import type { ComponentType } from 'react';

export interface PluginNavItem {
  path: string;
  label: string;
  /** Emoji used as a lightweight icon in the sidebar */
  icon: string;
}

/**
 * Client side of a game-system plugin. Routes are mounted under
 * /p/<plugin id>/... and nav items appear in the sidebar when the plugin
 * is enabled in config.json.
 */
export interface ClientPlugin {
  id: string;
  name: string;
  nav: PluginNavItem[];
  routes: { path: string; component: ComponentType }[];
}
