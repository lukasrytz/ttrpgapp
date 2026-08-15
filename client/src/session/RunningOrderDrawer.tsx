import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { CompendiumSearchHit, Note } from '@ttrpgapp/shared';
import { backend } from '../backend';
import { compendiumIndex } from '../compendium';
import BottomSheet from '../components/BottomSheet';
import { deriveBeats, toggleTaskInMarkdown } from './runningOrder';

export interface RunningOrderDrawerProps {
  isOpen: boolean;
  onToggle: () => void;
  onNavigateNotes?: (path: string) => void;
}

export default function RunningOrderDrawer({
  isOpen,
  onToggle,
  onNavigateNotes,
}: RunningOrderDrawerProps) {
  const qc = useQueryClient();
  const [selectedNotePath, setSelectedNotePath] = useState<string | null>(null);
  const [activeEntry, setActiveEntry] = useState<CompendiumSearchHit | null>(null);

  const notesQuery = useQuery({
    queryKey: ['notes'],
    queryFn: () => backend().listNotes(),
  });
  const notes = useMemo(() => notesQuery.data ?? [], [notesQuery.data]);

  const sessionNotes = useMemo(
    () =>
      notes
        .filter((n) => n.isSession || n.path.startsWith('sessions/'))
        .sort((a, b) => b.modifiedAt - a.modifiedAt),
    [notes],
  );

  const currentPath = selectedNotePath ?? sessionNotes[0]?.path ?? null;

  const noteQuery = useQuery({
    queryKey: ['note', currentPath],
    queryFn: () => (currentPath ? backend().readNote(currentPath) : Promise.resolve(null)),
    enabled: Boolean(currentPath),
  });
  const note: Note | null = noteQuery.data ?? null;

  const beats = useMemo(() => (note?.content ? deriveBeats(note.content) : []), [note?.content]);

  const handleToggleTask = async (taskText: string, currentDone: boolean) => {
    if (!note || !currentPath) return;
    const nextDone = !currentDone;
    const updated = toggleTaskInMarkdown(note.content, taskText, nextDone);
    await backend().writeNote(currentPath, updated);
    qc.setQueryData(['note', currentPath], { ...note, content: updated });
    qc.invalidateQueries({ queryKey: ['notes'] });
  };

  const handleOpenLink = (target: string) => {
    const hits = compendiumIndex.search(target, 5);
    const match = hits[0];
    if (match) {
      setActiveEntry(match);
    } else {
      if (onNavigateNotes) {
        onNavigateNotes(target.endsWith('.md') ? target : `${target}.md`);
      }
    }
  };

  return (
    <>
      <div className={`running-order-drawer ${isOpen ? 'open' : 'collapsed'}`}>
        <div className="running-order-header">
          <div className="running-order-title" onClick={onToggle}>
            <span>📋 Running Order</span>
            <span className="running-order-toggle-icon">{isOpen ? '▼' : '▲'}</span>
          </div>
          {isOpen && sessionNotes.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <select
                value={currentPath ?? ''}
                onChange={(e) => setSelectedNotePath(e.target.value)}
                style={{ maxWidth: '160px', fontSize: '11px', padding: '2px 4px' }}
              >
                {sessionNotes.map((n) => (
                  <option key={n.path} value={n.path}>
                    {n.title}
                  </option>
                ))}
              </select>
              {currentPath && onNavigateNotes && (
                <button
                  type="button"
                  className="icon-btn small"
                  title="Open full note"
                  onClick={() => onNavigateNotes(currentPath)}
                >
                  📝
                </button>
              )}
            </div>
          )}
        </div>

        {isOpen && (
          <div className="running-order-body">
            {!note ? (
              <div className="small muted" style={{ padding: '12px' }}>
                No session notes found. Create a session note in Prep Notes.
              </div>
            ) : beats.length === 0 ? (
              <div className="small muted" style={{ padding: '12px' }}>
                No beats or headings in <strong>{note.title}</strong>.
              </div>
            ) : (
              beats.map((b, idx) => (
                <div key={idx} className="running-beat-card">
                  <div className="running-beat-heading">
                    <span className="beat-level">H{b.level}</span>
                    <span className="beat-title">{b.heading}</span>
                  </div>
                  {b.summary && <p className="running-beat-summary">{b.summary}</p>}

                  {b.tasks.length > 0 && (
                    <div className="running-beat-tasks">
                      {b.tasks.map((t, tIdx) => (
                        <label key={tIdx} className={`running-task-item ${t.done ? 'done' : ''}`}>
                          <input
                            type="checkbox"
                            checked={t.done}
                            onChange={() => handleToggleTask(t.text, t.done)}
                          />
                          <span>{t.text}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {b.links.length > 0 && (
                    <div className="running-beat-links">
                      {b.links.map((l, lIdx) => (
                        <button
                          key={lIdx}
                          type="button"
                          className="running-link-chip"
                          onClick={() => handleOpenLink(l.target)}
                        >
                          🔗 {l.display}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {activeEntry && (
        <BottomSheet
          isOpen={Boolean(activeEntry)}
          onClose={() => setActiveEntry(null)}
          title={activeEntry.name}
        >
          <div style={{ padding: '8px 0', lineHeight: 1.6 }}>
            <div className="small muted" style={{ marginBottom: '8px' }}>
              Pack: {activeEntry.packId} · Type: {activeEntry.type}
            </div>
            <p>{activeEntry.snippet}</p>
          </div>
        </BottomSheet>
      )}
    </>
  );
}
