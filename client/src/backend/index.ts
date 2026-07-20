import { Capacitor } from '@capacitor/core';
import type { Backend } from './types';
import { HttpBackend } from './http';
import type { CapacitorBackend } from './capacitor';

let instance: Backend = new HttpBackend();
let capacitorInstance: CapacitorBackend | null = null;

export function setBackend(b: Backend) {
  instance = b;
}

/** Picks the on-device backend on Android, else keeps the HTTP backend. */
export async function initBackend(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const { CapacitorBackend } = await import('./capacitor');
    capacitorInstance = new CapacitorBackend();
    instance = capacitorInstance;
  }
}

export function backend(): Backend {
  return instance;
}

/** The concrete on-device backend (for the sync layer), or null on web. */
export function getCapacitorBackend(): CapacitorBackend | null {
  return capacitorInstance;
}

export type { Backend, TrackUpdate } from './types';
