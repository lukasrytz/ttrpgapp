import fs from 'node:fs';
import path from 'node:path';
import type { CompendiumPack } from '@ttrpgapp/shared';
import type { ServerPlugin } from '@ttrpgapp/shared/plugin-server';

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
};
