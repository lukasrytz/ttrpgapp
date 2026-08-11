import { describe, expect, it } from 'vitest';
import { migrateDeck } from '@ttrpgapp/shared';
import { starterDeck } from '../src/deck/starter';
import type { DeckButton } from '@ttrpgapp/shared';

describe('migrateDeck', () => {
  it('returns empty pages layout for non-object or null input', () => {
    expect(migrateDeck(null)).toEqual({ version: 1, pages: [] });
    expect(migrateDeck('invalid')).toEqual({ version: 1, pages: [] });
  });

  it('drops malformed buttons and preserves valid buttons', () => {
    const raw = {
      version: 1,
      pages: [
        {
          id: 'p1',
          name: 'Main',
          buttons: [
            { id: 'b1', label: 'Valid', action: { kind: 'navigate', to: '/music' } },
            { id: 'b2', label: 'Invalid Action', action: { kind: 'unknownKind' } },
            'not-a-button',
          ],
        },
      ],
    };

    const migrated = migrateDeck(raw);
    expect(migrated.pages.length).toBe(1);
    expect(migrated.pages[0]!.buttons.length).toBe(1);
    expect(migrated.pages[0]!.buttons[0]!.id).toBe('b1');
  });

  it('handles macro buttons, dropping nested macros and malformed entries', () => {
    const raw = {
      pages: [
        {
          id: 'p1',
          name: 'MacroPage',
          buttons: [
            {
              id: 'm1',
              label: 'My Macro',
              action: {
                kind: 'macro',
                actions: [
                  { kind: 'navigate', to: '/notes' },
                  { kind: 'macro', actions: [{ kind: 'navigate', to: '/music' }] }, // nested macro -> dropped
                  { kind: 'invalidLeaf' }, // malformed -> dropped
                  { kind: 'sfxLoop', sig: 'loop1|5', name: 'Loop 1' }, // missing mode -> defaults to 'toggle'
                ],
              },
            },
          ],
        },
      ],
    };

    const migrated = migrateDeck(raw);
    const btn = migrated.pages[0]!.buttons[0]!;
    expect(btn.action.kind).toBe('macro');
    if (btn.action.kind === 'macro') {
      expect(btn.action.actions.length).toBe(2);
      expect(btn.action.actions[0]).toEqual({ kind: 'navigate', to: '/notes' });
      expect(btn.action.actions[1]).toEqual({
        kind: 'sfxLoop',
        sig: 'loop1|5',
        name: 'Loop 1',
        volume: 1,
        mode: 'toggle',
      });
    }
  });
});

describe('starterDeck', () => {
  it('returns a populated starter layout', () => {
    const deck = starterDeck();
    expect(deck.version).toBe(1);
    expect(deck.pages.length).toBeGreaterThan(0);
    expect(deck.pages[0]!.buttons.length).toBeGreaterThan(0);
  });
});
