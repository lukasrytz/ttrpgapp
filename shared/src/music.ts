/** Tag dimensions for music tracks. The vocabulary per dimension is user-extensible. */
export const TAG_DIMENSIONS = ['theme', 'mood', 'landscape'] as const;
export type TagDimension = (typeof TAG_DIMENSIONS)[number];

/** Seeded tag suggestions; users extend the vocabulary by tagging tracks with new values. */
export const DEFAULT_TAG_VOCAB: Record<TagDimension, string[]> = {
  theme: ['battle', 'social', 'exploration'],
  mood: ['epic', 'joyful', 'tense', 'creepy', 'peaceful', 'sad'],
  landscape: ['wilderness', 'roads', 'urban'],
};

export interface Track {
  id: number;
  /** Path relative to its music folder root */
  path: string;
  folder: string;
  title: string;
  artist: string | null;
  durationSec: number | null;
  /** 1-5, null = untagged */
  intensity: number | null;
  /** dimension -> tag values */
  tags: Record<TagDimension, string[]>;
}

export interface TrackFilter {
  theme?: string[];
  mood?: string[];
  landscape?: string[];
  minIntensity?: number;
  maxIntensity?: number;
  search?: string;
}

/**
 * A directory holding audio (music or SFX), offered for inclusion in the library. Device
 * libraries mix TTRPG music with everything else, so the user picks which
 * folders count. Also used for SFX folders.
 */
export interface MusicFolder {
  /** Grouping key: the track's containing directory. */
  path: string;
  /** Last path segment, for display. */
  label: string;
  trackCount: number;
  enabled: boolean;
}

export interface MusicScanResult {
  added: number;
  removed: number;
  total: number;
}

/**
 * Device-independent track identity. Tags are keyed by this signature rather
 * than a file path, so they survive the different paths each device uses (the
 * desktop's `folder`+relative `path` vs. Android MediaStore URIs) and match
 * across copies of the same audio file. Derived only from data available on
 * every platform: the file's base name (no directory, no extension) plus its
 * duration rounded to the whole second. Duration disambiguates same-named
 * tracks; rounding absorbs minor re-encode drift. Unknown duration collapses to
 * 0 so both sides still agree.
 */
export function trackSignature(pathOrName: string, durationSec: number | null): string {
  const base = (pathOrName.split(/[\\/]/).pop() ?? pathOrName)
    .replace(/\.[^.]+$/, '')
    .trim()
    .toLowerCase();
  const dur = durationSec != null && durationSec > 0 ? Math.round(durationSec) : 0;
  return `${base}|${dur}`;
}

/** One track's portable tags, as stored in the synced catalog keyed by signature. */
export interface TrackTagEntry {
  intensity: number | null;
  tags: Record<TagDimension, string[]>;
}

/** The synced music-tag catalog: signature -> tags. Seeded on desktop, synced to devices. */
export type MusicTagCatalog = Record<string, TrackTagEntry>;
