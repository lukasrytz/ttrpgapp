import { useEffect, useRef, useState } from 'react';
import { getPluginRuntime } from '@ttrpgapp/shared/plugin-client';
import { newId, type PartyMember } from './rosters';

function blankMember(): PartyMember {
  return { id: newId(), name: '', maxHp: 10, ac: null, initiativeBonus: 0, passivePerception: null };
}

export default function PartyPage() {
  const [party, setParty] = useState<PartyMember[] | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = () =>
    void getPluginRuntime()
      .kvGet('dnd5e', 'party')
      .then((v) => setParty(v ? (JSON.parse(v) as PartyMember[]) : []));

  useEffect(() => {
    load();
    window.addEventListener('ttrpg-sync-updated', load);
    return () => window.removeEventListener('ttrpg-sync-updated', load);
  }, []);

  const persist = (next: PartyMember[]) => {
    setParty(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void getPluginRuntime()
        .kvSet('dnd5e', 'party', JSON.stringify(next))
        .then(() => window.dispatchEvent(new Event('ttrpg-local-changed')));
    }, 400);
  };

  if (!party) return <div className="page muted">Loading…</div>;

  const setMember = (id: string, patch: Partial<PartyMember>) =>
    persist(party.map((m) => (m.id === id ? { ...m, ...patch } : m)));

  const num = (v: string): number | null => (v.trim() === '' ? null : Number(v));

  return (
    <div className="page">
      <div className="page-header">
        <h1>Party</h1>
        <button className="primary" onClick={() => persist([...party, blankMember()])}>
          + Add character
        </button>
      </div>
      <p className="muted">
        Your player characters, reusable across encounters. Add them to a fight from the Encounters
        page — initiative is rolled as d20 + the bonus below (edit it in the tracker to a player's
        actual roll).
      </p>

      {party.length === 0 ? (
        <p className="muted">No characters yet.</p>
      ) : (
        <table className="roster-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Max HP</th>
              <th>AC</th>
              <th>Init bonus</th>
              <th>Passive Perc.</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {party.map((m) => (
              <tr key={m.id}>
                <td>
                  <input
                    value={m.name}
                    placeholder="Character name"
                    onChange={(e) => setMember(m.id, { name: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    className="w-narrow"
                    type="number"
                    inputMode="numeric"
                    value={m.maxHp}
                    onChange={(e) => setMember(m.id, { maxHp: Math.max(1, Number(e.target.value) || 1) })}
                  />
                </td>
                <td>
                  <input
                    className="w-narrow"
                    type="number"
                    inputMode="numeric"
                    value={m.ac ?? ''}
                    onChange={(e) => setMember(m.id, { ac: num(e.target.value) })}
                  />
                </td>
                <td>
                  <input
                    className="w-narrow"
                    type="number"
                    inputMode="numeric"
                    value={m.initiativeBonus}
                    onChange={(e) => setMember(m.id, { initiativeBonus: Number(e.target.value) || 0 })}
                  />
                </td>
                <td>
                  <input
                    className="w-narrow"
                    type="number"
                    inputMode="numeric"
                    value={m.passivePerception ?? ''}
                    onChange={(e) => setMember(m.id, { passivePerception: num(e.target.value) })}
                  />
                </td>
                <td>
                  <button
                    onClick={() => {
                      if (window.confirm(`Remove ${m.name || 'this character'}?`))
                        persist(party.filter((x) => x.id !== m.id));
                    }}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
