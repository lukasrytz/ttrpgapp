import { isNote } from './hash';
import type { SyncMeta, SyncResult, SyncStore, SyncTarget, Tombstones } from './types';

/**
 * Two-way, last-write-wins reconcile between a local store and a remote target.
 *
 * For each doc id in the union of local docs, remote docs, and tombstones:
 *  - the newest event wins (a delete beats an older edit; an edit beats an
 *    older delete → resurrection);
 *  - when both sides changed a note since the last sync (a true conflict), the
 *    loser's content is preserved as a "(conflict <date>)" copy so nothing is
 *    lost; state docs are pure LWW (transient live data).
 *
 * The engine is pure w.r.t. the interfaces — the same logic runs against Google
 * Drive in the app and against in-memory fakes in tests.
 */
export async function reconcile(local: SyncStore, remote: SyncTarget): Promise<SyncResult> {
  const result: SyncResult = {
    uploaded: 0,
    downloaded: 0,
    deletedLocal: 0,
    deletedRemote: 0,
    conflicts: 0,
    localChanged: false,
  };

  const [localDocs, remoteDocs, meta, localTomb, remoteTomb] = await Promise.all([
    local.listDocs(),
    remote.listDocs(),
    local.getMeta(),
    local.getTombstones(),
    remote.getTombstones(),
  ]);

  const localById = new Map(localDocs.map((d) => [d.id, d]));
  const remoteById = new Map(remoteDocs.map((d) => [d.id, d]));

  // Merge tombstones (keep the newest deletion per id).
  const tomb: Tombstones = { ...remoteTomb };
  for (const [id, at] of Object.entries(localTomb)) tomb[id] = Math.max(tomb[id] ?? 0, at);

  const ids = new Set<string>([
    ...localById.keys(),
    ...remoteById.keys(),
    ...Object.keys(tomb),
  ]);

  const now = Date.now();
  let metaChanged = false;
  let tombChanged = false;

  for (const id of ids) {
    const L = localById.get(id);
    const R = remoteById.get(id);
    const tombAt = tomb[id] ?? -1;
    const maxDocAt = Math.max(L?.updatedAt ?? -1, R?.updatedAt ?? -1);

    // Deletion wins when it's at least as new as the newest surviving edit.
    if (tombAt >= 0 && tombAt >= maxDocAt) {
      if (L) {
        await local.deleteDoc(id);
        result.deletedLocal++;
        result.localChanged = true;
      }
      if (R) {
        await remote.deleteDoc(id);
        result.deletedRemote++;
      }
      if (meta[id]) {
        delete meta[id];
        metaChanged = true;
      }
      if ((localTomb[id] ?? -1) !== tombAt) {
        localTomb[id] = tombAt;
        tombChanged = true;
      }
      if ((remoteTomb[id] ?? -1) !== tombAt) {
        remoteTomb[id] = tombAt;
        tombChanged = true;
      }
      continue;
    }

    if (!L && !R) continue; // stale tombstone with nothing to delete

    if (L && !R) {
      await remote.putDoc(id, L.content, L.hash, L.updatedAt);
      result.uploaded++;
      meta[id] = { lastSyncedHash: L.hash, lastSyncedAt: now };
      metaChanged = true;
      continue;
    }
    if (R && !L) {
      const content = await remote.getDoc(R.remoteId);
      await local.putDoc(id, content, R.updatedAt);
      result.downloaded++;
      result.localChanged = true;
      meta[id] = { lastSyncedHash: R.hash, lastSyncedAt: now };
      metaChanged = true;
      continue;
    }

    // Both present.
    if (L!.hash === R!.hash) {
      if (meta[id]?.lastSyncedHash !== L!.hash) {
        meta[id] = { lastSyncedHash: L!.hash, lastSyncedAt: now };
        metaChanged = true;
      }
      continue;
    }

    const base = meta[id]?.lastSyncedHash;
    const trueConflict = L!.hash !== base && R!.hash !== base;

    if (L!.updatedAt >= R!.updatedAt) {
      // Local wins.
      if (trueConflict && isNote(id)) {
        await writeConflictCopy(local, id, await remote.getDoc(R!.remoteId), R!.updatedAt);
        result.conflicts++;
        result.localChanged = true;
      }
      await remote.putDoc(id, L!.content, L!.hash, L!.updatedAt);
      result.uploaded++;
      meta[id] = { lastSyncedHash: L!.hash, lastSyncedAt: now };
      metaChanged = true;
    } else {
      // Remote wins.
      if (trueConflict && isNote(id)) {
        await writeConflictCopy(local, id, L!.content, L!.updatedAt);
        result.conflicts++;
      }
      const content = await remote.getDoc(R!.remoteId);
      await local.putDoc(id, content, R!.updatedAt);
      result.downloaded++;
      result.localChanged = true;
      meta[id] = { lastSyncedHash: R!.hash, lastSyncedAt: now };
      metaChanged = true;
    }
  }

  if (metaChanged) await local.setMeta(meta satisfies SyncMeta);
  if (tombChanged) {
    await local.setTombstones(localTomb);
    await remote.setTombstones(remoteTomb);
  }
  return result;
}

/** Save loser content beside a note as "<name> (conflict <date>).md". */
async function writeConflictCopy(
  local: SyncStore,
  id: string,
  content: string,
  at: number,
): Promise<void> {
  const date = new Date(at).toISOString().slice(0, 10);
  const base = id.replace(/\.md$/, '');
  await local.putDoc(`${base} (conflict ${date}).md`, content, Date.now());
}
