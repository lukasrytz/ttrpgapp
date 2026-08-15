import { describe, expect, it } from 'vitest';
import { deriveBeats, toggleTaskInMarkdown } from '../src/session/runningOrder';

describe('deriveBeats', () => {
  it('returns empty array for empty markdown', () => {
    expect(deriveBeats('')).toEqual([]);
    expect(deriveBeats('   \n  \n')).toEqual([]);
  });

  it('extracts beats with hierarchy, tasks, summaries, and wiki-links', () => {
    const md = `
# Session 12: The Sunken Crypt

The party arrives at the overgrown graveyard outside the old citadel walls.

- [x] Investigate the broken seal on the mausoleum
- [ ] Fight the [[Goblin Boss|Grizzle the Red]] and [[Skeleton]] guards
- [ ] Recover the [[Amulet of Health]]

## Beat 2: The Inner Sanctum

A cold mist swirls across the flooded stone chamber. What lies beneath?

- [ ] Disable the poison needle trap
- [ ] Confront [[Lich|The Bone King]]
`;

    const beats = deriveBeats(md);
    expect(beats.length).toBe(2);

    expect(beats[0]!.heading).toBe('Session 12: The Sunken Crypt');
    expect(beats[0]!.level).toBe(1);
    expect(beats[0]!.summary).toBe(
      'The party arrives at the overgrown graveyard outside the old citadel walls.',
    );
    expect(beats[0]!.tasks).toEqual([
      { text: 'Investigate the broken seal on the mausoleum', done: true },
      { text: 'Fight the [[Goblin Boss|Grizzle the Red]] and [[Skeleton]] guards', done: false },
      { text: 'Recover the [[Amulet of Health]]', done: false },
    ]);
    expect(beats[0]!.links).toEqual([
      { target: 'Goblin Boss', display: 'Grizzle the Red' },
      { target: 'Skeleton', display: 'Skeleton' },
      { target: 'Amulet of Health', display: 'Amulet of Health' },
    ]);

    expect(beats[1]!.heading).toBe('Beat 2: The Inner Sanctum');
    expect(beats[1]!.level).toBe(2);
    expect(beats[1]!.summary).toBe(
      'A cold mist swirls across the flooded stone chamber. What lies beneath?',
    );
    expect(beats[1]!.tasks).toEqual([
      { text: 'Disable the poison needle trap', done: false },
      { text: 'Confront [[Lich|The Bone King]]', done: false },
    ]);
    expect(beats[1]!.links).toEqual([{ target: 'Lich', display: 'The Bone King' }]);
  });

  it('truncates summaries longer than 120 characters', () => {
    const md = `
# Long Scene
This is a very long descriptive paragraph intended to set the mood for the ancient crypt where the players must navigate through dark corridors filled with spiders and crumbling stones.
`;
    const beats = deriveBeats(md);
    expect(beats.length).toBe(1);
    expect(beats[0]!.summary.length).toBeLessThanOrEqual(120);
    expect(beats[0]!.summary.endsWith('…')).toBe(true);
  });
});

describe('toggleTaskInMarkdown', () => {
  it('toggles task state in markdown', () => {
    const md = `# Notes\n- [ ] Task 1\n- [x] Task 2`;
    const toggled = toggleTaskInMarkdown(md, 'Task 1', true);
    expect(toggled).toBe('# Notes\n- [x] Task 1\n- [x] Task 2');

    const untoggled = toggleTaskInMarkdown(toggled, 'Task 2', false);
    expect(untoggled).toBe('# Notes\n- [x] Task 1\n- [ ] Task 2');
  });
});
