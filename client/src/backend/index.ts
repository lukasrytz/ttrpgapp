import type { Backend } from './types';
import { HttpBackend } from './http';

// The Android build swaps this for CapacitorBackend at bootstrap (see main.tsx).
let instance: Backend = new HttpBackend();

export function setBackend(b: Backend) {
  instance = b;
}

export function backend(): Backend {
  return instance;
}

export type { Backend, TrackUpdate } from './types';
