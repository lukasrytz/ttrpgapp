import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { useQueryClient } from '@tanstack/react-query';
import type { MusicTagCatalog } from '@ttrpgapp/shared';
import { syncManager, type SyncState } from '../sync/manager';
import { backend, getCapacitorBackend } from '../backend';
import { useSfx } from '../player/SfxProvider';
import { getSfxFolders, setSfxFolders } from '../music/folders';

function ago(ts: number): string {
  if (!ts) return 'never';
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
}

const THEMES = [
  { id: 'theme-fantasy', label: 'D&D / Fantasy', icon: '🏰', color: '#f59e0b', desc: 'Candlelight Amber' },
  { id: 'theme-horror', label: 'Call of Cthulhu / Horror', icon: '🐙', color: '#10b981', desc: 'Eldritch Emerald' },
  { id: 'theme-scifi', label: 'Mothership / Sci-Fi', icon: '🚀', color: '#06b6d4', desc: 'CRT Cyan & Alarm Orange' },
  { id: 'theme-universal', label: 'Universal Dark', icon: '🌙', color: '#6366f1', desc: 'High-Contrast Cyber' },
];

export default function SettingsPage() {
  const native = Capacitor.isNativePlatform();
  const qc = useQueryClient();
  const [clientId, setClientId] = useState('');
  const [currentTheme, setCurrentTheme] = useState<string>(
    () => localStorage.getItem('ttrpg-theme') || 'theme-fantasy',
  );
  const [state, setState] = useState<SyncState>(syncManager.state);
  const [busy, setBusy] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const changeTheme = (themeId: string) => {
    setCurrentTheme(themeId);
    localStorage.setItem('ttrpg-theme', themeId);
    window.dispatchEvent(new CustomEvent('ttrpg-theme-change', { detail: themeId }));
  };

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
        <h2>Genre UI Theme</h2>
        <p className="muted">
          Select a visual theme tailored to your campaign genre. Compatible across D&D 5e, Call of Cthulhu, and Mothership.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', marginTop: '12px', marginBottom: '24px' }}>
          {THEMES.map((t) => {
            const active = currentTheme === t.id;
            return (
              <button
                key={t.id}
                onClick={() => changeTheme(t.id)}
                style={{
                  textAlign: 'left',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: active ? `2px solid ${t.color}` : '1px solid var(--border)',
                  background: active ? 'var(--bg-hover)' : 'var(--bg-panel)',
                  boxShadow: active ? `0 0 14px ${t.color}40` : 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '18px' }}>{t.icon}</span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: t.color }}>{t.label}</span>
                </div>
                <span className="small muted">{t.desc}</span>
              </button>
            );
          })}
        </div>
      </section>

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

      <SfxSettingsSection />
    </div>
  );
}

function SfxSettingsSection() {
  const sfx = useSfx();
  const [folders, setFolders] = useState<Set<string>>(new Set());
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState<string | null>(null);

  useEffect(() => {
    void getSfxFolders().then(setFolders);
  }, []);

  const handleToggleFolder = async (folder: string) => {
    const next = new Set(folders);
    if (next.has(folder)) next.delete(folder);
    else next.add(folder);
    setFolders(next);
    await setSfxFolders(Array.from(next));
  };

  const handleRescan = async () => {
    setScanning(true);
    setScanMsg(null);
    try {
      const res = await backend().scanSfx();
      setScanMsg(`SFX scan complete: ${res.added} added, ${res.removed} removed, ${res.total} total.`);
    } catch (e) {
      setScanMsg(`Scan failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setScanning(false);
    }
  };

  return (
    <section className="settings-section" style={{ marginTop: '24px' }}>
      <h2>Audio & SFX Library</h2>
      <p className="muted">
        Configure sound effect folders, master volume, and music ducking when sound effects trigger.
      </p>

      <div className="form-group" style={{ marginTop: '12px' }}>
        <label className="small muted">SFX Master Volume: {Math.round(sfx.masterVolume * 100)}%</label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={sfx.masterVolume}
          onChange={(e) => sfx.setMasterVolume(Number(e.target.value))}
        />
      </div>

      <div className="form-group" style={{ marginTop: '12px' }}>
        <label className="small muted">
          Music Ducking Level: {Math.round(sfx.duckAmount * 100)}% music volume during SFX
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={sfx.duckAmount}
          onChange={(e) => sfx.setDuckAmount(Number(e.target.value))}
        />
      </div>

      <div style={{ marginTop: '16px' }}>
        <h3>SFX Library Folders</h3>
        <div className="header-actions" style={{ marginTop: '8px' }}>
          <button className="primary" onClick={handleRescan} disabled={scanning}>
            {scanning ? 'Scanning SFX…' : 'Rescan SFX Library'}
          </button>
        </div>
        {scanMsg && <p className="muted small" style={{ marginTop: '4px' }}>{scanMsg}</p>}
      </div>
    </section>
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
