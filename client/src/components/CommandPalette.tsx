import { useEffect, useRef, useState } from 'react';
import type { CompendiumEntry, CompendiumSearchHit } from '@ttrpgapp/shared';
import { compendiumIndex } from '../compendium';
import Markdown from './Markdown';

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<CompendiumSearchHit[]>([]);
  const [cursor, setCursor] = useState(0);
  const [entry, setEntry] = useState<CompendiumEntry | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
      setEntry(compendiumIndex.getEntry(packId, entryId));
    };
    const onOpenPalette = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('open-compendium-entry', onOpenEntry);
    window.addEventListener('open-command-palette', onOpenPalette);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('open-compendium-entry', onOpenEntry);
      window.removeEventListener('open-command-palette', onOpenPalette);
    };
  }, []);

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
    setHits(q.trim() ? compendiumIndex.search(q) : []);
    setCursor(0);
  };

  const pick = (hit: CompendiumSearchHit) => {
    setOpen(false);
    setEntry(compendiumIndex.getEntry(hit.packId, hit.entryId));
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
