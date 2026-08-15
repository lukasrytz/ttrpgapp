import { describe, expect, it, vi } from 'vitest';
import type { DeckAction, SfxClip, Track } from '@ttrpgapp/shared';
import { trackSignature } from '@ttrpgapp/shared';
import { runDeckAction, type DeckActionDeps } from '../src/deck/actions';
import type { PlayerApi } from '../src/player/PlayerProvider';
import type { SfxApi } from '../src/player/SfxProvider';

describe('runDeckAction', () => {
  const testTrack: Track = {
    id: 1,
    path: 'battle/War.mp3',
    folder: './music',
    title: 'War',
    artist: null,
    durationSec: 120,
    intensity: 4,
    tags: { theme: ['battle'], mood: ['epic'], landscape: [] },
  };

  const testClip: SfxClip = {
    id: 10,
    path: 'sfx/Thunder.wav',
    folder: './sfx',
    name: 'Thunder',
    durationSec: 3,
  };

  const trackSig = trackSignature(testTrack.path, testTrack.durationSec);
  const clipSig = trackSignature(testClip.path, testClip.durationSec);

  function createMockDeps() {
    const playQueue = vi.fn();
    const playTrack = vi.fn();
    const fire = vi.fn();
    const toggleLoop = vi.fn();
    const startLoop = vi.fn();
    const stopLoop = vi.fn();
    const navigate = vi.fn();

    const player = { playQueue, playTrack } as unknown as PlayerApi;
    const sfx = { fire, toggleLoop, startLoop, stopLoop, activeLoops: [] } as unknown as SfxApi;

    const deps: DeckActionDeps = {
      tracks: [testTrack],
      clips: [testClip],
      player,
      sfx,
      navigate,
    };

    return { deps, playQueue, playTrack, fire, toggleLoop, startLoop, stopLoop, navigate };
  }

  it('runs musicFilter action', () => {
    const { deps, playQueue } = createMockDeps();
    const action: DeckAction = {
      kind: 'musicFilter',
      filter: { dims: { theme: ['battle'] }, minIntensity: 0, search: '' },
    };
    runDeckAction(action, deps);
    expect(playQueue).toHaveBeenCalledTimes(1);
    expect(playQueue.mock.calls[0]![0][0]).toEqual(testTrack);
  });

  it('runs musicTrack action', () => {
    const { deps, playTrack } = createMockDeps();
    const action: DeckAction = { kind: 'musicTrack', sig: trackSig, title: 'War' };
    runDeckAction(action, deps);
    expect(playTrack).toHaveBeenCalledWith(testTrack);
  });

  it('runs sfxOneShot action', () => {
    const { deps, fire } = createMockDeps();
    const action: DeckAction = { kind: 'sfxOneShot', sig: clipSig, name: 'Thunder', volume: 0.8 };
    runDeckAction(action, deps);
    expect(fire).toHaveBeenCalledWith(testClip, 0.8);
  });

  /**
   * showToast dispatches on `window`; there is no jsdom here, so stand up a bare
   * EventTarget to observe what the user would actually be told.
   */
  function captureToasts() {
    const messages: string[] = [];
    const target = new EventTarget();
    const previous = (globalThis as Record<string, unknown>)['window'];
    (globalThis as Record<string, unknown>)['window'] = target;
    target.addEventListener('ttrpg-toast', (e) => {
      messages.push((e as CustomEvent<{ message: string }>).detail.message);
    });
    return {
      messages,
      restore: () => {
        (globalThis as Record<string, unknown>)['window'] = previous;
      },
    };
  }

  it('reports what a toggled loop actually did, not the stale pre-toggle state', () => {
    const { deps, toggleLoop } = createMockDeps();
    // The provider's `activeLoops` is React state and has not re-rendered yet, so
    // it still says the loop is running while the toggle has just stopped it.
    (deps.sfx as { activeLoops: string[] }).activeLoops = [clipSig];
    toggleLoop.mockReturnValue(false);

    const toasts = captureToasts();
    try {
      runDeckAction(
        { kind: 'sfxLoop', sig: clipSig, name: 'Thunder', volume: 0.5, mode: 'toggle' },
        deps,
      );
    } finally {
      toasts.restore();
    }

    expect(toasts.messages).toEqual(['Stopped Thunder']);
  });

  it('runs sfxLoop action with all modes', () => {
    const { deps, toggleLoop, startLoop, stopLoop } = createMockDeps();

    runDeckAction(
      { kind: 'sfxLoop', sig: clipSig, name: 'Thunder', volume: 0.5, mode: 'toggle' },
      deps,
    );
    expect(toggleLoop).toHaveBeenCalledWith(testClip, 0.5);

    runDeckAction(
      { kind: 'sfxLoop', sig: clipSig, name: 'Thunder', volume: 0.5, mode: 'start' },
      deps,
    );
    expect(startLoop).toHaveBeenCalledWith(testClip, 0.5);

    runDeckAction(
      { kind: 'sfxLoop', sig: clipSig, name: 'Thunder', volume: 0.5, mode: 'stop' },
      deps,
    );
    expect(stopLoop).toHaveBeenCalledWith(clipSig);
  });

  it('runs navigate and openNote actions', () => {
    const { deps, navigate } = createMockDeps();

    runDeckAction({ kind: 'navigate', to: '/music' }, deps);
    expect(navigate).toHaveBeenCalledWith('/music');

    runDeckAction({ kind: 'openNote', path: 'sessions/1.md' }, deps);
    expect(navigate).toHaveBeenCalledWith('/notes?path=sessions%2F1.md');
  });

  it('runs macros with non-navigate actions first and single navigate action last', () => {
    const { deps, startLoop, playQueue, navigate } = createMockDeps();
    const order: string[] = [];

    startLoop.mockImplementation(() => order.push('sfx'));
    playQueue.mockImplementation(() => order.push('music'));
    navigate.mockImplementation(() => order.push('nav'));

    const action: DeckAction = {
      kind: 'macro',
      actions: [
        { kind: 'navigate', to: '/tracker' }, // navigate placed first in array
        { kind: 'sfxLoop', sig: clipSig, name: 'Thunder', volume: 1, mode: 'start' },
        { kind: 'musicFilter', filter: { dims: { theme: ['battle'] }, minIntensity: 0, search: '' } },
      ],
    };

    runDeckAction(action, deps);
    // Nav must execute last
    expect(order).toEqual(['sfx', 'music', 'nav']);
  });

  it('runs pluginAction when plugin and action exist', async () => {
    const { deps } = createMockDeps();
    const runtimeMock = {
      kvGet: vi.fn().mockResolvedValue(null),
      kvSet: vi.fn().mockResolvedValue(undefined),
      searchCompendium: vi.fn(),
      getCompendiumEntry: vi.fn(),
      openCompendiumEntry: vi.fn(),
    };

    const previousWindow = (globalThis as Record<string, unknown>)['window'];
    const fakeWindow = { __ttrpgappRuntime: runtimeMock };
    (globalThis as Record<string, unknown>)['window'] = fakeWindow;

    try {
      runDeckAction(
        { kind: 'pluginAction', pluginId: 'dnd5e', actionId: 'nextTurn', label: 'Next Turn' },
        deps,
      );
      expect(runtimeMock.kvGet).toHaveBeenCalledWith('dnd5e', 'encounter');
    } finally {
      (globalThis as Record<string, unknown>)['window'] = previousWindow;
    }
  });

  it('degrades gracefully with a toast when plugin or action is unknown', () => {
    const { deps } = createMockDeps();
    const toasts = captureToasts();

    try {
      runDeckAction(
        { kind: 'pluginAction', pluginId: 'unknownPlugin', actionId: 'doSomething', label: 'Custom Action' },
        deps,
      );
    } finally {
      toasts.restore();
    }

    expect(toasts.messages).toEqual(['Custom Action unavailable']);
  });
});
