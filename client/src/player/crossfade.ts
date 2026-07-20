/**
 * Dual-deck audio engine: two <audio> elements routed through Web Audio gain
 * nodes. Starting a track on the idle deck while ramping gains gives smooth
 * crossfades, both on manual track changes and near-end auto-advance.
 */
export const CROSSFADE_SEC = 3;

interface Deck {
  audio: HTMLAudioElement;
  gain: GainNode;
}

export class CrossfadeEngine {
  private ctx: AudioContext | null = null;
  private decks: Deck[] = [];
  private active = 0;
  private master: GainNode | null = null;
  /** Fires when the playing deck's time enters the crossfade window at track end. */
  onNearEnd: (() => void) | null = null;
  onEnded: (() => void) | null = null;
  onTimeUpdate: ((current: number, duration: number) => void) | null = null;
  private nearEndFired = false;

  private ensureContext() {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    for (let i = 0; i < 2; i++) {
      const audio = new Audio();
      audio.crossOrigin = 'anonymous';
      audio.preload = 'auto';
      const source = this.ctx.createMediaElementSource(audio);
      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      source.connect(gain);
      gain.connect(this.master);
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
      this.decks.push({ audio, gain });
    }
  }

  /** Play url on the idle deck, crossfading from the current one. */
  async play(url: string) {
    this.ensureContext();
    await this.ctx!.resume();
    const now = this.ctx!.currentTime;
    const from = this.decks[this.active]!;
    const next = (this.active + 1) % 2;
    const to = this.decks[next]!;

    to.audio.src = url;
    to.audio.currentTime = 0;
    await to.audio.play();

    const fading = !from.audio.paused && from.audio.src !== '';
    const fade = fading ? CROSSFADE_SEC : 0.05;
    from.gain.gain.cancelScheduledValues(now);
    from.gain.gain.setValueAtTime(from.gain.gain.value, now);
    from.gain.gain.linearRampToValueAtTime(0, now + fade);
    to.gain.gain.cancelScheduledValues(now);
    to.gain.gain.setValueAtTime(0, now);
    to.gain.gain.linearRampToValueAtTime(1, now + fade);
    if (fading) {
      const old = from.audio;
      setTimeout(() => old.pause(), fade * 1000 + 100);
    }

    this.active = next;
    this.nearEndFired = false;
  }

  pause() {
    this.decks[this.active]?.audio.pause();
  }

  async resume() {
    this.ensureContext();
    await this.ctx!.resume();
    await this.decks[this.active]?.audio.play();
  }

  stop() {
    for (const d of this.decks) {
      d.audio.pause();
      d.gain.gain.value = 0;
    }
  }

  setVolume(v: number) {
    this.ensureContext();
    this.master!.gain.value = v;
  }
}
