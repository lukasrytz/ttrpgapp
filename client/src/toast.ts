export interface Toast {
  id: string;
  message: string;
  icon?: string;
  durationMs?: number;
}

export function showToast(message: string, icon?: string, durationMs = 2000): void {
  if (typeof window === 'undefined') return;
  const detail: Toast = {
    id: `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    message,
    icon,
    durationMs,
  };
  window.dispatchEvent(new CustomEvent<Toast>('ttrpg-toast', { detail }));
}
