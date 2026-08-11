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
  hitDice?: string;
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
 * Parse and roll a hit dice formula like "8d8 + 16", "2d8 - 1", or "4d6".
 * Returns calculated HP (minimum 1). Falls back to defaultHp if formula is omitted or invalid.
 */
export function rollHitDice(
  formula?: string,
  defaultHp = 1,
  rng: () => number = Math.random,
): number {
  if (!formula) return defaultHp;
  const match = /^(\d+)d(\d+)(?:\s*([+-])\s*(\d+))?$/i.exec(formula.trim());
  if (!match) return defaultHp;
  const numDice = parseInt(match[1]!, 10);
  const sides = parseInt(match[2]!, 10);
  const op = match[3];
  const mod = match[4] ? parseInt(match[4], 10) : 0;

  let total = 0;
  for (let i = 0; i < numDice; i++) {
    total += 1 + Math.floor(rng() * sides);
  }
  if (op === '+') total += mod;
  else if (op === '-') total -= mod;

  return Math.max(1, total);
}

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
  randomizeMonsterHp = false,
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
      const rolledHp = randomizeMonsterHp ? rollHitDice(g.hitDice, g.hp, rng) : g.hp;
      out.push({
        id: newId(),
        name: nextName(g.name, g.count > 1),
        initiative: d20(rng) + g.dexMod,
        hp: rolledHp,
        maxHp: rolledHp,
        ac: g.ac,
        conditions: [],
        exhaustion: 0,
        concentration: false,
        isPlayer: false,
        deathSaves: emptyDeathSaves(),
        monsterRef: { packId: g.packId, entryId: g.entryId },
        hitDice: g.hitDice,
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
