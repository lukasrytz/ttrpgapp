import { describe, expect, it } from 'vitest';
import {
  EMPTY_ENCOUNTER,
  applyCombatantHp,
  endCombat,
  nextTurn,
  previousTurn,
  sortedCombatants,
  type Combatant,
  type Encounter,
} from '../src/trackerTypes.js';

function makeCombatant(id: string, name: string, initiative: number): Combatant {
  return {
    id,
    name,
    initiative,
    hp: 10,
    maxHp: 10,
    ac: 12,
    conditions: [],
    exhaustion: 0,
    concentration: false,
    isPlayer: false,
    deathSaves: { successes: 0, failures: 0 },
  };
}

describe('trackerTypes pure reducers', () => {
  const c1 = makeCombatant('1', 'Alice', 18);
  const c2 = makeCombatant('2', 'Bob', 12);
  const c3 = makeCombatant('3', 'Charlie', 8);

  const testEncounter: Encounter = {
    round: 1,
    turnIndex: 0,
    combatants: [c2, c3, c1], // unsorted input
  };

  it('sortedCombatants sorts by initiative descending then name', () => {
    const sorted = sortedCombatants(testEncounter);
    expect(sorted.map((c) => c.name)).toEqual(['Alice', 'Bob', 'Charlie']);
  });

  describe('nextTurn', () => {
    it('returns untouched encounter when combatants is empty', () => {
      expect(nextTurn(EMPTY_ENCOUNTER)).toEqual(EMPTY_ENCOUNTER);
    });

    it('starts combat when turnIndex is -1', () => {
      const enc: Encounter = { round: 0, turnIndex: -1, combatants: [c1, c2] };
      const next = nextTurn(enc);
      expect(next.round).toBe(1);
      expect(next.turnIndex).toBe(0);
    });

    it('advances turn within the same round', () => {
      const next = nextTurn(testEncounter);
      expect(next.round).toBe(1);
      expect(next.turnIndex).toBe(1);
    });

    it('wraps around to next round after the last combatant', () => {
      const lastTurn: Encounter = { ...testEncounter, round: 1, turnIndex: 2 };
      const next = nextTurn(lastTurn);
      expect(next.round).toBe(2);
      expect(next.turnIndex).toBe(0);
    });
  });

  describe('previousTurn', () => {
    it('returns untouched encounter when empty or not started', () => {
      expect(previousTurn(EMPTY_ENCOUNTER)).toEqual(EMPTY_ENCOUNTER);
      const unstarted: Encounter = { round: 0, turnIndex: -1, combatants: [c1] };
      expect(previousTurn(unstarted)).toEqual(unstarted);
    });

    it('moves turn backward within the same round', () => {
      const enc: Encounter = { ...testEncounter, round: 2, turnIndex: 2 };
      const prev = previousTurn(enc);
      expect(prev.round).toBe(2);
      expect(prev.turnIndex).toBe(1);
    });

    it('wraps to previous round last combatant if at turn 0 and round > 1', () => {
      const enc: Encounter = { ...testEncounter, round: 2, turnIndex: 0 };
      const prev = previousTurn(enc);
      expect(prev.round).toBe(1);
      expect(prev.turnIndex).toBe(2); // 3 combatants -> index 2
    });

    it('stays at round 1 turn 0 if already at round 1 turn 0', () => {
      const enc: Encounter = { ...testEncounter, round: 1, turnIndex: 0 };
      const prev = previousTurn(enc);
      expect(prev.round).toBe(1);
      expect(prev.turnIndex).toBe(0);
    });
  });

  describe('endCombat', () => {
    it('resets encounter to EMPTY_ENCOUNTER', () => {
      expect(endCombat(testEncounter)).toEqual(EMPTY_ENCOUNTER);
    });
  });

  describe('applyCombatantHp', () => {
    it('computes DC 10 minimum or half damage on non-lethal damage while concentrating', () => {
      const conc: Combatant = { ...makeCombatant('4', 'Mage', 14), hp: 40, maxHp: 40, concentration: true };

      const small = applyCombatantHp(conc, 35); // 5 dmg -> DC 10
      expect(small.combatant.hp).toBe(35);
      expect(small.combatant.concentration).toBe(true);
      expect(small.concentrationDropped).toBe(false);
      expect(small.concentrationDc).toBe(10);

      const big = applyCombatantHp(conc, 14); // 26 dmg -> DC 13
      expect(big.combatant.hp).toBe(14);
      expect(big.combatant.concentration).toBe(true);
      expect(big.concentrationDropped).toBe(false);
      expect(big.concentrationDc).toBe(13);
    });

    it('drops concentration and resets death saves when reduced to 0 HP', () => {
      const conc: Combatant = {
        ...makeCombatant('4', 'Mage', 14),
        hp: 12,
        maxHp: 40,
        concentration: true,
        deathSaves: { successes: 2, failures: 1 },
      };

      const lethal = applyCombatantHp(conc, -4);
      expect(lethal.combatant.hp).toBe(0);
      expect(lethal.combatant.concentration).toBe(false);
      expect(lethal.combatant.deathSaves).toEqual({ successes: 0, failures: 0 });
      expect(lethal.concentrationDropped).toBe(true);
      expect(lethal.concentrationDc).toBeNull();
    });

    it('does not prompt concentration check when healing or when not concentrating', () => {
      const conc: Combatant = { ...makeCombatant('4', 'Mage', 14), hp: 20, maxHp: 40, concentration: true };
      const healed = applyCombatantHp(conc, 30);
      expect(healed.combatant.hp).toBe(30);
      expect(healed.combatant.concentration).toBe(true);
      expect(healed.concentrationDropped).toBe(false);
      expect(healed.concentrationDc).toBeNull();

      const nonConc: Combatant = { ...makeCombatant('5', 'Fighter', 12), hp: 30, maxHp: 40, concentration: false };
      const hurt = applyCombatantHp(nonConc, 10);
      expect(hurt.concentrationDropped).toBe(false);
      expect(hurt.concentrationDc).toBeNull();
    });
  });
});
