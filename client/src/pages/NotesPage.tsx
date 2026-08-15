import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { autocompletion, type CompletionContext } from '@codemirror/autocomplete';
import type { Note } from '@ttrpgapp/shared';
import { backend } from '../backend';
import Markdown, { splitSections } from '../components/Markdown';

import BottomSheet from '../components/BottomSheet';

type Mode = 'edit' | 'play';

interface WikiPreview {
  title: string;
  body: string;
  type?: string;
  notePath?: string;
  compendiumRef?: { packId: string; entryId: string };
}

export default function NotesPage() {
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const urlPath = searchParams.get('path');
  const [selectedPath, setSelectedPath] = useState<string | null>(urlPath);
  const [mode, setMode] = useState<Mode>('edit');
  const [preview, setPreview] = useState<WikiPreview | null>(null);

  useEffect(() => {
    if (urlPath) {
      setSelectedPath(urlPath);
    }
  }, [urlPath]);

  const { data: listData } = useQuery({
    queryKey: ['notes'],
    queryFn: () => backend().listNotes(),
  });
  const notes = useMemo(() => listData ?? [], [listData]);
  const sessions = notes.filter((n) => n.isSession);
  const others = notes.filter((n) => !n.isSession && n.path !== 'template.md');

  const invalidate = () => qc.invalidateQueries({ queryKey: ['notes'] });

  const newCampaign = useMutation({
    mutationFn: (name: string) => backend().createCampaign(name),
    onSuccess: () => invalidate(),
  });

  const newSession = useMutation({
    mutationFn: ({ title, campaign }: { title: string; campaign?: string }) => backend().createSession(title, campaign),
    onSuccess: (r) => {
      invalidate();
      setSelectedPath(r.path);
      setMode('edit');
    },
  });
  const newNote = useMutation({
    mutationFn: ({ title, campaign }: { title: string; campaign?: string }) => backend().createNote(title, campaign),
    onSuccess: (r) => {
      invalidate();
      setSelectedPath(r.path);
      setMode('edit');
    },
  });
  const deleteCampaign = useMutation({
    mutationFn: (name: string) => backend().deleteCampaign(name),
    onSuccess: () => invalidate(),
  });

  const openByTitle = useCallback(
    (title: string) => {
      const target = notes.find((n) => n.title.toLowerCase() === title.toLowerCase());
      if (target) setSelectedPath(target.path);
      else {
        newNote.mutate({ title });
      }
    },
    [notes, newNote],
  );

  const [expandedCampaigns, setExpandedCampaigns] = useState<Record<string, boolean>>({});

  const campaigns = useMemo(() => {
    const groups: Record<string, { sessions: typeof notes; notes: typeof notes; template?: (typeof notes)[0] }> = {
      Uncategorized: { sessions: [], notes: [] },
    };
    notes.forEach((n) => {
      const c = n.campaign || 'Uncategorized';
      if (!groups[c]) groups[c] = { sessions: [], notes: [] };
      if (n.title === 'template' && !n.isSession) {
        groups[c].template = n;
      } else if (n.isSession) {
        groups[c].sessions.push(n);
      } else {
        groups[c].notes.push(n);
      }
    });
    return groups;
  }, [notes]);

  const handleWikiLink = useCallback(
    (title: string) => {
      // 1. Check compendium index first if plugin runtime is available
      const hits = window.__ttrpgappRuntime?.searchCompendium(title, 5) ?? [];
      const exactCompendium = hits.find((h) => h.name.toLowerCase() === title.toLowerCase()) ?? hits[0];

      if (exactCompendium) {
        const entry = window.__ttrpgappRuntime?.getCompendiumEntry(exactCompendium.packId, exactCompendium.entryId);
        if (entry) {
          setPreview({
            title: entry.name,
            body: entry.body,
            type: entry.type,
            compendiumRef: { packId: exactCompendium.packId, entryId: exactCompendium.entryId },
          });
          return;
        }
      }

      // 2. Check local notes vault
      const targetNote = notes.find((n) => n.title.toLowerCase() === title.toLowerCase());
      if (targetNote) {
        void backend()
          .readNote(targetNote.path)
          .then((n) => {
            setPreview({
              title: n.title,
              body: n.content,
              type: n.isSession ? 'session' : 'note',
              notePath: n.path,
            });
          });
        return;
      }

      // 3. Fallback: navigate / create note
      openByTitle(title);
    },
    [notes, openByTitle],
  );

  return (
    <div className={`notes-page ${selectedPath ? 'has-selection' : ''}`}>
      <aside className="notes-list">
        <div className="notes-list-head" style={{ padding: '12px' }}>
          <button
            className="primary"
            style={{ width: '100%' }}
            onClick={() => {
              const name = window.prompt('Campaign Name?');
              if (name) newCampaign.mutate(name);
            }}
          >
            + New Campaign
          </button>
        </div>

        {Object.entries(campaigns).map(([cname, group]) => {
          // Hide "Uncategorized" if it's completely empty
          if (cname === 'Uncategorized' && group.sessions.length === 0 && group.notes.length === 0 && !group.template) {
            return null;
          }

          const isExpanded = expandedCampaigns[cname] ?? true;
          return (
            <div key={cname} className="campaign-group" style={{ marginBottom: '8px' }}>
              <div
                className="campaign-header"
                onClick={() => setExpandedCampaigns((prev) => ({ ...prev, [cname]: !isExpanded }))}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  padding: '8px 12px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  fontWeight: 'bold',
                }}
              >
                <span>
                  {isExpanded ? '▼' : '▶'} {cname}
                </span>
                <div className="campaign-actions" onClick={(e) => e.stopPropagation()} style={{ display: 'flex', gap: '4px' }}>
                  <button
                    className="icon-btn small-btn"
                    title="New Session"
                    onClick={() => {
                      const title = window.prompt('Session title?', new Date().toISOString().slice(0, 10));
                      if (title) newSession.mutate({ title, campaign: cname === 'Uncategorized' ? undefined : cname });
                    }}
                  >
                    🗓️
                  </button>
                  <button
                    className="icon-btn small-btn"
                    title="New Note"
                    onClick={() => {
                      const title = window.prompt('Note title? (e.g. NPC or location)');
                      if (title) newNote.mutate({ title, campaign: cname === 'Uncategorized' ? undefined : cname });
                    }}
                  >
                    📝
                  </button>
                  {cname !== 'Uncategorized' && (
                    <button
                      className="icon-btn small-btn"
                      title="Delete Campaign"
                      onClick={(e) => {
                        e.stopPropagation();
                        const confirm = window.prompt(`Type "delete" to confirm deleting the campaign "${cname}" and ALL its notes:`);
                        if (confirm?.toLowerCase() === 'delete') {
                          deleteCampaign.mutate(cname);
                        }
                      }}
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="campaign-content" style={{ paddingLeft: '12px' }}>
                  {group.sessions.length > 0 && <div className="sidebar-section">Sessions</div>}
                  {group.sessions.map((n) => (
                    <button
                      key={n.path}
                      className={`note-item ${n.path === selectedPath ? 'note-item-active' : ''}`}
                      onClick={() => setSelectedPath(n.path)}
                    >
                      {n.title}
                    </button>
                  ))}

                  {group.notes.length > 0 && <div className="sidebar-section">Notes</div>}
                  {group.notes.map((n) => (
                    <button
                      key={n.path}
                      className={`note-item ${n.path === selectedPath ? 'note-item-active' : ''}`}
                      onClick={() => setSelectedPath(n.path)}
                    >
                      {n.title}
                    </button>
                  ))}

                  {group.template && (
                    <>
                      <div className="sidebar-section">Template</div>
                      <button
                        className={`note-item ${group.template.path === selectedPath ? 'note-item-active' : ''}`}
                        onClick={() => setSelectedPath(group.template!.path)}
                      >
                        template.md
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </aside>
      {selectedPath ? (
        <NoteEditor
          key={selectedPath}
          path={selectedPath}
          mode={mode}
          setMode={setMode}
          noteTitles={notes.map((n) => n.title)}
          campaigns={Object.keys(campaigns)}
          onOpenByTitle={handleWikiLink}
          onOpenPath={setSelectedPath}
          onBack={() => setSelectedPath(null)}
          onDeleted={() => {
            setSelectedPath(null);
            invalidate();
          }}
        />
      ) : (
        <div className="page">
          <h1>Prep Notes</h1>
          <p className="muted">
            Select a note, or create a new session — it starts from your <em>template.md</em>, which
            you can edit like any other note. Placeholders <code>{'{{title}}'}</code> and{' '}
            <code>{'{{date}}'}</code> are filled in.
          </p>
        </div>
      )}

      <BottomSheet
        isOpen={Boolean(preview)}
        onClose={() => setPreview(null)}
        title={preview?.title ?? ''}
      >
        {preview && (
          <div className="wiki-preview-sheet">
            {preview.type && <span className="tag" style={{ marginBottom: 12 }}>{preview.type}</span>}
            <div className="markdown-body">
              <Markdown content={preview.body} onWikiLink={handleWikiLink} />
            </div>
            <div className="header-actions" style={{ marginTop: 16 }}>
              {preview.notePath && (
                <button
                  className="primary"
                  onClick={() => {
                    setSelectedPath(preview.notePath!);
                    setPreview(null);
                  }}
                >
                  Open Full Note
                </button>
              )}
              {preview.compendiumRef && (
                <button
                  className="primary"
                  onClick={() => {
                    window.__ttrpgappRuntime?.openCompendiumEntry(
                      preview.compendiumRef!.packId,
                      preview.compendiumRef!.entryId,
                    );
                    setPreview(null);
                  }}
                >
                  Open Compendium Entry
                </button>
              )}
            </div>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}

function NoteEditor({
  path,
  mode,
  setMode,
  noteTitles,
  campaigns,
  onOpenByTitle,
  onOpenPath,
  onBack,
  onDeleted,
}: {
  path: string;
  mode: Mode;
  setMode: (m: Mode) => void;
  noteTitles: string[];
  campaigns: string[];
  onOpenByTitle: (title: string) => void;
  onOpenPath: (path: string) => void;
  onBack: () => void;
  onDeleted: () => void;
}) {
  const qc = useQueryClient();
  const { data: note } = useQuery({
    queryKey: ['note', path],
    queryFn: (): Promise<Note> => backend().readNote(path),
  });
  const [draft, setDraft] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const content = draft ?? note?.content ?? '';

  const save = useMutation({
    mutationFn: (c: string) => backend().writeNote(path, c),
    onSuccess: () => {
      setDirty(false);
      void qc.invalidateQueries({ queryKey: ['note', path] });
      void qc.invalidateQueries({ queryKey: ['notes'] });
      window.dispatchEvent(new Event('ttrpg-local-changed'));
    },
  });

  const renameNote = useMutation({
    mutationFn: ({ oldPath, newPath }: { oldPath: string; newPath: string }) => backend().renameNote(oldPath, newPath),
    onSuccess: (res) => {
      onOpenPath(res.path);
      void qc.invalidateQueries({ queryKey: ['notes'] });
    },
  });

  // Keep the latest unsaved text reachable from the unmount/flush handlers,
  // which can't read the newest render's closure.
  const unsaved = useRef<string | null>(null);

  const flush = useCallback(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (unsaved.current !== null) {
      const c = unsaved.current;
      unsaved.current = null;
      // Write directly (not via the mutation) so it still lands if we're
      // unmounting — otherwise edits made within the debounce window are lost.
      void backend()
        .writeNote(path, c)
        .then(() => {
          window.dispatchEvent(new Event('ttrpg-local-changed'));
          void qc.invalidateQueries({ queryKey: ['notes'] });
        });
    }
  }, [path]);

  const onChange = (value: string) => {
    setDraft(value);
    setDirty(true);
    unsaved.current = value;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      unsaved.current = null;
      save.mutate(value);
    }, 1200);
  };

  // Flush pending edits when leaving the note (unmount), backgrounding the
  // app, or when a quickNote one-press capture is triggered.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    const onFlushEvent = () => {
      flush();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('ttrpg-flush-notes', onFlushEvent);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('ttrpg-flush-notes', onFlushEvent);
      flush();
    };
  }, [flush]);

  const titlesRef = useRef(noteTitles);
  titlesRef.current = noteTitles;
  const wikiCompletion = useMemo(
    () =>
      autocompletion({
        override: [
          (ctx: CompletionContext) => {
            const before = ctx.matchBefore(/\[\[([^\]]*)/);
            if (!before) return null;
            const typed = before.text.slice(2);
            return {
              from: before.from + 2,
              options: titlesRef.current
                .filter((t) => t.toLowerCase().includes(typed.toLowerCase()))
                .map((t) => ({ label: t, apply: `${t}]]` })),
            };
          },
        ],
      }),
    [],
  );

  // Stable identity: a fresh array (or a new markdown() instance) each render
  // makes react-codemirror reconfigure and snap the cursor to the top on every
  // keystroke. Build it once.
  const extensions = useMemo(() => [markdown(), wikiCompletion], [wikiCompletion]);

  if (!note) return <div className="page muted">Loading…</div>;

  return (
    <div className="note-editor">
      <div className="note-toolbar">
        <button className="icon-btn back-btn" aria-label="Back to list" onClick={onBack}>
          ‹
        </button>
        <strong className="note-title">{note.title}</strong>
        <span className="muted small">
          {dirty ? 'unsaved…' : save.isPending ? 'saving…' : 'saved'}
        </span>
        <div className="header-actions">
          {note.title !== 'template' && (
            <select
              value={note.campaign || 'Uncategorized'}
              onChange={(e) => {
                const newCampaign = e.target.value;
                if (newCampaign === (note.campaign || 'Uncategorized')) return;
                const cname = newCampaign === 'Uncategorized' ? undefined : newCampaign;
                const rel = cname 
                  ? (note.isSession ? `${cname}/sessions/${note.title}.md` : `${cname}/${note.title}.md`)
                  : (note.isSession ? `sessions/${note.title}.md` : `${note.title}.md`);
                renameNote.mutate({ oldPath: path, newPath: rel });
              }}
              style={{ marginRight: '8px', padding: '4px', background: 'var(--bg-layer-3)', color: 'var(--text-1)', border: '1px solid var(--border-1)', borderRadius: '4px' }}
            >
              <option value="Uncategorized">Uncategorized</option>
              {campaigns.filter((c) => c !== 'Uncategorized').map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}
          <button className={mode === 'edit' ? 'primary' : ''} onClick={() => setMode('edit')}>
            Edit
          </button>
          <button className={mode === 'play' ? 'primary' : ''} onClick={() => setMode('play')}>
            Play view
          </button>
          <button
            onClick={() => {
              if (window.confirm(`Delete "${note.title}"?`)) {
                void backend().deleteNote(path).then(onDeleted);
              }
            }}
          >
            🗑
          </button>
        </div>
      </div>
      {mode === 'edit' ? (
        <div className="note-edit-split">
          <CodeMirror
            className="note-cm"
            value={content}
            onChange={onChange}
            extensions={extensions}
            theme="dark"
            basicSetup={{ lineNumbers: false, foldGutter: false }}
          />
          <div className="note-preview markdown-body">
            <Markdown content={content} onWikiLink={onOpenByTitle} />
          </div>
        </div>
      ) : (
        <div className="note-play markdown-body">
          {splitSections(content).map((s, i) =>
            s.heading === null ? (
              <Markdown key={i} content={s.body} onWikiLink={onOpenByTitle} />
            ) : (
              <details key={i} open className="play-section">
                <summary>{s.heading}</summary>
                <Markdown content={s.body} onWikiLink={onOpenByTitle} />
              </details>
            ),
          )}
        </div>
      )}
      {note.backlinks.length > 0 && (
        <div className="backlinks">
          <span className="muted small">Linked from: </span>
          {note.backlinks.map((b) => (
            <button key={b} className="chip" onClick={() => onOpenPath(b)}>
              {b.replace(/\.md$/, '')}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
