import fs from 'node:fs';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { AppConfig, Note, NoteMeta } from '@ttrpgapp/shared';
import { extractLinks, renderTemplate, sanitizeNoteName, STARTER_TEMPLATE } from '@ttrpgapp/shared';
import { resolvePath } from './config.js';

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
    const normalized = rel.replace(/\\/g, '/');
    const parts = normalized.split('/');
    let isSession = false;
    let campaign: string | undefined = undefined;

    if (parts.length > 1) {
      if (parts[0] === 'sessions') {
        isSession = true;
      } else {
        campaign = parts[0];
        if (parts[1] === 'sessions') {
          isSession = true;
        }
      }
    }

    notes.push({
      path: normalized,
      title: titleOf(rel),
      isSession,
      campaign,
      modifiedAt: stat.mtimeMs,
    });
  }
  return notes.sort((a, b) => a.path.localeCompare(b.path));
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
    campaign: meta?.campaign,
  };
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

  /** Create a supporting note (NPCs, locations, …) at the vault root or in a campaign. */
  app.post<{ Body: { title: string; campaign?: string } }>('/api/notes/create', (req, reply) => {
    const name = sanitizeNoteName(req.body.title);
    if (!name) return reply.code(400).send({ error: 'bad title' });
    const cname = req.body.campaign ? sanitizeNoteName(req.body.campaign) : undefined;
    const rel = cname ? `${cname}/${name}.md` : `${name}.md`;
    const abs = safePath(vault, rel);
    if (!abs) return reply.code(400).send({ error: 'bad title' });
    if (fs.existsSync(abs)) return reply.code(409).send({ error: 'exists' });
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, `# ${name}\n\n`);
    return { path: rel };
  });

  /** Create a session note from template.md, filling {{title}} and {{date}}. */
  app.post<{ Body: { title: string; campaign?: string } }>('/api/notes/session', (req, reply) => {
    ensureVault(vault);
    const name = sanitizeNoteName(req.body.title);
    if (!name) return reply.code(400).send({ error: 'bad title' });
    const cname = req.body.campaign ? sanitizeNoteName(req.body.campaign) : undefined;
    const rel = cname ? `${cname}/sessions/${name}.md` : `sessions/${name}.md`;
    const abs = safePath(vault, rel);
    if (!abs) return reply.code(400).send({ error: 'bad title' });
    if (fs.existsSync(abs)) return reply.code(409).send({ error: 'exists' });
    fs.mkdirSync(path.dirname(abs), { recursive: true });

    let templatePath = cname ? path.join(vault, cname, 'template.md') : path.join(vault, 'template.md');
    if (!fs.existsSync(templatePath)) {
      templatePath = path.join(vault, 'template.md');
    }
    const template = fs.readFileSync(templatePath, 'utf-8');

    fs.writeFileSync(abs, renderTemplate(template, name));
    return { path: rel };
  });

  /** Create a new campaign directory and seed template.md */
  app.post<{ Body: { name: string } }>('/api/notes/campaign', (req, reply) => {
    const name = sanitizeNoteName(req.body.name);
    if (!name) return reply.code(400).send({ error: 'bad name' });
    
    const abs = path.join(vault, name);
    if (fs.existsSync(abs)) return reply.code(409).send({ error: 'exists' });
    
    fs.mkdirSync(path.join(abs, 'sessions'), { recursive: true });
    const globalTemplate = fs.readFileSync(path.join(vault, 'template.md'), 'utf-8');
    fs.writeFileSync(path.join(abs, 'template.md'), globalTemplate);
    
    return { ok: true };
  });

  app.delete<{ Querystring: { name: string } }>('/api/notes/campaign', (req, reply) => {
    const name = sanitizeNoteName(req.query.name);
    if (!name) return reply.code(400).send({ error: 'bad name' });
    const abs = path.join(vault, name);
    if (!fs.existsSync(abs)) return reply.code(404).send({ error: 'not found' });
    fs.rmSync(abs, { recursive: true, force: true });
    return { ok: true };
  });

  app.post<{ Body: { path: string; newPath: string } }>('/api/notes/rename', (req, reply) => {
    const oldAbs = safePath(vault, req.body.path);
    const newAbs = safePath(vault, req.body.newPath);
    if (!oldAbs || !newAbs) return reply.code(400).send({ error: 'bad path' });
    if (!fs.existsSync(oldAbs)) return reply.code(404).send({ error: 'not found' });
    if (fs.existsSync(newAbs)) return reply.code(409).send({ error: 'exists' });
    fs.mkdirSync(path.dirname(newAbs), { recursive: true });
    fs.renameSync(oldAbs, newAbs);
    return { path: req.body.newPath };
  });
}
