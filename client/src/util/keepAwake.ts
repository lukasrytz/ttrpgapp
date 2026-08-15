let wakeLockSentinel: any = null;

const STORAGE_KEY = 'ttrpg-keep-awake';

export function isKeepAwakeEnabled(): boolean {
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    return val === null ? true : val === 'true';
  } catch {
    return true;
  }
}

export async function setKeepAwakeEnabled(enabled: boolean): Promise<void> {
  try {
    localStorage.setItem(STORAGE_KEY, String(enabled));
  } catch {
    // ignore
  }
  await applyKeepAwake(enabled);
}

export async function applyKeepAwake(enabled?: boolean): Promise<void> {
  const shouldEnable = enabled ?? isKeepAwakeEnabled();

  if (!shouldEnable) {
    if (wakeLockSentinel) {
      try {
        await wakeLockSentinel.release();
      } catch {
        // ignore
      }
      wakeLockSentinel = null;
    }
    return;
  }

  // Request wake lock if supported
  if (typeof navigator !== 'undefined' && 'wakeLock' in navigator && (navigator as any).wakeLock) {
    try {
      if (!wakeLockSentinel) {
        wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
        wakeLockSentinel.addEventListener('release', () => {
          wakeLockSentinel = null;
        });
      }
    } catch {
      // ignore (e.g. low battery mode or unsupported)
    }
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      void applyKeepAwake();
    }
  });
}
