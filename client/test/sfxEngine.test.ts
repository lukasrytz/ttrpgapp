import { describe, expect, it, vi } from 'vitest';
import { SfxEngine } from '../src/player/sfx';

class FakeAudioElement {
  src = '';
  volume = 1;
  loop = false;
  paused = true;
  onended: (() => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;

  play() {
    this.paused = false;
    return Promise.resolve();
  }

  pause() {
    this.paused = true;
  }
}

describe('SfxEngine', () => {
  it('fires onOneShotActiveChange on 0->1 and 1->0 transitions', () => {
    const created: FakeAudioElement[] = [];
    const createAudio = () => {
      const el = new FakeAudioElement() as unknown as HTMLAudioElement;
      created.push(el as unknown as FakeAudioElement);
      return el;
    };

    let clock = 0;
    const callbacks: Array<() => void> = [];
    const schedule = (fn: () => void) => {
      callbacks.push(fn);
      return callbacks.length;
    };

    const engine = new SfxEngine(createAudio, () => clock, schedule, () => {});
    const activeStates: boolean[] = [];
    engine.onOneShotActiveChange = (active) => activeStates.push(active);

    engine.playOneShot('shot1.mp3', 0.8);
    expect(activeStates).toEqual([true]);
    expect(created.length).toBe(1);

    engine.playOneShot('shot2.mp3', 1.0);
    // Already active (1 -> 2), so onOneShotActiveChange is NOT fired again
    expect(activeStates).toEqual([true]);
    expect(created.length).toBe(2);

    // End shot 1
    created[0]!.onended?.();
    expect(activeStates).toEqual([true]);

    // End shot 2 -> transitions to 0
    created[1]!.onended?.();
    expect(activeStates).toEqual([true, false]);
  });

  it('manages loop start, volume updates, active loops list, and stop', () => {
    const created: FakeAudioElement[] = [];
    const createAudio = () => {
      const el = new FakeAudioElement() as unknown as HTMLAudioElement;
      created.push(el as unknown as FakeAudioElement);
      return el;
    };

    let clock = 0;
    const engine = new SfxEngine(
      createAudio,
      () => clock,
      () => 1,
      () => {},
    );

    engine.startLoop('rain|10', 'rain.ogg', 0.5);
    expect(engine.activeLoops()).toEqual(['rain|10']);
    expect(created.length).toBe(1);
    expect(created[0]!.loop).toBe(true);

    engine.setLoopVolume('rain|10', 0.8);
    expect(created[0]!.volume).toBe(0.8);

    engine.stopLoop('rain|10', 0); // immediate stop
    expect(engine.activeLoops()).toEqual([]);
    expect(created[0]!.paused).toBe(true);
  });

  it('stops all active loops and one-shots on stopAll', () => {
    const created: FakeAudioElement[] = [];
    const createAudio = () => {
      const el = new FakeAudioElement() as unknown as HTMLAudioElement;
      created.push(el as unknown as FakeAudioElement);
      return el;
    };

    const engine = new SfxEngine(createAudio);
    const activeStates: boolean[] = [];
    engine.onOneShotActiveChange = (active) => activeStates.push(active);

    engine.playOneShot('thunder.mp3', 1.0);
    engine.startLoop('wind|5', 'wind.ogg', 0.5);

    expect(activeStates).toEqual([true]);
    expect(engine.activeLoops()).toEqual(['wind|5']);

    engine.stopAll();
    expect(engine.activeLoops()).toEqual([]);
    expect(activeStates).toEqual([true, false]);
  });
});
