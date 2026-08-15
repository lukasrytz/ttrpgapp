import { describe, expect, it, vi } from 'vitest';
import {
  computeTotalElapsed,
  formatClock,
  getClockState,
  pauseClock,
  recordCombatFinished,
  resetClock,
  saveClockState,
  startClock,
} from '../src/session/clock';
import { wrapSession } from '../src/session/wrapSession';
import { backend } from '../src/backend';

vi.mock('../src/backend', () => {
  const noteStore: Record<string, string> = {
    'sessions/2026-08-15.md':
      '# Session\n\n## Beat 1\n- [x] Slay the Dragon\n- [ ] Open the Chest',
  };

  return {
    backend: () => ({
      listNotes: async () => [
        {
          path: 'sessions/2026-08-15.md',
          title: 'Session',
          isSession: true,
          modifiedAt: 1000,
        },
      ],
      readNote: async (path: string) => ({
        path,
        title: 'Session',
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

describe('session clock', () => {
  it('formats clock values into human readable strings', () => {
    expect(formatClock(0)).toBe('0m');
    expect(formatClock(59)).toBe('0m');
    expect(formatClock(120)).toBe('2m');
    expect(formatClock(3600)).toBe('1h 0m');
    expect(formatClock(8040)).toBe('2h 14m');
  });

  it('starts, pauses, records combat, and resets clock state', () => {
    resetClock();
    expect(getClockState().isRunning).toBe(false);

    startClock();
    expect(getClockState().isRunning).toBe(true);

    pauseClock();
    expect(getClockState().isRunning).toBe(false);

    recordCombatFinished(4);
    expect(getClockState().combatsCount).toBe(1);
    expect(getClockState().combatRounds).toBe(4);

    resetClock();
    expect(getClockState().combatsCount).toBe(0);
  });
});

describe('wrapSession', () => {
  it('appends wrap summary with completed tasks to active note and resets clock', async () => {
    saveClockState({
      startTime: null,
      elapsedSeconds: 7200, // 2h
      isRunning: false,
      targetMinutes: 210,
      combatsCount: 2,
      combatRounds: 8,
    });

    const res = await wrapSession();
    expect(res.path).toBe('sessions/2026-08-15.md');
    expect(res.summary).toContain('Session Wrap Summary');
    expect(res.summary).toContain('2h 0m');
    expect(res.summary).toContain('2 encounters (8 rounds total)');
    expect(res.summary).toContain('[x] Slay the Dragon');
    expect(res.summary).not.toContain('Open the Chest');

    const note = await backend().readNote(res.path);
    expect(note.content).toContain('Session Wrap Summary');

    // Clock should be reset
    expect(getClockState().combatsCount).toBe(0);
  });
});
