import type { SerializedFilter, TagDimension, Track } from '@ttrpgapp/shared';
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

export function toSerializable(f: Filter): SerializedFilter {
  const dims: Partial<Record<TagDimension, string[]>> = {};
  for (const dim of TAG_DIMENSIONS) {
    if (f.dims[dim] && f.dims[dim].size > 0) {
      dims[dim] = Array.from(f.dims[dim]);
    }
  }
  return {
    dims,
    minIntensity: f.minIntensity,
    search: f.search,
  };
}

export function fromSerializable(s: SerializedFilter): Filter {
  const dims: Record<TagDimension, Set<string>> = {
    theme: new Set(),
    mood: new Set(),
    landscape: new Set(),
  };
  if (s.dims) {
    for (const dim of TAG_DIMENSIONS) {
      const arr = s.dims[dim];
      if (Array.isArray(arr)) {
        dims[dim] = new Set(arr);
      }
    }
  }
  return {
    dims,
    minIntensity: typeof s.minIntensity === 'number' ? s.minIntensity : 0,
    search: typeof s.search === 'string' ? s.search : '',
  };
}
