import { Capacitor, registerPlugin } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import type {
  ClientConfig,
  MusicScanResult,
  Note,
  NoteMeta,
  TagDimension,
  Track,
} from '@ttrpgapp/shared';
import {
  extractLinks,
  renderTemplate,
  sanitizeNoteName,
  STARTER_TEMPLATE,
  TAG_DIMENSIONS,
} from '@ttrpgapp/shared';
import type { Backend, TrackUpdate } from './types';

interface DeviceTrack {
  path: string;
  title: string;
  artist: string | null;
  durationSec: number;
}

interface MusicLibraryPlugin {
  list(): Promise<{ tracks: DeviceTrack[] }>;
}

const MusicLibrary = registerPlugin<MusicLibraryPlugin>('MusicLibrary');

type TagStore = Record<string, { intensity: number | null; tags: Record<TagDimension, string[]> }>;

/** App-scoped external storage: user-visible under Android/data, no permission needed. */
const VAULT_DIR = Directory.External;
const DATA_DIR = Directory.Data;
const VAULT_BASE = 'vault';
const TAGS_FILE = 'music-tags.json';
const PATHS_FILE = 'music-paths.json';

// Sync bookkeeping (Preferences).
const SYNC_STATE_INDEX = 'sync.state.index'; // id -> updatedAt for plugin state docs
const SYNC_META = 'sync.meta';
const SYNC_TOMB = 'sync.tombstones';

async function prefGet<T>(key: string, fallback: T): Promise<T> {
  const { value } = await Preferences.get({ key });
  return value ? (JSON.parse(value) as T) : fallback;
}
async function prefSet(key: string, value: unknown): Promise<void> {
  await Preferences.set({ key, value: JSON.stringify(value) });
}

function emptyTags(): Record<TagDimension, string[]> {
  return { theme: [], mood: [], landscape: [] };
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    const res = await Filesystem.readFile({ path: file, directory: DATA_DIR, encoding: Encoding.UTF8 });
    return JSON.parse(res.data as string) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await Filesystem.writeFile({
    path: file,
    directory: DATA_DIR,
    encoding: Encoding.UTF8,
    data: JSON.stringify(value),
  });
}

export class CapacitorBackend implements Backend {
  /** id -> device path for the most recent listTracks() result. */
  private idToPath = new Map<number, string>();

  async getConfig(): Promise<ClientConfig> {
    // No config file on device; every compiled-in plugin is enabled.
    const { availableClientPlugins } = await import('../plugins');
    return {
      plugins: availableClientPlugins.map((p) => ({ id: p.id, name: p.name, enabled: true })),
    };
  }

  async listTracks(): Promise<Track[]> {
    const [{ tracks }, tagStore] = await Promise.all([
      MusicLibrary.list(),
      readJson<TagStore>(TAGS_FILE, {}),
    ]);
    this.idToPath.clear();
    return tracks.map((t, i) => {
      const id = i + 1;
      this.idToPath.set(id, t.path);
      const saved = tagStore[t.path];
      return {
        id,
        path: t.path,
        folder: '',
        title: t.title,
        artist: t.artist,
        durationSec: t.durationSec || null,
        intensity: saved?.intensity ?? null,
        tags: saved ? { ...emptyTags(), ...saved.tags } : emptyTags(),
      };
    });
  }

  async scanMusic(): Promise<MusicScanResult> {
    const known = new Set(await readJson<string[]>(PATHS_FILE, []));
    const tracks = await this.listTracks();
    const current = tracks.map((t) => t.path);
    const currentSet = new Set(current);
    const added = current.filter((p) => !known.has(p)).length;
    const removed = [...known].filter((p) => !currentSet.has(p)).length;
    await writeJson(PATHS_FILE, current);
    return { added, removed, total: current.length };
  }

