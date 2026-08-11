import fs from 'node:fs';
import path from 'node:path';
import type { FastifyRequest, FastifyReply } from 'fastify';

export const AUDIO_EXTS = new Set(['.mp3', '.ogg', '.oga', '.opus', '.flac', '.m4a', '.aac', '.wav', '.webm']);

export const MIME: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.wav': 'audio/wav',
  '.webm': 'audio/webm',
};

export function* walk(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else if (entry.isFile() && AUDIO_EXTS.has(path.extname(entry.name).toLowerCase())) yield p;
  }
}

export function sendFileRange(req: FastifyRequest, reply: FastifyReply, abs: string) {
  if (!fs.existsSync(abs)) return reply.code(404).send({ error: 'file missing' });

  const stat = fs.statSync(abs);
  const type = MIME[path.extname(abs).toLowerCase()] ?? 'application/octet-stream';
  reply.header('Accept-Ranges', 'bytes');
  reply.header('Content-Type', type);

  const range = req.headers.range;
  const m = range ? /^bytes=(\d*)-(\d*)$/.exec(range) : null;
  if (m && (m[1] || m[2])) {
    const start = m[1] ? Number(m[1]) : Math.max(0, stat.size - Number(m[2]));
    const end = m[1] && m[2] ? Math.min(Number(m[2]), stat.size - 1) : stat.size - 1;
    if (start >= stat.size || start > end) {
      return reply.code(416).header('Content-Range', `bytes */${stat.size}`).send();
    }
    reply.code(206);
    reply.header('Content-Range', `bytes ${start}-${end}/${stat.size}`);
    reply.header('Content-Length', end - start + 1);
    return reply.send(fs.createReadStream(abs, { start, end }));
  }
  reply.header('Content-Length', stat.size);
  return reply.send(fs.createReadStream(abs));
}
