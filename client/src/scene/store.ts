import { Preferences } from '@capacitor/preferences';
import { migrateScenes, type Scene, type SceneLibrary } from '@ttrpgapp/shared';
import { backend } from '../backend';

const SCENE_NS = 'deck';
const SCENE_KEY = 'scenes';
const PREF_ACTIVE_ID = 'scene.active.id';
const PREF_ACTIVE_TS = 'scene.active.enteredAt';

export async function loadSceneLibrary(): Promise<SceneLibrary> {
  try {
    const raw = await backend().kvGet(SCENE_NS, SCENE_KEY);
    if (!raw) return { version: 1, scenes: [] };
    return migrateScenes(JSON.parse(raw));
  } catch {
    return { version: 1, scenes: [] };
  }
}

export async function saveSceneLibrary(lib: SceneLibrary): Promise<void> {
  await backend().kvSet(SCENE_NS, SCENE_KEY, JSON.stringify(lib));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('ttrpg-local-changed'));
    window.dispatchEvent(new CustomEvent('ttrpg-sync-updated'));
  }
}

export async function getActiveSceneState(): Promise<{
  sceneId: string | null;
  enteredAt: number | null;
}> {
  const { value: id } = await Preferences.get({ key: PREF_ACTIVE_ID });
  const { value: ts } = await Preferences.get({ key: PREF_ACTIVE_TS });
  return {
    sceneId: id ?? null,
    enteredAt: ts ? Number(ts) : null,
  };
}

export async function setActiveSceneState(sceneId: string | null): Promise<void> {
  if (sceneId) {
    await Preferences.set({ key: PREF_ACTIVE_ID, value: sceneId });
    await Preferences.set({ key: PREF_ACTIVE_TS, value: String(Date.now()) });
  } else {
    await Preferences.remove({ key: PREF_ACTIVE_ID });
    await Preferences.remove({ key: PREF_ACTIVE_TS });
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ttrpg-scene-changed', { detail: { sceneId } }));
  }
}

export async function getSceneById(id: string): Promise<Scene | null> {
  const lib = await loadSceneLibrary();
  return lib.scenes.find((s) => s.id === id) ?? null;
}
