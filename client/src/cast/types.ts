/**
 * Casting model. A Chromecast never receives pushed audio — it fetches media
 * from a URL over the LAN. So casting needs two collaborating pieces:
 *
 *   MediaServer — an HTTP server on this device serving the local audio files
 *                 at LAN-reachable URLs (Android: NanoHTTPD in a foreground
 *                 service, behind a token + allow-list).
 *   CastTarget  — discovery and transport control for the receiver
 *                 (Android: the Google Cast SDK).
 *
 * Both are interfaces so the logic in manager.ts stays pure and testable
 * against fakes, the same way SyncTarget/SyncStore work in ../sync.
 */

export interface CastDevice {
  id: string;
  name: string;
}

export type CastStatus = 'unavailable' | 'idle' | 'connecting' | 'connected' | 'error';

export interface CastState {
  status: CastStatus;
  device: CastDevice | null;
  error?: string;
}

/** Playback state reported back by the receiver. */
export interface RemoteStatus {
  playerState: 'playing' | 'paused' | 'buffering' | 'idle';
  /** Seconds; 0 when unknown. */
  position: number;
  duration: number;
  /** True when the current item finished (drives queue advance). */
  ended?: boolean;
}

/** Serves this device's audio over the LAN so a receiver can fetch it. */
export interface MediaServer {
  /**
   * Start serving. `paths` is the allow-list: only these files are ever
   * servable, and they're addressed by index, never by caller-supplied path.
   * Returns the token-scoped base URL, e.g. http://192.168.1.42:8731/ab12cd.
   */
  start(paths: string[]): Promise<{ baseUrl: string }>;
  stop(): Promise<void>;
}

/** Discovery + transport control for a cast receiver. */
export interface CastTarget {
  isAvailable(): Promise<boolean>;
  listDevices(): Promise<CastDevice[]>;
  connect(deviceId: string): Promise<void>;
  disconnect(): Promise<void>;
  /** Load and start a media URL the receiver can fetch. */
  load(url: string, meta: { title: string; artist?: string | null }): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  setVolume(v: number): Promise<void>;
  /** Subscribe to receiver playback status. Returns an unsubscribe function. */
  onStatus(cb: (s: RemoteStatus) => void): () => void;
}

/**
 * URL for a track on the media server. Addressed by its index in the allow-list
 * the server was started with — a caller can never ask for an arbitrary path.
 * Returns null when the track isn't in the allow-list (e.g. the library was
 * rescanned since the server started), so callers fall back to local playback
 * rather than casting a URL that would 404.
 */
export function castUrlFor(baseUrl: string, paths: string[], trackPath: string): string | null {
  const index = paths.indexOf(trackPath);
  if (index < 0) return null;
  return `${baseUrl.replace(/\/$/, '')}/t/${index}`;
}
