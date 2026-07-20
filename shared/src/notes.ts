/** Seeded into new vaults as template.md; the user edits it in the app. */
export const STARTER_TEMPLATE = `# {{title}}

*Prepared {{date}}*

## Recap

-

## Strong start

-

## Scenes

### Scene 1

-

## NPCs & places

-

## Treasure & clues

-
`;

/** Fills template placeholders when creating a session note. */
export function renderTemplate(template: string, title: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return template.replaceAll('{{title}}', title).replaceAll('{{date}}', date);
}

/** Strips filesystem-hostile characters from a note title. */
export function sanitizeNoteName(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, '-').trim();
}

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
