export const CONDITIONS = [
  'blinded',
  'charmed',
  'deafened',
  'frightened',
  'grappled',
  'incapacitated',
  'invisible',
  'paralyzed',
  'petrified',
  'poisoned',
  'prone',
  'restrained',
  'stunned',
  'unconscious',
] as const;

export interface Combatant {
  id: string;
  name: string;
  initiative: number;
  hp: number;
  maxHp: number;
  ac: number | null;
  /** Entries from CONDITIONS; exhaustion is tracked separately by level. */
  conditions: string[];
  /** 0 = none, 1-6 per the 5e exhaustion table */
  exhaustion: number;
  concentration: boolean;
  isPlayer: boolean;
  deathSaves: { successes: number; failures: number };
  /** Set when added from the compendium; enables the inline stat block. */
  monsterRef?: { packId: string; entryId: string };
  /** 5e hit dice formula, e.g. "8d8 + 16" */
  hitDice?: string;
  /** Ability names marked used (nag-until-used chips). */
  usedAbilities?: string[];
}

export interface Encounter {
  round: number;
  /** Index into the initiative-sorted combatant list; -1 = not started */
  turnIndex: number;
  combatants: Combatant[];
}

export const EMPTY_ENCOUNTER: Encounter = { round: 0, turnIndex: -1, combatants: [] };

/** Initiative order: highest first, ties broken by name for stability. */
export function sortedCombatants(e: Encounter): Combatant[] {
  return [...e.combatants].sort(
    (a, b) => b.initiative - a.initiative || a.name.localeCompare(b.name),
  );
}

export function nextTurn(e: Encounter): Encounter {
  const n = sortedCombatants(e).length;
  if (n === 0) return e;
  if (e.turnIndex < 0) {
    return {
      ...e,
      round: 1,
      turnIndex: 0,
      combatants: e.combatants.map((c) =>
        c.usedAbilities && c.usedAbilities.length > 0 ? { ...c, usedAbilities: [] } : c,
      ),
    };
  }
  const next = e.turnIndex + 1;
  return next >= n ? { ...e, round: e.round + 1, turnIndex: 0 } : { ...e, turnIndex: next };
}

export function previousTurn(e: Encounter): Encounter {
  const n = sortedCombatants(e).length;
  if (n === 0 || e.turnIndex < 0) return e;
  if (e.turnIndex === 0) {
    if (e.round <= 1) return { ...e, round: 1, turnIndex: 0 };
    return { ...e, round: e.round - 1, turnIndex: n - 1 };
  }
  return { ...e, turnIndex: e.turnIndex - 1 };
}

export function endCombat(_e?: Encounter): Encounter {
  return EMPTY_ENCOUNTER;
}
