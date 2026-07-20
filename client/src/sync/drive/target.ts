import type { RemoteDocMeta, SyncTarget, Tombstones } from '../types';
import type { TokenProvider } from './auth';

const FILES = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const FOLDER_NAME = 'TTRPG Companion';
const TOMBSTONE_ID = '.sync-tombstones.json';

interface DriveFile {
  id: string;
  name: string;
  appProperties?: Record<string, string>;
}

function basename(id: string): string {
  return id.split('/').pop() || id;
}

/**
 * SyncTarget backed by Google Drive using the REST API. All app files live in a
 * single "TTRPG Companion" folder (visible/editable by the user, drive.file
 * scope). Each file carries appProperties {syncId, hash, updatedAt}; deletions
 * are tracked in a tombstones file. The folder is flat — the authoritative
 * identity is appProperties.syncId, not the filename.
 */
export class GoogleDriveTarget implements SyncTarget {
  private folderId: string | null = null;
  /** syncId -> Drive fileId, warmed by listDocs. */
  private fileIds = new Map<string, string>();

  constructor(private auth: TokenProvider) {}

  isAuthed() {
    return this.auth.isAuthed();
  }
  signIn() {
    return this.auth.signIn();
  }
  signOut() {
    this.folderId = null;
    this.fileIds.clear();
    return this.auth.signOut();
  }

  /** fetch against Drive with bearer auth and one 401→refresh→retry. */
  private async api(url: string, init: RequestInit = {}, retry = true): Promise<Response> {
    const token = await this.auth.getAccessToken();
    const res = await fetch(url, {
      ...init,
      headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` },
    });
    if (res.status === 401 && retry) {
      await this.auth.getAccessToken(true);
      return this.api(url, init, false);
    }
    if (!res.ok) throw new Error(`Drive ${init.method ?? 'GET'} ${url} → ${res.status}`);
    return res;
  }

  private async ensureFolder(): Promise<string> {
    if (this.folderId) return this.folderId;
    const q = encodeURIComponent(
      `name='${FOLDER_NAME}' and mimeType='${FOLDER_MIME}' and trashed=false`,
    );
    const res = await this.api(`${FILES}?q=${q}&fields=files(id)&spaces=drive`);
    const data = (await res.json()) as { files: DriveFile[] };
    if (data.files.length > 0) {
      this.folderId = data.files[0]!.id;
      return this.folderId;
    }
    const create = await this.api(`${FILES}?fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: FOLDER_NAME, mimeType: FOLDER_MIME }),
    });
    this.folderId = ((await create.json()) as DriveFile).id;
    return this.folderId;
  }

  private async listFiles(): Promise<DriveFile[]> {
    const folder = await this.ensureFolder();
    const q = encodeURIComponent(`'${folder}' in parents and trashed=false`);
    const res = await this.api(
      `${FILES}?q=${q}&fields=files(id,name,appProperties)&spaces=drive&pageSize=1000`,
    );
    return ((await res.json()) as { files: DriveFile[] }).files;
  }

  async listDocs(): Promise<RemoteDocMeta[]> {
    const files = await this.listFiles();
    this.fileIds.clear();
    const docs: RemoteDocMeta[] = [];
    for (const f of files) {
      const p = f.appProperties;
      if (!p?.['syncId']) continue;
      this.fileIds.set(p['syncId'], f.id);
      if (p['kind'] === 'tombstones') continue;
      docs.push({
        id: p['syncId'],
        remoteId: f.id,
        updatedAt: Number(p['updatedAt'] ?? 0),
        hash: p['hash'] ?? '',
      });
    }
    return docs;
  }

  async getDoc(remoteId: string): Promise<string> {
    const res = await this.api(`${FILES}/${remoteId}?alt=media`);
    return res.text();
  }

  private async resolveFileId(syncId: string): Promise<string | null> {
    if (this.fileIds.has(syncId)) return this.fileIds.get(syncId)!;
    const q = encodeURIComponent(`appProperties has { key='syncId' and value='${syncId}' }`);
    const res = await this.api(`${FILES}?q=${q}&fields=files(id)&spaces=drive`);
    const files = ((await res.json()) as { files: DriveFile[] }).files;
    const id = files[0]?.id ?? null;
    if (id) this.fileIds.set(syncId, id);
    return id;
  }

  private multipart(metadata: object, content: string): { body: string; boundary: string } {
    const boundary = `ttrpg${Math.random().toString(36).slice(2)}`;
    const body =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n` +
      `${content}\r\n--${boundary}--`;
    return { body, boundary };
  }

  async putDoc(
    id: string,
    content: string,
    hash: string,
    updatedAt: number,
  ): Promise<RemoteDocMeta> {
    const folder = await this.ensureFolder();
    const appProperties = { syncId: id, hash, updatedAt: String(updatedAt), kind: 'doc' };
    const existing = await this.resolveFileId(id);
    const metadata = existing
      ? { appProperties }
      : { name: basename(id), parents: [folder], appProperties };
    const { body, boundary } = this.multipart(metadata, content);
    const url = existing
      ? `${UPLOAD}/${existing}?uploadType=multipart&fields=id`
      : `${UPLOAD}?uploadType=multipart&fields=id`;
    const res = await this.api(url, {
      method: existing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    });
    const fileId = ((await res.json()) as DriveFile).id;
    this.fileIds.set(id, fileId);
    return { id, remoteId: fileId, updatedAt, hash };
  }

  async deleteDoc(id: string): Promise<void> {
    const fileId = await this.resolveFileId(id);
    if (!fileId) return;
    await this.api(`${FILES}/${fileId}`, { method: 'DELETE' });
    this.fileIds.delete(id);
  }

  async getTombstones(): Promise<Tombstones> {
    const fileId = await this.resolveFileId(TOMBSTONE_ID);
    if (!fileId) return {};
    try {
      const res = await this.api(`${FILES}/${fileId}?alt=media`);
      return JSON.parse(await res.text()) as Tombstones;
    } catch {
      return {};
    }
  }

  async setTombstones(t: Tombstones): Promise<void> {
    const folder = await this.ensureFolder();
    const appProperties = { syncId: TOMBSTONE_ID, kind: 'tombstones' };
    const existing = await this.resolveFileId(TOMBSTONE_ID);
    const metadata = existing
      ? { appProperties }
      : { name: TOMBSTONE_ID, parents: [folder], appProperties };
    const { body, boundary } = this.multipart(metadata, JSON.stringify(t));
    const url = existing
      ? `${UPLOAD}/${existing}?uploadType=multipart&fields=id`
      : `${UPLOAD}?uploadType=multipart&fields=id`;
    const res = await this.api(url, {
      method: existing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    });
    this.fileIds.set(TOMBSTONE_ID, ((await res.json()) as DriveFile).id);
  }
}
