import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { backend } from '../backend';
import { appendQuickNote } from '../session/quickNote';
import { showToast } from '../toast';
import BottomSheet from './BottomSheet';
import { splitSections } from './Markdown';

export interface QuickCaptureOptions {
  prompt?: string;
  heading?: string;
}

const DEFAULT_HEADINGS = ['In-session Notes', 'NPCs Met', 'Clues & Promises', 'Loot & Rewards'];

export function openQuickCapture(opts?: QuickCaptureOptions): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<QuickCaptureOptions>('open-quick-capture', { detail: opts ?? {} }));
}

export default function QuickCaptureSheet() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [promptTitle, setPromptTitle] = useState('Quick Capture');
  const [heading, setHeading] = useState('In-session Notes');
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<QuickCaptureOptions>).detail ?? {};
      setPromptTitle(detail.prompt?.replace(/:\s*$/, '') || 'Quick Capture');
      setHeading(detail.heading || 'In-session Notes');
      setText('');
      setOpen(true);
      setTimeout(() => textareaRef.current?.focus(), 40);
    };
    window.addEventListener('open-quick-capture', onOpen);
    return () => window.removeEventListener('open-quick-capture', onOpen);
  }, []);

  const notesQuery = useQuery({
    queryKey: ['notes'],
    queryFn: () => backend().listNotes(),
    enabled: open,
  });

  const latestSession = useMemo(() => {
    const notes = notesQuery.data ?? [];
    return notes
      .filter((n) => n.isSession || n.path.startsWith('sessions/'))
      .sort((a, b) => b.modifiedAt - a.modifiedAt)[0] ?? null;
  }, [notesQuery.data]);

  const activeNoteQuery = useQuery({
    queryKey: ['note', latestSession?.path],
    queryFn: () => backend().readNote(latestSession!.path),
    enabled: open && Boolean(latestSession?.path),
  });

  const headingChips = useMemo(() => {
    const seen = new Set<string>(DEFAULT_HEADINGS);
    if (activeNoteQuery.data?.content) {
      for (const s of splitSections(activeNoteQuery.data.content)) {
        if (s.heading && s.heading.trim()) seen.add(s.heading.trim());
      }
    }
    if (heading.trim()) seen.add(heading.trim());
    return Array.from(seen);
  }, [activeNoteQuery.data?.content, heading]);

  const handleSave = async () => {
    const trimmed = text.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      const res = await appendQuickNote(trimmed, heading.trim() || 'In-session Notes');
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['notes'] }),
        qc.invalidateQueries({ queryKey: ['note', res.path] }),
      ]);
      showToast('Note captured', '📝');
      setOpen(false);
    } catch {
      showToast('Failed to save note', '⚠️');
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet isOpen={open} onClose={() => setOpen(false)} title={promptTitle}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div className="small muted">
          Target:{' '}
          <strong>
            {latestSession ? latestSession.title : `New session note (${new Date().toISOString().slice(0, 10)})`}
          </strong>
        </div>

        <textarea
          ref={textareaRef}
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="NPC name, promise made, clue spotted…"
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              void handleSave();
            }
          }}
        />

        <div>
          <label className="small muted" style={{ display: 'block', marginBottom: '6px' }}>
            Section Heading
          </label>
          <div className="chip-row" style={{ marginBottom: '8px' }}>
            {headingChips.map((h) => (
              <button
                key={h}
                type="button"
                className={`chip ${heading === h ? 'chip-on' : ''}`}
                onClick={() => setHeading(h)}
              >
                {h}
              </button>
            ))}
          </div>
          <input
            value={heading}
            onChange={(e) => setHeading(e.target.value)}
            placeholder="In-session Notes"
            style={{ width: '100%' }}
          />
        </div>

        <div className="header-actions" style={{ justifyContent: 'flex-end', marginTop: '4px' }}>
          <button type="button" onClick={() => setOpen(false)}>
            Cancel
          </button>
          <button
            type="button"
            className="primary"
            disabled={!text.trim() || saving}
            onClick={() => void handleSave()}
          >
            {saving ? 'Saving…' : 'Save Note'}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
