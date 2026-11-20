import { useEffect, useMemo, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MusicFolder, MusicTagCatalog } from '@ttrpgapp/shared';
import { syncManager, type SyncState } from '../sync/manager';
import { backend, getCapacitorBackend } from '../backend';
import { useSfx } from '../player/SfxProvider';
import { isKeepAwakeEnabled, setKeepAwakeEnabled } from '../util/keepAwake';
import { showToast } from '../toast';

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
  const [keepAwake, setKeepAwake] = useState<boolean>(() => isKeepAwakeEnabled());
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
        <h2>Session display</h2>
        <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '6px 0' }}>
          <input
            type="checkbox"
            checked={keepAwake}
            onChange={(e) => {
              const next = e.target.checked;
              setKeepAwake(next);
              void setKeepAwakeEnabled(next);
            }}
          />
          <span>Keep screen on during session (prevents sleep)</span>
        </label>
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
              Syncs your Stream Deck, scenes, prep notes, combat tracker, party, encounters, and
              music tags across your devices via your Google Drive. Files live in a{' '}
              <em>TTRPG Companion</em> folder you can also open in Drive.
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
      <HomeAssistantSettingsSection />
      <AboutSettingsSection />
    </div>
  );
}

function SfxSettingsSection() {
  const qc = useQueryClient();
  const sfx = useSfx();
  const [pickingFolders, setPickingFolders] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState<string | null>(null);

  const sfxFolders = useQuery({
    queryKey: ['sfxFolders'],
    queryFn: () => backend().listSfxFolders(),
  });
  const enabledCount = sfxFolders.data?.filter((f) => f.enabled).length ?? 0;

  const handleRescan = async () => {
    setScanning(true);
    setScanMsg(null);
    try {
      const res = await backend().scanSfx();
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['sfxClips'] }),
        qc.invalidateQueries({ queryKey: ['sfxFolders'] }),
      ]);
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
        <div className="header-actions" style={{ marginTop: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setPickingFolders(true)}
            disabled={!sfxFolders.data}
            title="Choose which folders contain sound effects and ambience"
          >
            📁 SFX Folders{sfxFolders.data ? ` (${enabledCount}/${sfxFolders.data.length})` : ''}
          </button>
          <button className="primary" onClick={handleRescan} disabled={scanning}>
            {scanning ? 'Scanning SFX…' : 'Rescan SFX Library'}
          </button>
        </div>
        {scanMsg && <p className="muted small" style={{ marginTop: '4px' }}>{scanMsg}</p>}
      </div>

      {pickingFolders && sfxFolders.data && (
        <SfxFolderPicker folders={sfxFolders.data} onClose={() => setPickingFolders(false)} />
      )}
    </section>
  );
}

