import { useEffect, type ReactNode } from 'react';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export default function BottomSheet({ isOpen, onClose, title, children }: BottomSheetProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="bottom-sheet-overlay" onClick={onClose}>
      <div
        className="bottom-sheet-content"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="bottom-sheet-drag-handle" onClick={onClose} />
        {title && (
          <div className="bottom-sheet-header">
            <h3 className="bottom-sheet-title">{title}</h3>
            <button className="icon-btn bottom-sheet-close" aria-label="Close" onClick={onClose}>
              ✕
            </button>
          </div>
        )}
        <div className="bottom-sheet-body">{children}</div>
      </div>
    </div>
  );
}
