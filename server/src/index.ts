import Fastify from 'fastify';
import type { ClientConfig } from '@ttrpgapp/shared';
import { loadConfig, resolvePath } from './config.js';
import { openDb } from './db.js';
import { availablePlugins, registerPlugins } from './pluginHost.js';
import { search, getEntry } from './compendium.js';

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

app.get<{ Querystring: { q?: string } }>('/api/compendium/search', (req) => {
  const q = req.query.q ?? '';
  return { hits: search(db, q) };
});

app.get<{ Params: { packId: string; entryId: string } }>(
  '/api/compendium/entry/:packId/:entryId',
  (req, reply) => {
    const entry = getEntry(req.params.packId, req.params.entryId);
    if (!entry) return reply.code(404).send({ error: 'not found' });
    return entry;
  },
);

await registerPlugins(app, db, config);

const port = Number(process.env.PORT ?? 8787);
await app.listen({ port, host: '127.0.0.1' });
console.log(`ttrpgapp server listening on http://localhost:${port}`);
