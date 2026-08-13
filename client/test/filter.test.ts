import { describe, expect, it } from 'vitest';
import type { Track } from '@ttrpgapp/shared';
import { EMPTY_FILTER, fromSerializable, matches, toSerializable, type Filter } from '../src/music/filter';

const track = (over: Partial<Track>): Track => ({
  id: 1,
  path: 'a.mp3',
  folder: './music',
  title: 'Drums of War',
  artist: 'Bard',
  durationSec: 120,
  intensity: 4,
  tags: { theme: ['battle'], mood: ['epic'], landscape: [] },
  ...over,
});

const filter = (over: Partial<Filter>): Filter => ({ ...EMPTY_FILTER, ...over });

describe('music filter', () => {
  it('matches everything with the empty filter', () => {
    expect(matches(track({}), EMPTY_FILTER)).toBe(true);
  });

  it('requires a selected tag in the same dimension', () => {
    const f = filter({ dims: { theme: new Set(['tavern']), mood: new Set(), landscape: new Set() } });
    expect(matches(track({}), f)).toBe(false);
    expect(matches(track({ tags: { theme: ['tavern'], mood: [], landscape: [] } }), f)).toBe(true);
  });

  it('treats multiple values in one dimension as OR', () => {
    const f = filter({
      dims: { theme: new Set(['tavern', 'battle']), mood: new Set(), landscape: new Set() },
    });
    expect(matches(track({}), f)).toBe(true);
  });

  it('filters by minimum intensity, excluding untagged tracks', () => {
    const f = filter({ minIntensity: 3 });
    expect(matches(track({}), f)).toBe(true);
    expect(matches(track({ intensity: 2 }), f)).toBe(false);
    expect(matches(track({ intensity: null }), f)).toBe(false);
  });

  it('searches title and artist case-insensitively', () => {
    expect(matches(track({}), filter({ search: 'drums' }))).toBe(true);
    expect(matches(track({}), filter({ search: 'bard' }))).toBe(true);
    expect(matches(track({}), filter({ search: 'lute' }))).toBe(false);
  });
});

describe('filter serialization', () => {
  it('round-trips a filter with tags, minIntensity, and unicode search', () => {
    const original: Filter = {
      dims: {
        theme: new Set(['battle', 'social']),
        mood: new Set(['epic']),
        landscape: new Set(),
      },
      minIntensity: 3,
      search: 'Höhle 🐉',
    };

    const serialized = toSerializable(original);
    expect(serialized).toEqual({
      dims: {
        theme: ['battle', 'social'],
        mood: ['epic'],
      },
      minIntensity: 3,
      search: 'Höhle 🐉',
    });

    const deserialized = fromSerializable(serialized);
    expect(deserialized.dims.theme).toEqual(new Set(['battle', 'social']));
    expect(deserialized.dims.mood).toEqual(new Set(['epic']));
    expect(deserialized.dims.landscape).toEqual(new Set());
    expect(deserialized.minIntensity).toBe(3);
    expect(deserialized.search).toBe('Höhle 🐉');
  });

  it('handles empty filter serialization', () => {
    const serialized = toSerializable(EMPTY_FILTER);
    expect(serialized).toEqual({
      dims: {},
      minIntensity: 0,
      search: '',
    });

    const deserialized = fromSerializable(serialized);
    expect(deserialized).toEqual(EMPTY_FILTER);
  });
});
