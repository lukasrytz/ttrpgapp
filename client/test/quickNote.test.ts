import { describe, expect, it, vi } from 'vitest';
import { appendQuickNote } from '../src/session/quickNote';
import { backend } from '../src/backend';

vi.mock('../src/backend', () => {
  const noteStore: Record<string, string> = {
    'sessions/Session 1.md': '# Session 1\n\n## In-session Notes\n\n- **18:00**: Started game',
  };

  return {
    backend: () => ({
      listNotes: async () => [
        {
          path: 'sessions/Session 1.md',
          title: 'Session 1',
          isSession: true,
          modifiedAt: 1000,
        },
      ],
      readNote: async (path: string) => ({
        path,
        title: 'Session 1',
        isSession: true,
        modifiedAt: 1000,
        content: noteStore[path] || '',
        links: [],
        backlinks: [],
      }),
      writeNote: async (path: string, content: string) => {
        noteStore[path] = content;
      },
      createSession: async (title: string) => {
        const path = `sessions/${title}.md`;
        noteStore[path] = `# ${title}\n\n`;
        return { path };
      },
    }),
  };
});

describe('appendQuickNote', () => {
  it('appends timestamped note line under existing heading', async () => {
    let flushed = false;
    const target = new EventTarget();
    const prevWindow = (globalThis as Record<string, unknown>)['window'];
    (globalThis as Record<string, unknown>)['window'] = target;

    target.addEventListener('ttrpg-flush-notes', () => {
      flushed = true;
    });

    try {
      const res = await appendQuickNote('Found a golden goblet', 'In-session Notes');
      expect(res.path).toBe('sessions/Session 1.md');
      expect(flushed).toBe(true);

      const note = await backend().readNote(res.path);
      expect(note.content).toContain('## In-session Notes');
      expect(note.content).toContain('Found a golden goblet');
    } finally {
      (globalThis as Record<string, unknown>)['window'] = prevWindow;
    }
  });

  it('creates new heading if target heading does not exist', async () => {
    const res = await appendQuickNote('Gained 500 XP', 'Loot and Rewards');
    const note = await backend().readNote(res.path);
    expect(note.content).toContain('## Loot and Rewards');
    expect(note.content).toContain('Gained 500 XP');
  });
});
