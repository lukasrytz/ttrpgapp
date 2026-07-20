import type { ClientPlugin } from '@ttrpgapp/shared/plugin-client';
import CompendiumPage from './CompendiumPage';
import TrackerPage from './TrackerPage';

export const dnd5eClientPlugin: ClientPlugin = {
  id: 'dnd5e',
  name: 'D&D 5e',
  nav: [
    { path: '/tracker', label: 'Combat Tracker', icon: '⚔️' },
    { path: '/compendium', label: 'Compendium', icon: '📖' },
  ],
  routes: [
    { path: '/tracker', component: TrackerPage },
    { path: '/compendium', component: CompendiumPage },
  ],
};
