/**
 * Export the desktop's music tags as a portable, device-independent catalog.
 *
 * The desktop DB keys tags by file path, which no other device shares. This
 * re-keys every tagged track by its `trackSignature` (filename + duration) and
 * writes a single `music-tags.json` — the same shape the Android app's synced
 * catalog uses. Copy that file to a device and import it in the app; sync then
 * carries the tags to your other devices. Pure re-key: no model calls, no DB
 * writes, your existing tags are preserved 1:1.
 *
 *   npm run export-tags                 # -> ./music-tags.json
 *   npm run export-tags -- --out <path> # write elsewhere
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  TAG_DIMENSIONS,
  trackSignature,
  type MusicTagCatalog,
  type TagDimension,
  type TrackTagEntry,
} from '@ttrpgapp/shared';
import { openDb } from '../src/db.js';
import { loadConfig, repoRoot, resolvePath } from '../src/config.js';

const args = process.argv.slice(2);
const outArg = (() => {
  const i = args.indexOf('--out');
  return i >= 0 ? args[i + 1] : undefined;
})();
const outPath = outArg
  ? path.resolve(process.cwd(), outArg)
  : path.join(repoRoot, 'music-tags.json');

interface TrackRow {
  id: number;
  path: string;
  duration_sec: number | null;
  intensity: number | null;
}

function emptyTags(): Record<TagDimension, string[]> {
  return { theme: [], mood: [], landscape: [] };
}

function main() {
  const cfg = loadConfig();
  const db = openDb(resolvePath(cfg.dataDir));

  const tracks = db
    .prepare('SELECT id, path, duration_sec, intensity FROM tracks')
    .all() as TrackRow[];
  const tagRows = db.prepare('SELECT track_id, dimension, value FROM track_tags').all() as {
    track_id: number;
    dimension: TagDimension;
    value: string;
  }[];
  db.close();

  const tagsByTrack = new Map<number, Record<TagDimension, string[]>>();
  for (const r of tagRows) {
    let t = tagsByTrack.get(r.track_id);
    if (!t) {
      t = emptyTags();
      tagsByTrack.set(r.track_id, t);
    }
    t[r.dimension]?.push(r.value);
  }

  const catalog: MusicTagCatalog = {};
  let exported = 0;
  let collisions = 0;
  for (const track of tracks) {
    const tags = tagsByTrack.get(track.id) ?? emptyTags();
    const hasTags = TAG_DIMENSIONS.some((d) => tags[d].length > 0) || track.intensity !== null;
    if (!hasTags) continue;

    const sig = trackSignature(track.path, track.duration_sec);
    const existing = catalog[sig];
    if (existing) {
      // Two files collapse to one signature (same name + duration): union the
      // tags and keep the stronger intensity so nothing is silently dropped.
      collisions++;
      for (const d of TAG_DIMENSIONS) {
        existing.tags[d] = [...new Set([...existing.tags[d], ...tags[d]])];
      }
      existing.intensity = Math.max(existing.intensity ?? 0, track.intensity ?? 0) || null;
    } else {
      catalog[sig] = { intensity: track.intensity, tags } satisfies TrackTagEntry;
      exported++;
    }
  }

  fs.writeFileSync(outPath, JSON.stringify(catalog, null, 2));
  console.log(
    `Exported ${exported} tagged tracks to ${outPath}` +
      (collisions ? ` (${collisions} signature collisions merged)` : ''),
  );
  console.log('Copy this file to a device and use Settings → Import music tags.');
}

main();
