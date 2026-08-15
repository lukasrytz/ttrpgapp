import type { ComponentType } from 'react';
import type { CompendiumEntry, CompendiumPack, CompendiumSearchHit } from './compendium.js';

export interface PluginNavItem {
  path: string;
  label: string;
  /** Emoji used as a lightweight icon in the sidebar */
  icon: string;
}

export interface PluginAction {
  id: string;
  label: string;
  /** Emoji, matching the app's icon convention. */
  icon: string;
  /** Optional gate — e.g. hide "next turn" when no combat is running. */
  isAvailable?(runtime: PluginRuntime): Promise<boolean>;
  run(runtime: PluginRuntime): void | Promise<void>;
}

/**
 * Client side of a game-system plugin. Routes are mounted under
 * /p/<plugin id>/... and nav items appear in the sidebar when the plugin
 * is enabled in the app config.
 */
export interface ClientPlugin {
  id: string;
  name: string;
  nav: PluginNavItem[];
  routes: { path: string; component: ComponentType }[];
  /** Compendium packs bundled with this plugin (loaded once at startup). */
  loadPacks?: () => Promise<CompendiumPack[]>;
  actions?: PluginAction[];
}

/**
 * Services the host app provides to plugin components. Backed by the REST
 * server in web mode and by on-device storage in the Android build — plugin
 * code stays identical.
 */
export interface PluginRuntime {
  /** Persistent per-plugin key/value state (JSON strings). */
  kvGet(pluginId: string, key: string): Promise<string | null>;
  kvSet(pluginId: string, key: string, value: string): Promise<void>;
  searchCompendium(query: string, limit?: number): CompendiumSearchHit[];
  getCompendiumEntry(packId: string, entryId: string): CompendiumEntry | null;
  /** Opens the entry slide-over panel. */
  openCompendiumEntry(packId: string, entryId: string): void;
  getBackend?(): any;
}

declare global {
  interface Window {
    __ttrpgappRuntime?: PluginRuntime;
  }
}

export function getPluginRuntime(): PluginRuntime {
  const rt = window.__ttrpgappRuntime;
  if (!rt) throw new Error('plugin runtime not initialized');
  return rt;
}
