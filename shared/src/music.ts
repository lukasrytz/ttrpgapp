/** Tag dimensions for music tracks. The vocabulary per dimension is user-extensible. */
export const TAG_DIMENSIONS = ['theme', 'mood', 'landscape'] as const;
export type TagDimension = (typeof TAG_DIMENSIONS)[number];

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

export interface MusicScanResult {
  added: number;
  removed: number;
  total: number;
}
