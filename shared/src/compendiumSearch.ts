import type { CompendiumEntry, CompendiumPack, CompendiumSearchHit } from './compendium.js';

/**
 * In-memory compendium search shared by the server (HTTP mode) and the
 * on-device (Capacitor) build. Pack sizes are small (~1-2k entries), so a
 * linear scan with prefix matching is plenty fast.
 */
interface Row {
  pack: CompendiumPack;
  entry: CompendiumEntry;
  nameLower: string;
  bodyLower: string;
}

export class CompendiumIndex {
  private packs = new Map<string, CompendiumPack>();
  private rows: Row[] = [];

  clear() {
    this.packs.clear();
    this.rows = [];
  }

  addPack(pack: CompendiumPack) {
    this.packs.set(pack.id, pack);
    for (const entry of pack.entries) {
      this.rows.push({
        pack,
        entry,
        nameLower: entry.name.toLowerCase(),
        bodyLower: entry.body.toLowerCase(),
      });
    }
  }

  getEntry(packId: string, entryId: string): CompendiumEntry | null {
    return this.packs.get(packId)?.entries.find((e) => e.id === entryId) ?? null;
  }

  search(query: string, limit = 25): CompendiumSearchHit[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const terms = q.split(/\s+/).filter(Boolean);

    const scored: { row: Row; score: number; pos: number }[] = [];
    for (const row of this.rows) {
      let ok = true;
      let firstBodyPos = -1;
      for (const term of terms) {
        const inName = wordPrefixIndex(row.nameLower, term) >= 0;
        const bodyPos = inName ? -1 : wordPrefixIndex(row.bodyLower, term);
        if (!inName && bodyPos < 0) {
          ok = false;
          break;
        }
        if (bodyPos >= 0 && firstBodyPos < 0) firstBodyPos = bodyPos;
      }
      if (!ok) continue;
      const score = row.nameLower.startsWith(q)
        ? 0
        : terms.every((t) => wordPrefixIndex(row.nameLower, t) >= 0)
          ? 1
          : 2;
      scored.push({ row, score, pos: Math.max(0, firstBodyPos) });
    }

    scored.sort(
      (a, b) =>
        a.score - b.score ||
        a.row.nameLower.length - b.row.nameLower.length ||
        a.row.nameLower.localeCompare(b.row.nameLower),
    );

    return scored.slice(0, limit).map(({ row, pos }) => ({
      packId: row.pack.id,
      pluginId: row.pack.pluginId,
      entryId: row.entry.id,
      type: row.entry.type,
      name: row.entry.name,
      snippet: snippet(row.entry.body, pos),
    }));
  }
}

/** Index of a word starting with `term`, or -1. */
function wordPrefixIndex(text: string, term: string): number {
  if (text.startsWith(term)) return 0;
  let from = 0;
  for (;;) {
    const i = text.indexOf(term, from);
    if (i < 0) return -1;
    const prev = text[i - 1]!;
    if (!/[a-z0-9]/.test(prev)) return i;
    from = i + 1;
  }
}

function snippet(body: string, pos: number, len = 110): string {
  const start = pos <= 20 ? 0 : body.lastIndexOf(' ', pos - 10) + 1;
  const raw = body.slice(start, start + len);
  return (start > 0 ? '…' : '') + raw + (start + len < body.length ? '…' : '');
}
