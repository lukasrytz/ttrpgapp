/**
 * System-agnostic compendium schema. Game-system plugins ship their rules
 * content as a CompendiumPack; the core indexes packs of all enabled plugins
 * into one full-text search.
 */
export interface CompendiumEntry {
  /** Unique within the pack, e.g. "spell:fireball" */
  id: string;
  /** Entry kind, e.g. "spell" | "monster" | "condition" | "rule" — plugin-defined vocabulary */
  type: string;
  name: string;
  /** Markdown body rendered in the detail panel */
  body: string;
  /** Structured, type-specific fields (e.g. monster stats) for richer rendering */
  fields?: Record<string, unknown>;
  /** Attribution, e.g. "SRD 5.1 (CC-BY-4.0)" */
  source: string;
}

export interface CompendiumPack {
  /** Pack id, prefixed by plugin id, e.g. "dnd5e-srd" */
  id: string;
  pluginId: string;
  name: string;
  license: string;
  entries: CompendiumEntry[];
}

export interface CompendiumSearchHit {
  packId: string;
  pluginId: string;
  entryId: string;
  type: string;
  name: string;
  /** Snippet of the matched body text */
  snippet: string;
}
