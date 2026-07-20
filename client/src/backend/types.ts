import type {
  ClientConfig,
  MusicScanResult,
  Note,
  NoteMeta,
  TagDimension,
  Track,
} from '@ttrpgapp/shared';

export interface TrackUpdate {
  intensity?: number | null;
  tags?: Partial<Record<TagDimension, string[]>>;
}

/**
 * All data access of the client goes through this interface. HttpBackend
 * talks to the local Fastify server (desktop/dev); CapacitorBackend uses
 * on-device storage (Android build).
 */
export interface Backend {
  getConfig(): Promise<ClientConfig>;

  listTracks(): Promise<Track[]>;
  scanMusic(): Promise<MusicScanResult>;
  updateTrack(id: number, update: TrackUpdate): Promise<void>;
  /** Playable URL for a track (sync; used by the crossfade engine). */
  trackUrl(track: Track): string;

  listNotes(): Promise<NoteMeta[]>;
  readNote(path: string): Promise<Note>;
  writeNote(path: string, content: string): Promise<void>;
  deleteNote(path: string): Promise<void>;
  createNote(title: string): Promise<{ path: string }>;
  createSession(title: string): Promise<{ path: string }>;

  kvGet(pluginId: string, key: string): Promise<string | null>;
  kvSet(pluginId: string, key: string, value: string): Promise<void>;
}
