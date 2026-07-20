import { beforeEach, describe, expect, it } from 'vitest';
import { reconcile } from '../src/sync/engine';
import type {
  RemoteDocMeta,
  SyncMeta,
  SyncStore,
  SyncTarget,
  Tombstones,
} from '../src/sync/types';

// Deterministic, injective "hash" so hash-equality means content-equality.
const h = (c: string) => `h:${c}`;

class FakeStore implements SyncStore {
  docs = new Map<string, { content: string; updatedAt: number }>();
  meta: SyncMeta = {};
  tomb: Tombstones = {};
  async listDocs() {
    return [...this.docs].map(([id, d]) => ({
      id,
      content: d.content,
      updatedAt: d.updatedAt,
      hash: h(d.content),
    }));
  }
  async getDoc(id: string) {
    return this.docs.get(id)?.content ?? null;
  }
  async putDoc(id: string, content: string, updatedAt: number) {
    this.docs.set(id, { content, updatedAt });
  }
  async deleteDoc(id: string) {
    this.docs.delete(id);
  }
  async getMeta() {
    return this.meta;
  }
  async setMeta(m: SyncMeta) {
    this.meta = m;
  }
  async getTombstones() {
    return this.tomb;
  }
  async setTombstones(t: Tombstones) {
    this.tomb = t;
  }
}

class FakeTarget implements SyncTarget {
  docs = new Map<string, { content: string; updatedAt: number }>();
  tomb: Tombstones = {};
  authed = true;
  async isAuthed() {
    return this.authed;
  }
  async signIn() {
    this.authed = true;
  }
  async signOut() {
    this.authed = false;
  }
  async listDocs(): Promise<RemoteDocMeta[]> {
    return [...this.docs].map(([id, d]) => ({
      id,
      remoteId: id,
      updatedAt: d.updatedAt,
      hash: h(d.content),
    }));
  }
  async getDoc(remoteId: string) {
    return this.docs.get(remoteId)!.content;
  }
  async putDoc(id: string, content: string, hash: string, updatedAt: number) {
    this.docs.set(id, { content, updatedAt });
    return { id, remoteId: id, updatedAt, hash };
  }
  async deleteDoc(id: string) {
    this.docs.delete(id);
  }
  async getTombstones() {
    return this.tomb;
  }
  async setTombstones(t: Tombstones) {
    this.tomb = t;
  }
}

let local: FakeStore;
let remote: FakeTarget;
beforeEach(() => {
  local = new FakeStore();
  remote = new FakeTarget();
});

describe('reconcile — basic transfer', () => {
  it('uploads a local-only doc', async () => {
    local.docs.set('notes/a.md', { content: 'A', updatedAt: 100 });
    const r = await reconcile(local, remote);
    expect(r.uploaded).toBe(1);
    expect(remote.docs.get('notes/a.md')?.content).toBe('A');
    expect(local.meta['notes/a.md']?.lastSyncedHash).toBe(h('A'));
  });

  it('downloads a remote-only doc', async () => {
    remote.docs.set('notes/b.md', { content: 'B', updatedAt: 100 });
    const r = await reconcile(local, remote);
    expect(r.downloaded).toBe(1);
    expect(r.localChanged).toBe(true);
    expect(local.docs.get('notes/b.md')?.content).toBe('B');
  });

  it('does nothing when both sides already match', async () => {
    local.docs.set('notes/c.md', { content: 'C', updatedAt: 100 });
    remote.docs.set('notes/c.md', { content: 'C', updatedAt: 90 });
    const r = await reconcile(local, remote);
    expect(r).toMatchObject({ uploaded: 0, downloaded: 0, conflicts: 0 });
  });
});

