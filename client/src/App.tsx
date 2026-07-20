import { useEffect, useState } from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import type { ClientConfig } from '@ttrpgapp/shared';
import { availableClientPlugins } from './plugins';
import { PlayerProvider } from './player/PlayerProvider';
import PlayerBar from './player/PlayerBar';
import CommandPalette from './components/CommandPalette';
import MusicPage from './pages/MusicPage';
import NotesPage from './pages/NotesPage';

const CORE_NAV = [
  { path: '/', label: 'Music', icon: '🎵' },
  { path: '/notes', label: 'Prep Notes', icon: '📓' },
];

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
        </nav>

        <main className="main">
          <div className="main-content">
            <Routes>
              <Route path="/" element={<MusicPage />} />
              <Route path="/notes/*" element={<NotesPage />} />
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
