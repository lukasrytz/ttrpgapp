import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AppConfig } from '@ttrpgapp/shared';

const here = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(here, '..', '..');

const DEFAULTS: AppConfig = {
  musicFolders: ['./music'],
  sfxFolders: [],
  notesVault: './vault',
  dataDir: './data',
  plugins: { dnd5e: true },
};

function readJsonIfExists(p: string): Partial<AppConfig> {
  if (!fs.existsSync(p)) return {};
  return JSON.parse(fs.readFileSync(p, 'utf-8')) as Partial<AppConfig>;
}

/** Loads config.json, overlaid with config.local.json (gitignored) if present. */
export function loadConfig(): AppConfig {
  const base = readJsonIfExists(path.join(repoRoot, 'config.json'));
  const local = readJsonIfExists(path.join(repoRoot, 'config.local.json'));
  const merged = { ...DEFAULTS, ...base, ...local };
  merged.plugins = { ...DEFAULTS.plugins, ...base.plugins, ...local.plugins };
  return merged;
}

/** Resolves a config path (possibly relative) against the repo root. */
export function resolvePath(p: string): string {
  return path.isAbsolute(p) ? p : path.resolve(repoRoot, p);
}
