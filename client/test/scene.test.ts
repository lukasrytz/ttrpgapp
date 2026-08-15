import { describe, expect, it } from 'vitest';
import {
  migrateScenes,
  planTransition,
  type Scene,
} from '@ttrpgapp/shared';

describe('planTransition', () => {
  const tavern: Scene = {
    id: 'tavern',
    name: 'Tavern',
    icon: '🍺',
    color: 'amber',
    music: { dims: { theme: ['social'] }, minIntensity: 1, search: '' },
    ambience: [
      { sig: 'crowd|10', name: 'Crowd Murmur', volume: 0.8 },
      { sig: 'fire|5', name: 'Fireplace', volume: 0.5 },
    ],
    noteSection: { path: 'sessions/1.md', heading: 'The Tavern' },
    haScene: 'scene.tavern_warm',
  };

  const road: Scene = {
    id: 'road',
    name: 'The Road',
    icon: '🌲',
    color: 'forest',
    music: { dims: { theme: ['travel'] }, minIntensity: 1, search: '' },
    ambience: [
      { sig: 'wind|10', name: 'Gentle Wind', volume: 0.6 },
      { sig: 'fire|5', name: 'Campfire', volume: 0.5 }, // shared loop with tavern!
    ],
    noteSection: { path: 'sessions/1.md', heading: 'The Road' },
  };

  it('enters scene from null (starts loops and sets music)', () => {
    const t = planTransition(null, tavern);
    expect(t.stopLoops).toEqual([]);
    expect(t.startLoops).toEqual([
      { sig: 'crowd|10', volume: 0.8 },
      { sig: 'fire|5', volume: 0.5 },
    ]);
    expect(t.music).toEqual(tavern.music);
    expect(t.openNote).toEqual(tavern.noteSection);
    expect(t.haScene).toBe('scene.tavern_warm');
  });

  it('swaps scenes stopping only unique loops from previous scene and starting unique loops for next scene', () => {
    const t = planTransition(tavern, road);
    // fire|5 is in both tavern and road, so only crowd|10 must stop
    expect(t.stopLoops).toEqual(['crowd|10']);
    // only wind|10 must start
    expect(t.startLoops).toEqual([{ sig: 'wind|10', volume: 0.6 }]);
    expect(t.music).toEqual(road.music);
    expect(t.openNote).toEqual(road.noteSection);
    expect(t.haScene).toBeUndefined();
  });

  it('re-entering the same scene is idempotent (no loop restarts)', () => {
    const t = planTransition(tavern, tavern);
    expect(t.stopLoops).toEqual([]);
    expect(t.startLoops).toEqual([]);
    expect(t.music).toEqual(tavern.music);
    expect(t.openNote).toEqual(tavern.noteSection);
  });

  it('exiting to null stops all loops and clears targets', () => {
    const t = planTransition(tavern, null);
    expect(t.stopLoops).toEqual(['crowd|10', 'fire|5']);
    expect(t.startLoops).toEqual([]);
    expect(t.music).toBeUndefined();
    expect(t.openNote).toBeUndefined();
  });

  it('transitions from null to null cleanly', () => {
    const t = planTransition(null, null);
    expect(t.stopLoops).toEqual([]);
    expect(t.startLoops).toEqual([]);
  });
});

describe('migrateScenes', () => {
  it('returns default empty library for null/invalid input', () => {
    expect(migrateScenes(null)).toEqual({ version: 1, scenes: [] });
    expect(migrateScenes('invalid')).toEqual({ version: 1, scenes: [] });
  });

  it('drops malformed scenes and preserves valid ones', () => {
    const raw = {
      scenes: [
        {
          id: 's1',
          name: 'Valid Scene',
          icon: '🎭',
          color: 'indigo',
          ambience: [{ sig: 'rain|5', name: 'Rain', volume: 0.7 }],
        },
        { id: 123 }, // missing name & invalid types -> dropped
        'not-an-object',
      ],
    };

    const res = migrateScenes(raw);
    expect(res.scenes.length).toBe(1);
    expect(res.scenes[0]!.id).toBe('s1');
    expect(res.scenes[0]!.name).toBe('Valid Scene');
    expect(res.scenes[0]!.ambience).toEqual([{ sig: 'rain|5', name: 'Rain', volume: 0.7 }]);
  });
});
