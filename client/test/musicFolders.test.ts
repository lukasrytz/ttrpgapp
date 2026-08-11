import { describe, expect, it, vi } from 'vitest';
import { filterByFolders, folderKey, foldersOf, getSfxFolders, setSfxFolders } from '../src/music/folders';

const { prefs } = vi.hoisted(() => ({
  prefs: new Map<string, string>(),
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

const track = (folder: string, path: string) => ({ folder, path });

describe('folderKey', () => {
  it('takes the containing directory of a device path', () => {
    expect(folderKey(track('', '/storage/emulated/0/Music/ttrpg/Battle.mp3'))).toBe(
      '/storage/emulated/0/Music/ttrpg',
    );
  });

  it('joins the server build’s folder root with the relative path', () => {
    expect(folderKey(track('./music', 'ambient/forest/Rain.ogg'))).toBe('./music/ambient/forest');
    expect(folderKey(track('./music/', 'Rain.ogg'))).toBe('./music');
  });

  it('normalises backslashes and handles files at the root', () => {
    expect(folderKey(track('C:\\Music', 'ttrpg\\Battle.mp3'))).toBe('C:/Music/ttrpg');
    expect(folderKey(track('', 'Battle.mp3'))).toBe('');
    expect(folderKey(track('', '/Battle.mp3'))).toBe('/');
  });
});

describe('foldersOf / filterByFolders', () => {
  const tracks = [
    track('', '/sd/pop/Hit.mp3'),
    track('', '/sd/ttrpg/Battle.mp3'),
    track('', '/sd/ttrpg/Tavern.mp3'),
  ];

  it('groups with counts, sorted by path', () => {
    expect(foldersOf(tracks, null)).toEqual([
      { path: '/sd/pop', label: 'pop', trackCount: 1, enabled: true },
      { path: '/sd/ttrpg', label: 'ttrpg', trackCount: 2, enabled: true },
    ]);
  });

  it('marks only selected folders enabled', () => {
    expect(foldersOf(tracks, new Set(['/sd/ttrpg'])).map((f) => f.enabled)).toEqual([false, true]);
  });

  it('filters tracks to the selection, and passes everything through when unset', () => {
    expect(filterByFolders(tracks, new Set(['/sd/ttrpg'])).length).toBe(2);
    expect(filterByFolders(tracks, null).length).toBe(3);
    expect(filterByFolders(tracks, new Set()).length).toBe(0);
  });
});

describe('getSfxFolders / setSfxFolders', () => {
  it('defaults to an empty Set when no selection is stored (opt-in)', async () => {
    const sfxFolders = await getSfxFolders();
    expect(sfxFolders).toBeInstanceOf(Set);
    expect(sfxFolders.size).toBe(0);
  });

  it('stores and retrieves selected SFX folders', async () => {
    await setSfxFolders(['/sd/sfx']);
    const sfxFolders = await getSfxFolders();
    expect(sfxFolders.has('/sd/sfx')).toBe(true);
    expect(sfxFolders.size).toBe(1);
  });
});
