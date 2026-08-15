import { describe, expect, it } from 'vitest';
import { parseMarkdownTable, rollOnMarkdownTable } from '@ttrpgapp/shared';

describe('parseMarkdownTable', () => {
  it('parses valid markdown tables', () => {
    const md = `
# Random Encounters

| d6 | Encounter | Danger Level |
| --- | --- | --- |
| 1 | Wandering merchant | Low |
| 2 | Goblin scouts | Medium |
| 3-4 | Owlbear tracks | High |
| 5-6 | Abandoned shrine | None |
`;

    const res = parseMarkdownTable(md);
    expect(res).not.toBeNull();
    expect(res!.headers).toEqual(['d6', 'Encounter', 'Danger Level']);
    expect(res!.rows.length).toBe(4);
    expect(res!.rows[0]).toEqual(['1', 'Wandering merchant', 'Low']);
    expect(res!.rows[1]).toEqual(['2', 'Goblin scouts', 'Medium']);
  });

  it('returns null if no markdown table exists', () => {
    const md = `# Notes\nJust regular text without tables.`;
    expect(parseMarkdownTable(md)).toBeNull();
  });
});

describe('rollOnMarkdownTable', () => {
  it('rolls a random row and formats text', () => {
    const md = `
| Roll | Loot |
| --- | --- |
| 1 | 50 gold coins |
| 2 | Healing Potion |
`;
    const res = rollOnMarkdownTable(md, () => 0.6); // picks row index 1
    expect(res).not.toBeNull();
    expect(res!.row).toEqual(['2', 'Healing Potion']);
    expect(res!.text).toBe('2 — Healing Potion');
  });

  it('returns null on invalid table markdown', () => {
    expect(rollOnMarkdownTable('No tables')).toBeNull();
  });
});
