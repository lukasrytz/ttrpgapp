import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * In-memory fakes for the Capacitor plugins so the on-device backend logic
 * (tag merge, scan diff, vault/template handling) can be tested off-device.
 * Shared state lives in vi.hoisted so the (hoisted) vi.mock factories can
 * reference it without hitting a temporal-dead-zone error.
 */
const { files, prefs, state, musicListMock } = vi.hoisted(() => {
  const files = new Map<string, string>();
  const prefs = new Map<string, string>();
  const state = {
    deviceTracks: [] as {
      path: string;
      title: string;
      artist: string | null;
      durationSec: number;
    }[],
  };
  const musicListMock = vi.fn(async () => ({ tracks: state.deviceTracks }));
  return { files, prefs, state, musicListMock };
});

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => true,
    convertFileSrc: (p: string) => `file-src://${p}`,
  },
  registerPlugin: () => ({ list: musicListMock }),
}));

vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: async ({ key }: { key: string }) => ({ value: prefs.get(key) ?? null }),
    set: async ({ key, value }: { key: string; value: string }) => {
      prefs.set(key, value);
    },
    remove: async ({ key }: { key: string }) => {
      prefs.delete(key);
    },
  },
}));

vi.mock('@capacitor/filesystem', () => {
  const Directory = { External: 'EXTERNAL', Data: 'DATA' };
  const Encoding = { UTF8: 'utf8' };
  const key = (dir: string, path: string) => `${dir}:${path}`;
  return {
    Directory,
    Encoding,
    Filesystem: {
      readFile: async ({ directory, path }: { directory: string; path: string }) => {
        const k = key(directory, path);
        if (!files.has(k)) throw new Error('not found');
        return { data: files.get(k)! };
      },
      writeFile: async ({ directory, path, data }: { directory: string; path: string; data: string }) => {
        files.set(key(directory, path), data);
      },
      deleteFile: async ({ directory, path }: { directory: string; path: string }) => {
        files.delete(key(directory, path));
      },
      stat: async ({ directory, path }: { directory: string; path: string }) => {
        const prefix = key(directory, path);
        if (files.has(prefix)) return { type: 'file', mtime: 0 };
        for (const k of files.keys()) if (k.startsWith(prefix + '/')) return { type: 'directory', mtime: 0 };
        throw new Error('not found');
      },
      mkdir: async () => {},
      readdir: async ({ directory, path }: { directory: string; path: string }) => {
        const base = key(directory, path);
        const names = new Map<string, 'file' | 'directory'>();
        for (const k of files.keys()) {
          if (!k.startsWith(base + '/')) continue;
          const rest = k.slice(base.length + 1);
          const slash = rest.indexOf('/');
          if (slash < 0) names.set(rest, 'file');
          else names.set(rest.slice(0, slash), 'directory');
        }
        return {
          files: [...names].map(([name, type]) => ({ name, type, mtime: 0 })),
        };
      },
    },
  };
});

import { CapacitorBackend } from '../src/backend/capacitor';

beforeEach(() => {
  files.clear();
  prefs.clear();
  state.deviceTracks = [
    { path: '/sd/Battle.mp3', title: 'Battle', artist: 'Bard', durationSec: 90 },
    { path: '/sd/Tavern.mp3', title: 'Tavern', artist: null, durationSec: 120 },
  ];
  musicListMock.mockClear();
});

