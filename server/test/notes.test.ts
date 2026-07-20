import { describe, expect, it } from 'vitest';
import { extractLinks } from '../src/notes.js';

describe('extractLinks', () => {
  it('finds wiki links', () => {
    expect(extractLinks('meet [[Grizzle]] at the [[Rusty Nail]]')).toEqual([
      'Grizzle',
      'Rusty Nail',
    ]);
  });

  it('supports labels and dedupes', () => {
    expect(extractLinks('[[Grizzle|the king]] and [[Grizzle]] again')).toEqual(['Grizzle']);
  });

  it('ignores plain brackets', () => {
    expect(extractLinks('a [link](url) and [note]')).toEqual([]);
  });
});
