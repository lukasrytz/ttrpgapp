import type { Combatant } from './trackerTypes';

/** A reusable player character for the tracker (a persistent party roster). */
export interface PartyMember {
  id: string;
  name: string;
  maxHp: number;
  ac: number | null;
  /** Added to a d20 for initiative (or override with the player's rolled value). */
  initiativeBonus: number;
  passivePerception: number | null;
}

/** One monster type + how many appear in a saved encounter. */
export interface EncounterGroup {
  packId: string;
  entryId: string;
  name: string;
  count: number;
  /** Cached stat-block fields so encounters instantiate offline. */
  hp: number;
  ac: number | null;
  dexMod: number;
}

/** A pre-planned encounter: a named roster of monster groups. */
export interface SavedEncounter {
  id: string;
  name: string;
  groups: EncounterGroup[];
  notes: string;
}

export function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function d20(rng: () => number): number {
  return 1 + Math.floor(rng() * 20);
}

const emptyDeathSaves = () => ({ successes: 0, failures: 0 });

/**
 * Expand a saved encounter plus the chosen party members into live combatants,
 * rolling initiative (d20 + modifier). Monster instances of a repeated name are
 * numbered ("Goblin 1", "Goblin 2"); unique names stay bare. Pure and
 * deterministic given `rng`, so it's unit-testable.
 */
export function instantiate(
  enc: SavedEncounter,
  party: PartyMember[],
  rng: () => number = Math.random,
): Combatant[] {
  const out: Combatant[] = [];
  const seen = new Map<string, number>();
  const nextName = (base: string, forceNumber: boolean): string => {
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return forceNumber || n > 1 ? `${base} ${n}` : base;
  };

  for (const g of enc.groups) {
    for (let i = 0; i < g.count; i++) {
      out.push({
        id: newId(),
        name: nextName(g.name, g.count > 1),
        initiative: d20(rng) + g.dexMod,
        hp: g.hp,
        maxHp: g.hp,
        ac: g.ac,
        conditions: [],
        exhaustion: 0,
        concentration: false,
        isPlayer: false,
        deathSaves: emptyDeathSaves(),
        monsterRef: { packId: g.packId, entryId: g.entryId },
      });
    }
  }

  for (const p of party) {
    out.push({
      id: newId(),
      name: nextName(p.name, false),
      initiative: d20(rng) + p.initiativeBonus,
      hp: p.maxHp,
      maxHp: p.maxHp,
      ac: p.ac,
      conditions: [],
      exhaustion: 0,
      concentration: false,
      isPlayer: true,
      deathSaves: emptyDeathSaves(),
    });
  }

  return out;
}
