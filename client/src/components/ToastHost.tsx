import { useEffect, useState } from 'react';
import type { Toast } from '../toast';

export default function ToastHost() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const handleToast = (e: Event) => {
      const toast = (e as CustomEvent<Toast>).detail;
      if (!toast) return;

      setToasts((prev) => [...prev, toast]);

      const duration = toast.durationMs ?? 2000;
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, duration);
    };

    window.addEventListener('ttrpg-toast', handleToast);
    return () => window.removeEventListener('ttrpg-toast', handleToast);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-host">
      {toasts.map((t) => (
        <div key={t.id} className="toast-card">
          {t.icon && <span className="toast-icon">{t.icon}</span>}
          <span className="toast-message">{t.message}</span>
        </div>
      ))}
    </div>
  );
}
