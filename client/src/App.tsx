import { Routes, Route, NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { ClientConfig } from '@ttrpgapp/shared';
import { apiGet } from './api';
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

export default function App() {
  const { data: config } = useQuery({
    queryKey: ['config'],
    queryFn: () => apiGet<ClientConfig>('/api/config'),
  });

  const enabledIds = new Set(
    (config?.plugins ?? []).filter((p) => p.enabled).map((p) => p.id),
  );
  const activePlugins = availableClientPlugins.filter((p) => enabledIds.has(p.id));

  return (
    <PlayerProvider>
    <div className="app">
      <nav className="sidebar">
        <div className="sidebar-title">TTRPG Companion</div>
        {CORE_NAV.map((item) => (
          <NavLink key={item.path} to={item.path} end={item.path === '/'} className="nav-item">
            <span className="nav-icon">{item.icon}</span> {item.label}
          </NavLink>
        ))}
        <div className="sidebar-hint muted small">⌘K / Ctrl+K: rules search</div>
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
