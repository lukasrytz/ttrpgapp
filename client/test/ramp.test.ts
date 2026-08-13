import { describe, expect, it } from 'vitest';
import { rampValue } from '../src/player/ramp';

describe('rampValue', () => {
  it('calls onStep with initial and target values as time advances', () => {
    let currentTime = 0;
    const steps: number[] = [];
    let scheduledFn: (() => void) | null = null;

    rampValue(
      0,
      1.0,
      100,
      (v) => steps.push(v),
      () => currentTime,
      (fn) => {
        scheduledFn = fn;
        return 1;
      },
      () => {
        scheduledFn = null;
      },
    );

    expect(steps).toEqual([0]);

    currentTime = 50;
    scheduledFn?.();
    expect(steps.length).toBe(2);
    expect(steps[1]).toBeCloseTo(0.5);

    currentTime = 100;
    scheduledFn?.();
    expect(steps.length).toBe(3);
    expect(steps[2]).toBeCloseTo(1.0);
    expect(scheduledFn).toBeNull(); // unscheduled on completion
  });

  it('can be cancelled early', () => {
    let currentTime = 0;
    const steps: number[] = [];
    let scheduledFn: (() => void) | null = null;

    const handle = rampValue(
      0,
      1.0,
      100,
      (v) => steps.push(v),
      () => currentTime,
      (fn) => {
        scheduledFn = fn;
        return 1;
      },
      () => {
        scheduledFn = null;
      },
    );

    handle.cancel();
    expect(scheduledFn).toBeNull();

    currentTime = 50;
    scheduledFn?.();
    expect(steps).toEqual([0]); // no further steps after cancel
  });
});
