import { useEffect, useState } from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import type { ClientConfig } from '@ttrpgapp/shared';
import { availableClientPlugins } from './plugins';
import { PlayerProvider } from './player/PlayerProvider';
import PlayerBar from './player/PlayerBar';
import CommandPalette from './components/CommandPalette';
import MusicPage from './pages/MusicPage';
import NotesPage from './pages/NotesPage';
import SettingsPage, { SyncBadge } from './pages/SettingsPage';
import { syncManager, type SyncState } from './sync/manager';

const CORE_NAV = [
  { path: '/', label: 'Music', icon: '🎵' },
  { path: '/notes', label: 'Prep Notes', icon: '📓' },
];

function SyncIndicator() {
  const [state, setState] = useState<SyncState>(syncManager.state);
  useEffect(() => {
    const onStatus = (e: Event) => setState((e as CustomEvent<SyncState>).detail);
    window.addEventListener('ttrpg-sync-status', onStatus);
    return () => window.removeEventListener('ttrpg-sync-status', onStatus);
  }, []);
  if (state.status === 'disconnected') return null;
  return (
    <NavLink to="/settings" className="sync-indicator">
      <SyncBadge status={state.status} />
    </NavLink>
  );
}

function openPalette() {
  window.dispatchEvent(new CustomEvent('open-command-palette'));
}

export default function App({ config }: { config: ClientConfig }) {
  const enabledIds = new Set(config.plugins.filter((p) => p.enabled).map((p) => p.id));
  const activePlugins = availableClientPlugins.filter((p) => enabledIds.has(p.id));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  // Close the mobile drawer whenever the route changes.
  useEffect(() => setDrawerOpen(false), [location.pathname]);

  return (
    <PlayerProvider>
      <div className="app">
        <div className="topbar">
          <button className="icon-btn" aria-label="Menu" onClick={() => setDrawerOpen(true)}>
            ☰
          </button>
          <span className="topbar-title">TTRPG Companion</span>
          <button className="icon-btn" aria-label="Search rules" onClick={openPalette}>
            🔎
          </button>
        </div>

        {drawerOpen && <div className="drawer-backdrop" onClick={() => setDrawerOpen(false)} />}
        <nav className={`sidebar ${drawerOpen ? 'sidebar-open' : ''}`}>
          <div className="sidebar-title">TTRPG Companion</div>
          {CORE_NAV.map((item) => (
            <NavLink key={item.path} to={item.path} end={item.path === '/'} className="nav-item">
              <span className="nav-icon">{item.icon}</span> {item.label}
            </NavLink>
          ))}
          <button className="nav-item nav-search" onClick={openPalette}>
            <span className="nav-icon">🔎</span> Rules search
            <span className="muted small kbd-hint"> ⌘K</span>
          </button>
          <NavLink to="/settings" className="nav-item">
            <span className="nav-icon">⚙️</span> Settings
          </NavLink>
          {activePlugins.map((plugin) => (
            <div key={plugin.id}>
              <div className="sidebar-section">{plugin.name}</div>
              {plugin.nav.map((item) => (
                <NavLink key={item.path} to={`/p/${plugin.id}${item.path}`} className="nav-item">
                  <span className="nav-icon">{item.icon}</span> {item.label}
                </NavLink>
              ))}
            </div>
          ))}
          <div className="sidebar-spacer" />
          <SyncIndicator />
        </nav>

        <main className="main">
          <div className="main-content">
            <Routes>
              <Route path="/" element={<MusicPage />} />
              <Route path="/notes/*" element={<NotesPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              {activePlugins.flatMap((plugin) =>
                plugin.routes.map((r) => (
                  <Route
                    key={`${plugin.id}${r.path}`}
                    path={`/p/${plugin.id}${r.path}`}
                    element={<r.component />}
                  />
                )),
              )}
            </Routes>
          </div>
          <PlayerBar />
        </main>
        <CommandPalette />
      </div>
    </PlayerProvider>
  );
}
