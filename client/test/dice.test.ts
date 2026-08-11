import { describe, expect, it } from 'vitest';
import { rollDice } from '../src/deck/dice';

describe('rollDice', () => {
  it('parses and rolls simple dice expressions like 2d6+3', () => {
    const res = rollDice('2d6+3');
    expect(res.formula).toBe('2d6+3');
    expect(res.count).toBe(2);
    expect(res.sides).toBe(6);
    expect(res.modifier).toBe(3);
    expect(res.allRolls.length).toBe(2);
    expect(res.total).toBe(res.allRolls[0]! + res.allRolls[1]! + 3);
  });

  it('handles negative modifiers like 1d20-2', () => {
    const res = rollDice('1d20-2');
    expect(res.count).toBe(1);
    expect(res.sides).toBe(20);
    expect(res.modifier).toBe(-2);
    expect(res.total).toBe(res.allRolls[0]! - 2);
  });

  it('handles keep-highest (kh) for advantage / stat rolls (e.g. 4d6kh3)', () => {
    const res = rollDice('4d6kh3');
    expect(res.count).toBe(4);
    expect(res.sides).toBe(6);
    expect(res.keepMode).toBe('kh');
    expect(res.keepCount).toBe(3);
    expect(res.allRolls.length).toBe(4);
    expect(res.keptRolls.length).toBe(3);

    const sortedAll = [...res.allRolls].sort((a, b) => b - a);
    expect(res.keptRolls).toEqual(sortedAll.slice(0, 3));
    expect(res.total).toBe(res.keptRolls.reduce((sum, v) => sum + v, 0));
  });

  it('handles keep-lowest (kl) for disadvantage (e.g. 2d20kl1+2)', () => {
    const res = rollDice('2d20kl1+2');
    expect(res.count).toBe(2);
    expect(res.sides).toBe(20);
    expect(res.keepMode).toBe('kl');
    expect(res.keepCount).toBe(1);
    expect(res.allRolls.length).toBe(2);
    expect(res.keptRolls.length).toBe(1);
    expect(res.keptRolls[0]).toBe(Math.min(...res.allRolls));
    expect(res.total).toBe(res.keptRolls[0]! + 2);
  });

  it('throws for invalid formulas', () => {
    expect(() => rollDice('invalid-dice')).toThrow();
  });
});
