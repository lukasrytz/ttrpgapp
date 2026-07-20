/**
 * Dual-deck audio engine: two <audio> elements crossfaded on track change and
 * near-end auto-advance.
 *
 * Preferred path routes each element through a Web Audio GainNode. In some
 * WebViews (notably Android with Capacitor.convertFileSrc URLs)
 * createMediaElementSource can fail or output silence, so the engine falls
 * back to ramping HTMLAudioElement.volume directly. Same public API either way.
 */
export const CROSSFADE_SEC = 3;

interface Deck {
  audio: HTMLAudioElement;
  gain: GainNode | null;
  /** Logical 0..1 level for the fallback path (multiplied by master volume). */
  level: number;
  /** Active fallback ramp, or null when not ramping. */
  ramp: { from: number; to: number; startMs: number; durMs: number } | null;
}

export class CrossfadeEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private decks: Deck[] = [];
  private active = 0;
  private useWebAudio = true;
  private volume = 1;
  private ramp: ReturnType<typeof setInterval> | null = null;

  onNearEnd: (() => void) | null = null;
  onEnded: (() => void) | null = null;
  onTimeUpdate: ((current: number, duration: number) => void) | null = null;
  private nearEndFired = false;

  private ensureDecks() {
    if (this.decks.length) return;

    try {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
    } catch {
      this.useWebAudio = false;
    }

    for (let i = 0; i < 2; i++) {
      const audio = new Audio();
      audio.preload = 'auto';
      let gain: GainNode | null = null;
      if (this.useWebAudio && this.ctx && this.master) {
        try {
          audio.crossOrigin = 'anonymous';
          const source = this.ctx.createMediaElementSource(audio);
          gain = this.ctx.createGain();
          gain.gain.value = 0;
          source.connect(gain);
          gain.connect(this.master);
        } catch {
          // Fall back to volume ramps for both decks to stay consistent.
          this.useWebAudio = false;
          gain = null;
        }
      }
      if (!this.useWebAudio) audio.volume = 0;

      const deckIndex = i;
      audio.addEventListener('timeupdate', () => {
        if (deckIndex !== this.active) return;
        const { currentTime, duration } = audio;
        this.onTimeUpdate?.(currentTime, duration || 0);
        if (
          !this.nearEndFired &&
          duration > 0 &&
          duration - currentTime <= CROSSFADE_SEC &&
          duration > CROSSFADE_SEC * 2
        ) {
          this.nearEndFired = true;
          this.onNearEnd?.();
        }
      });
      audio.addEventListener('ended', () => {
        if (deckIndex === this.active) this.onEnded?.();
      });
      this.decks.push({ audio, gain, level: 0, ramp: null });
    }
  }

  /** Play url on the idle deck, crossfading from the current one. */
  async play(url: string) {
    this.ensureDecks();
    if (this.ctx) await this.ctx.resume();

    const from = this.decks[this.active]!;
    const nextIndex = (this.active + 1) % 2;
    const to = this.decks[nextIndex]!;

    to.audio.src = url;
    to.audio.currentTime = 0;
    await to.audio.play();

    const fading = !from.audio.paused && from.audio.src !== '';
    const fade = fading ? CROSSFADE_SEC : 0.05;
    this.rampDeck(from, 0, fade);
    this.rampDeck(to, 1, fade);
    if (fading) {
      const old = from.audio;
      setTimeout(() => old.pause(), fade * 1000 + 100);
    }

    this.active = nextIndex;
    this.nearEndFired = false;
  }

  private rampDeck(deck: Deck, target: number, seconds: number) {
    if (this.useWebAudio && this.ctx && deck.gain) {
      const now = this.ctx.currentTime;
      deck.gain.gain.cancelScheduledValues(now);
      deck.gain.gain.setValueAtTime(deck.gain.gain.value, now);
      deck.gain.gain.linearRampToValueAtTime(target, now + seconds);
      deck.level = target;
      return;
    }
    // Fallback: animate level toward target and apply level * master volume.
    deck.ramp = { from: deck.level, to: target, startMs: performance.now(), durMs: seconds * 1000 };
    this.startRampLoop();
  }

  private startRampLoop() {
    if (this.ramp) return;
    this.ramp = setInterval(() => {
      const now = performance.now();
      let anyActive = false;
      for (const deck of this.decks) {
        if (!deck.ramp) continue;
        const p = Math.min(1, (now - deck.ramp.startMs) / Math.max(1, deck.ramp.durMs));
        deck.level = deck.ramp.from + (deck.ramp.to - deck.ramp.from) * p;
        deck.audio.volume = Math.max(0, Math.min(1, deck.level * this.volume));
        if (p >= 1) deck.ramp = null;
        else anyActive = true;
      }
      if (!anyActive && this.ramp) {
        clearInterval(this.ramp);
        this.ramp = null;
      }
    }, 50);
  }

  pause() {
    this.decks[this.active]?.audio.pause();
  }

  async resume() {
    this.ensureDecks();
    if (this.ctx) await this.ctx.resume();
    await this.decks[this.active]?.audio.play();
  }

  stop() {
    for (const d of this.decks) {
      d.audio.pause();
      d.level = 0;
      if (d.gain) d.gain.gain.value = 0;
      else d.audio.volume = 0;
    }
  }

  setVolume(v: number) {
    this.ensureDecks();
    this.volume = v;
    if (this.useWebAudio && this.master) {
      this.master.gain.value = v;
    } else {
      for (const d of this.decks) d.audio.volume = Math.max(0, Math.min(1, d.level * v));
    }
  }
}