  async updateTrack(id: number, update: TrackUpdate): Promise<void> {
    const path = this.idToPath.get(id);
    if (!path) throw new Error(`unknown track id ${id}`);
    const store = await readJson<TagStore>(TAGS_FILE, {});
    const entry = store[path] ?? { intensity: null, tags: emptyTags() };
    if (update.intensity !== undefined) entry.intensity = update.intensity;
    if (update.tags) {
      for (const dim of TAG_DIMENSIONS) {
        const values = update.tags[dim];
        if (!values) continue;
        entry.tags[dim] = [...new Set(values.map((v) => v.trim().toLowerCase()).filter(Boolean))];
      }
    }
    store[path] = entry;
    await writeJson(TAGS_FILE, store);
  }

  trackUrl(track: Track): string {
    return Capacitor.convertFileSrc(track.path);
  }

  // --- notes ---

  private async ensureVault(): Promise<void> {
    try {
      await Filesystem.stat({ path: `${VAULT_BASE}/template.md`, directory: VAULT_DIR });
    } catch {
      await Filesystem.writeFile({
        path: `${VAULT_BASE}/template.md`,
        directory: VAULT_DIR,
        encoding: Encoding.UTF8,
        data: STARTER_TEMPLATE,
        recursive: true,
      });
    }
    try {
      await Filesystem.stat({ path: `${VAULT_BASE}/sessions`, directory: VAULT_DIR });
    } catch {
      await Filesystem.mkdir({ path: `${VAULT_BASE}/sessions`, directory: VAULT_DIR, recursive: true });
    }
  }

  private async walkNotes(rel: string): Promise<NoteMeta[]> {
    const out: NoteMeta[] = [];
    const res = await Filesystem.readdir({ path: `${VAULT_BASE}/${rel}`.replace(/\/$/, ''), directory: VAULT_DIR });
    for (const f of res.files) {
      const child = rel ? `${rel}/${f.name}` : f.name;
      if (f.type === 'directory') {
        out.push(...(await this.walkNotes(child)));
      } else if (f.name.endsWith('.md')) {
        out.push({
          path: child,
          title: f.name.replace(/\.md$/, ''),
          isSession: child.startsWith('sessions/'),
          modifiedAt: f.mtime ?? 0,
        });
      }
    }
    return out;
  }

  async listNotes(): Promise<NoteMeta[]> {
    await this.ensureVault();
    const notes = await this.walkNotes('');
    return notes.sort((a, b) => a.path.localeCompare(b.path));
  }

  private async readRaw(path: string): Promise<string> {
    const res = await Filesystem.readFile({
      path: `${VAULT_BASE}/${path}`,
      directory: VAULT_DIR,
      encoding: Encoding.UTF8,
    });
    return res.data as string;
  }

  async readNote(path: string): Promise<Note> {
    const notes = await this.listNotes();
    const meta = notes.find((n) => n.path === path);
    const content = await this.readRaw(path);
    const myTitle = path.split('/').pop()!.replace(/\.md$/, '').toLowerCase();
    const backlinks: string[] = [];
    for (const other of notes) {
      if (other.path === path) continue;
      const otherContent = await this.readRaw(other.path);
      if (extractLinks(otherContent).some((l) => l.toLowerCase() === myTitle)) {
        backlinks.push(other.path);
      }
    }
    return {
      path,
      title: myTitle && meta ? meta.title : path.replace(/\.md$/, ''),
      isSession: meta?.isSession ?? path.startsWith('sessions/'),
      modifiedAt: meta?.modifiedAt ?? 0,
      content,
      links: extractLinks(content),
      backlinks,
    };
  }

  async writeNote(path: string, content: string): Promise<void> {
    await Filesystem.writeFile({
      path: `${VAULT_BASE}/${path}`,
      directory: VAULT_DIR,
      encoding: Encoding.UTF8,
      data: content,
      recursive: true,
    });
  }

