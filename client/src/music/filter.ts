import type { TagDimension, Track } from '@ttrpgapp/shared';
import { TAG_DIMENSIONS } from '@ttrpgapp/shared';

export interface Filter {
  dims: Record<TagDimension, Set<string>>;
  minIntensity: number;
  search: string;
}

export const EMPTY_FILTER: Filter = {
  dims: { theme: new Set(), mood: new Set(), landscape: new Set() },
  minIntensity: 0,
  search: '',
};

export function matches(track: Track, f: Filter): boolean {
  for (const dim of TAG_DIMENSIONS) {
    const wanted = f.dims[dim];
    if (wanted.size > 0 && !track.tags[dim].some((t) => wanted.has(t))) return false;
  }
  if (f.minIntensity > 0 && (track.intensity ?? 0) < f.minIntensity) return false;
  if (f.search) {
    const q = f.search.toLowerCase();
    if (!track.title.toLowerCase().includes(q) && !(track.artist ?? '').toLowerCase().includes(q))
      return false;
  }
  return true;
}
