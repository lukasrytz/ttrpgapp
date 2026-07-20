import { useEffect, useState } from 'react';
import type { CompendiumSearchHit } from '@ttrpgapp/shared';

const TYPES = ['spell', 'monster', 'condition', 'equipment', 'magic-item', 'rule', 'skill'];

/** Opens the core entry slide-over (same event the command palette uses). */
function openEntry(packId: string, entryId: string) {
  window.dispatchEvent(new CustomEvent('open-compendium-entry', { detail: { packId, entryId } }));
}

export default function CompendiumPage() {
  const [query, setQuery] = useState('');
  const [type, setType] = useState<string | null>(null);
  const [hits, setHits] = useState<CompendiumSearchHit[]>([]);

  useEffect(() => {
    if (!query.trim()) {
      setHits([]);
      return;
    }
    const t = setTimeout(() => {
      void fetch(`/api/compendium/search?q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((r: { hits: CompendiumSearchHit[] }) => setHits(r.hits));
    }, 150);
    return () => clearTimeout(t);
  }, [query]);

  const shown = type ? hits.filter((h) => h.type === type) : hits;

  return (
    <div className="page">
      <h1>5e Compendium</h1>
      <p className="muted">
        SRD 5.1 content (CC-BY-4.0). Tip: press <code>⌘K</code> anywhere for quick lookup.
      </p>
      <div className="filter-panel">
        <div className="filter-row">
          <input
            autoFocus
            placeholder="Search spells, monsters, rules…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ minWidth: 280 }}
          />
          <div className="chip-row">
            {TYPES.map((t) => (
              <button
                key={t}
                className={`chip ${type === t ? 'chip-on' : ''}`}
                onClick={() => setType(type === t ? null : t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="compendium-hits">
        {shown.map((h) => (
          <button
            key={`${h.packId}/${h.entryId}`}
            className="compendium-hit"
            onClick={() => openEntry(h.packId, h.entryId)}
          >
            <div>
              <strong>{h.name}</strong> <span className="tag">{h.type}</span>
            </div>
            <div className="muted small">{h.snippet.replace(/[*#|]/g, '').slice(0, 140)}</div>
          </button>
        ))}
        {query.trim() && shown.length === 0 && <p className="muted">No matches.</p>}
      </div>
    </div>
  );
}
