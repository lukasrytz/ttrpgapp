import { describe, expect, it } from 'vitest';
import { d20, formatDiceResult, parseDice, rollDice, rollFormula } from '@ttrpgapp/shared';

/** Deterministic rng: every die shows its maximum face. */
const max = () => 0.999999;
/** Deterministic rng: every die shows 1. */
const min = () => 0;

describe('parseDice', () => {
  it('parses a single group with a modifier', () => {
    expect(parseDice('2d6+3')).toEqual({
      terms: [{ sign: 1, count: 2, sides: 6 }],
      modifier: 3,
    });
  });

  it('defaults an omitted count to one', () => {
    expect(parseDice('d20')).toEqual({ terms: [{ sign: 1, count: 1, sides: 20 }], modifier: 0 });
  });

  it('parses several groups in one expression', () => {
    expect(parseDice('1d8+2d6+3')).toEqual({
      terms: [
        { sign: 1, count: 1, sides: 8 },
        { sign: 1, count: 2, sides: 6 },
      ],
      modifier: 3,
    });
  });

  it('parses subtracted groups and negative modifiers', () => {
    expect(parseDice('1d20-1d4-2')).toEqual({
      terms: [
        { sign: 1, count: 1, sides: 20 },
        { sign: -1, count: 1, sides: 4 },
      ],
      modifier: -2,
    });
  });

  it('parses keep-highest and keep-lowest', () => {
    expect(parseDice('4d6kh3')?.terms[0]).toEqual({
      sign: 1,
      count: 4,
      sides: 6,
      keep: { mode: 'kh', n: 3 },
    });
    expect(parseDice('2d20kl1')?.terms[0]?.keep).toEqual({ mode: 'kl', n: 1 });
  });

  it('tolerates whitespace, as hit-dice strings carry it', () => {
    expect(parseDice('8d8 + 16')).toEqual({
      terms: [{ sign: 1, count: 8, sides: 8 }],
      modifier: 16,
    });
  });

  it('returns null rather than throwing for malformed input', () => {
    for (const bad of ['', '   ', 'abc', '2d6++3', '2d6 banana', 'd', '1d0', '2d6 1d4']) {
      expect(parseDice(bad)).toBeNull();
    }
  });

  it('refuses expressions large enough to lock the UI up', () => {
    expect(parseDice('99999d6')).toBeNull();
    expect(parseDice('1d99999999')).toBeNull();
  });
});

describe('rollFormula', () => {
  it('sums dice and modifier', () => {
    const res = rollFormula(parseDice('2d6+3')!, max);
    expect(res.allRolls).toEqual([6, 6]);
    expect(res.total).toBe(15);
  });

  it('adds every group in a multi-term expression', () => {
    const res = rollFormula(parseDice('1d8+2d6+3')!, max);
    expect(res.allRolls).toEqual([8, 6, 6]);
    expect(res.total).toBe(23);
  });

  it('subtracts groups carrying a minus sign', () => {
    const res = rollFormula(parseDice('1d20-1d4')!, max);
    expect(res.total).toBe(20 - 4);
  });

  it('keeps only the highest dice for kh', () => {
    let n = 0;
    const seq = [0.99, 0, 0.5, 0.99]; // -> 6, 1, 4, 6
    const res = rollFormula(parseDice('4d6kh3')!, () => seq[n++]!);
    expect(res.allRolls).toEqual([6, 1, 4, 6]);
    expect(res.keptRolls).toEqual([6, 6, 4]);
    expect(res.total).toBe(16);
  });

  it('keeps only the lowest die for kl (disadvantage)', () => {
    let n = 0;
    const seq = [0.99, 0.1]; // -> 20, 3
    const res = rollFormula(parseDice('2d20kl1+2')!, () => seq[n++]!);
    expect(res.keptRolls).toEqual([3]);
    expect(res.total).toBe(5);
  });

  it('never rolls below 1 or above the die size', () => {
    expect(rollFormula(parseDice('1d20')!, min).allRolls).toEqual([1]);
    expect(rollFormula(parseDice('1d20')!, max).allRolls).toEqual([20]);
  });
});

describe('rollDice', () => {
  it('parses and rolls in one step', () => {
    expect(rollDice('3d6', min).total).toBe(3);
  });

  it('throws for malformed input so callers must handle it explicitly', () => {
    expect(() => rollDice('invalid-dice')).toThrow();
    expect(() => rollDice('')).toThrow();
  });
});

describe('formatDiceResult', () => {
  it('shows the rolls and a signed modifier', () => {
    expect(formatDiceResult(rollDice('2d6+3', max))).toBe('[6, 6] +3');
    expect(formatDiceResult(rollDice('2d6-1', max))).toBe('[6, 6] -1');
  });

  it('shows which dice were kept when some were dropped', () => {
    expect(formatDiceResult(rollDice('4d6kh3', max))).toBe('[6, 6, 6, 6] keep 6, 6, 6');
  });
});

describe('d20', () => {
  it('spans 1..20', () => {
    expect(d20(min)).toBe(1);
    expect(d20(max)).toBe(20);
  });
});
