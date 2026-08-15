import type { CompendiumPack } from '@ttrpgapp/shared';
import type { ClientPlugin, PluginRuntime } from '@ttrpgapp/shared/plugin-client';
import CompendiumPage from './CompendiumPage';
import TrackerPage from './TrackerPage';
import EncountersPage from './EncountersPage';
import PartyPage from './PartyPage';
import {
  EMPTY_ENCOUNTER,
  endCombat,
  nextTurn,
  previousTurn,
  type Encounter,
} from './trackerTypes';

// Resolved by Vite to an emitted asset URL (kept out of the JS bundle).
const srdPackUrl = new URL('../data/srd-pack.json', import.meta.url).href;

async function updateEncounter(
  runtime: PluginRuntime,
  reducer: (e: Encounter) => Encounter,
): Promise<void> {
  const raw = await runtime.kvGet('dnd5e', 'encounter');
  const enc = raw ? (JSON.parse(raw) as Encounter) : EMPTY_ENCOUNTER;
  const next = reducer(enc);
  await runtime.kvSet('dnd5e', 'encounter', JSON.stringify(next));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('ttrpg-local-changed'));
    window.dispatchEvent(new CustomEvent('ttrpg-sync-updated'));
  }
}

export const dnd5eClientPlugin: ClientPlugin = {
  id: 'dnd5e',
  name: 'D&D 5e',
  nav: [
    { path: '/tracker', label: 'Combat Tracker', icon: '⚔️' },
    { path: '/encounters', label: 'Encounters', icon: '📋' },
    { path: '/party', label: 'Party', icon: '🛡️' },
    { path: '/compendium', label: 'Compendium', icon: '📖' },
  ],
  routes: [
    { path: '/tracker', component: TrackerPage },
    { path: '/encounters', component: EncountersPage },
    { path: '/party', component: PartyPage },
    { path: '/compendium', component: CompendiumPage },
  ],
  actions: [
    {
      id: 'nextTurn',
      label: 'Next Turn',
      icon: '⏭️',
      run: (runtime) => updateEncounter(runtime, nextTurn),
    },
    {
      id: 'previousTurn',
      label: 'Previous Turn',
      icon: '⏮️',
      run: (runtime) => updateEncounter(runtime, previousTurn),
    },
    {
      id: 'endCombat',
      label: 'End Combat',
      icon: '⏹️',
      run: (runtime) => updateEncounter(runtime, endCombat),
    },
  ],
  loadPacks: async () => {
    const res = await fetch(srdPackUrl);
    if (!res.ok) throw new Error(`failed to load SRD pack: ${res.status}`);
    return [(await res.json()) as CompendiumPack];
  },
};
