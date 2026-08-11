import { rampValue, type RampHandle } from './ramp';

interface LoopEntry {
  audio: HTMLAudioElement;
  volume: number;
  rampHandle?: RampHandle;
  fadingOut?: boolean;
}

export class SfxEngine {
  private masterVolume = 1;
  private idleOneShots: HTMLAudioElement[] = [];
  private activeOneShots = new Set<HTMLAudioElement>();
  private loops = new Map<string, LoopEntry>();

  public onOneShotActiveChange: ((active: boolean) => void) | null = null;

  constructor(
    private createAudio: () => HTMLAudioElement = () => new Audio(),
    private now: () => number = () => performance.now(),
    private schedule: (fn: () => void, ms: number) => unknown = (fn, d) => setInterval(fn, d),
    private unschedule: (handle: unknown) => void = (h) => clearInterval(h as ReturnType<typeof setInterval>),
  ) {}

  setMasterVolume(v: number): void {
    this.masterVolume = Math.max(0, Math.min(1, v));
    for (const entry of this.loops.values()) {
      if (!entry.fadingOut) {
        entry.audio.volume = Math.max(0, Math.min(1, entry.volume * this.masterVolume));
      }
    }
  }

  playOneShot(url: string, volume: number): void {
    const audio = this.idleOneShots.pop() ?? this.createAudio();
    audio.loop = false;
    audio.src = url;
    audio.volume = Math.max(0, Math.min(1, volume * this.masterVolume));

    const cleanup = () => {
      audio.onended = null;
      audio.onerror = null;
      try {
        audio.pause();
      } catch {
        // ignore
      }
      this.activeOneShots.delete(audio);
      this.idleOneShots.push(audio);
      if (this.activeOneShots.size === 0) {
        this.onOneShotActiveChange?.(false);
      }
    };

    audio.onended = cleanup;
    audio.onerror = cleanup;

    const wasEmpty = this.activeOneShots.size === 0;
    this.activeOneShots.add(audio);

    if (wasEmpty) {
      this.onOneShotActiveChange?.(true);
    }

    const p = audio.play();
    if (p && typeof p.catch === 'function') {
      p.catch(() => {
        cleanup();
      });
    }
  }

  startLoop(key: string, url: string, volume: number): void {
    const existing = this.loops.get(key);
    if (existing) {
      if (existing.audio.src === url || existing.audio.src.endsWith(url)) {
        existing.volume = volume;
        if (existing.fadingOut) {
          existing.fadingOut = false;
          existing.rampHandle?.cancel();
        }
        existing.rampHandle = rampValue(
          existing.audio.volume,
          volume * this.masterVolume,
          400,
          (v) => {
            existing.audio.volume = Math.max(0, Math.min(1, v));
          },
          this.now,
          this.schedule,
          this.unschedule,
        );
        return;
      }
      this.stopLoop(key, 0);
    }

    const audio = this.createAudio();
    audio.loop = true;
    audio.src = url;
    audio.volume = 0;

    const entry: LoopEntry = { audio, volume, fadingOut: false };
    entry.rampHandle = rampValue(
      0,
      volume * this.masterVolume,
      800,
      (v) => {
        audio.volume = Math.max(0, Math.min(1, v));
      },
      this.now,
      this.schedule,
      this.unschedule,
    );

    this.loops.set(key, entry);
    const p = audio.play();
    if (p && typeof p.catch === 'function') {
      p.catch(() => {});
    }
  }

  setLoopVolume(key: string, volume: number): void {
    const entry = this.loops.get(key);
    if (!entry) return;
    entry.volume = volume;
    if (!entry.fadingOut) {
      entry.audio.volume = Math.max(0, Math.min(1, volume * this.masterVolume));
    }
  }

  stopLoop(key: string, fadeSec = 1.5): void {
    const entry = this.loops.get(key);
    if (!entry) return;

    entry.rampHandle?.cancel();

    const cleanup = () => {
      try {
        entry.audio.pause();
      } catch {
        // ignore
      }
      entry.audio.src = '';
      this.loops.delete(key);
    };

    if (fadeSec <= 0) {
      cleanup();
      return;
    }

    entry.fadingOut = true;
    const startVol = entry.audio.volume;
    const ms = fadeSec * 1000;

    const startTime = this.now();

    entry.rampHandle = rampValue(
      startVol,
      0,
      ms,
      (v) => {
        entry.audio.volume = Math.max(0, Math.min(1, v));
        if (this.now() - startTime >= ms) {
          cleanup();
        }
      },
      this.now,
      this.schedule,
      this.unschedule,
    );
  }

  stopAll(): void {
    for (const audio of Array.from(this.activeOneShots)) {
      audio.onended = null;
      audio.onerror = null;
      try {
        audio.pause();
      } catch {
        // ignore
      }
      this.idleOneShots.push(audio);
    }
    const hadActiveOneShots = this.activeOneShots.size > 0;
    this.activeOneShots.clear();

    for (const [key] of Array.from(this.loops.entries())) {
      this.stopLoop(key, 0);
    }

    if (hadActiveOneShots) {
      this.onOneShotActiveChange?.(false);
    }
  }

  activeLoops(): string[] {
    return Array.from(this.loops.keys());
  }
}
