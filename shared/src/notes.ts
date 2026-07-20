export interface NoteMeta {
  /** Vault-relative path, e.g. "sessions/2026-07-20 Goblin Ambush.md" */
  path: string;
  title: string;
  isSession: boolean;
  modifiedAt: number;
}

export interface Note extends NoteMeta {
  content: string;
  /** Titles of notes this note wiki-links to */
  links: string[];
  /** Paths of notes that link to this one */
  backlinks: string[];
}
