import { DECK_COLORS, type DeckColor, type SerializedFilter } from './deck.js';
import type { TagDimension } from './music.js';

export const SCENE_SCHEMA_VERSION = 1;

export interface SceneAmbience {
  sig: string;
  name: string;
  volume: number;
}

export interface SceneNoteSection {
  path: string;
  heading: string;
}

export interface Scene {
  id: string;
  name: string;
  icon: string;
  color: DeckColor;
  /** Music to swing to on enter. */
  music?: SerializedFilter;
  /** Ambience loops this scene owns — started on enter, stopped on exit. */
  ambience: SceneAmbience[];
  /** Optional note section to open on enter. */
  noteSection?: SceneNoteSection;
  /** Home Assistant scene entity id. */
  haScene?: string;
}

export interface SceneLibrary {
  version: number;
  scenes: Scene[];
}

export interface SceneTransition {
  stopLoops: string[]; // signatures to stop (previous scene's ambience)
  startLoops: { sig: string; volume: number }[];
  music?: SerializedFilter;
  openNote?: SceneNoteSection;
  haScene?: string;
}

function isValidColor(c: unknown): c is DeckColor {
  return typeof c === 'string' && (DECK_COLORS as readonly string[]).includes(c);
}

function migrateAmbience(raw: unknown): SceneAmbience | null {
  if (!raw || typeof raw !== 'object') return null;
  const a = raw as Record<string, unknown>;
  if (typeof a['sig'] !== 'string' || typeof a['name'] !== 'string') return null;
  const volume = typeof a['volume'] === 'number' ? a['volume'] : 1;
  return { sig: a['sig'], name: a['name'], volume };
}

function migrateNoteSection(raw: unknown): SceneNoteSection | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const n = raw as Record<string, unknown>;
  if (typeof n['path'] !== 'string' || typeof n['heading'] !== 'string') return undefined;
  return { path: n['path'], heading: n['heading'] };
}

function migrateFilter(raw: unknown): SerializedFilter | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const f = raw as Record<string, unknown>;
  const dims = (f['dims'] && typeof f['dims'] === 'object' ? f['dims'] : {}) as Partial<
    Record<TagDimension, string[]>
  >;
  const minIntensity = typeof f['minIntensity'] === 'number' ? f['minIntensity'] : 0;
  const search = typeof f['search'] === 'string' ? f['search'] : '';
  return { dims, minIntensity, search };
}

function migrateScene(raw: unknown): Scene | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Record<string, unknown>;
  if (typeof s['id'] !== 'string' || typeof s['name'] !== 'string') return null;
  const icon = typeof s['icon'] === 'string' ? s['icon'] : '🎭';
  const color = isValidColor(s['color']) ? s['color'] : 'slate';
  const music = migrateFilter(s['music']);

  const rawAmbience = Array.isArray(s['ambience']) ? s['ambience'] : [];
  const ambience: SceneAmbience[] = [];
  for (const item of rawAmbience) {
    const a = migrateAmbience(item);
    if (a) ambience.push(a);
  }

  const noteSection = migrateNoteSection(s['noteSection']);
  const haScene = typeof s['haScene'] === 'string' ? s['haScene'] : undefined;

  return {
    id: s['id'],
    name: s['name'],
    icon,
    color,
    music,
    ambience,
    noteSection,
    haScene,
  };
}

/** Tolerant load, same contract as migrateDeck: never throws. */
export function migrateScenes(raw: unknown): SceneLibrary {
  if (!raw || typeof raw !== 'object') {
    return { version: SCENE_SCHEMA_VERSION, scenes: [] };
  }
  const obj = raw as Record<string, unknown>;
  const rawScenes = Array.isArray(obj['scenes']) ? obj['scenes'] : [];
  const scenes: Scene[] = [];

  for (const s of rawScenes) {
    const scene = migrateScene(s);
    if (scene) scenes.push(scene);
  }

  return { version: SCENE_SCHEMA_VERSION, scenes };
}

/** Pure: what entering `next` from `current` implies. Unit-tested. */
export function planTransition(current: Scene | null, next: Scene | null): SceneTransition {
  if (!current && !next) {
    return { stopLoops: [], startLoops: [] };
  }

  if (current && !next) {
    return {
      stopLoops: current.ambience.map((a) => a.sig),
      startLoops: [],
    };
  }

  if (!current && next) {
    return {
      stopLoops: [],
      startLoops: next.ambience.map((a) => ({ sig: a.sig, volume: a.volume })),
      music: next.music,
      openNote: next.noteSection,
      haScene: next.haScene,
    };
  }

  // Both current and next are non-null
  const curr = current!;
  const nxt = next!;

  if (curr.id === nxt.id) {
    // Re-entering same scene is idempotent: do not stop or restart loops
    return {
      stopLoops: [],
      startLoops: [],
      music: nxt.music,
      openNote: nxt.noteSection,
      haScene: nxt.haScene,
    };
  }

  const curSigs = new Set(curr.ambience.map((a) => a.sig));
  const nextSigs = new Set(nxt.ambience.map((a) => a.sig));

  // Stop loops that belong to current but are not in next
  const stopLoops = curr.ambience.filter((a) => !nextSigs.has(a.sig)).map((a) => a.sig);

  // Start loops that belong to next but were not in current
  const startLoops = nxt.ambience
    .filter((a) => !curSigs.has(a.sig))
    .map((a) => ({ sig: a.sig, volume: a.volume }));

  return {
    stopLoops,
    startLoops,
    music: nxt.music,
    openNote: nxt.noteSection,
    haScene: nxt.haScene,
  };
}
