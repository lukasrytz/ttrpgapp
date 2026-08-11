/** Seeded into new vaults as template.md; the user edits it in the app. */
export const STARTER_TEMPLATE = `# {{title}}

*Prepared {{date}}*

## 1. Review the Characters

- **Character 1**: 
- **Character 2**: 
- **Character 3**: 

## 2. Create a Strong Start

- 

## 3. Outline Potential Scenes

- 
- 
- 

## 4. Define Secrets and Clues

1. 
2. 
3. 
4. 
5. 
6. 
7. 
8. 
9. 
10. 

## 5. Develop Fantastic Locations

- **Location 1**: 
- **Location 2**: 

## 6. Outline Important NPCs

- 
- 
- 

## 7. Choose Relevant Monsters

- 
- 
- 

## 8. Select Treasure and Magic Item Rewards

- 
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
  campaign?: string;
  modifiedAt: number;
}

export interface Note extends NoteMeta {
  content: string;
  /** Titles of notes this note wiki-links to */
  links: string[];
  /** Paths of notes that link to this one */
  backlinks: string[];
}
