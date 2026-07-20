import type { FastifyInstance } from 'fastify';
import type { Database } from 'better-sqlite3';
import type { CompendiumPack } from './compendium.js';
import type { AppConfig } from './config.js';

export interface ServerPluginContext {
  db: Database;
  config: AppConfig;
  /** Absolute path to the plugin package root (for locating bundled data files) */
  pluginDir: string;
}

/**
 * Server side of a game-system plugin. Routes are registered under
 * /api/plugins/<id>/ and compendium packs are indexed into the core search.
 */
export interface ServerPlugin {
  id: string;
  name: string;
  packs?: (ctx: ServerPluginContext) => CompendiumPack[] | Promise<CompendiumPack[]>;
  routes?: (app: FastifyInstance, ctx: ServerPluginContext) => void | Promise<void>;
}
