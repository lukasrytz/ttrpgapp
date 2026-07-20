import { Capacitor } from '@capacitor/core';
import type { Backend } from './types';
import { HttpBackend } from './http';

let instance: Backend = new HttpBackend();

export function setBackend(b: Backend) {
  instance = b;
}

/** Picks the on-device backend on Android, else keeps the HTTP backend. */
export async function initBackend(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const { CapacitorBackend } = await import('./capacitor');
    instance = new CapacitorBackend();
  }
}

export function backend(): Backend {
  return instance;
}

export type { Backend, TrackUpdate } from './types';
