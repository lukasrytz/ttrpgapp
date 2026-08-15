export async function triggerHaptic(): Promise<void> {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(10);
    }
  } catch {
    // ignore
  }
}
