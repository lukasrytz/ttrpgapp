import { Capacitor, CapacitorHttp, registerPlugin } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import type {
  ClientConfig,
  MusicFolder,
  MusicScanResult,
  MusicTagCatalog,
  Note,
  NoteMeta,
  SfxClip,
  TagDimension,
  Track,
  TrackTagEntry,
} from '@ttrpgapp/shared';
import {
  extractLinks,
  renderTemplate,
  sanitizeNoteName,
  STARTER_TEMPLATE,
  TAG_DIMENSIONS,
  trackSignature,
} from '@ttrpgapp/shared';
import {
  filterByFolders,
  foldersOf,
  getFolderSelection,
  getSfxFolders,
  setFolderSelection,
  setSfxFolders,
} from '../music/folders';
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

/** Legacy on-device tag store, keyed by device path (pre-signature). Migrated on read. */
type LegacyTagStore = Record<string, TrackTagEntry>;

/** App-scoped external storage: user-visible under Android/data, no permission needed. */
const VAULT_DIR = Directory.External;
const DATA_DIR = Directory.Data;
const VAULT_BASE = 'vault';
const TAGS_FILE = 'music-tags.json';
const PATHS_FILE = 'music-paths.json';
const SFX_PATHS_FILE = 'sfx-paths.json';

// Music tags live as a synced plugin-state doc `state/music/tags` (Preferences
// key `music:tags`), keyed by device-independent trackSignature so they carry
// across devices via Drive sync. `music` is a synthetic plugin id for storage.
const MUSIC_NS = 'music';
const MUSIC_KEY = 'tags';

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

/** Announce a local change so the sync loop pushes it (no-op without a DOM, e.g. tests). */
function notifyLocalChanged(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('ttrpg-local-changed'));
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

function normalizeHaUrl(url: string): string {
  let u = url.trim();
  if (!/^https?:\/\//i.test(u)) {
    u = `http://${u}`;
  }
  return u.replace(/\/+$/, '');
}

function normalizeHaToken(token: string): string {
  let t = token.trim();
  if (t.toLowerCase().startsWith('bearer ')) {
    t = t.slice(7).trim();
  }
  return t;
}

export class CapacitorBackend implements Backend {
  /** id -> device path for the most recent listTracks() result. */
  private idToPath = new Map<number, string>();
  /** id -> device-independent signature (the tag catalog key) for the same result. */
  private idToSig = new Map<number, string>();

  async getConfig(): Promise<ClientConfig> {
    // No config file on device; every compiled-in plugin is enabled.
    const { availableClientPlugins } = await import('../plugins');
    return {
      plugins: availableClientPlugins.map((p) => ({ id: p.id, name: p.name, enabled: true })),
    };
  }

  /**
   * The signature-keyed music tag catalog (synced). On first read it migrates
   * any legacy path-keyed `music-tags.json`, mapping each device path to its
   * signature using the current track list (which carries durations).
   */
  private async readCatalog(): Promise<MusicTagCatalog> {
    const raw = (await Preferences.get({ key: `${MUSIC_NS}:${MUSIC_KEY}` })).value;
    return raw != null ? (JSON.parse(raw) as MusicTagCatalog) : {};
  }

  private async loadCatalog(deviceTracks: DeviceTrack[]): Promise<MusicTagCatalog> {
    const raw = (await Preferences.get({ key: `${MUSIC_NS}:${MUSIC_KEY}` })).value;
    if (raw != null) return JSON.parse(raw) as MusicTagCatalog;

    // No synced catalog yet — migrate the legacy path-keyed file if present.
    const legacy = await readJson<LegacyTagStore>(TAGS_FILE, {});
    const catalog: MusicTagCatalog = {};
    if (Object.keys(legacy).length > 0) {
      for (const t of deviceTracks) {
        const entry = legacy[t.path];
        if (entry) catalog[trackSignature(t.path, t.durationSec || null)] = entry;
      }
      await this.saveCatalog(catalog); // persist + register for sync
    }
    return catalog;
  }

