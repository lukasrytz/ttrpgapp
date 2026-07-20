import type { ClientPlugin } from '@ttrpgapp/shared/plugin-client';
import CompendiumPage from './CompendiumPage';

export const dnd5eClientPlugin: ClientPlugin = {
  id: 'dnd5e',
  name: 'D&D 5e',
  nav: [{ path: '/compendium', label: 'Compendium', icon: '📖' }],
  routes: [{ path: '/compendium', component: CompendiumPage }],
};