  async deleteNote(path: string): Promise<void> {
    await this.deleteNoteRaw(path);
    // Record a tombstone so the deletion propagates to other devices.
    const tomb = await this.getTombstones();
    tomb[`notes/${path}`] = Date.now();
    await this.setTombstones(tomb);
  }

  /** Delete without recording a tombstone (used when sync applies a remote delete). */
  async deleteNoteRaw(path: string): Promise<void> {
    await Filesystem.deleteFile({ path: `${VAULT_BASE}/${path}`, directory: VAULT_DIR });
  }

  private async exists(path: string): Promise<boolean> {
    try {
      await Filesystem.stat({ path: `${VAULT_BASE}/${path}`, directory: VAULT_DIR });
      return true;
    } catch {
      return false;
    }
  }

  async createNote(title: string): Promise<{ path: string }> {
    await this.ensureVault();
    const name = sanitizeNoteName(title);
    if (!name) throw new Error('bad title');
    const rel = `${name}.md`;
    if (await this.exists(rel)) throw new Error('exists');
    await this.writeNote(rel, `# ${name}\n\n`);
    return { path: rel };
  }

  async createSession(title: string): Promise<{ path: string }> {
    await this.ensureVault();
    const name = sanitizeNoteName(title);
    if (!name) throw new Error('bad title');
    const rel = `sessions/${name}.md`;
    if (await this.exists(rel)) throw new Error('exists');
    const template = await this.readRaw('template.md');
    await this.writeNote(rel, renderTemplate(template, name));
    return { path: rel };
  }

  // --- plugin KV ---

  async kvGet(pluginId: string, key: string): Promise<string | null> {
    const res = await Preferences.get({ key: `${pluginId}:${key}` });
    return res.value;
  }

  async kvSet(pluginId: string, key: string, value: string): Promise<void> {
    await this.setStateRaw(pluginId, key, value, Date.now());
  }

  // --- sync support (used by CapacitorSyncStore; not part of the Backend interface) ---

  /** Write plugin state with an explicit updatedAt (sync uses the remote's stamp). */
  async setStateRaw(pluginId: string, key: string, value: string, updatedAt: number): Promise<void> {
    await Preferences.set({ key: `${pluginId}:${key}`, value });
    const idx = await prefGet<Record<string, number>>(SYNC_STATE_INDEX, {});
    idx[`state/${pluginId}/${key}`] = updatedAt;
    await prefSet(SYNC_STATE_INDEX, idx);
  }

  /** Enumerate plugin-state docs with their content and updatedAt. */
  async listStateDocs(): Promise<{ id: string; value: string; updatedAt: number }[]> {
    const idx = await prefGet<Record<string, number>>(SYNC_STATE_INDEX, {});
    const out: { id: string; value: string; updatedAt: number }[] = [];
    for (const [id, updatedAt] of Object.entries(idx)) {
      const [, pluginId, ...rest] = id.split('/');
      const { value } = await Preferences.get({ key: `${pluginId}:${rest.join('/')}` });
      if (value != null) out.push({ id, value, updatedAt });
    }
    return out;
  }

  async deleteStateRaw(id: string): Promise<void> {
    const [, pluginId, ...rest] = id.split('/');
    await Preferences.remove({ key: `${pluginId}:${rest.join('/')}` });
    const idx = await prefGet<Record<string, number>>(SYNC_STATE_INDEX, {});
    delete idx[id];
    await prefSet(SYNC_STATE_INDEX, idx);
  }

  getSyncMeta() {
    return prefGet<Record<string, { lastSyncedHash: string; lastSyncedAt: number }>>(SYNC_META, {});
  }
  setSyncMeta(meta: Record<string, { lastSyncedHash: string; lastSyncedAt: number }>) {
    return prefSet(SYNC_META, meta);
  }
  getTombstones() {
    return prefGet<Record<string, number>>(SYNC_TOMB, {});
  }
  setTombstones(t: Record<string, number>) {
    return prefSet(SYNC_TOMB, t);
  }
}
