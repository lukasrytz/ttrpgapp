import type { AppConfig } from '@ttrpgapp/shared';
import type { ServerPlugin } from '@ttrpgapp/shared/plugin-server';
import { dnd5eServerPlugin } from '@ttrpgapp/plugin-dnd5e/server';

/** All plugins compiled into this build; config.json decides which are active. */
const AVAILABLE: ServerPlugin[] = [dnd5eServerPlugin];

export function availablePlugins(): ServerPlugin[] {
  return AVAILABLE;
}

export function enabledPlugins(config: AppConfig): ServerPlugin[] {
  return AVAILABLE.filter((p) => config.plugins[p.id]);
}
