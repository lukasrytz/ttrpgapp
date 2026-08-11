import { describe, expect, it } from 'vitest';
import { showToast, type Toast } from '../src/toast';

describe('showToast', () => {
  it('dispatches a ttrpg-toast event with payload', () => {
    let received: Toast | null = null;
    const listeners: Record<string, (e: Event) => void> = {};

    // Mock window event target for node test environment
    (globalThis as unknown as { window: unknown }).window = {
      dispatchEvent: (e: { type: string }) => {
        if (listeners[e.type]) listeners[e.type]!(e as unknown as Event);
        return true;
      },
      addEventListener: (type: string, fn: (e: Event) => void) => {
        listeners[type] = fn;
      },
      removeEventListener: (type: string) => {
        delete listeners[type];
      },
    };

    window.addEventListener('ttrpg-toast', (e: Event) => {
      received = (e as CustomEvent<Toast>).detail;
    });

    showToast('Hello World', '🎉', 3000);

    expect(received).not.toBeNull();
    expect(received!.message).toBe('Hello World');
    expect(received!.icon).toBe('🎉');
    expect(received!.durationMs).toBe(3000);
    expect(received!.id).toBeDefined();
  });
});
