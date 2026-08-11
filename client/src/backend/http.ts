import type {
  ClientConfig,
  MusicFolder,
  MusicScanResult,
  Note,
  NoteMeta,
  Track,
} from '@ttrpgapp/shared';
import {
  filterByFolders,
  foldersOf,
  getFolderSelection,
  setFolderSelection,
} from '../music/folders';
import type { Backend, TrackUpdate } from './types';

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

async function send<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${url} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export class HttpBackend implements Backend {
  getConfig() {
    return get<ClientConfig>('/api/config');
  }

  private async allTracks() {
    return (await get<{ tracks: Track[] }>('/api/music/tracks')).tracks;
  }

  async listTracks() {
    return filterByFolders(await this.allTracks(), await getFolderSelection());
  }

  async listMusicFolders(): Promise<MusicFolder[]> {
    return foldersOf(await this.allTracks(), await getFolderSelection());
  }

  async setMusicFolders(paths: string[] | null): Promise<void> {
    await setFolderSelection(paths);
  }

  async scanMusic() {
    const result = await send<MusicScanResult>('POST', '/api/music/scan');
    // The server counts every configured folder; report the library's size.
    const selection = await getFolderSelection();
    if (!selection) return result;
    return { ...result, total: (await this.listTracks()).length };
  }

  async updateTrack(id: number, update: TrackUpdate) {
    await send('PATCH', `/api/music/tracks/${id}`, update);
  }

  trackUrl(track: Track): string {
    return `/api/music/stream/${track.id}`;
  }

  async listNotes() {
    return (await get<{ notes: NoteMeta[] }>('/api/notes')).notes;
  }

  readNote(path: string) {
    return get<Note>(`/api/notes/note?path=${encodeURIComponent(path)}`);
  }

  async writeNote(path: string, content: string) {
    await send('PUT', `/api/notes/note?path=${encodeURIComponent(path)}`, { content });
  }

  async deleteNote(path: string) {
    await send('DELETE', `/api/notes/note?path=${encodeURIComponent(path)}`);
  }

  createNote(title: string, campaign?: string) {
    return send<{ path: string }>('POST', '/api/notes/create', { title, campaign });
  }

  createSession(title: string, campaign?: string) {
    return send<{ path: string }>('POST', '/api/notes/session', { title, campaign });
  }

  async createCampaign(name: string) {
    await send('POST', '/api/notes/campaign', { name });
  }

  async deleteCampaign(name: string) {
    await send('DELETE', `/api/notes/campaign?name=${encodeURIComponent(name)}`);
  }

  renameNote(path: string, newPath: string) {
    return send<{ path: string }>('POST', '/api/notes/rename', { path, newPath });
  }

  async kvGet(pluginId: string, key: string) {
    return (
      await get<{ value: string | null }>(
        `/api/plugin-state/${encodeURIComponent(pluginId)}/${encodeURIComponent(key)}`,
      )
    ).value;
  }

  async kvSet(pluginId: string, key: string, value: string) {
    await send(
      'PUT',
      `/api/plugin-state/${encodeURIComponent(pluginId)}/${encodeURIComponent(key)}`,
      { value },
    );
  }
}
