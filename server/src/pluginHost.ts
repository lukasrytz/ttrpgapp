import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FastifyInstance } from 'fastify';
import type { Database } from 'better-sqlite3';
import type { AppConfig } from '@ttrpgapp/shared';
import type { ServerPlugin, ServerPluginContext } from '@ttrpgapp/shared/plugin-server';
import { dnd5eServerPlugin } from '@ttrpgapp/plugin-dnd5e/server';
import { indexPack } from './compendium.js';

/** All plugins compiled into this build; config.json decides which are active. */
const AVAILABLE: ServerPlugin[] = [dnd5eServerPlugin];

export function availablePlugins(): ServerPlugin[] {
  return AVAILABLE;
}

export function enabledPlugins(config: AppConfig): ServerPlugin[] {
  return AVAILABLE.filter((p) => config.plugins[p.id]);
}

function pluginDir(id: string): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '..', '..', 'plugins', id);
}

export async function registerPlugins(app: FastifyInstance, db: Database, config: AppConfig) {
  db.exec('DELETE FROM compendium_fts');
  for (const plugin of enabledPlugins(config)) {
    const ctx: ServerPluginContext = { db, config, pluginDir: pluginDir(plugin.id) };
    if (plugin.packs) {
      for (const pack of await plugin.packs(ctx)) {
        indexPack(db, pack);
      }
    }
    if (plugin.routes) {
      await app.register(
        async (scope) => {
          await plugin.routes!(scope, ctx);
        },
        { prefix: `/api/plugins/${plugin.id}` },
      );
    }
  }
}
