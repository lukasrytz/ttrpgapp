import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CompendiumSearchHit } from '@ttrpgapp/shared';
import { getPluginRuntime } from '@ttrpgapp/shared/plugin-client';
import { instantiate, newId, type EncounterGroup, type PartyMember, type SavedEncounter } from './rosters';
import { EMPTY_ENCOUNTER } from './trackerTypes';

const rt = getPluginRuntime;

export default function EncountersPage() {
  const navigate = useNavigate();
  const [encounters, setEncounters] = useState<SavedEncounter[] | null>(null);
  const [party, setParty] = useState<PartyMember[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [starting, setStarting] = useState<SavedEncounter | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = () => {
    void rt()
      .kvGet('dnd5e', 'encounters')
      .then((v) => setEncounters(v ? (JSON.parse(v) as SavedEncounter[]) : []));
    void rt()
      .kvGet('dnd5e', 'party')
      .then((v) => setParty(v ? (JSON.parse(v) as PartyMember[]) : []));
  };

  useEffect(() => {
    load();
    window.addEventListener('ttrpg-sync-updated', load);
    return () => window.removeEventListener('ttrpg-sync-updated', load);
  }, []);

  const persist = (next: SavedEncounter[]) => {
    setEncounters(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void rt()
        .kvSet('dnd5e', 'encounters', JSON.stringify(next))
        .then(() => window.dispatchEvent(new Event('ttrpg-local-changed')));
    }, 400);
  };

  const selected = encounters?.find((e) => e.id === selectedId) ?? null;
  const updateSelected = (patch: Partial<SavedEncounter>) =>
    encounters && selected && persist(encounters.map((e) => (e.id === selected.id ? { ...e, ...patch } : e)));

  if (!encounters) return <div className="page muted">Loading…</div>;

  const createEncounter = () => {
    const name = window.prompt('Encounter name?');
    if (!name?.trim()) return;
    const enc: SavedEncounter = { id: newId(), name: name.trim(), groups: [], notes: '' };
    persist([...encounters, enc]);
    setSelectedId(enc.id);
  };

  return (
    <div className="page encounters-page">
      <aside className="encounters-list">
        <div className="notes-list-head">
          <button className="primary" onClick={createEncounter}>
            + New encounter
          </button>
        </div>
        {encounters.length === 0 && <div className="muted small pad">No saved encounters.</div>}
        {encounters.map((e) => (
          <button
            key={e.id}
            className={`note-item ${e.id === selectedId ? 'note-item-active' : ''}`}
            onClick={() => setSelectedId(e.id)}
          >
            {e.name}
            <span className="muted small">
              {' '}
              · {e.groups.reduce((n, g) => n + g.count, 0)}
            </span>
          </button>
        ))}
      </aside>

      {selected ? (
        <EncounterEditor
          key={selected.id}
          enc={selected}
          onChange={updateSelected}
          onDelete={() => {
            if (window.confirm(`Delete "${selected.name}"?`)) {
              persist(encounters.filter((e) => e.id !== selected.id));
              setSelectedId(null);
            }
          }}
          onStart={() => setStarting(selected)}
        />
      ) : (
        <div className="encounter-main muted">Select or create an encounter.</div>
      )}

      {starting && (
        <StartDialog
          enc={starting}
          party={party}
          onCancel={() => setStarting(null)}
          onConfirm={(chosen) => {
            const live = { ...EMPTY_ENCOUNTER, combatants: instantiate(starting, chosen) };
            void rt()
              .kvSet('dnd5e', 'encounter', JSON.stringify(live))
              .then(() => {
                window.dispatchEvent(new Event('ttrpg-local-changed'));
                window.dispatchEvent(new CustomEvent('ttrpg-sync-updated'));
                navigate('/p/dnd5e/tracker');
              });
          }}
        />
      )}
    </div>
  );
}

