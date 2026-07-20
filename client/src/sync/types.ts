/**
 * Provider-agnostic sync model. Notes and plugin/tracker state are both
 * represented as SyncDocs identified by a namespaced id:
 *   notes/<vaultpath>        e.g. "notes/sessions/Goblin Ambush.md"
 *   state/<pluginId>/<key>   e.g. "state/dnd5e/encounter"
 * The reconcile engine (engine.ts) works purely against these interfaces, so
 * the same logic drives Google Drive today and Dropbox/WebDAV later.
 */

export interface SyncDoc {
  id: string;
  content: string;
  /** epoch ms; note mtime for notes, an explicit stamp for state */
  updatedAt: number;
  /** content hash (see hash.ts); compared as an opaque string */
  hash: string;
}

/** A remote doc listed without its content (content fetched lazily). */
export interface RemoteDocMeta {
  id: string;
  /** provider-specific handle used to fetch content */
  remoteId: string;
  updatedAt: number;
  hash: string;
}

/** id -> deletion timestamp (epoch ms). */
export type Tombstones = Record<string, number>;

/** Local record of the last successfully-synced hash, to detect true conflicts. */
export interface SyncMetaEntry {
  lastSyncedHash: string;
  lastSyncedAt: number;
}
export type SyncMeta = Record<string, SyncMetaEntry>;

/** Local side of sync: notes + state on the device, plus sync bookkeeping. */
export interface SyncStore {
  listDocs(): Promise<SyncDoc[]>;
  getDoc(id: string): Promise<string | null>;
  /** Write without re-triggering a sync (updatedAt is advisory for state). */
  putDoc(id: string, content: string, updatedAt: number): Promise<void>;
  deleteDoc(id: string): Promise<void>;
  getMeta(): Promise<SyncMeta>;
  setMeta(meta: SyncMeta): Promise<void>;
  getTombstones(): Promise<Tombstones>;
  setTombstones(t: Tombstones): Promise<void>;
}

/** Remote side of sync: one implementation per provider (Drive, Dropbox, …). */
export interface SyncTarget {
  isAuthed(): Promise<boolean>;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
  listDocs(): Promise<RemoteDocMeta[]>;
  getDoc(remoteId: string): Promise<string>;
  putDoc(id: string, content: string, hash: string, updatedAt: number): Promise<RemoteDocMeta>;
  deleteDoc(id: string): Promise<void>;
  getTombstones(): Promise<Tombstones>;
  setTombstones(t: Tombstones): Promise<void>;
}

export interface SyncResult {
  uploaded: number;
  downloaded: number;
  deletedLocal: number;
  deletedRemote: number;
  conflicts: number;
  /** true if any local doc changed (UI should refresh) */
  localChanged: boolean;
}
