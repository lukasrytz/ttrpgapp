export interface SessionClockState {
  startTime: number | null;
  elapsedSeconds: number;
  isRunning: boolean;
  targetMinutes: number; // default: 210 (3h 30m)
  combatsCount: number;
  combatRounds: number;
}

const STORAGE_KEY = 'ttrpg-session-clock';
const memoryStore: Record<string, string> = {};

function storageGet(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined') return localStorage.getItem(key);
    return memoryStore[key] ?? null;
  } catch {
    return memoryStore[key] ?? null;
  }
}

function storageSet(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
    memoryStore[key] = value;
  } catch {
    memoryStore[key] = value;
  }
}

export const DEFAULT_CLOCK_STATE: SessionClockState = {
  startTime: null,
  elapsedSeconds: 0,
  isRunning: false,
  targetMinutes: 210,
  combatsCount: 0,
  combatRounds: 0,
};

export function getClockState(): SessionClockState {
  try {
    const raw = storageGet(STORAGE_KEY);
    if (!raw) return DEFAULT_CLOCK_STATE;
    const parsed = JSON.parse(raw) as Partial<SessionClockState>;
    return {
      startTime: typeof parsed.startTime === 'number' ? parsed.startTime : null,
      elapsedSeconds: typeof parsed.elapsedSeconds === 'number' ? parsed.elapsedSeconds : 0,
      isRunning: Boolean(parsed.isRunning),
      targetMinutes: typeof parsed.targetMinutes === 'number' ? parsed.targetMinutes : 210,
      combatsCount: typeof parsed.combatsCount === 'number' ? parsed.combatsCount : 0,
      combatRounds: typeof parsed.combatRounds === 'number' ? parsed.combatRounds : 0,
    };
  } catch {
    return DEFAULT_CLOCK_STATE;
  }
}

export function saveClockState(state: SessionClockState): void {
  try {
    storageSet(STORAGE_KEY, JSON.stringify(state));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ttrpg-clock-changed', { detail: state }));
    }
  } catch {
    // ignore
  }
}

export function computeTotalElapsed(s: SessionClockState): number {
  if (!s.isRunning || s.startTime === null) {
    return s.elapsedSeconds;
  }
  const currentRun = Math.max(0, Math.floor((Date.now() - s.startTime) / 1000));
  return s.elapsedSeconds + currentRun;
}

export function formatClock(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export function startClock(): void {
  const current = getClockState();
  if (current.isRunning) return;
  saveClockState({
    ...current,
    isRunning: true,
    startTime: Date.now(),
  });
}

export function pauseClock(): void {
  const current = getClockState();
  if (!current.isRunning) return;
  const elapsed = computeTotalElapsed(current);
  saveClockState({
    ...current,
    isRunning: false,
    startTime: null,
    elapsedSeconds: elapsed,
  });
}

export function resetClock(): void {
  const current = getClockState();
  saveClockState({
    ...DEFAULT_CLOCK_STATE,
    targetMinutes: current.targetMinutes,
  });
}

export function recordCombatFinished(rounds: number): void {
  const current = getClockState();
  saveClockState({
    ...current,
    combatsCount: current.combatsCount + 1,
    combatRounds: current.combatRounds + Math.max(1, rounds),
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('ttrpg-combat-ended', (e: Event) => {
    const detail = (e as CustomEvent<{ rounds: number }>).detail;
    const rounds = detail?.rounds ?? 1;
    recordCombatFinished(rounds);
  });
}
