import type { TagDimension } from './music.js';

export const DECK_SCHEMA_VERSION = 1;

export const DECK_COLORS = ['slate', 'amber', 'crimson', 'forest', 'indigo', 'plum'] as const;
export type DeckColor = (typeof DECK_COLORS)[number];

export const DECK_SIZES = ['1x1', '2x1'] as const;
export type DeckSize = (typeof DECK_SIZES)[number];

/** JSON-safe form of the music page's Filter, whose `dims` holds Sets. */
export interface SerializedFilter {
  dims: Partial<Record<TagDimension, string[]>>;
  minIntensity: number;
  search: string;
}

/** Everything a macro may contain. Split out so macros cannot nest — by construction, not
 *  by a runtime guard. */
export type LeafDeckAction =
  | { kind: 'musicFilter'; filter: SerializedFilter }
  | { kind: 'musicTrack'; sig: string; title: string }
  | { kind: 'sfxOneShot'; sig: string; name: string; volume: number }
  | { kind: 'sfxLoop'; sig: string; name: string; volume: number; mode: 'toggle' | 'start' | 'stop' }
  | { kind: 'navigate'; to: string }
  | { kind: 'openNote'; path: string }
  | { kind: 'openEntry'; packId: string; entryId: string }
  | { kind: 'counter'; counterId: string; name: string; max?: number; delta: number }
  | { kind: 'roll'; formula: string; label?: string };

export type DeckAction = LeafDeckAction | { kind: 'macro'; actions: LeafDeckAction[] };

export interface DeckButton {
  id: string;
  label: string;
  /** Emoji, matching the app's icon convention. */
  icon: string;
  color: DeckColor;
  size: DeckSize;
  action: DeckAction;
}

export interface DeckPage {
  id: string;
  name: string;
  buttons: DeckButton[];
}

export interface DeckLayout {
  version: number;
  pages: DeckPage[];
}

function isValidColor(c: unknown): c is DeckColor {
  return typeof c === 'string' && (DECK_COLORS as readonly string[]).includes(c);
}

function isValidSize(s: unknown): s is DeckSize {
  return typeof s === 'string' && (DECK_SIZES as readonly string[]).includes(s);
}

function migrateLeafAction(raw: unknown): LeafDeckAction | null {
  if (!raw || typeof raw !== 'object') return null;
  const a = raw as Record<string, unknown>;
  const kind = a['kind'];

  if (kind === 'musicFilter') {
    const f = a['filter'] as Record<string, unknown> | undefined;
    if (!f || typeof f !== 'object') return null;
    const dims = (f['dims'] && typeof f['dims'] === 'object' ? f['dims'] : {}) as Partial<
      Record<TagDimension, string[]>
    >;
    const minIntensity = typeof f['minIntensity'] === 'number' ? f['minIntensity'] : 0;
    const search = typeof f['search'] === 'string' ? f['search'] : '';
    return { kind: 'musicFilter', filter: { dims, minIntensity, search } };
  }

  if (kind === 'musicTrack') {
    if (typeof a['sig'] !== 'string' || typeof a['title'] !== 'string') return null;
    return { kind: 'musicTrack', sig: a['sig'], title: a['title'] };
  }

  if (kind === 'sfxOneShot') {
    if (typeof a['sig'] !== 'string' || typeof a['name'] !== 'string') return null;
    const volume = typeof a['volume'] === 'number' ? a['volume'] : 1;
    return { kind: 'sfxOneShot', sig: a['sig'], name: a['name'], volume };
  }

  if (kind === 'sfxLoop') {
    if (typeof a['sig'] !== 'string' || typeof a['name'] !== 'string') return null;
    const volume = typeof a['volume'] === 'number' ? a['volume'] : 1;
    const rawMode = a['mode'];
    const mode =
      rawMode === 'start' || rawMode === 'stop' || rawMode === 'toggle' ? rawMode : 'toggle';
    return { kind: 'sfxLoop', sig: a['sig'], name: a['name'], volume, mode };
  }

  if (kind === 'navigate') {
    if (typeof a['to'] !== 'string') return null;
    return { kind: 'navigate', to: a['to'] };
  }

  if (kind === 'openNote') {
    if (typeof a['path'] !== 'string') return null;
    return { kind: 'openNote', path: a['path'] };
  }

  if (kind === 'openEntry') {
    if (typeof a['packId'] !== 'string' || typeof a['entryId'] !== 'string') return null;
    return { kind: 'openEntry', packId: a['packId'], entryId: a['entryId'] };
  }

  if (kind === 'counter') {
    if (typeof a['counterId'] !== 'string' || typeof a['name'] !== 'string') return null;
    const max = typeof a['max'] === 'number' ? a['max'] : undefined;
    const delta = typeof a['delta'] === 'number' ? a['delta'] : 1;
    return { kind: 'counter', counterId: a['counterId'], name: a['name'], max, delta };
  }

  if (kind === 'roll') {
    if (typeof a['formula'] !== 'string') return null;
    const label = typeof a['label'] === 'string' ? a['label'] : undefined;
    return { kind: 'roll', formula: a['formula'], label };
  }

  return null;
}

function migrateAction(raw: unknown): DeckAction | null {
  if (!raw || typeof raw !== 'object') return null;
  const a = raw as Record<string, unknown>;
  if (a['kind'] === 'macro') {
    const rawActions = Array.isArray(a['actions']) ? a['actions'] : [];
    const actions: LeafDeckAction[] = [];
    for (const item of rawActions) {
      const leaf = migrateLeafAction(item);
      if (leaf) actions.push(leaf);
    }
    return { kind: 'macro', actions };
  }
  return migrateLeafAction(raw);
}

function migrateButton(raw: unknown): DeckButton | null {
  if (!raw || typeof raw !== 'object') return null;
  const b = raw as Record<string, unknown>;
  if (typeof b['id'] !== 'string') return null;
  const label = typeof b['label'] === 'string' ? b['label'] : '';
  const icon = typeof b['icon'] === 'string' ? b['icon'] : '🔘';
  const color = isValidColor(b['color']) ? b['color'] : 'slate';
  const size = isValidSize(b['size']) ? b['size'] : '1x1';
  const action = migrateAction(b['action']);
  if (!action) return null;
  return { id: b['id'], label, icon, color, size, action };
}

/** Tolerant load: never throws, drops malformed buttons, stamps the current version. */
export function migrateDeck(raw: unknown): DeckLayout {
  if (!raw || typeof raw !== 'object') {
    return { version: DECK_SCHEMA_VERSION, pages: [] };
  }
  const obj = raw as Record<string, unknown>;
  const rawPages = Array.isArray(obj['pages']) ? obj['pages'] : [];
  const pages: DeckPage[] = [];

  for (let i = 0; i < rawPages.length; i++) {
    const p = rawPages[i] as Record<string, unknown> | undefined;
    if (!p || typeof p !== 'object') continue;
    const id = typeof p['id'] === 'string' ? p['id'] : `page-${i + 1}`;
    const name = typeof p['name'] === 'string' ? p['name'] : `Page ${i + 1}`;
    const rawButtons = Array.isArray(p['buttons']) ? p['buttons'] : [];
    const buttons: DeckButton[] = [];
    for (const b of rawButtons) {
      const btn = migrateButton(b);
      if (btn) buttons.push(btn);
    }
    pages.push({ id, name, buttons });
  }

  return { version: DECK_SCHEMA_VERSION, pages };
}
