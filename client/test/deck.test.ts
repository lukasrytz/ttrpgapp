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

  it('migrates valid counter actions', () => {
    const raw = {
      pages: [
        {
          id: 'p1',
          name: 'CounterPage',
          buttons: [
            {
              id: 'c1',
              label: '+1 Segment',
              action: { kind: 'counter', counterId: 'clock-1', name: 'Tension', max: 6, delta: 1 },
            },
          ],
        },
      ],
    };

    const migrated = migrateDeck(raw);
    const btn = migrated.pages[0]!.buttons[0]!;
    expect(btn.action).toEqual({
      kind: 'counter',
      counterId: 'clock-1',
      name: 'Tension',
      max: 6,
      delta: 1,
    });
  });

  it('migrates valid roll actions', () => {
    const raw = {
      pages: [
        {
          id: 'p1',
          name: 'RollPage',
          buttons: [
            {
              id: 'r1',
              label: 'Fireball',
              action: { kind: 'roll', formula: '8d6', label: 'Fireball Damage' },
            },
          ],
        },
      ],
    };

    const migrated = migrateDeck(raw);
    const btn = migrated.pages[0]!.buttons[0]!;
    expect(btn.action).toEqual({
      kind: 'roll',
      formula: '8d6',
      label: 'Fireball Damage',
    });
  });

  it('migrates valid openEncounter actions', () => {
    const raw = {
      pages: [
        {
          id: 'p1',
          name: 'EncounterPage',
          buttons: [
            {
              id: 'e1',
              label: 'Goblin Ambush',
              action: { kind: 'openEncounter', encounterId: 'enc-42', autoStart: true },
            },
          ],
        },
      ],
    };

    const migrated = migrateDeck(raw);
    const btn = migrated.pages[0]!.buttons[0]!;
    expect(btn.action).toEqual({
      kind: 'openEncounter',
      encounterId: 'enc-42',
      autoStart: true,
    });
  });

  it('migrates valid pluginAction actions', () => {
    const raw = {
      pages: [
        {
          id: 'p1',
          name: 'CombatPage',
          buttons: [
            {
              id: 'p1',
              label: 'Next Turn',
              action: { kind: 'pluginAction', pluginId: 'dnd5e', actionId: 'nextTurn', label: 'Next Turn' },
            },
          ],
        },
      ],
    };

    const migrated = migrateDeck(raw);
    const btn = migrated.pages[0]!.buttons[0]!;
    expect(btn.action).toEqual({
      kind: 'pluginAction',
      pluginId: 'dnd5e',
      actionId: 'nextTurn',
      label: 'Next Turn',
    });
  });

  it('migrates valid scene actions', () => {
    const raw = {
      pages: [
        {
          id: 'p1',
          name: 'ScenePage',
          buttons: [
            {
              id: 's1',
              label: 'Tavern',
              action: { kind: 'scene', sceneId: 'tavern-1', name: 'Tavern' },
            },
          ],
        },
      ],
    };

    const migrated = migrateDeck(raw);
    const btn = migrated.pages[0]!.buttons[0]!;
    expect(btn.action).toEqual({
      kind: 'scene',
      sceneId: 'tavern-1',
      name: 'Tavern',
    });
  });

  it('migrates valid quickNote actions', () => {
    const raw = {
      pages: [
        {
          id: 'p1',
          name: 'NotesPage',
          buttons: [
            {
              id: 'q1',
              label: 'Capture',
              action: { kind: 'quickNote', prompt: 'Note:', heading: 'Session Log' },
            },
          ],
        },
      ],
    };

    const migrated = migrateDeck(raw);
    const btn = migrated.pages[0]!.buttons[0]!;
    expect(btn.action).toEqual({
      kind: 'quickNote',
      prompt: 'Note:',
      heading: 'Session Log',
    });
  });

  it('migrates valid oracle, escalate, and quickNpc actions', () => {
    const raw = {
      pages: [
        {
          id: 'p1',
          name: 'OraclePage',
          buttons: [
            { id: 'o1', label: 'Oracle', action: { kind: 'oracle', odds: 'likely' } },
            { id: 'e1', label: 'Escalate', action: { kind: 'escalate' } },
            { id: 'n1', label: 'NPC', action: { kind: 'quickNpc' } },
            { id: 't1', label: 'Table', action: { kind: 'rollTable', notePath: 'tables/loot.md' } },
          ],
        },
      ],
    };

    const migrated = migrateDeck(raw);
    expect(migrated.pages[0]!.buttons[0]!.action).toEqual({
      kind: 'oracle',
      odds: 'likely',
    });
    expect(migrated.pages[0]!.buttons[1]!.action).toEqual({
      kind: 'escalate',
    });
    expect(migrated.pages[0]!.buttons[2]!.action).toEqual({
      kind: 'quickNpc',
    });
    expect(migrated.pages[0]!.buttons[3]!.action).toEqual({
      kind: 'rollTable',
      notePath: 'tables/loot.md',
    });
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
