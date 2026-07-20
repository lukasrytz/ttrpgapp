import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GoogleDriveTarget } from '../src/sync/drive/target';
import type { TokenProvider } from '../src/sync/drive/auth';

/** In-memory Google Drive that understands the handful of calls the target makes. */
function makeFakeDrive() {
  const folders = new Map<string, { name: string }>();
  const files = new Map<
    string,
    { name: string; parents: string[]; appProperties: Record<string, string>; content: string }
  >();
  let seq = 0;
  const json = (obj: unknown) =>
    new Response(JSON.stringify(obj), { status: 200, headers: { 'Content-Type': 'application/json' } });

  const parseMultipart = (body: string) => {
    const meta = JSON.parse(/(\{[\s\S]*?\})\r\n--/.exec(body)![1]!);
    const content = /text\/plain[^\n]*\r\n\r\n([\s\S]*?)\r\n--[^\r\n]*--\s*$/.exec(body)![1]!;
    return { meta, content };
  };

  const fetchImpl = vi.fn(async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET';
    const auth = (init.headers as Record<string, string> | undefined)?.['Authorization'];
    if (auth !== 'Bearer good') return new Response('unauthorized', { status: 401 });

    // media download: /files/<id>?alt=media
    const media = /\/files\/([^/?]+)\?alt=media/.exec(url);
    if (media && method === 'GET') return new Response(files.get(media[1]!)!.content, { status: 200 });

    // list queries (order matters: parent-folder ids contain "folder")
    if (url.includes('/files?') && url.includes('q=') && method === 'GET') {
      const q = decodeURIComponent(/q=([^&]+)/.exec(url)![1]!);
      if (q.includes('in parents')) {
        return json({
          files: [...files].map(([id, f]) => ({ id, name: f.name, appProperties: f.appProperties })),
        });
      }
      const sync = /value='([^']+)'/.exec(q);
      if (sync) {
        const id = [...files].find(([, f]) => f.appProperties['syncId'] === sync[1])?.[0];
        return json({ files: id ? [{ id }] : [] });
      }
      if (q.includes("mimeType='application/vnd.google-apps.folder'")) {
        return json({ files: [...folders].map(([id]) => ({ id })) });
      }
    }

    // create folder (JSON body)
    if (url.startsWith('https://www.googleapis.com/drive/v3/files?') && method === 'POST') {
      const id = `folder${++seq}`;
      folders.set(id, { name: 'TTRPG Companion' });
      return json({ id });
    }

    // upload create / update
    if (url.startsWith('https://www.googleapis.com/upload/drive/v3/files')) {
      const { meta, content } = parseMultipart(init.body as string);
      const patch = /\/files\/([^?]+)\?/.exec(url);
      if (method === 'PATCH' && patch) {
        const f = files.get(patch[1]!)!;
        files.set(patch[1]!, { ...f, appProperties: meta.appProperties, content });
        return json({ id: patch[1] });
      }
      const id = `file${++seq}`;
      files.set(id, {
        name: meta.name,
        parents: meta.parents ?? [],
        appProperties: meta.appProperties,
        content,
      });
      return json({ id });
    }

    if (/\/files\/[^/?]+$/.test(url) && method === 'DELETE') {
      files.delete(/\/files\/([^/?]+)$/.exec(url)![1]!);
      return new Response(null, { status: 204 });
    }

    return new Response('not found', { status: 404 });
  });

  return { fetchImpl, folders, files };
}

class FakeToken implements TokenProvider {
  async isAuthed() {
    return true;
  }
  async signIn() {}
  async signOut() {}
  async getAccessToken(force = false) {
    return force ? 'good' : 'good';
  }
}

let drive: ReturnType<typeof makeFakeDrive>;
beforeEach(() => {
  drive = makeFakeDrive();
  vi.stubGlobal('fetch', drive.fetchImpl);
});
afterEach(() => vi.unstubAllGlobals());

describe('GoogleDriveTarget', () => {
  it('creates the app folder on first use and round-trips a doc', async () => {
    const t = new GoogleDriveTarget(new FakeToken());
    const put = await t.putDoc('notes/a.md', 'hello', 'h1', 1000);
    expect(put.remoteId).toMatch(/^file/);
    expect(drive.folders.size).toBe(1);

    const list = await t.listDocs();
    expect(list).toEqual([{ id: 'notes/a.md', remoteId: put.remoteId, updatedAt: 1000, hash: 'h1' }]);
    expect(await t.getDoc(put.remoteId)).toBe('hello');
  });

  it('updates an existing doc in place rather than duplicating', async () => {
    const t = new GoogleDriveTarget(new FakeToken());
    await t.putDoc('notes/a.md', 'v1', 'h1', 1000);
    await t.putDoc('notes/a.md', 'v2', 'h2', 2000);
    const list = await t.listDocs();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ hash: 'h2', updatedAt: 2000 });
    expect(await t.getDoc(list[0]!.remoteId)).toBe('v2');
  });

  it('excludes the tombstones file from listDocs but reads it back', async () => {
    const t = new GoogleDriveTarget(new FakeToken());
    await t.putDoc('notes/a.md', 'x', 'h1', 1000);
    await t.setTombstones({ 'notes/gone.md': 500 });
    const list = await t.listDocs();
    expect(list.map((d) => d.id)).toEqual(['notes/a.md']);
    expect(await t.getTombstones()).toEqual({ 'notes/gone.md': 500 });
  });

  it('deletes a doc', async () => {
    const t = new GoogleDriveTarget(new FakeToken());
    await t.putDoc('notes/a.md', 'x', 'h1', 1000);
    await t.deleteDoc('notes/a.md');
    expect(await t.listDocs()).toEqual([]);
  });

  it('refreshes the token and retries on 401', async () => {
    let calls = 0;
    let refreshed = false;
    const token: TokenProvider = {
      isAuthed: async () => true,
      signIn: async () => {},
      signOut: async () => {},
      getAccessToken: async (force = false) => {
        calls++;
        if (force) refreshed = true; // simulate caching the refreshed token
        return refreshed ? 'good' : 'stale';
      },
    };
    const t = new GoogleDriveTarget(token);
    // first api() call uses 'stale' → 401 → force refresh → 'good' → retry
    await t.putDoc('notes/a.md', 'x', 'h1', 1000);
    expect(calls).toBeGreaterThanOrEqual(2);
    expect(await t.getDoc((await t.listDocs())[0]!.remoteId)).toBe('x');
  });
});