function SfxFolderPicker({ folders, onClose }: { folders: MusicFolder[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [enabled, setEnabled] = useState(
    () => new Set(folders.filter((f) => f.enabled).map((f) => f.path)),
  );
  const [search, setSearch] = useState('');

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? folders.filter((f) => f.path.toLowerCase().includes(q)) : folders;
  }, [folders, search]);

  const save = useMutation({
    mutationFn: () => backend().setSfxFolders([...enabled]),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['sfxClips'] }),
        qc.invalidateQueries({ queryKey: ['sfxFolders'] }),
      ]);
      showToast('SFX folders updated', '🔊');
      onClose();
    },
  });

  const toggle = (path: string) =>
    setEnabled((prev) => {
      const next = new Set(prev);
      if (!next.delete(path)) next.add(path);
      return next;
    });

  const clipCount = folders
    .filter((f) => enabled.has(f.path))
    .reduce((n, f) => n + f.trackCount, 0);

  return (
    <div className="palette-backdrop" onClick={onClose}>
      <div className="folder-picker" onClick={(e) => e.stopPropagation()}>
        <div className="folder-picker-head">
          <strong>SFX & Ambience folders</strong>
          <button type="button" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <p className="muted small folder-picker-hint">
          Selected folders provide SFX one-shots and ambience loops — {clipCount} clip
          {clipCount === 1 ? '' : 's'} from {enabled.size} folder
          {enabled.size === 1 ? '' : 's'}.
        </p>
        <input
          placeholder="Filter folders…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="folder-list">
          {shown.map((f) => (
            <label key={f.path} className="folder-row">
              <input
                type="checkbox"
                checked={enabled.has(f.path)}
                onChange={() => toggle(f.path)}
              />
              <span className="folder-name">
                {f.label}
                <span className="muted small folder-path">{f.path}</span>
              </span>
              <span className="muted small">{f.trackCount}</span>
            </label>
          ))}
          {shown.length === 0 && <p className="muted folder-empty">No folders match.</p>}
        </div>
        <div className="folder-picker-foot">
          <button type="button" onClick={() => setEnabled(new Set(folders.map((f) => f.path)))}>All</button>
          <button type="button" onClick={() => setEnabled(new Set())}>None</button>
          <button type="button" className="primary" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function HomeAssistantSettingsSection() {
  const [haUrl, setHaUrl] = useState('');
  const [haToken, setHaToken] = useState('');
  const [haStatus, setHaStatus] = useState<string | null>(null);
  const [haTesting, setHaTesting] = useState(false);

  useEffect(() => {
    void backend()
      .kvGet('settings', 'ha')
      .then((raw) => {
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as { url?: string; token?: string };
            if (parsed.url) setHaUrl(parsed.url);
            if (parsed.token) setHaToken(parsed.token);
          } catch {
            // ignore
          }
        }
      });
  }, []);

  return (
    <section className="settings-section" style={{ marginTop: '24px' }}>
      <h2>💡 Home Assistant Lighting Integration</h2>
      <p className="muted">
        Connect to your local Home Assistant instance to trigger smart light cues, scene transitions, and immersive battle ambient lighting directly from scenes and Stream Deck buttons.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '12px' }}>
        <label>
          <span className="small muted">Home Assistant URL</span>
          <input
            value={haUrl}
            onChange={(e) => setHaUrl(e.target.value)}
            placeholder="e.g. http://192.168.1.100:8123 or http://homeassistant.local:8123"
          />
        </label>

        <label>
          <span className="small muted">Long-Lived Access Token</span>
          <input
            type="password"
            value={haToken}
            onChange={(e) => setHaToken(e.target.value)}
            placeholder="Paste HA Bearer Token"
          />
        </label>

        {haStatus && (
          <div
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '13px',
              background: haStatus.startsWith('✓') ? 'var(--accent-soft)' : 'rgba(239, 68, 68, 0.15)',
              color: haStatus.startsWith('✓') ? 'var(--accent)' : 'var(--danger)',
            }}
          >
            {haStatus}
          </div>
        )}

        <div className="header-actions" style={{ marginTop: '8px', justifyContent: 'flex-end', gap: '8px' }}>
          <button
            type="button"
            disabled={haTesting || !haUrl.trim() || !haToken.trim()}
            onClick={async () => {
              setHaTesting(true);
              setHaStatus('Testing connection…');
              let normalizedUrl = haUrl.trim();
              if (!/^https?:\/\//i.test(normalizedUrl)) {
                normalizedUrl = `http://${normalizedUrl}`;
                setHaUrl(normalizedUrl);
              }
              let normalizedToken = haToken.trim();
              if (normalizedToken.toLowerCase().startsWith('bearer ')) {
                normalizedToken = normalizedToken.slice(7).trim();
                setHaToken(normalizedToken);
              }
              try {
                await backend().testHaConnection(normalizedUrl, normalizedToken);
                await backend().kvSet(
                  'settings',
                  'ha',
                  JSON.stringify({ url: normalizedUrl, token: normalizedToken }),
                );
                setHaStatus('✓ Connected successfully to Home Assistant!');
                showToast('HA Connected & Saved!', '💡');
              } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                setHaStatus(`✗ Connection failed: ${msg}`);
                showToast('HA Connection Failed', '⚠️');
              } finally {
                setHaTesting(false);
              }
            }}
          >
            {haTesting ? 'Testing…' : 'Test Connection'}
          </button>

          <button
            type="button"
            className="primary"
            onClick={async () => {
              let normalizedUrl = haUrl.trim();
              if (normalizedUrl && !/^https?:\/\//i.test(normalizedUrl)) {
                normalizedUrl = `http://${normalizedUrl}`;
                setHaUrl(normalizedUrl);
              }
              let normalizedToken = haToken.trim();
              if (normalizedToken.toLowerCase().startsWith('bearer ')) {
                normalizedToken = normalizedToken.slice(7).trim();
                setHaToken(normalizedToken);
              }
              await backend().kvSet(
                'settings',
                'ha',
                JSON.stringify({ url: normalizedUrl, token: normalizedToken }),
              );
              showToast('Home Assistant settings saved', '💾');
            }}
          >
            Save Settings
          </button>
        </div>
      </div>
    </section>
  );
}

function AboutSettingsSection() {
  const version = (typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.1.0').replace(/^v/, '');
  return (
    <section className="settings-section" style={{ marginTop: '24px', opacity: 0.9 }}>
      <h2>About & Updates</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="small muted">App Version</span>
          <span className="small font-mono" style={{ fontWeight: 600 }}>v{version}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="small muted">Distribution</span>
          <span className="small">Private Sideload / GitHub Release</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="small muted">Over-the-Air Updates</span>
          <span className="small">Supported via Obtainium</span>
        </div>
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
