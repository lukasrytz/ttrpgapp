import { backend } from '../backend';

const DECK_NS = 'deck';
const COUNTERS_KEY = 'counters';

let countersCache: Record<string, number> = {};
let loaded = false;

export async function initCounters(): Promise<Record<string, number>> {
  try {
    const raw = await backend().kvGet(DECK_NS, COUNTERS_KEY);
    if (raw) {
      countersCache = JSON.parse(raw) as Record<string, number>;
    } else {
      countersCache = {};
    }
  } catch {
    countersCache = {};
  }
  loaded = true;
  return { ...countersCache };
}

export function getCounter(id: string): number {
  return countersCache[id] ?? 0;
}

export function modifyCounter(id: string, delta: number, max?: number): number {
  const current = countersCache[id] ?? 0;
  let next: number;

  if (delta === 0) {
    next = 0;
  } else {
    next = current + delta;
  }

  if (next < 0) next = 0;
  if (max !== undefined && next > max) next = max;

  countersCache[id] = next;

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('ttrpg-counters-changed'));
  }

  void backend().kvSet(DECK_NS, COUNTERS_KEY, JSON.stringify(countersCache));

  return next;
}
