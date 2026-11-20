import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getCounter, initCounters, modifyCounter } from '../src/deck/counterStore';
import { setBackend, type Backend } from '../src/backend';

const mockKv: Record<string, string> = {};
const fakeBackend = {
  kvGet: (ns: string, key: string) => Promise.resolve(mockKv[`${ns}:${key}`] ?? null),
  kvSet: (ns: string, key: string, val: string) => {
    mockKv[`${ns}:${key}`] = val;
    return Promise.resolve();
  },
} as unknown as Backend;

const originalWindow = (globalThis as unknown as { window?: unknown }).window;

beforeEach(() => {
  for (const k of Object.keys(mockKv)) delete mockKv[k];
  setBackend(fakeBackend);
});

afterEach(() => {
  if (originalWindow === undefined) {
    delete (globalThis as unknown as { window?: unknown }).window;
  } else {
    (globalThis as unknown as { window?: unknown }).window = originalWindow;
  }
});

describe('counterStore', () => {
  it('returns 0 for uninitialized counters', () => {
    expect(getCounter('unknown-counter')).toBe(0);
  });

  it('increments counters and respects max bounds', () => {
    expect(modifyCounter('spell-slot-1', 1, 4)).toBe(1);
    expect(getCounter('spell-slot-1')).toBe(1);

    modifyCounter('spell-slot-1', 5, 4); // exceeds max 4 -> clamped to 4
    expect(getCounter('spell-slot-1')).toBe(4);
  });

  it('decrements counters and clamps to minimum 0', () => {
    modifyCounter('hp-loss', 2);
    expect(getCounter('hp-loss')).toBe(2);

    modifyCounter('hp-loss', -5); // below 0 -> clamped to 0
    expect(getCounter('hp-loss')).toBe(0);
  });

  it('resets counter on delta: 0', () => {
    modifyCounter('clock-1', 3, 6);
    expect(getCounter('clock-1')).toBe(3);

    modifyCounter('clock-1', 0, 6);
    expect(getCounter('clock-1')).toBe(0);
  });

  it('dispatches ttrpg-counters-changed custom DOM event', () => {
    let fired = false;
    const listeners: Record<string, (e: Event) => void> = {};

    // Mock window event target for node test environment if needed
    (globalThis as unknown as { window: unknown }).window = {
      dispatchEvent: (e: { type: string }) => {
        if (listeners[e.type]) listeners[e.type]!(e as unknown as Event);
        return true;
      },
      addEventListener: (type: string, fn: (e: Event) => void) => {
        listeners[type] = fn;
      },
      removeEventListener: (type: string) => {
        delete listeners[type];
      },
    };

    window.addEventListener('ttrpg-counters-changed', () => {
      fired = true;
    });

    modifyCounter('event-test', 1);
    expect(fired).toBe(true);
  });

  it('initCounters hydrates from backend and modifyCounter emits ttrpg-local-changed', async () => {
    const events: string[] = [];
    (globalThis as unknown as { window: unknown }).window = {
      dispatchEvent: (e: { type: string }) => {
        events.push(e.type);
        return true;
      },
      addEventListener: () => {},
      removeEventListener: () => {},
    };

    mockKv['deck:counters'] = JSON.stringify({ tension: 4 });
    const loaded = await initCounters();
    expect(loaded).toEqual({ tension: 4 });
    expect(getCounter('tension')).toBe(4);
    expect(events).toContain('ttrpg-counters-changed');

    events.length = 0;
    modifyCounter('tension', 1, 6);
    expect(getCounter('tension')).toBe(5);
    await new Promise((r) => setTimeout(r, 0));
    expect(mockKv['deck:counters']).toBe(JSON.stringify({ tension: 5 }));
    expect(events).toEqual(['ttrpg-counters-changed', 'ttrpg-local-changed']);
  });
});
