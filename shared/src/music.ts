/** Tag dimensions for music tracks. The vocabulary per dimension is user-extensible. */
export const TAG_DIMENSIONS = ['theme', 'mood', 'landscape'] as const;
export type TagDimension = (typeof TAG_DIMENSIONS)[number];

/** Seeded tag suggestions; users extend the vocabulary by tagging tracks with new values. */
export const DEFAULT_TAG_VOCAB: Record<TagDimension, string[]> = {
  theme: ['dungeon', 'tavern', 'city', 'wilderness', 'battle', 'ritual', 'court'],
  mood: ['peaceful', 'tense', 'mysterious', 'joyful', 'somber', 'epic', 'creepy'],
  landscape: ['forest', 'mountains', 'sea', 'desert', 'swamp', 'underground', 'arctic', 'plains'],
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
 * A directory holding audio, offered for inclusion in the library. Device
 * libraries mix TTRPG music with everything else, so the user picks which
 * folders count.
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
