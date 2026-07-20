import Fastify from 'fastify';
import type { ClientConfig } from '@ttrpgapp/shared';
import { loadConfig, resolvePath } from './config.js';
import { openDb } from './db.js';
import { availablePlugins } from './pluginHost.js';
import { registerMusicRoutes } from './music.js';
import { registerNotesRoutes } from './notes.js';

const config = loadConfig();
const db = openDb(resolvePath(config.dataDir));

const app = Fastify({ logger: { level: 'warn' } });

app.get('/api/config', (): ClientConfig => {
  return {
    plugins: availablePlugins().map((p) => ({
      id: p.id,
      name: p.name,
      enabled: !!config.plugins[p.id],
    })),
  };
});

const kvGet = db.prepare('SELECT value FROM plugin_state WHERE plugin_id = ? AND key = ?');
const kvPut = db.prepare(
  'INSERT INTO plugin_state (plugin_id, key, value) VALUES (?, ?, ?) ' +
    'ON CONFLICT (plugin_id, key) DO UPDATE SET value = excluded.value',
);

app.get<{ Params: { pluginId: string; key: string } }>(
  '/api/plugin-state/:pluginId/:key',
  (req) => {
    const row = kvGet.get(req.params.pluginId, req.params.key) as { value: string } | undefined;
    return { value: row?.value ?? null };
  },
);

app.put<{ Params: { pluginId: string; key: string }; Body: { value: string } }>(
  '/api/plugin-state/:pluginId/:key',
  (req) => {
    kvPut.run(req.params.pluginId, req.params.key, req.body.value);
    return { ok: true };
  },
);

registerMusicRoutes(app, db, config);
registerNotesRoutes(app, config);

const port = Number(process.env.PORT ?? 8787);
await app.listen({ port, host: '127.0.0.1' });
console.log(`ttrpgapp server listening on http://localhost:${port}`);