function EncounterEditor({
  enc,
  onChange,
  onDelete,
  onStart,
}: {
  enc: SavedEncounter;
  onChange: (patch: Partial<SavedEncounter>) => void;
  onDelete: () => void;
  onStart: () => void;
}) {
  const [query, setQuery] = useState('');
  const hits = useMemo(
    () => (query.trim() ? rt().searchCompendium(query, 50).filter((h) => h.type === 'monster').slice(0, 6) : []),
    [query],
  );

  const addMonster = (hit: CompendiumSearchHit) => {
    const existing = enc.groups.find((g) => g.entryId === hit.entryId);
    if (existing) {
      onChange({ groups: enc.groups.map((g) => (g === existing ? { ...g, count: g.count + 1 } : g)) });
    } else {
      const entry = rt().getCompendiumEntry(hit.packId, hit.entryId);
      const f = (entry?.fields ?? {}) as { hp?: number; ac?: number; dexMod?: number };
      const group: EncounterGroup = {
        packId: hit.packId,
        entryId: hit.entryId,
        name: hit.name,
        count: 1,
        hp: f.hp ?? 1,
        ac: f.ac ?? null,
        dexMod: f.dexMod ?? 0,
      };
      onChange({ groups: [...enc.groups, group] });
    }
    setQuery('');
  };

  const setCount = (entryId: string, count: number) =>
    onChange({
      groups:
        count <= 0
          ? enc.groups.filter((g) => g.entryId !== entryId)
          : enc.groups.map((g) => (g.entryId === entryId ? { ...g, count } : g)),
    });

  const total = enc.groups.reduce((n, g) => n + g.count, 0);

  return (
    <div className="encounter-main">
      <div className="page-header">
        <input
          className="encounter-name"
          value={enc.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
        <div className="header-actions">
          <span className="muted small">{total} monsters</span>
          <button className="primary" onClick={onStart} disabled={enc.groups.length === 0}>
            ▶ Start
          </button>
          <button onClick={onDelete}>🗑</button>
        </div>
      </div>

      <div className="filter-panel">
        <div className="filter-row">
          <span className="filter-label">add monster</span>
          <input
            placeholder="Search SRD monsters…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="chip-row">
            {hits.map((h) => (
              <button key={h.entryId} className="chip" onClick={() => addMonster(h)}>
                + {h.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {enc.groups.length === 0 ? (
        <p className="muted">No monsters yet — search above to add them.</p>
      ) : (
        <table className="roster-table">
          <tbody>
            {enc.groups.map((g) => (
              <tr key={g.entryId}>
                <td>
                  <button
                    className="linklike"
                    onClick={() => rt().openCompendiumEntry(g.packId, g.entryId)}
                  >
                    {g.name}
                  </button>
                  <span className="muted small"> HP {g.hp} · AC {g.ac ?? '—'}</span>
                </td>
                <td className="count-cell">
                  <button onClick={() => setCount(g.entryId, g.count - 1)}>−</button>
                  <span className="count-val">{g.count}</span>
                  <button onClick={() => setCount(g.entryId, g.count + 1)}>+</button>
                </td>
                <td>
                  <button onClick={() => setCount(g.entryId, 0)}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function StartDialog({
  enc,
  party,
  onCancel,
  onConfirm,
}: {
  enc: SavedEncounter;
  party: PartyMember[];
  onCancel: () => void;
  onConfirm: (chosen: PartyMember[]) => void;
}) {
  const [chosen, setChosen] = useState<Set<string>>(new Set(party.map((p) => p.id)));
  const toggle = (id: string) =>
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="palette-backdrop" onClick={onCancel}>
      <div className="start-dialog" onClick={(e) => e.stopPropagation()}>
        <h2>Start “{enc.name}”</h2>
        <p className="muted small">
          Rolls initiative and loads the tracker (replacing any current fight). Choose who's present:
        </p>
        {party.length === 0 ? (
          <p className="muted">No party members — add some on the Party page.</p>
        ) : (
          <div className="chip-row start-party">
            {party.map((p) => (
              <button
                key={p.id}
                className={`chip ${chosen.has(p.id) ? 'chip-on' : ''}`}
                onClick={() => toggle(p.id)}
              >
                {p.name || 'Unnamed'}
              </button>
            ))}
          </div>
        )}
        <div className="header-actions">
          <button className="primary" onClick={() => onConfirm(party.filter((p) => chosen.has(p.id)))}>
            ▶ Start encounter
          </button>
          <button onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
