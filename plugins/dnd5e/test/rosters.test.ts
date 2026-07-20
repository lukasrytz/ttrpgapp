import { describe, expect, it } from 'vitest';
import { instantiate, type PartyMember, type SavedEncounter } from '../src/rosters';

// Deterministic rng: always 0 → d20 rolls a 1, so initiative == 1 + modifier.
const rng = () => 0;

const encounter: SavedEncounter = {
  id: 'e1',
  name: 'Goblin Ambush',
  notes: '',
  groups: [
    { packId: 'dnd5e-srd', entryId: 'monster:goblin', name: 'Goblin', count: 3, hp: 7, ac: 15, dexMod: 2 },
    { packId: 'dnd5e-srd', entryId: 'monster:hobgoblin', name: 'Hobgoblin', count: 1, hp: 11, ac: 18, dexMod: 1 },
  ],
};

const party: PartyMember[] = [
  { id: 'p1', name: 'Thora', maxHp: 24, ac: 16, initiativeBonus: 3, passivePerception: 12 },
  { id: 'p2', name: 'Eldrin', maxHp: 18, ac: 12, initiativeBonus: 2, passivePerception: 14 },
];

describe('instantiate', () => {
  it('expands monster counts with numbered names and bare singletons', () => {
    const c = instantiate(encounter, [], rng);
    const names = c.map((x) => x.name);
    expect(names).toEqual(['Goblin 1', 'Goblin 2', 'Goblin 3', 'Hobgoblin']);
  });

  it('rolls initiative as d20 + modifier and sets full HP + monsterRef', () => {
    const [goblin] = instantiate(encounter, [], rng);
    expect(goblin!.initiative).toBe(1 + 2); // d20(=1) + dexMod
    expect(goblin!).toMatchObject({ hp: 7, maxHp: 7, ac: 15, isPlayer: false });
    expect(goblin!.monsterRef).toEqual({ packId: 'dnd5e-srd', entryId: 'monster:goblin' });
  });

  it('adds chosen party members as players at full HP', () => {
    const c = instantiate(encounter, party, rng);
    const thora = c.find((x) => x.name === 'Thora')!;
    expect(thora).toMatchObject({ hp: 24, maxHp: 24, ac: 16, isPlayer: true });
    expect(thora.initiative).toBe(1 + 3);
    expect(c.filter((x) => x.isPlayer)).toHaveLength(2);
  });

  it('numbers a name shared between a party member and a monster group', () => {
    const enc: SavedEncounter = {
      id: 'e2',
      name: 'Doppelganger',
      notes: '',
      groups: [{ packId: 'p', entryId: 'e', name: 'Thora', count: 1, hp: 5, ac: 10, dexMod: 0 }],
    };
    const names = instantiate(enc, party, rng).map((x) => x.name);
    const thoras = names.filter((n) => n.startsWith('Thora'));
    expect(thoras).toHaveLength(2);
    expect(new Set(thoras).size).toBe(2); // distinct despite the name clash
  });

  it('gives every combatant a unique id', () => {
    const c = instantiate(encounter, party, rng);
    expect(new Set(c.map((x) => x.id)).size).toBe(c.length);
  });
});
