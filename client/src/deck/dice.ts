export interface DiceRollResult {
  formula: string;
  count: number;
  sides: number;
  modifier: number;
  keepMode?: 'kh' | 'kl';
  keepCount?: number;
  allRolls: number[];
  keptRolls: number[];
  total: number;
}

/** Evaluates a dice expression like 2d6+3, 1d20, 4d6kh3, 2d20kh1+5, +3, 8 */
export function rollDice(rawFormula: string): DiceRollResult {
  const formula = rawFormula.trim();
  const pattern = /^\s*(?:(\d*)d(\d+)(?:(kh|kl)(\d+))?)?\s*([+-]?\s*\d+)?\s*$/i;
  const match = pattern.exec(formula);

  if (!match) {
    throw new Error(`Invalid dice formula: "${rawFormula}"`);
  }

  const [, countStr, sidesStr, keepModeRaw, keepCountStr, modifierStr] = match;

  const count = countStr ? parseInt(countStr, 10) : sidesStr ? 1 : 0;
  const sides = sidesStr ? parseInt(sidesStr, 10) : 0;
  const modifier = modifierStr ? parseInt(modifierStr.replace(/\s+/g, ''), 10) : 0;
  const keepMode = keepModeRaw ? (keepModeRaw.toLowerCase() as 'kh' | 'kl') : undefined;
  const keepCount = keepCountStr ? parseInt(keepCountStr, 10) : undefined;

  const allRolls: number[] = [];
  for (let i = 0; i < count; i++) {
    const roll = Math.floor(Math.random() * sides) + 1;
    allRolls.push(roll);
  }

  let keptRolls = [...allRolls];
  if (keepMode && keepCount !== undefined && keepCount < keptRolls.length) {
    if (keepMode === 'kh') {
      keptRolls.sort((a, b) => b - a);
      keptRolls = keptRolls.slice(0, keepCount);
    } else if (keepMode === 'kl') {
      keptRolls.sort((a, b) => a - b);
      keptRolls = keptRolls.slice(0, keepCount);
    }
  }

  const diceSum = keptRolls.reduce((sum, r) => sum + r, 0);
  const total = diceSum + modifier;

  return {
    formula,
    count,
    sides,
    modifier,
    keepMode,
    keepCount,
    allRolls,
    keptRolls,
    total,
  };
}