describe('CapacitorBackend music', () => {
  it('assigns stable ids and playable urls', async () => {
    const b = new CapacitorBackend();
    const tracks = await b.listTracks();
    expect(tracks.map((t) => t.title)).toEqual(['Battle', 'Tavern']);
    expect(b.trackUrl(tracks[0]!)).toBe('file-src:///sd/Battle.mp3');
  });

  it('persists and merges tags keyed by device path', async () => {
    const b = new CapacitorBackend();
    let tracks = await b.listTracks();
    await b.updateTrack(tracks[0]!.id, { intensity: 4, tags: { theme: ['Battle', 'battle', ' EPIC '] } });
    tracks = await b.listTracks();
    expect(tracks[0]!.intensity).toBe(4);
    expect(tracks[0]!.tags.theme).toEqual(['battle', 'epic']);
    expect(tracks[1]!.intensity).toBeNull();
  });

  it('keeps tags stable when track order changes', async () => {
    const b = new CapacitorBackend();
    let tracks = await b.listTracks();
    await b.updateTrack(tracks[1]!.id, { tags: { mood: ['calm'] } });
    // Tavern becomes first on next scan
    state.deviceTracks = [state.deviceTracks[1]!, state.deviceTracks[0]!];
    tracks = await b.listTracks();
    const tavern = tracks.find((t) => t.title === 'Tavern')!;
    expect(tavern.tags.mood).toEqual(['calm']);
  });

  it('lists folders with counts, all enabled until a selection is made', async () => {
    state.deviceTracks.push({ path: '/sd/ttrpg/Dungeon.mp3', title: 'Dungeon', artist: null, durationSec: 30 });
    const b = new CapacitorBackend();
    expect(await b.listMusicFolders()).toEqual([
      { path: '/sd', label: 'sd', trackCount: 2, enabled: true },
      { path: '/sd/ttrpg', label: 'ttrpg', trackCount: 1, enabled: true },
    ]);
  });

  it('restricts the library to selected folders', async () => {
    state.deviceTracks.push({ path: '/sd/ttrpg/Dungeon.mp3', title: 'Dungeon', artist: null, durationSec: 30 });
    const b = new CapacitorBackend();
    await b.setMusicFolders(['/sd/ttrpg']);
    expect((await b.listTracks()).map((t) => t.title)).toEqual(['Dungeon']);
    // The picker still sees every folder, with the selection reflected.
    expect((await b.listMusicFolders()).map((f) => [f.path, f.enabled])).toEqual([
      ['/sd', false],
      ['/sd/ttrpg', true],
    ]);
    // Clearing the selection brings everything back.
    await b.setMusicFolders(null);
    expect((await b.listTracks()).length).toBe(3);
  });

  it('keeps tags across a folder selection change', async () => {
    state.deviceTracks.push({ path: '/sd/ttrpg/Dungeon.mp3', title: 'Dungeon', artist: null, durationSec: 30 });
    const b = new CapacitorBackend();
    const all = await b.listTracks();
    const dungeon = all.find((t) => t.title === 'Dungeon')!;
    await b.updateTrack(dungeon.id, { intensity: 3 });
    await b.setMusicFolders(['/sd/ttrpg']);
    const [only] = await b.listTracks();
    expect(only!.intensity).toBe(3);
  });

  it('counts a scan against the selected folders only', async () => {
    state.deviceTracks.push({ path: '/sd/ttrpg/Dungeon.mp3', title: 'Dungeon', artist: null, durationSec: 30 });
    const b = new CapacitorBackend();
    await b.setMusicFolders(['/sd/ttrpg']);
    expect(await b.scanMusic()).toEqual({ added: 1, removed: 0, total: 1 });
    // Enabling another folder shows up as newly added tracks.
    await b.setMusicFolders(['/sd/ttrpg', '/sd']);
    expect(await b.scanMusic()).toEqual({ added: 2, removed: 0, total: 3 });
  });

  it('computes scan added/removed against saved paths', async () => {
    const b = new CapacitorBackend();
    expect(await b.scanMusic()).toEqual({ added: 2, removed: 0, total: 2 });
    state.deviceTracks.push({ path: '/sd/City.mp3', title: 'City', artist: null, durationSec: 60 });
    state.deviceTracks.shift();
    expect(await b.scanMusic()).toEqual({ added: 1, removed: 1, total: 2 });
  });
});

describe('CapacitorBackend notes', () => {
  it('seeds a template and creates a session from it', async () => {
    const b = new CapacitorBackend();
    const notes = await b.listNotes();
    expect(notes.map((n) => n.path)).toContain('template.md');

    const { path } = await b.createSession('Goblin Ambush');
    expect(path).toBe('sessions/Goblin Ambush.md');
    const note = await b.readNote(path);
    expect(note.isSession).toBe(true);
    expect(note.content).toContain('# Goblin Ambush');
    expect(note.content).not.toContain('{{title}}');
  });

  it('computes backlinks across notes', async () => {
    const b = new CapacitorBackend();
    await b.createNote('Grizzle');
    await b.createSession('Session One');
    await b.writeNote('sessions/Session One.md', 'meet [[Grizzle]] tonight');
    const grizzle = await b.readNote('Grizzle.md');
    expect(grizzle.backlinks).toContain('sessions/Session One.md');
  });

  it('rejects duplicate session titles', async () => {
    const b = new CapacitorBackend();
    await b.createSession('Dup');
    await expect(b.createSession('Dup')).rejects.toThrow('exists');
  });
});

describe('CapacitorBackend plugin KV', () => {
  it('namespaces keys per plugin', async () => {
    const b = new CapacitorBackend();
    await b.kvSet('dnd5e', 'encounter', '{"round":2}');
    expect(await b.kvGet('dnd5e', 'encounter')).toBe('{"round":2}');
    expect(await b.kvGet('other', 'encounter')).toBeNull();
  });
});
