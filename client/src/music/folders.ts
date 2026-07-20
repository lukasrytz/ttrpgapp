import { Preferences } from '@capacitor/preferences';
import type { MusicFolder } from '@ttrpgapp/shared';

/**
 * Folder selection for the music library. A device's audio library is mostly
 * *not* TTRPG music, so the library is restricted to folders the user picked.
 * The selection lives in Preferences (native storage on Android, localStorage
 * on web) and is applied by both backends, so the rest of the app only ever
 * sees tracks that are in the library.
 *
 * No selection stored = every folder, which is what a fresh install gets.
 */
const SELECTION_KEY = 'music.folders';

/** Just enough of a Track to locate it; server tracks are folder-root + relative path. */
type Located = { folder: string; path: string };

/** The directory a track lives in — the grouping key for selection. */
export function folderKey(track: Located): string {
  const joined = track.folder ? `${track.folder.replace(/[\\/]+$/, '')}/${track.path}` : track.path;
  const norm = joined.replace(/\\/g, '/');
  const cut = norm.lastIndexOf('/');
  if (cut < 0) return '';
  return norm.slice(0, cut) || '/';
}

function labelOf(key: string): string {
  if (!key || key === '/') return '(top level)';
  return key.slice(key.lastIndexOf('/') + 1) || key;
}

/** Selected folders, or null when every folder counts. */
export async function getFolderSelection(): Promise<Set<string> | null> {
  const { value } = await Preferences.get({ key: SELECTION_KEY });
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? new Set(parsed as string[]) : null;
  } catch {
    return null;
  }
}

/** Restrict the library to `paths`; null clears the restriction (all folders). */
export async function setFolderSelection(paths: string[] | null): Promise<void> {
  if (paths === null) await Preferences.remove({ key: SELECTION_KEY });
  else await Preferences.set({ key: SELECTION_KEY, value: JSON.stringify(paths) });
}

export function filterByFolders<T extends Located>(tracks: T[], selection: Set<string> | null): T[] {
  if (!selection) return tracks;
  return tracks.filter((t) => selection.has(folderKey(t)));
}

/** Every folder holding audio, with track counts and whether it's in the library. */
export function foldersOf(tracks: Located[], selection: Set<string> | null): MusicFolder[] {
  const counts = new Map<string, number>();
  for (const t of tracks) {
    const key = folderKey(t);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts]
    .map(([path, trackCount]) => ({
      path,
      label: labelOf(path),
      trackCount,
      enabled: selection ? selection.has(path) : true,
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
}
