/**
 * Dice expression parsing and rolling.
 *
 * Lives in `shared` so both the client (deck roll buttons) and game-system
 * plugins (initiative, hit dice) use one implementation rather than each
 * carrying its own regex.
 *
 * Grammar: a sequence of signed terms, each either a dice group or a constant.
 *
 *   2d6+3        1d8+2d6+3        4d6kh3        2d20kh1        d20-1d4+2
 *
 * `kh`/`kl` keep the highest/lowest N dice of that group, which is all
 * advantage and disadvantage are: `2d20kh1` and `2d20kl1`.
 */

/** Guard rails so a typo like `9999d9999` cannot lock the UI up. */
const MAX_DICE_PER_ROLL = 1000;
const MAX_SIDES = 10000;

export interface DiceTerm {
  /** Whether this group is added to or subtracted from the total. */
  sign: 1 | -1;
  count: number;
  sides: number;
  keep?: { mode: 'kh' | 'kl'; n: number };
}

export interface DiceFormula {
  terms: DiceTerm[];
  /** Sum of every constant term, already signed. */
  modifier: number;
}

export interface DiceTermRoll {
  sides: number;
  sign: 1 | -1;
  /** Every die rolled for this group, in roll order. */
  all: number[];
  /** Only the dice that counted, after any keep-highest/lowest. */
  kept: number[];
}

export interface DiceRollResult {
  formula: string;
  modifier: number;
  terms: DiceTermRoll[];
  /** Every die rolled across all groups, flattened — for display. */
  allRolls: number[];
  /** Only the dice that counted toward the total, flattened. */
  keptRolls: number[];
  total: number;
}

// One signed term: either NdM with an optional keep clause, or a bare constant.
const TERM = /([+-])?\s*(?:(\d*)d(\d+)(?:(kh|kl)\s*(\d+))?|(\d+))\s*/giy;

/**
 * Parses a dice expression. Returns null for anything malformed — this never
 * throws, because the input can come from a deck button that arrived over sync
 * from another device.
 */
export function parseDice(input: string): DiceFormula | null {
  const src = input.trim();
  if (!src) return null;

  const terms: DiceTerm[] = [];
  let modifier = 0;
  let totalDice = 0;

  TERM.lastIndex = 0;
  let consumed = 0;
  let first = true;
  let match: RegExpExecArray | null;

  while ((match = TERM.exec(src)) !== null) {
    const [whole, signRaw, countRaw, sidesRaw, keepModeRaw, keepCountRaw, constRaw] = match;
    // Only the leading term may omit its sign; `2d6 1d4` is not an expression.
    if (!signRaw && !first) return null;
    const sign: 1 | -1 = signRaw === '-' ? -1 : 1;

    if (constRaw !== undefined) {
      modifier += sign * parseInt(constRaw, 10);
    } else {
      const count = countRaw ? parseInt(countRaw, 10) : 1;
      const sides = parseInt(sidesRaw!, 10);
      if (sides < 1 || sides > MAX_SIDES) return null;
      totalDice += count;
      if (totalDice > MAX_DICE_PER_ROLL) return null;

      const term: DiceTerm = { sign, count, sides };
      if (keepModeRaw && keepCountRaw) {
        const n = parseInt(keepCountRaw, 10);
        if (n < 1) return null;
        term.keep = { mode: keepModeRaw.toLowerCase() as 'kh' | 'kl', n };
      }
      terms.push(term);
    }

    consumed = TERM.lastIndex;
    first = false;
  }

  // Trailing junk (`2d6 banana`) leaves part of the input unconsumed.
  if (consumed !== src.length) return null;
  if (terms.length === 0 && modifier === 0) return null;
  return { terms, modifier };
}

/** Rolls an already-parsed formula. `rng` is injectable so tests stay deterministic. */
export function rollFormula(
  formula: DiceFormula,
  rng: () => number = Math.random,
  label = '',
): DiceRollResult {
  const terms: DiceTermRoll[] = [];
  const allRolls: number[] = [];
  const keptRolls: number[] = [];
  let total = formula.modifier;

  for (const term of formula.terms) {
    const all: number[] = [];
    for (let i = 0; i < term.count; i++) all.push(1 + Math.floor(rng() * term.sides));

    let kept = [...all];
    if (term.keep && term.keep.n < kept.length) {
      kept.sort((a, b) => (term.keep!.mode === 'kh' ? b - a : a - b));
      kept = kept.slice(0, term.keep.n);
    }

    total += term.sign * kept.reduce((sum, r) => sum + r, 0);
    terms.push({ sides: term.sides, sign: term.sign, all, kept });
    allRolls.push(...all);
    keptRolls.push(...kept);
  }

  return { formula: label, modifier: formula.modifier, terms, allRolls, keptRolls, total };
}

/**
 * Parses and rolls in one step. Throws on a malformed expression — callers that
 * accept user input should either catch, or use `parseDice` to validate first.
 */
export function rollDice(input: string, rng: () => number = Math.random): DiceRollResult {
  const formula = parseDice(input);
  if (!formula) throw new Error(`Invalid dice formula: "${input}"`);
  return rollFormula(formula, rng, input.trim());
}

/** Human-readable breakdown, e.g. `[6, 3] +2` or `[6, ~~1~~] kh1`. */
export function formatDiceResult(result: DiceRollResult): string {
  const parts = result.terms.map((t) => {
    const dropped = t.all.length - t.kept.length;
    const rolls = `[${t.all.join(', ')}]`;
    return dropped > 0 ? `${rolls} keep ${t.kept.join(', ')}` : rolls;
  });
  if (result.modifier !== 0) {
    parts.push(result.modifier > 0 ? `+${result.modifier}` : `${result.modifier}`);
  }
  return parts.join(' ');
}

/** A single d20. The one roll this app makes constantly. */
export function d20(rng: () => number = Math.random): number {
  return 1 + Math.floor(rng() * 20);
}
