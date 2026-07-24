import { registerPlugin } from '@capacitor/core';
import type { CastDevice, CastTarget, MediaServer, RemoteStatus } from './types';

/** Native Android plugin surfaces (see android/.../CastPlugin.java, MediaServerPlugin.java). */
interface CastNativePlugin {
  isAvailable(): Promise<{ available: boolean }>;
  listDevices(): Promise<{ devices: CastDevice[] }>;
  connect(opts: { deviceId: string }): Promise<void>;
  disconnect(): Promise<void>;
  loadMedia(opts: { url: string; title: string; artist?: string | null }): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  setVolume(opts: { volume: number }): Promise<void>;
  addListener(event: 'status', cb: (s: RemoteStatus) => void): Promise<{ remove: () => void }>;
}

interface MediaServerNativePlugin {
  start(opts: { paths: string[] }): Promise<{ baseUrl: string }>;
  stop(): Promise<void>;
}

const CastNative = registerPlugin<CastNativePlugin>('Cast');
const MediaServerNative = registerPlugin<MediaServerNativePlugin>('MediaServer');

/** CastTarget backed by the Android Google Cast SDK. */
export const nativeCastTarget: CastTarget = {
  async isAvailable() {
    try {
      return (await CastNative.isAvailable()).available;
    } catch {
      return false;
    }
  },
  async listDevices() {
    return (await CastNative.listDevices()).devices;
  },
  connect(deviceId) {
    return CastNative.connect({ deviceId });
  },
  disconnect() {
    return CastNative.disconnect();
  },
  load(url, meta) {
    return CastNative.loadMedia({ url, title: meta.title, artist: meta.artist });
  },
  play() {
    return CastNative.play();
  },
  pause() {
    return CastNative.pause();
  },
  setVolume(volume) {
    return CastNative.setVolume({ volume });
  },
  onStatus(cb) {
    // addListener resolves async; keep a handle so unsubscribe works either way.
    let handle: { remove: () => void } | null = null;
    let cancelled = false;
    void CastNative.addListener('status', cb).then((h) => {
      if (cancelled) h.remove();
      else handle = h;
    });
    return () => {
      cancelled = true;
      handle?.remove();
    };
  },
};

/** MediaServer backed by the on-device NanoHTTPD server. */
export const nativeMediaServer: MediaServer = {
  start(paths) {
    return MediaServerNative.start({ paths });
  },
  stop() {
    return MediaServerNative.stop();
  },
};
