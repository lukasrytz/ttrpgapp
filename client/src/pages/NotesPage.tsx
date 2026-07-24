import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { autocompletion, type CompletionContext } from '@codemirror/autocomplete';
import type { Note } from '@ttrpgapp/shared';
import { backend } from '../backend';
import Markdown, { splitSections } from '../components/Markdown';

type Mode = 'edit' | 'play';

export default function NotesPage() {
  const qc = useQueryClient();
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('edit');

  const { data: listData } = useQuery({
    queryKey: ['notes'],
    queryFn: () => backend().listNotes(),
  });
  const notes = useMemo(() => listData ?? [], [listData]);
  const sessions = notes.filter((n) => n.isSession);
  const others = notes.filter((n) => !n.isSession && n.path !== 'template.md');

  const invalidate = () => qc.invalidateQueries({ queryKey: ['notes'] });

  const newSession = useMutation({
    mutationFn: (title: string) => backend().createSession(title),
    onSuccess: (r) => {
      invalidate();
      setSelectedPath(r.path);
      setMode('edit');
    },
  });
  const newNote = useMutation({
    mutationFn: (title: string) => backend().createNote(title),
    onSuccess: (r) => {
      invalidate();
      setSelectedPath(r.path);
      setMode('edit');
    },
  });

  const openByTitle = useCallback(
    (title: string) => {
      const target = notes.find((n) => n.title.toLowerCase() === title.toLowerCase());
      if (target) setSelectedPath(target.path);
      else {
        newNote.mutate(title);
      }
    },
    [notes, newNote],
  );

  return (
    <div className={`notes-page ${selectedPath ? 'has-selection' : ''}`}>
      <aside className="notes-list">
        <div className="notes-list-head">
          <button
            className="primary"
            onClick={() => {
              const title = window.prompt('Session title?', new Date().toISOString().slice(0, 10));
              if (title) newSession.mutate(title);
            }}
          >
            + New session
          </button>
          <button
            onClick={() => {
              const title = window.prompt('Note title? (e.g. an NPC or place)');
              if (title) newNote.mutate(title);
            }}
          >
            + Note
          </button>
        </div>
        <div className="sidebar-section">Sessions</div>
        {sessions.map((n) => (
          <button
            key={n.path}
            className={`note-item ${n.path === selectedPath ? 'note-item-active' : ''}`}
            onClick={() => setSelectedPath(n.path)}
          >
            {n.title}
          </button>
        ))}
        {sessions.length === 0 && <div className="muted small pad">No sessions yet.</div>}
        <div className="sidebar-section">Notes</div>
        {others.map((n) => (
          <button
            key={n.path}
            className={`note-item ${n.path === selectedPath ? 'note-item-active' : ''}`}
            onClick={() => setSelectedPath(n.path)}
          >
            {n.title}
          </button>
        ))}
        <div className="sidebar-section">Template</div>
        <button
          className={`note-item ${selectedPath === 'template.md' ? 'note-item-active' : ''}`}
          onClick={() => setSelectedPath('template.md')}
        >
          template.md
        </button>
      </aside>
      {selectedPath ? (
        <NoteEditor
          key={selectedPath}
          path={selectedPath}
          mode={mode}
          setMode={setMode}
          noteTitles={notes.map((n) => n.title)}
          onOpenByTitle={openByTitle}
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
    </div>
  );
}

function NoteEditor({
  path,
  mode,
  setMode,
  noteTitles,
  onOpenByTitle,
  onOpenPath,
  onBack,
  onDeleted,
}: {
  path: string;
  mode: Mode;
  setMode: (m: Mode) => void;
  noteTitles: string[];
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

  // Flush pending edits when leaving the note (unmount) or backgrounding the
  // app, so nothing typed in the last second is dropped.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
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
