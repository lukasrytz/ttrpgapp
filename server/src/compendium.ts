import type { Database } from 'better-sqlite3';
import type { CompendiumPack, CompendiumSearchHit } from '@ttrpgapp/shared';

const packs = new Map<string, CompendiumPack>();

export function indexPack(db: Database, pack: CompendiumPack) {
  packs.set(pack.id, pack);
  const insert = db.prepare(
    'INSERT INTO compendium_fts (pack_id, plugin_id, entry_id, type, name, body) VALUES (?, ?, ?, ?, ?, ?)',
  );
  const insertAll = db.transaction(() => {
    for (const e of pack.entries) {
      insert.run(pack.id, pack.pluginId, e.id, e.type, e.name, e.body);
    }
  });
  insertAll();
}

/** Escape user input for FTS5 MATCH: quote each term, use prefix matching. */
function ftsQuery(input: string): string {
  const terms = input
    .split(/\s+/)
    .map((t) => t.replace(/["'*]/g, ''))
    .filter(Boolean);
  if (terms.length === 0) return '';
  return terms.map((t) => `"${t}"*`).join(' ');
}

export function search(db: Database, query: string, limit = 25): CompendiumSearchHit[] {
  const match = ftsQuery(query);
  if (!match) return [];
  const rows = db
    .prepare(
      `SELECT pack_id, plugin_id, entry_id, type, name,
              snippet(compendium_fts, 5, '', '', '…', 12) AS snippet,
              rank
       FROM compendium_fts
       WHERE compendium_fts MATCH ?
       ORDER BY (name LIKE ? COLLATE NOCASE) DESC, rank
       LIMIT ?`,
    )
    .all(match, `${query.trim()}%`, limit) as {
    pack_id: string;
    plugin_id: string;
    entry_id: string;
    type: string;
    name: string;
    snippet: string;
  }[];
  return rows.map((r) => ({
    packId: r.pack_id,
    pluginId: r.plugin_id,
    entryId: r.entry_id,
    type: r.type,
    name: r.name,
    snippet: r.snippet,
  }));
}

export function getEntry(packId: string, entryId: string) {
  return packs.get(packId)?.entries.find((e) => e.id === entryId) ?? null;
}