  private async saveCatalog(catalog: MusicTagCatalog): Promise<void> {
    await this.setStateRaw(MUSIC_NS, MUSIC_KEY, JSON.stringify(catalog), Date.now());
  }

  /**
   * Everything MediaStore knows about, before folder selection. Ids are
   * assigned over this full list so they stay stable as the selection changes.
   */
  private async listDeviceTracks(): Promise<Track[]> {
    const { tracks } = await MusicLibrary.list();
    const catalog = await this.loadCatalog(tracks);
    this.idToPath.clear();
    this.idToSig.clear();
    return tracks.map((t, i) => {
      const id = i + 1;
      const sig = trackSignature(t.path, t.durationSec || null);
      this.idToPath.set(id, t.path);
      this.idToSig.set(id, sig);
      const saved = catalog[sig];
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

  async listTracks(): Promise<Track[]> {
    const [tracks, selection] = await Promise.all([
      this.listDeviceTracks(),
      getFolderSelection(),
    ]);
    return filterByFolders(tracks, selection);
  }

  async listMusicFolders(): Promise<MusicFolder[]> {
    const [tracks, selection] = await Promise.all([
      this.listDeviceTracks(),
      getFolderSelection(),
    ]);
    return foldersOf(tracks, selection);
  }

  async setMusicFolders(paths: string[] | null): Promise<void> {
    await setFolderSelection(paths);
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
    const sig = this.idToSig.get(id);
    if (!sig) throw new Error(`unknown track id ${id}`);
    const catalog = await this.readCatalog();
    const entry = catalog[sig] ?? { intensity: null, tags: emptyTags() };
    if (update.intensity !== undefined) entry.intensity = update.intensity;
    if (update.tags) {
      for (const dim of TAG_DIMENSIONS) {
        const values = update.tags[dim];
        if (!values) continue;
        entry.tags[dim] = [...new Set(values.map((v) => v.trim().toLowerCase()).filter(Boolean))];
      }
    }
    catalog[sig] = entry;
    await this.saveCatalog(catalog);
    // Nudge the sync loop so tag edits propagate to other devices.
    notifyLocalChanged();
  }

  trackUrl(track: Track): string {
    return Capacitor.convertFileSrc(track.path);
  }

  private async listDeviceSfx(): Promise<SfxClip[]> {
    const { tracks } = await MusicLibrary.list();
    return tracks.map((t, i) => {
      const id = i + 1;
      const stem = (t.path.split(/[\\/]/).pop() ?? t.path).replace(/\.[^.]+$/, '').trim();
      return {
        id,
        path: t.path,
        folder: '',
        name: stem || t.title,
        durationSec: t.durationSec || null,
      };
    });
  }

  async listSfx(): Promise<SfxClip[]> {
    const [clips, selection] = await Promise.all([
      this.listDeviceSfx(),
      getSfxFolders(),
    ]);
    return filterByFolders(clips, selection);
  }

  async listSfxFolders(): Promise<MusicFolder[]> {
    const [clips, selection] = await Promise.all([
      this.listDeviceSfx(),
      getSfxFolders(),
    ]);
    return foldersOf(clips, selection);
  }

  async setSfxFolders(paths: string[]): Promise<void> {
    await setSfxFolders(paths);
  }

  async scanSfx(): Promise<MusicScanResult> {
    const known = new Set(await readJson<string[]>(SFX_PATHS_FILE, []));
    const clips = await this.listSfx();
    const current = clips.map((c) => c.path);
    const currentSet = new Set(current);
    const added = current.filter((p) => !known.has(p)).length;
    const removed = [...known].filter((p) => !currentSet.has(p)).length;
    await writeJson(SFX_PATHS_FILE, current);
    return { added, removed, total: current.length };
  }

  sfxUrl(clip: SfxClip): string {
    return Capacitor.convertFileSrc(clip.path);
  }

  /**
   * Merge a catalog exported from the desktop (`npm run export-tags`) into the
   * synced store. Additive per signature: an imported dimension replaces that
   * dimension, dimensions it omits are kept, and imported intensity wins when
   * present. Registers for sync so the tags propagate to other devices.
   * Returns the number of catalog entries touched.
   */
  async importMusicTags(incoming: MusicTagCatalog): Promise<number> {
    const catalog = await this.readCatalog();
    let touched = 0;
    for (const [sig, entry] of Object.entries(incoming)) {
      const cur = catalog[sig] ?? { intensity: null, tags: emptyTags() };
      if (entry.intensity != null) cur.intensity = entry.intensity;
      for (const dim of TAG_DIMENSIONS) {
        const vals = entry.tags?.[dim];
        if (vals && vals.length) {
          cur.tags[dim] = [...new Set(vals.map((v) => v.trim().toLowerCase()).filter(Boolean))];
        }
      }
      catalog[sig] = cur;
      touched++;
    }
    await this.saveCatalog(catalog);
    notifyLocalChanged();
    return touched;
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
        const parts = child.split('/');
        let isSession = false;
        let campaign: string | undefined = undefined;

        if (parts.length > 1) {
          if (parts[0] === 'sessions') {
            isSession = true;
          } else {
            campaign = parts[0];
            if (parts[1] === 'sessions') {
              isSession = true;
            }
          }
        }

        out.push({
          path: child,
          title: f.name.replace(/\.md$/, ''),
          isSession,
          campaign,
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
      campaign: meta?.campaign,
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

  async createNote(title: string, campaign?: string): Promise<{ path: string }> {
    await this.ensureVault();
    const name = sanitizeNoteName(title);
    if (!name) throw new Error('bad title');
    const cname = campaign ? sanitizeNoteName(campaign) : undefined;
    const rel = cname ? `${cname}/${name}.md` : `${name}.md`;
    if (await this.exists(rel)) throw new Error('exists');
    await this.writeNote(rel, `# ${name}\n\n`);
    return { path: rel };
  }

  async createSession(title: string, campaign?: string): Promise<{ path: string }> {
    await this.ensureVault();
    const name = sanitizeNoteName(title);
    if (!name) throw new Error('bad title');
    const cname = campaign ? sanitizeNoteName(campaign) : undefined;
    const rel = cname ? `${cname}/sessions/${name}.md` : `sessions/${name}.md`;
    if (await this.exists(rel)) throw new Error('exists');
    
    let templatePath = cname ? `${cname}/template.md` : 'template.md';
    if (!(await this.exists(templatePath))) {
      templatePath = 'template.md';
    }
    const template = await this.readRaw(templatePath);
    await this.writeNote(rel, renderTemplate(template, name));
    return { path: rel };
  }

  async createCampaign(name: string): Promise<void> {
    await this.ensureVault();
    const cname = sanitizeNoteName(name);
    if (!cname) throw new Error('bad name');
    const rel = `${cname}/template.md`;
    if (await this.exists(rel)) throw new Error('exists');
    
    // Ensure sessions directory exists
    await Filesystem.mkdir({ path: `${VAULT_BASE}/${cname}/sessions`, directory: VAULT_DIR, recursive: true });
    
    const globalTemplate = await this.readRaw('template.md');
    await this.writeNote(rel, globalTemplate);
  }

  async deleteCampaign(name: string): Promise<void> {
    const cname = sanitizeNoteName(name);
    if (!cname) throw new Error('bad name');
    await Filesystem.rmdir({ path: `${VAULT_BASE}/${cname}`, directory: VAULT_DIR, recursive: true });
  }

  async renameNote(path: string, newPath: string): Promise<{ path: string }> {
    await Filesystem.rename({ from: `${VAULT_BASE}/${path}`, to: `${VAULT_BASE}/${newPath}`, directory: VAULT_DIR });
    return { path: newPath };
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

  async triggerHaScene(sceneId: string, transitionSec?: number, fxScript?: string): Promise<void> {
    const raw = await this.kvGet('settings', 'ha');
    if (!raw) throw new Error('Home Assistant not configured');
    let config: { url?: string; token?: string } = {};
    try {
      config = JSON.parse(raw) as { url?: string; token?: string };
    } catch {
      throw new Error('Home Assistant settings invalid');
    }
    const { url, token } = config;
    if (!url || !token) throw new Error('Home Assistant URL or Token not configured');

    const cleanUrl = normalizeHaUrl(url);
    const cleanToken = normalizeHaToken(token);
    const endpoint = `${cleanUrl}/api/services/script/ttrpg_cue`;
    const payload = {
      scene_id: sceneId,
      fx_script: fxScript || 'none',
      transition_s: transitionSec ?? 2.5,
    };

    if (Capacitor.isNativePlatform()) {
      const res = await CapacitorHttp.post({
        url: endpoint,
        headers: {
          Authorization: `Bearer ${cleanToken}`,
          'Content-Type': 'application/json',
        },
        data: payload,
        connectTimeout: 3000,
        readTimeout: 3000,
      });
      if (res.status < 200 || res.status >= 300) {
        const text = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
        throw new Error(`HA returned ${res.status}: ${text}`);
      }
    } else {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cleanToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(2000),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HA returned ${res.status}: ${text}`);
      }
    }
  }

  async testHaConnection(urlInput?: string, tokenInput?: string): Promise<void> {
    let url = urlInput;
    let token = tokenInput;
    if (!url || !token) {
      const raw = await this.kvGet('settings', 'ha');
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as { url?: string; token?: string };
          url = url || parsed.url;
          token = token || parsed.token;
        } catch {
          // ignore
        }
      }
    }
    if (!url || !token) throw new Error('Home Assistant URL and Token required');

    const cleanUrl = normalizeHaUrl(url);
    const cleanToken = normalizeHaToken(token);
    const endpoint = `${cleanUrl}/api/`;

    if (Capacitor.isNativePlatform()) {
      try {
        const res = await CapacitorHttp.get({
          url: endpoint,
          headers: {
            Authorization: `Bearer ${cleanToken}`,
            'Content-Type': 'application/json',
          },
          connectTimeout: 4000,
          readTimeout: 4000,
        });

        if (res.status === 401) {
          throw new Error('Unauthorized (401): Please verify your Long-Lived Access Token');
        }
        if (res.status >= 200 && res.status < 300) {
          return;
        }
        // Fallback check to /api/states in case /api/ is restricted
        const fallback = await CapacitorHttp.get({
          url: `${cleanUrl}/api/states`,
          headers: {
            Authorization: `Bearer ${cleanToken}`,
            'Content-Type': 'application/json',
          },
          connectTimeout: 4000,
          readTimeout: 4000,
        });
        if (fallback.status >= 200 && fallback.status < 300) {
          return;
        }
        throw new Error(`Home Assistant returned status ${res.status || fallback.status}`);
      } catch (err: unknown) {
        if (err instanceof Error && err.message.startsWith('Unauthorized')) {
          throw err;
        }
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`Unable to reach Home Assistant at ${cleanUrl} (${msg})`);
      }
    } else {
      try {
        const res = await fetch(endpoint, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${cleanToken}`,
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(3000),
        });

        if (res.status === 401) {
          throw new Error('Unauthorized (401): Please verify your Long-Lived Access Token');
        }
        if (!res.ok) {
          const fallback = await fetch(`${cleanUrl}/api/states`, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${cleanToken}`,
              'Content-Type': 'application/json',
            },
            signal: AbortSignal.timeout(3000),
          });
          if (!fallback.ok) {
            throw new Error(`HA returned status ${res.status}`);
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.message.startsWith('Unauthorized')) {
          throw err;
        }
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`Unable to reach Home Assistant at ${cleanUrl} (${msg})`);
      }
    }
  }
}
