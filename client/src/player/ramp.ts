export interface RampHandle {
  cancel(): void;
}

export function rampValue(
  from: number,
  to: number,
  ms: number,
  onStep: (v: number) => void,
  now: () => number = () => performance.now(),
  schedule: (fn: () => void, ms: number) => unknown = (fn, d) => setInterval(fn, d),
  unschedule: (handle: unknown) => void = (h) => clearInterval(h as ReturnType<typeof setInterval>),
): RampHandle {
  if (ms <= 0) {
    onStep(to);
    return { cancel: () => {} };
  }

  const startTime = now();
  onStep(from);

  let timer: unknown = null;
  let cancelled = false;

  const tick = () => {
    if (cancelled) return;
    const elapsed = now() - startTime;
    const progress = Math.min(1, elapsed / ms);
    const current = from + (to - from) * progress;
    onStep(current);
    if (progress >= 1 && timer !== null) {
      unschedule(timer);
    }
  };

  timer = schedule(tick, 16);

  return {
    cancel: () => {
      cancelled = true;
      if (timer !== null) unschedule(timer);
    },
  };
}
