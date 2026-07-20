import { CompendiumIndex } from '@ttrpgapp/shared';
import type { ClientPlugin, PluginRuntime } from '@ttrpgapp/shared/plugin-client';
import { backend } from './backend';

export const compendiumIndex = new CompendiumIndex();

/** Loads the packs of all enabled plugins into the in-memory search index. */
export async function initCompendium(plugins: ClientPlugin[], enabledIds: Set<string>) {
  compendiumIndex.clear();
  for (const plugin of plugins) {
    if (!enabledIds.has(plugin.id) || !plugin.loadPacks) continue;
    for (const pack of await plugin.loadPacks()) compendiumIndex.addPack(pack);
  }
}

export function openCompendiumEntry(packId: string, entryId: string) {
  window.dispatchEvent(new CustomEvent('open-compendium-entry', { detail: { packId, entryId } }));
}

/** Exposes host services to plugin components (see shared/plugin-client.ts). */
export function installPluginRuntime() {
  const runtime: PluginRuntime = {
    kvGet: (pluginId, key) => backend().kvGet(pluginId, key),
    kvSet: (pluginId, key, value) => backend().kvSet(pluginId, key, value),
    searchCompendium: (query, limit) => compendiumIndex.search(query, limit),
    getCompendiumEntry: (packId, entryId) => compendiumIndex.getEntry(packId, entryId),
    openCompendiumEntry,
  };
  window.__ttrpgappRuntime = runtime;
}