describe('reconcile — last-write-wins', () => {
  it('newer local overwrites remote when remote is unchanged since last sync', async () => {
    local.meta['notes/c.md'] = { lastSyncedHash: h('C0'), lastSyncedAt: 0 };
    local.docs.set('notes/c.md', { content: 'C1', updatedAt: 200 });
    remote.docs.set('notes/c.md', { content: 'C0', updatedAt: 50 });
    const r = await reconcile(local, remote);
    expect(r.uploaded).toBe(1);
    expect(r.conflicts).toBe(0);
    expect(remote.docs.get('notes/c.md')?.content).toBe('C1');
  });

  it('newer remote overwrites local when local is unchanged since last sync', async () => {
    local.meta['notes/c.md'] = { lastSyncedHash: h('C0'), lastSyncedAt: 0 };
    local.docs.set('notes/c.md', { content: 'C0', updatedAt: 50 });
    remote.docs.set('notes/c.md', { content: 'C2', updatedAt: 200 });
    const r = await reconcile(local, remote);
    expect(r.downloaded).toBe(1);
    expect(r.conflicts).toBe(0);
    expect(local.docs.get('notes/c.md')?.content).toBe('C2');
  });
});

describe('reconcile — conflicts', () => {
  it('keeps a conflict copy when a note changed on both sides', async () => {
    local.meta['notes/c.md'] = { lastSyncedHash: h('C0'), lastSyncedAt: 0 };
    local.docs.set('notes/c.md', { content: 'LOCAL', updatedAt: 200 });
    remote.docs.set('notes/c.md', { content: 'REMOTE', updatedAt: 100 });
    const r = await reconcile(local, remote);
    expect(r.conflicts).toBe(1);
    // local (newer) wins the canonical file
    expect(local.docs.get('notes/c.md')?.content).toBe('LOCAL');
    expect(remote.docs.get('notes/c.md')?.content).toBe('LOCAL');
    // remote's losing content preserved beside it
    const conflict = [...local.docs].find(([id]) => id.includes('(conflict'));
    expect(conflict?.[1].content).toBe('REMOTE');
  });

  it('does NOT keep a conflict copy for state docs (pure LWW)', async () => {
    local.meta['state/dnd5e/encounter'] = { lastSyncedHash: h('S0'), lastSyncedAt: 0 };
    local.docs.set('state/dnd5e/encounter', { content: 'SL', updatedAt: 100 });
    remote.docs.set('state/dnd5e/encounter', { content: 'SR', updatedAt: 200 });
    const r = await reconcile(local, remote);
    expect(r.conflicts).toBe(0);
    expect(local.docs.get('state/dnd5e/encounter')?.content).toBe('SR');
    expect([...local.docs].some(([id]) => id.includes('(conflict'))).toBe(false);
  });
});

describe('reconcile — deletions', () => {
  it('propagates a local deletion to the remote', async () => {
    local.tomb['notes/d.md'] = 300;
    remote.docs.set('notes/d.md', { content: 'D', updatedAt: 100 });
    const r = await reconcile(local, remote);
    expect(r.deletedRemote).toBe(1);
    expect(remote.docs.has('notes/d.md')).toBe(false);
    expect(remote.tomb['notes/d.md']).toBe(300);
  });

  it('resurrects a doc edited after it was deleted elsewhere', async () => {
    remote.tomb['notes/d.md'] = 100;
    local.docs.set('notes/d.md', { content: 'D-EDIT', updatedAt: 300 });
    const r = await reconcile(local, remote);
    expect(r.deletedLocal).toBe(0);
    expect(r.uploaded).toBe(1);
    expect(remote.docs.get('notes/d.md')?.content).toBe('D-EDIT');
  });

  it('deletes a remote doc locally when the tombstone is newer', async () => {
    remote.tomb['notes/e.md'] = 300;
    local.docs.set('notes/e.md', { content: 'E', updatedAt: 100 });
    const r = await reconcile(local, remote);
    expect(r.deletedLocal).toBe(1);
    expect(local.docs.has('notes/e.md')).toBe(false);
  });
});

describe('reconcile — round trip converges', () => {
  it('a second reconcile is a no-op', async () => {
    local.docs.set('notes/a.md', { content: 'A', updatedAt: 100 });
    remote.docs.set('notes/b.md', { content: 'B', updatedAt: 100 });
    await reconcile(local, remote);
    const r2 = await reconcile(local, remote);
    expect(r2).toMatchObject({ uploaded: 0, downloaded: 0, deletedLocal: 0, deletedRemote: 0 });
  });
});
