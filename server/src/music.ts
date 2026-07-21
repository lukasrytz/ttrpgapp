import fs from 'node:fs';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { Database } from 'better-sqlite3';
import { parseFile } from 'music-metadata';
import type { AppConfig, MusicScanResult, TagDimension, Track } from '@ttrpgapp/shared';
import { TAG_DIMENSIONS } from '@ttrpgapp/shared';
import { resolvePath } from './config.js';

const AUDIO_EXTS = new Set(['.mp3', '.ogg', '.oga', '.opus', '.flac', '.m4a', '.aac', '.wav', '.webm']);

const MIME: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.wav': 'audio/wav',
  '.webm': 'audio/webm',
};

function* walk(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else if (entry.isFile() && AUDIO_EXTS.has(path.extname(entry.name).toLowerCase())) yield p;
  }
}

export async function scan(db: Database, config: AppConfig): Promise<MusicScanResult> {
  const known = new Map<string, number>(); // "folder\0path" -> id
  for (const row of db.prepare('SELECT id, folder, path FROM tracks').all() as {
    id: number;
    folder: string;
    path: string;
  }[]) {
    known.set(`${row.folder}\0${row.path}`, row.id);
  }

  const seen = new Set<string>();
  let added = 0;
  const insert = db.prepare(
    'INSERT INTO tracks (folder, path, title, artist, duration_sec) VALUES (?, ?, ?, ?, ?)',
  );

  for (const folder of config.musicFolders) {
    const root = resolvePath(folder);
    if (!fs.existsSync(root)) continue;
    for (const abs of walk(root)) {
      const rel = path.relative(root, abs);
      const key = `${folder}\0${rel}`;
      seen.add(key);
      if (known.has(key)) continue;
      let title = path.basename(rel, path.extname(rel));
      let artist: string | null = null;
      let duration: number | null = null;
      try {
        const meta = await parseFile(abs, { duration: true });
        if (meta.common.title) title = meta.common.title;
        artist = meta.common.artist ?? null;
        duration = meta.format.duration ?? null;
      } catch {
        // unreadable metadata is fine; keep filename as title
      }
      insert.run(folder, rel, title, artist, duration);
      added++;
    }
  }

  let removed = 0;
  const del = db.prepare('DELETE FROM tracks WHERE id = ?');
  for (const [key, id] of known) {
    if (!seen.has(key)) {
      del.run(id);
      removed++;
    }
  }

  const total = (db.prepare('SELECT COUNT(*) AS c FROM tracks').get() as { c: number }).c;
  return { added, removed, total };
}

function listTracks(db: Database): Track[] {
  const rows = db
    .prepare('SELECT id, folder, path, title, artist, duration_sec, intensity FROM tracks ORDER BY title')
    .all() as {
    id: number;
    folder: string;
    path: string;
    title: string;
    artist: string | null;
    duration_sec: number | null;
    intensity: number | null;
  }[];
  const tagRows = db.prepare('SELECT track_id, dimension, value FROM track_tags').all() as {
    track_id: number;
    dimension: TagDimension;
    value: string;
  }[];
  const tagsById = new Map<number, Record<TagDimension, string[]>>();
  for (const t of tagRows) {
    let tags = tagsById.get(t.track_id);
    if (!tags) {
      tags = { theme: [], mood: [], landscape: [] };
      tagsById.set(t.track_id, tags);
    }
    tags[t.dimension]?.push(t.value);
  }
  return rows.map((r) => ({
    id: r.id,
    folder: r.folder,
    path: r.path,
    title: r.title,
    artist: r.artist,
    durationSec: r.duration_sec,
    intensity: r.intensity,
    tags: tagsById.get(r.id) ?? { theme: [], mood: [], landscape: [] },
  }));
}

interface UpdateTrackBody {
  intensity?: number | null;
  tags?: Partial<Record<TagDimension, string[]>>;
}

export function registerMusicRoutes(app: FastifyInstance, db: Database, config: AppConfig) {
  app.get('/api/music/tracks', () => ({ tracks: listTracks(db) }));

  app.post('/api/music/scan', async () => scan(db, config));

  app.patch<{ Params: { id: string }; Body: UpdateTrackBody }>(
    '/api/music/tracks/:id',
    (req, reply) => {
      const id = Number(req.params.id);
      const track = db.prepare('SELECT id FROM tracks WHERE id = ?').get(id);
      if (!track) return reply.code(404).send({ error: 'not found' });
      const { intensity, tags } = req.body ?? {};
      const tx = db.transaction(() => {
        if (intensity !== undefined) {
          db.prepare('UPDATE tracks SET intensity = ? WHERE id = ?').run(intensity, id);
        }
        if (tags) {
          for (const dim of TAG_DIMENSIONS) {
            const values = tags[dim];
            if (!values) continue;
            db.prepare('DELETE FROM track_tags WHERE track_id = ? AND dimension = ?').run(id, dim);
            const ins = db.prepare(
              'INSERT OR IGNORE INTO track_tags (track_id, dimension, value) VALUES (?, ?, ?)',
            );
            for (const v of values) {
              const clean = v.trim().toLowerCase();
              if (clean) ins.run(id, dim, clean);
            }
          }
        }
      });
      tx();
      return { ok: true };
    },
  );

  app.get<{ Params: { id: string } }>('/api/music/stream/:id', (req, reply) => {
    const id = Number(req.params.id);
    const track = db.prepare('SELECT folder, path FROM tracks WHERE id = ?').get(id) as
      | { folder: string; path: string }
      | undefined;
    if (!track) return reply.code(404).send({ error: 'not found' });
    const abs = path.join(resolvePath(track.folder), track.path);
    if (!fs.existsSync(abs)) return reply.code(404).send({ error: 'file missing' });

    const stat = fs.statSync(abs);
    const type = MIME[path.extname(abs).toLowerCase()] ?? 'application/octet-stream';
    reply.header('Accept-Ranges', 'bytes');
    reply.header('Content-Type', type);

    const range = req.headers.range;
    const m = range ? /^bytes=(\d*)-(\d*)$/.exec(range) : null;
    if (m && (m[1] || m[2])) {
      const start = m[1] ? Number(m[1]) : Math.max(0, stat.size - Number(m[2]));
      const end = m[1] && m[2] ? Math.min(Number(m[2]), stat.size - 1) : stat.size - 1;
      if (start >= stat.size || start > end) {
        return reply.code(416).header('Content-Range', `bytes */${stat.size}`).send();
      }
      reply.code(206);
      reply.header('Content-Range', `bytes ${start}-${end}/${stat.size}`);
      reply.header('Content-Length', end - start + 1);
      return reply.send(fs.createReadStream(abs, { start, end }));
    }
    reply.header('Content-Length', stat.size);
    return reply.send(fs.createReadStream(abs));
  });
}
