import fs from 'node:fs';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { Database } from 'better-sqlite3';
import { parseFile } from 'music-metadata';
import type { AppConfig, MusicScanResult, SfxClip } from '@ttrpgapp/shared';
import { resolvePath } from './config.js';
import { walk, sendFileRange } from './audio.js';

export async function scanSfx(db: Database, config: AppConfig): Promise<MusicScanResult> {
  const known = new Map<string, number>(); // "folder\0path" -> id
  for (const row of db.prepare('SELECT id, folder, path FROM sfx').all() as {
    id: number;
    folder: string;
    path: string;
  }[]) {
    known.set(`${row.folder}\0${row.path}`, row.id);
  }

  const seen = new Set<string>();
  let added = 0;
  const insert = db.prepare(
    'INSERT INTO sfx (folder, path, name, duration_sec) VALUES (?, ?, ?, ?)',
  );

  for (const folder of config.sfxFolders) {
    const root = resolvePath(folder);
    if (!fs.existsSync(root)) continue;
    for (const abs of walk(root)) {
      const rel = path.relative(root, abs);
      const key = `${folder}\0${rel}`;
      seen.add(key);
      if (known.has(key)) continue;
      const name = path.basename(rel, path.extname(rel));
      let duration: number | null = null;
      try {
        const meta = await parseFile(abs, { duration: true });
        duration = meta.format.duration ?? null;
      } catch {
        // unreadable metadata is fine
      }
      insert.run(folder, rel, name, duration);
      added++;
    }
  }

  let removed = 0;
  const del = db.prepare('DELETE FROM sfx WHERE id = ?');
  for (const [key, id] of known) {
    if (!seen.has(key)) {
      del.run(id);
      removed++;
    }
  }

  const total = (db.prepare('SELECT COUNT(*) AS c FROM sfx').get() as { c: number }).c;
  return { added, removed, total };
}

export function listSfxClips(db: Database): SfxClip[] {
  const rows = db
    .prepare('SELECT id, folder, path, name, duration_sec FROM sfx ORDER BY name')
    .all() as {
    id: number;
    folder: string;
    path: string;
    name: string;
    duration_sec: number | null;
  }[];
  return rows.map((r) => ({
    id: r.id,
    folder: r.folder,
    path: r.path,
    name: r.name,
    durationSec: r.duration_sec,
  }));
}

export function registerSfxRoutes(app: FastifyInstance, db: Database, config: AppConfig) {
  app.get('/api/sfx/clips', () => ({ clips: listSfxClips(db) }));

  app.post('/api/sfx/scan', async () => scanSfx(db, config));

  app.get<{ Params: { id: string } }>('/api/sfx/stream/:id', (req, reply) => {
    const id = Number(req.params.id);
    const clip = db.prepare('SELECT folder, path FROM sfx WHERE id = ?').get(id) as
      | { folder: string; path: string }
      | undefined;
    if (!clip) return reply.code(404).send({ error: 'not found' });
    const abs = path.join(resolvePath(clip.folder), clip.path);
    return sendFileRange(req, reply, abs);
  });
}
