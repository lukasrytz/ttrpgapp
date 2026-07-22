import { App } from '@capacitor/app';
import { Preferences } from '@capacitor/preferences';
import type { QueryClient } from '@tanstack/react-query';
import type { CapacitorBackend } from '../backend/capacitor';
import { reconcile } from './engine';
import { CapacitorSyncStore } from './store';
import { GoogleDriveAuth } from './drive/auth';
import { GoogleDriveTarget } from './drive/target';

export type SyncStatus = 'disconnected' | 'idle' | 'syncing' | 'error';

export interface SyncState {
  status: SyncStatus;
  lastSyncedAt: number;
  error?: string;
}

const CLIENT_ID_KEY = 'sync.google.clientId';
const PERIODIC_MS = 90_000;

/**
 * Client IDs get pasted from the Cloud Console, which is easy to do with a
 * trailing slash or stray whitespace. Google answers those with a bare
 * `invalid_client`, so normalise instead of passing them on. Applied on read
 * too, so an already-stored bad value fixes itself.
 */
export function normalizeClientId(id: string): string {
  return id.trim().replace(/^["']|["']$/g, '').replace(/\/+$/, '').trim();
}

/**
 * Owns the local-first sync loop for the Android build: reconciles the device
 * store with Google Drive on launch, on app resume, periodically, after edits
 * (debounced), and on demand. Emits `ttrpg-sync-status` for the UI and
 * `ttrpg-sync-updated` when local data changed so open views refresh.
 */
class SyncManager {
  private store: CapacitorSyncStore | null = null;
  private auth: GoogleDriveAuth | null = null;
  private target: GoogleDriveTarget | null = null;
  private qc: QueryClient | null = null;
  private running = false;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private triggersInstalled = false;

  state: SyncState = { status: 'disconnected', lastSyncedAt: 0 };

  async init(be: CapacitorBackend, qc: QueryClient): Promise<void> {
    this.qc = qc;
    this.store = new CapacitorSyncStore(be);
    // Notes and plugin views announce edits with this event (cross-package safe).
    window.addEventListener('ttrpg-local-changed', () => this.requestSync());
    await this.buildTarget();
    if (this.auth && (await this.auth.isAuthed())) {
      this.setStatus('idle');
      this.installTriggers();
      void this.syncNow();
    } else {
      this.setStatus('disconnected');
    }
  }

  private async clientId(): Promise<string | null> {
    const override = (await Preferences.get({ key: CLIENT_ID_KEY })).value;
    const id = override || (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) || null;
    return id ? normalizeClientId(id) || null : null;
  }

  private async buildTarget(): Promise<boolean> {
    const clientId = await this.clientId();
    if (!clientId) return false;
    this.auth = new GoogleDriveAuth(clientId);
    this.target = new GoogleDriveTarget(this.auth);
    return true;
  }

  async setClientId(id: string): Promise<void> {
    await Preferences.set({ key: CLIENT_ID_KEY, value: normalizeClientId(id) });
    await this.buildTarget();
  }

  isConfigured(): Promise<boolean> {
    return this.clientId().then((c) => c !== null);
  }

  async connect(): Promise<void> {
    if (!this.target && !(await this.buildTarget())) {
      throw new Error('No Google client ID configured');
    }
    await this.auth!.signIn();
    this.setStatus('idle');
    this.installTriggers();
    await this.syncNow();
  }

  async disconnect(): Promise<void> {
    await this.auth?.signOut();
    this.setStatus('disconnected');
  }

  /** Debounced sync after local edits. */
  requestSync(delayMs = 4000): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => void this.syncNow(), delayMs);
  }

  async syncNow(): Promise<void> {
    if (!this.store || !this.target || !this.auth) return;
    if (this.running) return;
    if (!(await this.auth.isAuthed())) {
      this.setStatus('disconnected');
      return;
    }
    this.running = true;
    this.setStatus('syncing');
    try {
      const res = await reconcile(this.store, this.target);
      this.state.lastSyncedAt = Date.now();
      this.setStatus('idle');
      if (res.localChanged) {
        this.qc?.invalidateQueries({ queryKey: ['notes'] });
        this.qc?.invalidateQueries({ queryKey: ['note'] });
        this.qc?.invalidateQueries({ queryKey: ['tracks'] });
        window.dispatchEvent(new CustomEvent('ttrpg-sync-updated'));
      }
    } catch (e) {
      this.setStatus('error', e instanceof Error ? e.message : String(e));
    } finally {
      this.running = false;
    }
  }

  private installTriggers(): void {
    if (this.triggersInstalled) return;
    this.triggersInstalled = true;
    void App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) this.requestSync(500);
    });
    setInterval(() => void this.syncNow(), PERIODIC_MS);
  }

  private setStatus(status: SyncStatus, error?: string): void {
    this.state = { status, lastSyncedAt: this.state.lastSyncedAt, error };
    window.dispatchEvent(new CustomEvent<SyncState>('ttrpg-sync-status', { detail: this.state }));
  }
}

export const syncManager = new SyncManager();

/** Fire-and-forget debounced sync request from anywhere (no-op on web). */
export function requestSync(): void {
  syncManager.requestSync();
}
