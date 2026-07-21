import { DEFAULT_TAG_VOCAB, TAG_DIMENSIONS, type TagDimension } from './music.js';

/** Text signals available for a track, gathered from path + ID3 metadata. */
export interface AutotagInput {
  folder: string;
  filename: string;
  title: string;
  artist: string | null;
  album: string | null;
  genre: string | null;
  comment: string | null;
}

export interface TagResult {
  theme: string[];
  mood: string[];
  landscape: string[];
  intensity: number | null;
}

export type Vocab = Record<TagDimension, string[]>;

/**
 * Keyword synonyms per vocabulary value. Matching is case-insensitive with a
 * left word boundary (so "forests"/"battles" match, but "disease" ≠ "sea").
 */
const SYNONYMS: Record<TagDimension, Record<string, string[]>> = {
  theme: {
    battle: ['battle', 'combat', 'fight', 'war', 'clash', 'skirmish', 'boss', 'siege', 'duel', 'ambush'],
    social: [
      'social', 'tavern', 'inn', 'pub', 'alehouse', 'bar', 'court', 'castle', 'throne',
      'noble', 'royal', 'palace', 'market', 'feast', 'festival', 'celebration', 'party', 'gathering',
    ],
    exploration: [
      'exploration', 'explore', 'dungeon', 'crypt', 'catacomb', 'tomb', 'lair', 'ruin',
      'travel', 'journey', 'wander', 'discovery', 'mystery', 'quest', 'expedition', 'delve',
    ],
  },
  mood: {
    epic: ['epic', 'heroic', 'triumph', 'glory', 'grand', 'legend', 'victory', 'valiant'],
    joyful: ['joyful', 'happy', 'merry', 'festive', 'celebration', 'cheer', 'jig', 'dance', 'lively', 'upbeat'],
    tense: ['tense', 'suspense', 'danger', 'chase', 'stealth', 'dread', 'ominous', 'mystery', 'mysterious', 'pursuit', 'anxious'],
    creepy: ['creepy', 'horror', 'eerie', 'haunt', 'spooky', 'nightmare', 'undead', 'ghost', 'sinister', 'macabre'],
    peaceful: ['peaceful', 'calm', 'serene', 'gentle', 'relax', 'quiet', 'ambient', 'ambience', 'rest', 'tranquil', 'soft'],
    sad: ['sad', 'somber', 'melancholy', 'mourn', 'grief', 'lament', 'sorrow', 'sorrowful', 'mournful'],
  },
  landscape: {
    wilderness: [
      'wilderness', 'wild', 'forest', 'woods', 'woodland', 'jungle', 'grove',
      'mountain', 'peak', 'cliff', 'highland', 'desert', 'dune', 'sand', 'oasis',
      'swamp', 'marsh', 'bog', 'fen', 'mire', 'sea', 'ocean', 'coast', 'tide',
      'arctic', 'snow', 'ice', 'frozen', 'frost', 'tundra', 'winter', 'glacier',
      'plains', 'field', 'meadow', 'grassland', 'prairie', 'steppe',
      'cave', 'cavern', 'grotto', 'underground', 'underdark',
    ],
    roads: ['road', 'roads', 'path', 'trail', 'travel', 'journey', 'caravan', 'crossroads', 'bridge', 'march'],
    urban: ['urban', 'city', 'town', 'village', 'street', 'settlement', 'market', 'district'],
  },
};

/** Keyword → intensity (1–5) hints; the strongest match wins. */
const INTENSITY_HINTS: { words: string[]; value: number }[] = [
  { words: ['boss', 'siege', 'epic', 'climax'], value: 5 },
  { words: ['battle', 'combat', 'fight', 'war', 'chase', 'action', 'intense'], value: 4 },
  { words: ['tense', 'danger', 'suspense', 'pursuit'], value: 3 },
  { words: ['tavern', 'travel', 'exploration', 'mystery', 'town'], value: 2 },
  { words: ['calm', 'peaceful', 'ambient', 'quiet', 'serene', 'sleep', 'rest'], value: 1 },
];

/** True if `kw` appears in `hay` with a non-alphanumeric char (or start) before it. */
function wordish(hay: string, kw: string): boolean {
  let from = 0;
  for (;;) {
    const i = hay.indexOf(kw, from);
    if (i < 0) return false;
    const before = i === 0 ? undefined : hay[i - 1];
    if (before === undefined || !/[a-z0-9]/.test(before)) return true;
    from = i + 1;
  }
}

/** Deterministic tags from a track's text signals — no model, no I/O. */
export function heuristicTags(input: AutotagInput, vocab: Vocab = DEFAULT_TAG_VOCAB): TagResult {
  const hay = [
    input.folder,
    input.filename,
    input.title,
    input.artist,
    input.album,
    input.genre,
    input.comment,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const result: TagResult = { theme: [], mood: [], landscape: [], intensity: null };
  for (const dim of TAG_DIMENSIONS) {
    for (const value of vocab[dim]) {
      const kws = SYNONYMS[dim][value] ?? [value];
      if (kws.some((k) => wordish(hay, k))) result[dim].push(value);
    }
  }

  let intensity: number | null = null;
  for (const hint of INTENSITY_HINTS) {
    if (hint.words.some((w) => wordish(hay, w))) {
      intensity = intensity === null ? hint.value : Math.max(intensity, hint.value);
    }
  }
  result.intensity = intensity;
  return result;
}

/** Extract and JSON-parse the first {...} block from a model reply. */
function extractJson(raw: string): Record<string, unknown> | null {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Parse an LLM reply into tags, keeping only values that exist in the vocab and
 * clamping intensity to 1–5. Tolerant of prose around the JSON.
 */
export function parseLlmTags(raw: string, vocab: Vocab = DEFAULT_TAG_VOCAB): TagResult {
  const out: TagResult = { theme: [], mood: [], landscape: [], intensity: null };
  const json = extractJson(raw);
  if (!json) return out;
  for (const dim of TAG_DIMENSIONS) {
    const allowed = new Set(vocab[dim]);
    const values = Array.isArray(json[dim]) ? (json[dim] as unknown[]) : [];
    out[dim] = [
      ...new Set(values.map((v) => String(v).trim().toLowerCase()).filter((v) => allowed.has(v))),
    ];
  }
  const it = Number(json['intensity']);
  out.intensity = Number.isFinite(it) ? Math.min(5, Math.max(1, Math.round(it))) : null;
  return out;
}

/** Union tag values; intensity prefers `b` (the LLM), falling back to `a`. */
export function mergeTags(a: TagResult, b: TagResult): TagResult {
  const u = (x: string[], y: string[]) => [...new Set([...x, ...y])];
  return {
    theme: u(a.theme, b.theme),
    mood: u(a.mood, b.mood),
    landscape: u(a.landscape, b.landscape),
    intensity: b.intensity ?? a.intensity,
  };
}
