import type { Track } from '@ttrpgapp/shared';
import {
  castUrlFor,
  type CastDevice,
  type CastState,
  type CastStatus,
  type CastTarget,
  type MediaServer,
  type RemoteStatus,
} from './types';

/**
 * Owns the cast session: starts the on-device media server, drives the
 * receiver, and reports playback status back so the queue keeps advancing.
 *
 * Deliberately holds no React and no Capacitor imports — the target and server
 * are injected — so the whole state machine is unit-testable against fakes,
 * like SyncEngine in ../sync/engine.ts.
 */
export class CastManager {
  private target: CastTarget | null = null;
  private server: MediaServer | null = null;
  private baseUrl: string | null = null;
  private paths: string[] = [];
  private unsubscribe: (() => void) | null = null;

  state: CastState = { status: 'unavailable', device: null };

  /** Set by PlayerProvider: advance the queue when the receiver finishes a track. */
  onEnded: (() => void) | null = null;
  /** Set by PlayerProvider: mirror receiver playback position into the UI. */
  onProgress: ((position: number, duration: number) => void) | null = null;

  async init(target: CastTarget, server: MediaServer): Promise<void> {
    this.target = target;
    this.server = server;
    this.setState((await target.isAvailable()) ? 'idle' : 'unavailable');
  }

  isAvailable(): boolean {
    return this.state.status !== 'unavailable';
  }

  isCasting(): boolean {
    return this.state.status === 'connected';
  }

  async listDevices(): Promise<CastDevice[]> {
    if (!this.target || !this.isAvailable()) return [];
    try {
      return await this.target.listDevices();
    } catch {
      return [];
    }
  }

  /**
   * Connect to a receiver and start serving `libraryPaths` over the LAN. The
   * allow-list is captured here: only these files are reachable, by index.
   */
  async connect(device: CastDevice, libraryPaths: string[]): Promise<void> {
    if (!this.target || !this.server) throw new Error('cast not initialised');
    this.setState('connecting', device);
    try {
      const { baseUrl } = await this.server.start(libraryPaths);
      this.baseUrl = baseUrl;
      this.paths = libraryPaths;
      await this.target.connect(device.id);
      this.unsubscribe = this.target.onStatus((s) => this.handleStatus(s));
      this.setState('connected', device);
    } catch (e) {
      // Don't leave the server running if the session failed to come up.
      await this.server.stop().catch(() => {});
      this.baseUrl = null;
      this.setState('error', null, e instanceof Error ? e.message : String(e));
      throw e;
    }
  }

  async disconnect(): Promise<void> {
    this.unsubscribe?.();
    this.unsubscribe = null;
    try {
      await this.target?.disconnect();
    } finally {
      await this.server?.stop().catch(() => {});
      this.baseUrl = null;
      this.paths = [];
      this.setState(this.isAvailable() ? 'idle' : 'unavailable');
    }
  }

  /**
   * Play a track on the receiver. Returns false when the track isn't servable
   * (not in the allow-list), so the caller can fall back to local playback
   * instead of silently playing nothing.
   */
  async loadTrack(track: Track): Promise<boolean> {
    if (!this.target || !this.isCasting() || !this.baseUrl) return false;
    const url = castUrlFor(this.baseUrl, this.paths, track.path);
    if (!url) return false;
    await this.target.load(url, { title: track.title, artist: track.artist });
    return true;
  }

  async play(): Promise<void> {
    await this.target?.play();
  }

  async pause(): Promise<void> {
    await this.target?.pause();
  }

  async setVolume(v: number): Promise<void> {
    await this.target?.setVolume(v);
  }

  private handleStatus(s: RemoteStatus): void {
    this.onProgress?.(s.position, s.duration);
    if (s.ended) this.onEnded?.();
  }

  private setState(status: CastStatus, device: CastDevice | null = null, error?: string): void {
    this.state = { status, device: status === 'connected' || status === 'connecting' ? device : null, error };
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent<CastState>('ttrpg-cast-status', { detail: this.state }));
    }
  }
}

export const castManager = new CastManager();
