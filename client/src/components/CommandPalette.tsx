import { useCallback, useEffect, useRef, useState } from 'react';
import type { CompendiumEntry, CompendiumSearchHit } from '@ttrpgapp/shared';
import { apiGet } from '../api';
import Markdown from './Markdown';

/** Other views (incl. plugin views) open a compendium entry via this event. */
export function openCompendiumEntry(packId: string, entryId: string) {
  window.dispatchEvent(new CustomEvent('open-compendium-entry', { detail: { packId, entryId } }));
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<CompendiumSearchHit[]>([]);
  const [cursor, setCursor] = useState(0);
  const [entry, setEntry] = useState<CompendiumEntry | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showEntry = useCallback((packId: string, entryId: string) => {
    void apiGet<CompendiumEntry>(
      `/api/compendium/entry/${encodeURIComponent(packId)}/${encodeURIComponent(entryId)}`,
    ).then(setEntry);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === 'Escape') {
        setOpen(false);
        setEntry(null);
      }
    };
    const onOpenEntry = (e: Event) => {
      const { packId, entryId } = (e as CustomEvent<{ packId: string; entryId: string }>).detail;
      showEntry(packId, entryId);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('open-compendium-entry', onOpenEntry);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('open-compendium-entry', onOpenEntry);
    };
  }, [showEntry]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setHits([]);
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  const onQuery = (q: string) => {
    setQuery(q);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      if (!q.trim()) {
        setHits([]);
        return;
      }
      void apiGet<{ hits: CompendiumSearchHit[] }>(
        `/api/compendium/search?q=${encodeURIComponent(q)}`,
      ).then((r) => {
        setHits(r.hits);
        setCursor(0);
      });
    }, 120);
  };

  const pick = (hit: CompendiumSearchHit) => {
    setOpen(false);
    showEntry(hit.packId, hit.entryId);
  };

  return (
    <>
      {open && (
        <div className="palette-backdrop" onClick={() => setOpen(false)}>
          <div className="palette" onClick={(e) => e.stopPropagation()}>
            <input
              ref={inputRef}
              value={query}
              placeholder="Search rules, spells, monsters…  (Esc to close)"
              onChange={(e) => onQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setCursor((c) => Math.min(c + 1, hits.length - 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setCursor((c) => Math.max(c - 1, 0));
                } else if (e.key === 'Enter' && hits[cursor]) {
                  pick(hits[cursor]);
                }
              }}
            />
            <div className="palette-hits">
              {hits.map((h, i) => (
                <button
                  key={`${h.packId}/${h.entryId}`}
                  className={`palette-hit ${i === cursor ? 'palette-hit-active' : ''}`}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => pick(h)}
                >
                  <span className="palette-hit-name">{h.name}</span>
                  <span className="palette-hit-type">{h.type}</span>
                </button>
              ))}
              {query.trim() && hits.length === 0 && (
                <div className="muted pad">No matches.</div>
              )}
            </div>
          </div>
        </div>
      )}
      {entry && (
        <aside className="entry-panel">
          <div className="entry-panel-head">
            <div>
              <h2>{entry.name}</h2>
              <span className="muted small">
                {entry.type} · {entry.source}
              </span>
            </div>
            <button onClick={() => setEntry(null)}>✕</button>
          </div>
          <div className="entry-panel-body markdown-body">
            <Markdown content={entry.body} />
          </div>
        </aside>
      )}
    </>
  );
}
