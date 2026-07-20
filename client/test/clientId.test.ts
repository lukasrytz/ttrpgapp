import { describe, expect, it } from 'vitest';
import { normalizeClientId } from '../src/sync/manager';

const ID = '204369640551-nl7q1gna5gkngr9ekmkorldq8hl82f8g.apps.googleusercontent.com';

describe('normalizeClientId', () => {
  it('strips what a console copy/paste tends to bring along', () => {
    expect(normalizeClientId(`${ID}/`)).toBe(ID);
    expect(normalizeClientId(`  ${ID} `)).toBe(ID);
    expect(normalizeClientId(`"${ID}"`)).toBe(ID);
    expect(normalizeClientId(`${ID}///`)).toBe(ID);
  });

  it('leaves a clean id alone', () => {
    expect(normalizeClientId(ID)).toBe(ID);
  });
});
