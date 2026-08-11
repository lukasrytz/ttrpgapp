import type { DeckLayout } from '@ttrpgapp/shared';
import { DECK_SCHEMA_VERSION } from '@ttrpgapp/shared';

export function starterDeck(): DeckLayout {
  return {
    version: DECK_SCHEMA_VERSION,
    pages: [
      {
        id: 'session',
        name: 'Session',
        buttons: [
          {
            id: 'btn-tracker',
            label: 'Combat Tracker',
            icon: '⚔️',
            color: 'crimson',
            size: '1x1',
            action: { kind: 'navigate', to: '/tracker' },
          },
          {
            id: 'btn-compendium',
            label: 'Compendium',
            icon: '📚',
            color: 'indigo',
            size: '1x1',
            action: { kind: 'navigate', to: '/compendium' },
          },
          {
            id: 'btn-notes',
            label: 'Prep Notes',
            icon: '📝',
            color: 'amber',
            size: '1x1',
            action: { kind: 'navigate', to: '/notes' },
          },
          {
            id: 'btn-music',
            label: 'Music',
            icon: '🎵',
            color: 'plum',
            size: '1x1',
            action: { kind: 'navigate', to: '/music' },
          },
          {
            id: 'btn-battle-music',
            label: 'Battle Music',
            icon: '⚔️',
            color: 'crimson',
            size: '1x1',
            action: {
              kind: 'musicFilter',
              filter: {
                dims: { theme: ['battle'], mood: ['tense'] },
                minIntensity: 0,
                search: '',
              },
            },
          },
          {
            id: 'btn-peaceful-music',
            label: 'Peaceful Music',
            icon: '🌿',
            color: 'forest',
            size: '1x1',
            action: {
              kind: 'musicFilter',
              filter: {
                dims: { theme: ['exploration'], mood: ['peaceful'] },
                minIntensity: 0,
                search: '',
              },
            },
          },
          {
            id: 'btn-social-music',
            label: 'Tavern / Social',
            icon: '🍺',
            color: 'amber',
            size: '1x1',
            action: {
              kind: 'musicFilter',
              filter: {
                dims: { theme: ['social'] },
                minIntensity: 0,
                search: '',
              },
            },
          },
          {
            id: 'btn-macro-combat',
            label: 'Combat!',
            icon: '🔥',
            color: 'crimson',
            size: '2x1',
            action: {
              kind: 'macro',
              actions: [
                {
                  kind: 'musicFilter',
                  filter: {
                    dims: { theme: ['battle'], mood: ['tense'] },
                    minIntensity: 0,
                    search: '',
                  },
                },
                { kind: 'navigate', to: '/tracker' },
              ],
            },
          },
        ],
      },
    ],
  };
}
