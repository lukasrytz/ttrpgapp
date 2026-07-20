import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CompendiumIndex, type CompendiumPack } from '@ttrpgapp/shared';

const here = path.dirname(fileURLToPath(import.meta.url));
const pack = JSON.parse(
  fs.readFileSync(path.join(here, '..', 'data', 'srd-pack.json'), 'utf-8'),
) as CompendiumPack;

const index = new CompendiumIndex();
index.addPack(pack);

describe('compendium search over the SRD pack', () => {
  it('ranks name prefix matches first', () => {
    expect(index.search('grap')[0]!.name).toBe('Grappled');
    expect(index.search('fireb')[0]!.name).toBe('Fireball');
  });

  it('matches multi-word queries as word prefixes', () => {
    const hits = index.search('adult red drag');
    expect(hits[0]!.name).toBe('Adult Red Dragon');
  });

  it('finds body-only matches with a snippet', () => {
    const hits = index.search('bat guano');
    const fireball = hits.find((h) => h.name === 'Fireball');
    expect(fireball).toBeDefined();
    expect(fireball!.snippet.toLowerCase()).toContain('bat guano');
  });

  it('returns nothing for empty queries', () => {
    expect(index.search('  ')).toEqual([]);
  });

  it('resolves entries by id', () => {
    expect(index.getEntry(pack.id, 'condition:grappled')?.name).toBe('Grappled');
    expect(index.getEntry(pack.id, 'nope')).toBeNull();
  });
});
