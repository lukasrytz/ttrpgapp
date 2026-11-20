import { describe, expect, it } from 'vitest';
import type { Track } from '@ttrpgapp/shared';
import { MAX_HISTORY, popHistory, pushHistory, type PlaybackSnapshot } from '../src/player/history';

function makeTrack(id: number, title = `Track ${id}`): Track {
  return {
    id,
    path: `music/${title}.mp3`,
    folder: './music',
    title,
    artist: null,
    durationSec: 120,
    intensity: 3,
    tags: { theme: [], mood: [], landscape: [] },
  };
}

describe('player playback history', () => {
  it('pushes and pops snapshots in LIFO order with queue & queueIndex intact', () => {
    const t1 = makeTrack(1, 'Tavern');
    const t2 = makeTrack(2, 'Road');
    const t3 = makeTrack(3, 'Boss');

    let hist: PlaybackSnapshot[] = [];
    hist = pushHistory(hist, null, [], -1);
    expect(hist).toEqual([]);

    hist = pushHistory(hist, t1, [t1, t2], 0);
    hist = pushHistory(hist, t2, [t1, t2], 1);
    hist = pushHistory(hist, t3, [t3], 0);

    const p1 = popHistory(hist);
    expect(p1.previous).toEqual({ track: t3, queue: [t3], queueIndex: 0 });

    const p2 = popHistory(p1.rest);
    expect(p2.previous).toEqual({ track: t2, queue: [t1, t2], queueIndex: 1 });

    const p3 = popHistory(p2.rest);
    expect(p3.previous).toEqual({ track: t1, queue: [t1, t2], queueIndex: 0 });

    const empty = popHistory(p3.rest);
    expect(empty.previous).toBeNull();
    expect(empty.rest).toEqual([]);
  });

  it('caps history length at MAX_HISTORY', () => {
    let hist: PlaybackSnapshot[] = [];
    for (let i = 1; i <= MAX_HISTORY + 5; i++) {
      const t = makeTrack(i);
      hist = pushHistory(hist, t, [t], 0);
    }
    expect(hist.length).toBe(MAX_HISTORY);
    expect(hist[0]!.track.id).toBe(6);
    expect(hist[hist.length - 1]!.track.id).toBe(MAX_HISTORY + 5);
  });
});
