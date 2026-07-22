import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { useQueryClient } from '@tanstack/react-query';
import type { MusicTagCatalog } from '@ttrpgapp/shared';
import { syncManager, type SyncState } from '../sync/manager';
import { getCapacitorBackend } from '../backend';

function ago(ts: number): string {
  if (!ts) return 'never';
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
}

export default function SettingsPage() {
  const native = Capacitor.isNativePlatform();
  const qc = useQueryClient();
  const [clientId, setClientId] = useState('');
  const [state, setState] = useState<SyncState>(syncManager.state);
  const [busy, setBusy] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void Preferences.get({ key: 'sync.google.clientId' }).then(({ value }) => {
      setClientId(value ?? (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''));
    });
    const onStatus = (e: Event) => setState((e as CustomEvent<SyncState>).detail);
    window.addEventListener('ttrpg-sync-status', onStatus);
    return () => window.removeEventListener('ttrpg-sync-status', onStatus);
  }, []);

  const connected = state.status !== 'disconnected';

  const importTags = async (file: File) => {
    setImportMsg(null);
    setBusy(true);
    try {
      const parsed = JSON.parse(await file.text()) as MusicTagCatalog;
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('not a tag catalog');
      }
      const be = getCapacitorBackend();
      if (!be) throw new Error('unavailable on this platform');
      const n = await be.importMusicTags(parsed);
      await qc.invalidateQueries({ queryKey: ['tracks'] });
      setImportMsg(`Imported tags for ${n} tracks. They'll sync to your other devices.`);
    } catch (e) {
      setImportMsg(`Import failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const connect = async () => {
    setBusy(true);
    try {
      if (clientId.trim()) await syncManager.setClientId(clientId.trim());
      await syncManager.connect();
    } catch (e) {
      window.alert(`Couldn't connect: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <h1>Settings</h1>

      <section className="settings-section">
        <h2>Cross-device sync</h2>
        {!native && (
          <p className="muted">
            Sync runs in the Android app, keeping your prep notes and combat tracker in step
            across devices through your own Google Drive. In this web/desktop build the local
            server is the shared store.
          </p>
        )}
        {native && (
          <>
            <p className="muted">
              Syncs prep notes and combat tracker state across your devices via your Google
              Drive. Files live in a <em>TTRPG Companion</em> folder you can also open in Drive.
            </p>

            <label className="settings-field">
              <span>Google OAuth client ID</span>
              <input
                value={clientId}
                placeholder="xxxxx.apps.googleusercontent.com"
                onChange={(e) => setClientId(e.target.value)}
                disabled={connected}
              />
            </label>

            <div className="settings-status">
              <SyncBadge status={state.status} />
              <span className="muted small">last synced {ago(state.lastSyncedAt)}</span>
              {state.error && <span className="hp-low small">· {state.error}</span>}
            </div>

            <div className="header-actions">
              {!connected ? (
                <button className="primary" onClick={connect} disabled={busy || !clientId.trim()}>
                  Connect Google Drive
                </button>
              ) : (
                <>
                  <button
                    className="primary"
                    onClick={() => void syncManager.syncNow()}
                    disabled={state.status === 'syncing'}
                  >
                    Sync now
                  </button>
                  <button onClick={() => void syncManager.disconnect()}>Disconnect</button>
                </>
              )}
            </div>
          </>
        )}
      </section>

      {native && (
        <section className="settings-section">
          <h2>Import music tags</h2>
          <p className="muted">
            Load a <code>music-tags.json</code> exported from the desktop
            (<code>npm run export-tags</code>). Tags are matched to your device's tracks by
            name and length, merged into your library, and synced to your other devices.
          </p>
          <div className="header-actions">
            <button className="primary" disabled={busy} onClick={() => fileInput.current?.click()}>
              Choose file…
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) void importTags(f);
              }}
            />
          </div>
          {importMsg && <p className="muted small">{importMsg}</p>}
        </section>
      )}
    </div>
  );
}

export function SyncBadge({ status }: { status: SyncState['status'] }) {
  const label = {
    disconnected: 'Not connected',
    idle: 'Synced',
    syncing: 'Syncing…',
    error: 'Sync error',
  }[status];
  return <span className={`sync-badge sync-${status}`}>{label}</span>;
}
