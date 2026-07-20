import type { CapacitorBackend } from '../backend/capacitor';
import { hashContent } from './hash';
import type { SyncDoc, SyncMeta, SyncStore, Tombstones } from './types';

/**
 * Presents the on-device notes vault and plugin state as SyncDocs for the
 * reconcile engine. Notes are `notes/<vaultpath>`; plugin state is
 * `state/<pluginId>/<key>`.
 */
export class CapacitorSyncStore implements SyncStore {
  constructor(private be: CapacitorBackend) {}

  async listDocs(): Promise<SyncDoc[]> {
    const notes = await this.be.listNotes();
    const noteDocs = await Promise.all(
      notes.map(async (n) => {
        const content = (await this.be.readNote(n.path)).content;
        return {
          id: `notes/${n.path}`,
          content,
          updatedAt: n.modifiedAt,
          hash: await hashContent(content),
        } satisfies SyncDoc;
      }),
    );
    const stateDocs = await Promise.all(
      (await this.be.listStateDocs()).map(async (s) => ({
        id: s.id,
        content: s.value,
        updatedAt: s.updatedAt,
        hash: await hashContent(s.value),
      })),
    );
    return [...noteDocs, ...stateDocs];
  }

  async getDoc(id: string): Promise<string | null> {
    if (id.startsWith('notes/')) {
      try {
        return (await this.be.readNote(id.slice('notes/'.length))).content;
      } catch {
        return null;
      }
    }
    const found = (await this.be.listStateDocs()).find((s) => s.id === id);
    return found?.value ?? null;
  }

  async putDoc(id: string, content: string, updatedAt: number): Promise<void> {
    if (id.startsWith('notes/')) {
      await this.be.writeNote(id.slice('notes/'.length), content);
    } else {
      const [, pluginId, ...rest] = id.split('/');
      await this.be.setStateRaw(pluginId!, rest.join('/'), content, updatedAt);
    }
  }

  async deleteDoc(id: string): Promise<void> {
    if (id.startsWith('notes/')) {
      await this.be.deleteNoteRaw(id.slice('notes/'.length));
    } else {
      await this.be.deleteStateRaw(id);
    }
  }

  getMeta(): Promise<SyncMeta> {
    return this.be.getSyncMeta();
  }
  setMeta(meta: SyncMeta): Promise<void> {
    return this.be.setSyncMeta(meta);
  }
  getTombstones(): Promise<Tombstones> {
    return this.be.getTombstones();
  }
  setTombstones(t: Tombstones): Promise<void> {
    return this.be.setTombstones(t);
  }
}
