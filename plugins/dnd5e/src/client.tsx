import type { CompendiumPack } from '@ttrpgapp/shared';
import type { ClientPlugin } from '@ttrpgapp/shared/plugin-client';
import CompendiumPage from './CompendiumPage';
import TrackerPage from './TrackerPage';

// Resolved by Vite to an emitted asset URL (kept out of the JS bundle).
const srdPackUrl = new URL('../data/srd-pack.json', import.meta.url).href;

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
  loadPacks: async () => {
    const res = await fetch(srdPackUrl);
    if (!res.ok) throw new Error(`failed to load SRD pack: ${res.status}`);
    return [(await res.json()) as CompendiumPack];
  },
};
