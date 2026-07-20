/**
 * Downloads the 5e-bits/5e-database SRD 5.1 JSON (CC-BY-4.0) and converts it
 * into a CompendiumPack at plugins/dnd5e/data/srd-pack.json. The generated
 * pack is committed so the app works offline; re-run to refresh.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CompendiumEntry, CompendiumPack } from '@ttrpgapp/shared';
import {
  convertSpells,
  convertMonsters,
  convertSimple,
  convertEquipment,
  type Named,
  type Spell,
  type Monster,
  type Equipment,
} from './convert.js';

const BASE = 'https://raw.githubusercontent.com/5e-bits/5e-database/main/src/2014/en';

async function fetchJson<T>(file: string): Promise<T> {
  const url = `${BASE}/${file}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json() as Promise<T>;
}

async function main() {
  const [spells, monsters, conditions, equipment, magicItems, ruleSections, skills] =
    await Promise.all([
      fetchJson<Spell[]>('5e-SRD-Spells.json'),
      fetchJson<Monster[]>('5e-SRD-Monsters.json'),
      fetchJson<Named[]>('5e-SRD-Conditions.json'),
      fetchJson<Equipment[]>('5e-SRD-Equipment.json'),
      fetchJson<Named[]>('5e-SRD-Magic-Items.json'),
      fetchJson<Named[]>('5e-SRD-Rule-Sections.json'),
      fetchJson<Named[]>('5e-SRD-Skills.json'),
    ]);

  const entries: CompendiumEntry[] = [
    ...convertSpells(spells),
    ...convertMonsters(monsters),
    ...convertSimple('condition', conditions),
    ...convertEquipment(equipment),
    ...convertSimple('magic-item', magicItems),
    ...convertSimple('rule', ruleSections),
    ...convertSimple('skill', skills),
  ];

  const pack: CompendiumPack = {
    id: 'dnd5e-srd',
    pluginId: 'dnd5e',
    name: 'D&D 5e SRD',
    license:
      'Content from the Systems Reference Document 5.1 by Wizards of the Coast, via 5e-bits/5e-database, licensed under CC-BY-4.0.',
    entries,
  };

  const here = path.dirname(fileURLToPath(import.meta.url));
  const out = path.join(here, '..', 'data', 'srd-pack.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(pack));
  const byType = new Map<string, number>();
  for (const e of entries) byType.set(e.type, (byType.get(e.type) ?? 0) + 1);
  console.log(`Wrote ${out}: ${entries.length} entries`);
  for (const [t, n] of byType) console.log(`  ${t}: ${n}`);
}

await main();
