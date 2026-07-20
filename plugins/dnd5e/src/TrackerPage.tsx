import { useEffect, useRef, useState } from 'react';
import type { CompendiumSearchHit } from '@ttrpgapp/shared';
import { getPluginRuntime } from '@ttrpgapp/shared/plugin-client';
import {
  CONDITIONS,
  EMPTY_ENCOUNTER,
  sortedCombatants,
  type Combatant,
  type Encounter,
} from './trackerTypes';

function openEntry(packId: string, entryId: string) {
  getPluginRuntime().openCompendiumEntry(packId, entryId);
}

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function d20(): number {
  return 1 + Math.floor(Math.random() * 20);
}

export default function TrackerPage() {
  const [enc, setEnc] = useState<Encounter | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editingConditions, setEditingConditions] = useState<string | null>(null);

  useEffect(() => {
    void getPluginRuntime()
      .kvGet('dnd5e', 'encounter')
      .then((v) => setEnc(v ? (JSON.parse(v) as Encounter) : EMPTY_ENCOUNTER));
  }, []);

  const update = (fn: (e: Encounter) => Encounter) => {
    setEnc((prev) => {
      if (!prev) return prev;
      const next = fn(prev);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void getPluginRuntime().kvSet('dnd5e', 'encounter', JSON.stringify(next));
      }, 300);
      return next;
    });
  };

  const updateCombatant = (id: string, fn: (c: Combatant) => Combatant) =>
    update((e) => ({
      ...e,
      combatants: e.combatants.map((c) => (c.id === id ? fn(c) : c)),
    }));

  if (!enc) return <div className="page muted">Loading…</div>;

  const order = sortedCombatants(enc);
  const active = enc.turnIndex >= 0 ? order[enc.turnIndex % order.length] : null;

  const nextTurn = () =>
    update((e) => {
      const n = sortedCombatants(e).length;
      if (n === 0) return e;
      if (e.turnIndex < 0) return { ...e, round: 1, turnIndex: 0 };
      const next = e.turnIndex + 1;
      return next >= n ? { ...e, round: e.round + 1, turnIndex: 0 } : { ...e, turnIndex: next };
    });

  return (
    <div className="page tracker-page">
      <div className="page-header">
        <h1>Combat Tracker</h1>
        <div className="header-actions">
          {enc.round > 0 && (
            <span className="round-badge">
              Round {enc.round}
              {active ? ` · ${active.name}` : ''}
            </span>
          )}
          <button className="primary" onClick={nextTurn} disabled={order.length === 0}>
            {enc.turnIndex < 0 ? '▶ Start combat' : '⏭ Next turn'}
          </button>
          <button
            onClick={() => {
              if (window.confirm('End combat and clear all combatants?'))
                update(() => EMPTY_ENCOUNTER);
            }}
            disabled={order.length === 0}
          >
            End combat
          </button>
        </div>
      </div>

      <AddCombatant onAdd={(c) => update((e) => ({ ...e, combatants: [...e.combatants, c] }))} existing={enc.combatants} />

      {order.length === 0 ? (
        <p className="muted">No combatants. Add players and monsters above.</p>
      ) : (
        <table className="tracker-table">
          <thead>
            <tr>
              <th>Init</th>
              <th>Name</th>
              <th>HP</th>
              <th>AC</th>
              <th>Conditions</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {order.map((c) => (
              <CombatantRow
                key={c.id}
                c={c}
                isActive={active?.id === c.id}
                editingConditions={editingConditions === c.id}
                onToggleConditions={() =>
                  setEditingConditions(editingConditions === c.id ? null : c.id)
                }
                onChange={(fn) => updateCombatant(c.id, fn)}
                onRemove={() =>
                  update((e) => ({ ...e, combatants: e.combatants.filter((x) => x.id !== c.id) }))
                }
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function CombatantRow({
  c,
  isActive,
  editingConditions,
  onToggleConditions,
  onChange,
  onRemove,
}: {
  c: Combatant;
  isActive: boolean;
  editingConditions: boolean;
  onToggleConditions: () => void;
  onChange: (fn: (c: Combatant) => Combatant) => void;
  onRemove: () => void;
}) {
  const [amount, setAmount] = useState('');

  const applyHp = (sign: 1 | -1) => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return;
    onChange((prev) => {
      const hp = Math.max(0, Math.min(prev.maxHp, prev.hp + sign * n));
      const dropped = hp === 0 && prev.hp > 0;
      return {
        ...prev,
        hp,
        deathSaves: dropped ? { successes: 0, failures: 0 } : prev.deathSaves,
        concentration: sign < 0 && prev.concentration ? prev.concentration : prev.concentration,
      };
    });
    setAmount('');
  };

  const down = c.hp === 0;

  return (
    <>
      <tr className={`${isActive ? 'row-active-turn' : ''} ${down ? 'row-down' : ''}`}>
        <td className="cell-init">
          <input
            className="init-input"
            type="number"
            value={c.initiative}
            onChange={(e) => onChange((p) => ({ ...p, initiative: Number(e.target.value) }))}
          />
        </td>
        <td>
          {c.monsterRef ? (
            <button
              className="linklike"
              onClick={() => openEntry(c.monsterRef!.packId, c.monsterRef!.entryId)}
              title="Show stat block"
            >
              {c.name}
            </button>
          ) : (
            <span>{c.name}</span>
          )}
          {c.isPlayer && <span className="tag">PC</span>}
          {c.concentration && (
            <button
              className="chip chip-on conc"
              title="Concentrating — click to drop"
              onClick={() => onChange((p) => ({ ...p, concentration: false }))}
            >
              ⌛ conc.
            </button>
          )}
          {!c.concentration && (
            <button
              className="chip conc"
              title="Mark concentrating"
              onClick={() => onChange((p) => ({ ...p, concentration: true }))}
            >
              conc.
            </button>
          )}
        </td>
        <td className="cell-hp">
          <span className={c.hp <= c.maxHp / 4 ? 'hp-low' : ''}>
            {c.hp}/{c.maxHp}
          </span>
          <span className="hp-controls">
            <button onClick={() => applyHp(-1)} title="Damage">
              −
            </button>
            <input
              className="hp-amount"
              value={amount}
              placeholder="0"
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applyHp(-1);
              }}
            />
            <button onClick={() => applyHp(1)} title="Heal">
              +
            </button>
          </span>
        </td>
        <td>{c.ac ?? '—'}</td>
        <td className="cell-conditions">
          {c.conditions.map((cond) => (
            <button
              key={cond}
              className="chip chip-on"
              title="Click for rules; ✕ in editor to remove"
              onClick={() => openEntry('dnd5e-srd', `condition:${cond}`)}
            >
              {cond}
            </button>
          ))}
          {c.exhaustion > 0 && (
            <button
              className="chip chip-on"
              onClick={() => openEntry('dnd5e-srd', 'condition:exhaustion')}
            >
              exhaustion {c.exhaustion}
            </button>
          )}
          <button className="chip" onClick={onToggleConditions}>
            {editingConditions ? 'done' : '+'}
          </button>
        </td>
        <td className="cell-remove">
          <button onClick={onRemove} title="Remove">
            ✕
          </button>
        </td>
      </tr>
      {down && c.isPlayer && (
        <tr className="row-death-saves">
          <td></td>
          <td colSpan={5}>
            <DeathSaves c={c} onChange={onChange} />
          </td>
        </tr>
      )}
      {editingConditions && (
        <tr>
          <td></td>
          <td colSpan={5}>
            <div className="chip-row condition-editor">
              {CONDITIONS.map((cond) => (
                <button
                  key={cond}
                  className={`chip ${c.conditions.includes(cond) ? 'chip-on' : ''}`}
                  onClick={() =>
                    onChange((p) => ({
                      ...p,
                      conditions: p.conditions.includes(cond)
                        ? p.conditions.filter((x) => x !== cond)
                        : [...p.conditions, cond],
                    }))
                  }
                >
                  {cond}
                </button>
              ))}
              <span className="muted small">exhaustion:</span>
              {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  className={`chip ${c.exhaustion === n ? 'chip-on' : ''}`}
                  onClick={() => onChange((p) => ({ ...p, exhaustion: n }))}
                >
                  {n}
                </button>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function DeathSaves({
  c,
  onChange,
}: {
  c: Combatant;
  onChange: (fn: (c: Combatant) => Combatant) => void;
}) {
  const { successes, failures } = c.deathSaves;
  const mark = (kind: 'successes' | 'failures') =>
    onChange((p) => ({
      ...p,
      deathSaves: { ...p.deathSaves, [kind]: Math.min(3, p.deathSaves[kind] + 1) },
    }));
  return (
    <div className="death-saves">
      <span className="muted small">Death saves</span>
      <span>
        ✓ {'●'.repeat(successes)}
        {'○'.repeat(3 - successes)}
      </span>
      <span>
        ☠ {'●'.repeat(failures)}
        {'○'.repeat(3 - failures)}
      </span>
      <button onClick={() => mark('successes')}>+ success</button>
      <button onClick={() => mark('failures')}>+ failure</button>
      <button
        onClick={() =>
          onChange((p) => ({ ...p, hp: 1, deathSaves: { successes: 0, failures: 0 } }))
        }
      >
        Stabilize @ 1 HP
      </button>
      {failures >= 3 && <span className="hp-low">Dead</span>}
      {successes >= 3 && <span>Stable</span>}
    </div>
  );
}

function AddCombatant({
  onAdd,
  existing,
}: {
  onAdd: (c: Combatant) => void;
  existing: Combatant[];
}) {
  const [name, setName] = useState('');
  const [init, setInit] = useState('');
  const [hp, setHp] = useState('');
  const [ac, setAc] = useState('');
  const [monsterQuery, setMonsterQuery] = useState('');
  const [monsterHits, setMonsterHits] = useState<CompendiumSearchHit[]>([]);

  useEffect(() => {
    if (!monsterQuery.trim()) {
      setMonsterHits([]);
      return;
    }
    setMonsterHits(
      getPluginRuntime()
        .searchCompendium(monsterQuery, 50)
        .filter((h) => h.type === 'monster')
        .slice(0, 6),
    );
  }, [monsterQuery]);

  const uniqueName = (base: string) => {
    if (!existing.some((c) => c.name === base)) return base;
    let i = 2;
    while (existing.some((c) => c.name === `${base} ${i}`)) i++;
    return `${base} ${i}`;
  };

  const addMonster = (hit: CompendiumSearchHit) => {
    const entry = getPluginRuntime().getCompendiumEntry(hit.packId, hit.entryId);
    if (!entry) return;
    const f = (entry.fields ?? {}) as { hp?: number; ac?: number; dexMod?: number };
    const maxHp = f.hp ?? 1;
    onAdd({
      id: newId(),
      name: uniqueName(entry.name),
      initiative: d20() + (f.dexMod ?? 0),
      hp: maxHp,
      maxHp,
      ac: f.ac ?? null,
      conditions: [],
      exhaustion: 0,
      concentration: false,
      isPlayer: false,
      deathSaves: { successes: 0, failures: 0 },
      monsterRef: { packId: hit.packId, entryId: hit.entryId },
    });
    setMonsterQuery('');
  };

  return (
    <div className="filter-panel add-combatant">
      <form
        className="filter-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          const maxHp = Math.max(1, Number(hp) || 1);
          onAdd({
            id: newId(),
            name: uniqueName(name.trim()),
            initiative: Number(init) || 0,
            hp: maxHp,
            maxHp,
            ac: Number(ac) || null,
            conditions: [],
            exhaustion: 0,
            concentration: false,
            isPlayer: true,
            deathSaves: { successes: 0, failures: 0 },
          });
          setName('');
          setInit('');
          setHp('');
          setAc('');
        }}
      >
        <span className="filter-label">player</span>
        <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <input
          placeholder="Init"
          className="w-narrow"
          value={init}
          onChange={(e) => setInit(e.target.value)}
        />
        <input
          placeholder="Max HP"
          className="w-narrow"
          value={hp}
          onChange={(e) => setHp(e.target.value)}
        />
        <input
          placeholder="AC"
          className="w-narrow"
          value={ac}
          onChange={(e) => setAc(e.target.value)}
        />
        <button type="submit">Add player</button>
      </form>
      <div className="filter-row monster-search">
        <span className="filter-label">monster</span>
        <input
          placeholder="Search SRD monsters… (rolls initiative)"
          value={monsterQuery}
          onChange={(e) => setMonsterQuery(e.target.value)}
        />
        <div className="chip-row">
          {monsterHits.map((h) => (
            <button key={h.entryId} className="chip" onClick={() => addMonster(h)}>
              + {h.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
