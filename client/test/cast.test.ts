import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Track } from '@ttrpgapp/shared';
import { CastManager } from '../src/cast/manager';
import { castUrlFor, type CastTarget, type MediaServer, type RemoteStatus } from '../src/cast/types';

function track(path: string, title = 'T'): Track {
  return {
    id: 1,
    path,
    folder: '',
    title,
    artist: null,
    durationSec: 100,
    intensity: null,
    tags: { theme: [], mood: [], landscape: [] },
  };
}

/** In-memory fakes so the whole session state machine runs off-device. */
function fakes() {
  const calls: string[] = [];
  let statusCb: ((s: RemoteStatus) => void) | null = null;
  const server: MediaServer & { started: string[][] } = {
    started: [],
    async start(paths) {
      calls.push('server.start');
      server.started.push(paths);
      return { baseUrl: 'http://192.168.1.42:8731/tok3n' };
    },
    async stop() {
      calls.push('server.stop');
    },
  };
  const target: CastTarget & { loaded: string[] } = {
    loaded: [],
    async isAvailable() {
      return true;
    },
    async listDevices() {
      return [{ id: 'cc1', name: 'Living Room' }];
    },
    async connect() {
      calls.push('target.connect');
    },
    async disconnect() {
      calls.push('target.disconnect');
    },
    async load(url) {
      target.loaded.push(url);
    },
    async play() {
      calls.push('target.play');
    },
    async pause() {
      calls.push('target.pause');
    },
    async setVolume() {
      calls.push('target.setVolume');
    },
    onStatus(cb) {
      statusCb = cb;
      return () => {
        statusCb = null;
        calls.push('unsubscribe');
      };
    },
  };
  return { server, target, calls, emit: (s: RemoteStatus) => statusCb?.(s), hasSub: () => statusCb !== null };
}

const DEVICE = { id: 'cc1', name: 'Living Room' };

describe('castUrlFor', () => {
  const paths = ['/sd/Battle.mp3', '/sd/Tavern.mp3'];

  it('addresses tracks by allow-list index, never by path', () => {
    expect(castUrlFor('http://h:1/tok', paths, '/sd/Tavern.mp3')).toBe('http://h:1/tok/t/1');
  });

  it('refuses a path outside the allow-list', () => {
    expect(castUrlFor('http://h:1/tok', paths, '/sd/../../etc/passwd')).toBeNull();
    expect(castUrlFor('http://h:1/tok', paths, '/sd/Unknown.mp3')).toBeNull();
  });

  it('tolerates a trailing slash on the base url', () => {
    expect(castUrlFor('http://h:1/tok/', paths, '/sd/Battle.mp3')).toBe('http://h:1/tok/t/0');
  });
});

describe('CastManager', () => {
  let f: ReturnType<typeof fakes>;
  let m: CastManager;

  beforeEach(async () => {
    f = fakes();
    m = new CastManager();
    await m.init(f.target, f.server);
  });

  it('starts idle when casting is available and reports unavailable otherwise', async () => {
    expect(m.state.status).toBe('idle');
    expect(m.isCasting()).toBe(false);

    const m2 = new CastManager();
    await m2.init({ ...f.target, isAvailable: async () => false }, f.server);
    expect(m2.state.status).toBe('unavailable');
    expect(await m2.listDevices()).toEqual([]);
  });

  it('starts the media server before connecting, and passes the allow-list', async () => {
    await m.connect(DEVICE, ['/sd/Battle.mp3']);
    expect(m.state.status).toBe('connected');
    expect(m.state.device).toEqual(DEVICE);
    // Server must be up before the receiver is told to fetch from it.
    expect(f.calls).toEqual(['server.start', 'target.connect']);
    expect(f.server.started[0]).toEqual(['/sd/Battle.mp3']);
  });

  it('loads a track as a token-scoped url', async () => {
    await m.connect(DEVICE, ['/sd/Battle.mp3', '/sd/Tavern.mp3']);
    expect(await m.loadTrack(track('/sd/Tavern.mp3'))).toBe(true);
    expect(f.target.loaded).toEqual(['http://192.168.1.42:8731/tok3n/t/1']);
  });

  it('reports a non-servable track instead of casting silence', async () => {
    await m.connect(DEVICE, ['/sd/Battle.mp3']);
    // e.g. the library was rescanned and this file wasn't in the allow-list
    expect(await m.loadTrack(track('/sd/New.mp3'))).toBe(false);
    expect(f.target.loaded).toEqual([]);
  });

  it('does not load when not connected', async () => {
    expect(await m.loadTrack(track('/sd/Battle.mp3'))).toBe(false);
  });

  it('advances the queue when the receiver finishes a track', async () => {
    const onEnded = vi.fn();
    m.onEnded = onEnded;
    await m.connect(DEVICE, ['/sd/Battle.mp3']);
    f.emit({ playerState: 'idle', position: 100, duration: 100, ended: true });
    expect(onEnded).toHaveBeenCalledOnce();
  });

  it('mirrors receiver progress without advancing', async () => {
    const onProgress = vi.fn();
    const onEnded = vi.fn();
    m.onProgress = onProgress;
    m.onEnded = onEnded;
    await m.connect(DEVICE, ['/sd/Battle.mp3']);
    f.emit({ playerState: 'playing', position: 12, duration: 100 });
    expect(onProgress).toHaveBeenCalledWith(12, 100);
    expect(onEnded).not.toHaveBeenCalled();
  });

  it('tears down the server and subscription on disconnect', async () => {
    await m.connect(DEVICE, ['/sd/Battle.mp3']);
    expect(f.hasSub()).toBe(true);
    await m.disconnect();
    expect(f.hasSub()).toBe(false);
    expect(f.calls).toContain('server.stop');
    expect(m.state.status).toBe('idle');
    expect(m.state.device).toBeNull();
    expect(m.isCasting()).toBe(false);
  });

  it('stops the server if the receiver refuses the connection', async () => {
    const failing = { ...f.target, connect: async () => { throw new Error('no route to device'); } };
    const m2 = new CastManager();
    await m2.init(failing, f.server);
    await expect(m2.connect(DEVICE, ['/sd/Battle.mp3'])).rejects.toThrow('no route');
    // Leaving an HTTP server running on the LAN after a failed session is the bug here.
    expect(f.calls).toContain('server.stop');
    expect(m2.state.status).toBe('error');
    expect(m2.state.error).toContain('no route');
    expect(m2.isCasting()).toBe(false);
  });
});
