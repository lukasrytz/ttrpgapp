/**
 * Standalone music auto-tagger. Runs on the computer (web/desktop mode) over the
 * scanned library in SQLite, combining deterministic metadata heuristics with a
 * local LLM (LM Studio, OpenAI-compatible at localhost:1234), and writes tags
 * into the same tables the app reads. Nothing in the app changes.
 *
 *   npm run autotag -- [--all|--untagged] [--folder <name>] [--dry-run] [--no-llm] [--test]
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseFile } from 'music-metadata';
import {
  DEFAULT_TAG_VOCAB,
  TAG_DIMENSIONS,
  heuristicTags,
  mergeTags,
  parseLlmTags,
  type AutotagInput,
  type TagDimension,
  type TagResult,
  type Vocab,
} from '@ttrpgapp/shared';
import { openDb } from '../src/db.js';
import { scan } from '../src/music.js';
import { loadConfig, repoRoot, resolvePath } from '../src/config.js';

interface AutotagConfig {
  endpoint: string;
  model: string;
  useLlm: boolean;
}

const DEFAULT_AUTOTAG: AutotagConfig = {
  endpoint: 'http://localhost:1234/v1',
  model: 'google/gemma-4-12b',
  useLlm: true,
};

function loadAutotagConfig(): AutotagConfig {
  const p = path.join(repoRoot, 'config.json');
  const raw = fs.existsSync(p) ? (JSON.parse(fs.readFileSync(p, 'utf-8')) as { autotag?: Partial<AutotagConfig> }) : {};
  return { ...DEFAULT_AUTOTAG, ...(raw.autotag ?? {}) };
}

// --- args ---
const args = process.argv.slice(2);
const has = (f: string) => args.includes(f);
const argVal = (f: string) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : undefined;
};
const doAll = has('--all');
const dryRun = has('--dry-run');
const noLlm = has('--no-llm');
const testConn = has('--test');
const doScan = has('--scan');
const folderFilter = argVal('--folder')?.toLowerCase();

interface TrackRow {
  id: number;
  folder: string;
  path: string;
  title: string;
  artist: string | null;
  intensity: number | null;
}

function effectiveVocab(existing: Map<TagDimension, Set<string>>): Vocab {
  const v: Vocab = { theme: [], mood: [], landscape: [] };
  for (const dim of TAG_DIMENSIONS) {
    v[dim] = [...new Set([...DEFAULT_TAG_VOCAB[dim], ...(existing.get(dim) ?? [])])];
  }
  return v;
}

async function buildInput(track: TrackRow): Promise<AutotagInput> {
  const abs = path.join(resolvePath(track.folder), track.path);
  let album: string | null = null;
  let genre: string | null = null;
  let comment: string | null = null;
  try {
    const meta = await parseFile(abs);
    album = meta.common.album ?? null;
    genre = meta.common.genre?.join(' ') ?? null;
    const c = meta.common.comment;
    comment = Array.isArray(c)
      ? c.map((x) => (typeof x === 'string' ? x : (x?.text ?? ''))).join(' ') || null
      : null;
  } catch {
    // metadata unreadable — heuristics still use folder/filename/title/artist
  }
  return {
    folder: path.dirname(track.path).split(/[\\/]/).join(' '),
    filename: path.basename(track.path, path.extname(track.path)),
    title: track.title,
    artist: track.artist,
    album,
    genre,
    comment,
  };
}

async function callLlm(input: AutotagInput, vocab: Vocab, cfg: AutotagConfig): Promise<TagResult> {
  const system =
    'You tag fantasy tabletop-RPG background music. Choose ONLY from these values.\n' +
    `theme: ${vocab.theme.join(', ')}\n` +
    `mood: ${vocab.mood.join(', ')}\n` +
    `landscape: ${vocab.landscape.join(', ')}\n` +
    'intensity: an integer 1 (calm/ambient) to 5 (intense/combat).\n' +
    'Reply with ONLY JSON: {"theme":[],"mood":[],"landscape":[],"intensity":n}. ' +
    'Use [] when unsure; at most 2–3 values per dimension.';
  const user =
    `Folder: ${input.folder}\nFile: ${input.filename}\nTitle: ${input.title}\n` +
    `Artist: ${input.artist ?? ''}\nAlbum: ${input.album ?? ''}\n` +
    `Genre: ${input.genre ?? ''}\nComment: ${input.comment ?? ''}`;

  const res = await fetch(`${cfg.endpoint}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer lm-studio' },
    body: JSON.stringify({
      model: cfg.model,
      temperature: 0.2,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) throw new Error(`LM Studio ${res.status} ${res.statusText}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return parseLlmTags(data.choices?.[0]?.message?.content ?? '', vocab);
}

function fmt(t: TagResult): string {
  const dims = TAG_DIMENSIONS.map((d) => `${d}:[${t[d].join(', ')}]`).join('  ');
  return `${dims}  intensity:${t.intensity ?? '-'}`;
}

async function testConnection(cfg: AutotagConfig) {
  try {
    const res = await fetch(`${cfg.endpoint}/models`, { headers: { Authorization: 'Bearer lm-studio' } });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const data = (await res.json()) as { data?: { id: string }[] };
    const ids = (data.data ?? []).map((m) => m.id);
    console.log(`✓ LM Studio reachable at ${cfg.endpoint} — models: ${ids.join(', ') || '(none loaded)'}`);
    if (!ids.includes(cfg.model)) {
      console.log(`  note: configured model "${cfg.model}" is not in the list; load it or update config.json.`);
    }
  } catch (e) {
    console.error(`✗ Could not reach LM Studio at ${cfg.endpoint}: ${e instanceof Error ? e.message : e}`);
    process.exitCode = 1;
  }
}

async function main() {
  const cfg = loadConfig();
  const auto = loadAutotagConfig();

  if (testConn) {
    await testConnection(auto);
    return;
  }

  const db = openDb(resolvePath(cfg.dataDir));

  if (doScan) {
    console.log(`Scanning ${cfg.musicFolders.join(', ')} …`);
    const r = await scan(db, cfg);
    console.log(`Scan: ${r.added} added, ${r.removed} removed, ${r.total} total.`);
  }

  const tracks = db
    .prepare('SELECT id, folder, path, title, artist, intensity FROM tracks ORDER BY folder, path')
    .all() as TrackRow[];

  const tagRows = db.prepare('SELECT track_id, dimension, value FROM track_tags').all() as {
    track_id: number;
    dimension: TagDimension;
    value: string;
  }[];
  const taggedIds = new Set<number>();
  const usedValues = new Map<TagDimension, Set<string>>();
  for (const r of tagRows) {
    taggedIds.add(r.track_id);
    if (!usedValues.has(r.dimension)) usedValues.set(r.dimension, new Set());
    usedValues.get(r.dimension)!.add(r.value);
  }
  const vocab = effectiveVocab(usedValues);

  const useLlm = auto.useLlm && !noLlm;
  const candidates = tracks.filter((t) => {
    if (folderFilter && !`${t.folder}/${t.path}`.toLowerCase().includes(folderFilter)) return false;
    if (doAll) return true;
    return !taggedIds.has(t.id) && t.intensity === null; // untagged only
  });

  console.log(
    `Auto-tagging ${candidates.length}/${tracks.length} tracks ` +
      `(${doAll ? 'all' : 'untagged'}, llm=${useLlm ? auto.model : 'off'}${dryRun ? ', dry-run' : ''})`,
  );

  const applyDim = db.transaction((id: number, dim: TagDimension, values: string[]) => {
    db.prepare('DELETE FROM track_tags WHERE track_id = ? AND dimension = ?').run(id, dim);
    const ins = db.prepare('INSERT OR IGNORE INTO track_tags (track_id, dimension, value) VALUES (?, ?, ?)');
    for (const v of values) ins.run(id, dim, v);
  });
  const setIntensity = db.prepare('UPDATE tracks SET intensity = ? WHERE id = ?');

  let tagged = 0;
  for (let i = 0; i < candidates.length; i++) {
    const track = candidates[i]!;
    const input = await buildInput(track);
    let result = heuristicTags(input, vocab);
    if (useLlm) {
      try {
        result = mergeTags(result, await callLlm(input, vocab, auto));
      } catch (e) {
        console.warn(`  ! LLM failed for "${track.title}" (${e instanceof Error ? e.message : e}); heuristics only`);
      }
    }

    const hasTags = TAG_DIMENSIONS.some((d) => result[d].length > 0) || result.intensity !== null;
    console.log(`[${i + 1}/${candidates.length}] ${track.title}  →  ${hasTags ? fmt(result) : '(no signal)'}`);

    if (!dryRun && hasTags) {
      // Additive: only write dimensions that produced values; never wipe existing tags.
      for (const dim of TAG_DIMENSIONS) if (result[dim].length) applyDim(track.id, dim, result[dim]);
      if (result.intensity !== null) setIntensity.run(result.intensity, track.id);
      tagged++;
    }
  }

  console.log(dryRun ? 'Dry run complete — nothing written.' : `Done. Wrote tags for ${tagged} tracks.`);
  db.close();
}

await main();
