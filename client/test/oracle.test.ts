import { describe, expect, it } from 'vitest';
import { rollOracle, ORACLE_ACTIONS, ORACLE_THEMES } from '@ttrpgapp/shared';

describe('rollOracle', () => {
  it('rolls valid oracle answers with prompt action and theme', () => {
    for (let i = 0; i < 50; i++) {
      const res = rollOracle('even');
      expect(['yesAnd', 'yes', 'yesBut', 'noBut', 'no', 'noAnd']).toContain(res.answer);
      expect(ORACLE_ACTIONS).toContain(res.action);
      expect(ORACLE_THEMES).toContain(res.theme);
      expect(res.text).toContain(res.action);
      expect(res.text).toContain(res.theme);
    }
  });

  it('supports likely and unlikely odds', () => {
    const likely = rollOracle('likely');
    expect(likely.answerLabel).toBeDefined();

    const unlikely = rollOracle('unlikely');
    expect(unlikely.answerLabel).toBeDefined();
  });
});
