import fs from 'node:fs';
import path from 'node:path';
import type { CompendiumPack } from '@ttrpgapp/shared';
import type { ServerPlugin } from '@ttrpgapp/shared/plugin-server';
import { EMPTY_ENCOUNTER, type Encounter } from './trackerTypes.js';

export const dnd5eServerPlugin: ServerPlugin = {
  id: 'dnd5e',
  name: 'D&D 5e',
  packs: (ctx) => {
    const packFile = path.join(ctx.pluginDir, 'data', 'srd-pack.json');
    if (!fs.existsSync(packFile)) {
      console.warn('dnd5e: data/srd-pack.json missing — run `npm run build-srd`');
      return [];
    }
    return [JSON.parse(fs.readFileSync(packFile, 'utf-8')) as CompendiumPack];
  },
  routes: (app, ctx) => {
    const get = ctx.db.prepare(
      "SELECT value FROM plugin_state WHERE plugin_id = 'dnd5e' AND key = 'encounter'",
    );
    const put = ctx.db.prepare(
      "INSERT INTO plugin_state (plugin_id, key, value) VALUES ('dnd5e', 'encounter', ?) " +
        'ON CONFLICT (plugin_id, key) DO UPDATE SET value = excluded.value',
    );

    app.get('/encounter', (): Encounter => {
      const row = get.get() as { value: string } | undefined;
      return row ? (JSON.parse(row.value) as Encounter) : EMPTY_ENCOUNTER;
    });

    app.put<{ Body: Encounter }>('/encounter', (req) => {
      put.run(JSON.stringify(req.body));
      return { ok: true };
    });
  },
};
