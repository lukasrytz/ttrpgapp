import type { Track } from '@ttrpgapp/shared';

export interface PlaybackSnapshot {
  track: Track;
  queue: Track[];
  queueIndex: number;
}

export const MAX_HISTORY = 20;

export function pushHistory(
  history: PlaybackSnapshot[],
  current: Track | null,
  queue: Track[],
  queueIndex: number,
): PlaybackSnapshot[] {
  if (!current) return history;
  const next = [...history, { track: current, queue: [...queue], queueIndex }];
  return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
}

export function popHistory(history: PlaybackSnapshot[]): {
  previous: PlaybackSnapshot | null;
  rest: PlaybackSnapshot[];
} {
  if (history.length === 0) return { previous: null, rest: history };
  const previous = history[history.length - 1] ?? null;
  return { previous, rest: history.slice(0, -1) };
}
