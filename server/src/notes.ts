import fs from 'node:fs';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { AppConfig, Note, NoteMeta } from '@ttrpgapp/shared';
import { resolvePath } from './config.js';

const STARTER_TEMPLATE = `# {{title}}

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

const WIKI_LINK = /\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g;

function ensureVault(vault: string) {
  fs.mkdirSync(path.join(vault, 'sessions'), { recursive: true });
  const template = path.join(vault, 'template.md');
  if (!fs.existsSync(template)) fs.writeFileSync(template, STARTER_TEMPLATE);
}

/** Resolve a vault-relative path, rejecting escapes; returns absolute path. */
function safePath(vault: string, rel: string): string | null {
  if (!rel.endsWith('.md')) return null;
  const abs = path.resolve(vault, rel);
  if (!abs.startsWith(vault + path.sep)) return null;
  return abs;
}

function* walkMd(dir: string, base: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walkMd(p, base);
    else if (entry.isFile() && entry.name.endsWith('.md')) yield path.relative(base, p);
  }
}

function titleOf(rel: string): string {
  return path.basename(rel, '.md');
}

function listNotes(vault: string): NoteMeta[] {
  ensureVault(vault);
  const notes: NoteMeta[] = [];
  for (const rel of walkMd(vault, vault)) {
    const stat = fs.statSync(path.join(vault, rel));
    notes.push({
      path: rel.split(path.sep).join('/'),
      title: titleOf(rel),
      isSession: rel.split(path.sep)[0] === 'sessions',
      modifiedAt: stat.mtimeMs,
    });
  }
  return notes.sort((a, b) => a.path.localeCompare(b.path));
}

export function extractLinks(content: string): string[] {
  const links: string[] = [];
  for (const m of content.matchAll(WIKI_LINK)) {
    const target = m[1]!.trim();
    if (target && !links.includes(target)) links.push(target);
  }
  return links;
}

function readNote(vault: string, rel: string): Note | null {
  const abs = safePath(vault, rel);
  if (!abs || !fs.existsSync(abs)) return null;
  const content = fs.readFileSync(abs, 'utf-8');
  const meta = listNotes(vault).find((n) => n.path === rel);
  const myTitle = titleOf(rel).toLowerCase();
  const backlinks: string[] = [];
  for (const other of listNotes(vault)) {
    if (other.path === rel) continue;
    const otherContent = fs.readFileSync(path.join(vault, other.path), 'utf-8');
    if (extractLinks(otherContent).some((l) => l.toLowerCase() === myTitle)) {
      backlinks.push(other.path);
    }
  }
  return {
    path: rel,
    title: titleOf(rel),
    isSession: meta?.isSession ?? false,
    modifiedAt: meta?.modifiedAt ?? 0,
    content,
    links: extractLinks(content),
    backlinks,
  };
}

function sanitizeName(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, '-').trim();
}

export function registerNotesRoutes(app: FastifyInstance, config: AppConfig) {
  const vault = resolvePath(config.notesVault);
  ensureVault(vault);

  app.get('/api/notes', () => ({ notes: listNotes(vault) }));

  app.get<{ Querystring: { path: string } }>('/api/notes/note', (req, reply) => {
    const note = readNote(vault, req.query.path);
    if (!note) return reply.code(404).send({ error: 'not found' });
    return note;
  });

  app.put<{ Querystring: { path: string }; Body: { content: string } }>(
    '/api/notes/note',
    (req, reply) => {
      const abs = safePath(vault, req.query.path);
      if (!abs) return reply.code(400).send({ error: 'bad path' });
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, req.body.content);
      return { ok: true };
    },
  );

  app.delete<{ Querystring: { path: string } }>('/api/notes/note', (req, reply) => {
    const abs = safePath(vault, req.query.path);
    if (!abs || !fs.existsSync(abs)) return reply.code(404).send({ error: 'not found' });
    fs.rmSync(abs);
    return { ok: true };
  });

  /** Create a supporting note (NPCs, locations, …) at the vault root. */
  app.post<{ Body: { title: string } }>('/api/notes/create', (req, reply) => {
    const name = sanitizeName(req.body.title);
    if (!name) return reply.code(400).send({ error: 'bad title' });
    const rel = `${name}.md`;
    const abs = safePath(vault, rel);
    if (!abs) return reply.code(400).send({ error: 'bad title' });
    if (fs.existsSync(abs)) return reply.code(409).send({ error: 'exists' });
    fs.writeFileSync(abs, `# ${name}\n\n`);
    return { path: rel };
  });

  /** Create a session note from template.md, filling {{title}} and {{date}}. */
  app.post<{ Body: { title: string } }>('/api/notes/session', (req, reply) => {
    ensureVault(vault);
    const name = sanitizeName(req.body.title);
    if (!name) return reply.code(400).send({ error: 'bad title' });
    const rel = `sessions/${name}.md`;
    const abs = safePath(vault, rel);
    if (!abs) return reply.code(400).send({ error: 'bad title' });
    if (fs.existsSync(abs)) return reply.code(409).send({ error: 'exists' });
    const template = fs.readFileSync(path.join(vault, 'template.md'), 'utf-8');
    const date = new Date().toISOString().slice(0, 10);
    const content = template.replaceAll('{{title}}', name).replaceAll('{{date}}', date);
    fs.writeFileSync(abs, content);
    return { path: rel };
  });
}
