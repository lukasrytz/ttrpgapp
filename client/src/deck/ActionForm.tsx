import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { CompendiumSearchHit, LeafDeckAction, Scene, TagDimension } from '@ttrpgapp/shared';
import { DEFAULT_TAG_VOCAB, TAG_DIMENSIONS, trackSignature } from '@ttrpgapp/shared';
import { backend } from '../backend';
import { useSfx } from '../player/SfxProvider';
import { EMPTY_FILTER, fromSerializable, toSerializable } from '../music/filter';
import FilterChips from '../music/FilterChips';
import { availableClientPlugins } from '../plugins';
import { compendiumIndex } from '../compendium';
import { loadSceneLibrary, saveSceneLibrary } from '../scene/store';
import SceneEditor from '../scene/SceneEditor';

export interface ActionFormProps {
  value: LeafDeckAction;
  onChange: (action: LeafDeckAction) => void;
  isMacroRow?: boolean;
  onRemove?: () => void;
  disabledKinds?: Set<LeafDeckAction['kind']>;
}

export function getNavOptions() {
  const options = [
    { path: '/', label: 'Deck' },
    { path: '/music', label: 'Music' },
    { path: '/notes', label: 'Prep Notes' },
    { path: '/generators', label: 'DM Tools' },
  ];
  for (const plugin of availableClientPlugins) {
    for (const item of plugin.nav) {
      options.push({
        path: `/p/${plugin.id}${item.path}`,
        label: `${plugin.name}: ${item.label}`,
      });
    }
  }
  return options;
}

export function defaultLeafAction(kind: LeafDeckAction['kind'], isMacroRow = false): LeafDeckAction {
  switch (kind) {
    case 'musicFilter':
      return { kind: 'musicFilter', filter: toSerializable(EMPTY_FILTER) };
    case 'musicTrack':
      return { kind: 'musicTrack', sig: '', title: '' };
    case 'sfxOneShot':
      return { kind: 'sfxOneShot', sig: '', name: '', volume: 1 };
    case 'sfxLoop':
      return { kind: 'sfxLoop', sig: '', name: '', volume: 1, mode: isMacroRow ? 'start' : 'toggle' };
    case 'navigate':
      return { kind: 'navigate', to: '/' };
    case 'openNote':
      return { kind: 'openNote', path: '' };
    case 'openEntry':
      return { kind: 'openEntry', packId: 'spells', entryId: '' };
    case 'counter':
      return { kind: 'counter', counterId: 'counter-1', name: 'Counter', delta: 1 };
    case 'roll':
      return { kind: 'roll', formula: '1d20+5', label: 'd20 Roll' };
    case 'openEncounter':
      return { kind: 'openEncounter', encounterId: '', autoStart: false };
    case 'pluginAction': {
      const firstPlugin = availableClientPlugins.find((p) => p.actions && p.actions.length > 0);
      const firstAction = firstPlugin?.actions?.[0];
      return {
        kind: 'pluginAction',
        pluginId: firstPlugin?.id ?? 'dnd5e',
        actionId: firstAction?.id ?? 'nextTurn',
        label: firstAction?.label ?? 'Next Turn',
      };
    }
    case 'scene':
      return { kind: 'scene', sceneId: '', name: 'Scene' };
    case 'quickNote':
      return { kind: 'quickNote', prompt: 'Quick note:', heading: 'In-session Notes' };
    case 'oracle':
      return { kind: 'oracle', odds: 'even' };
    case 'escalate':
      return { kind: 'escalate' };
    case 'quickNpc':
      return { kind: 'quickNpc' };
    case 'rollTable':
      return { kind: 'rollTable', notePath: '' };
  }
}

export default function ActionForm({
  value,
  onChange,
  isMacroRow = false,
  onRemove,
  disabledKinds,
}: ActionFormProps) {
  const qc = useQueryClient();
  const sfx = useSfx();
  const [compendiumQuery, setCompendiumQuery] = useState('');
  const [editingScene, setEditingScene] = useState<Scene | null>(null);
  const [isSceneEditorOpen, setIsSceneEditorOpen] = useState(false);

  const scenesQuery = useQuery({
    queryKey: ['scenes'],
    queryFn: () => loadSceneLibrary(),
  });
  const sceneLib = scenesQuery.data ?? { version: 1, scenes: [] };
  const scenes = sceneLib.scenes;

  const tracksQuery = useQuery({
    queryKey: ['tracks'],
    queryFn: () => backend().listTracks(),
  });
  const tracks = tracksQuery.data ?? [];

  const sfxQuery = useQuery({
    queryKey: ['sfxClips'],
    queryFn: () => backend().listSfx(),
  });
  const clips = sfxQuery.data ?? [];

  const notesQuery = useQuery({
    queryKey: ['notes'],
    queryFn: () => backend().listNotes(),
  });
  const notes = notesQuery.data ?? [];

  const encountersQuery = useQuery({
    queryKey: ['encounters'],
    queryFn: async () => {
      const raw = await backend().kvGet('dnd5e', 'encounters');
      return raw ? (JSON.parse(raw) as Array<{ id: string; name: string }>) : [];
    },
  });
  const encounters = encountersQuery.data ?? [];

  const navOptions = useMemo(() => getNavOptions(), []);

  const vocab = useMemo(() => {
    const v: Record<TagDimension, string[]> = { theme: [], mood: [], landscape: [] };
    for (const dim of TAG_DIMENSIONS) {
      const values = new Set(DEFAULT_TAG_VOCAB[dim]);
      for (const t of tracks) for (const tag of t.tags[dim]) values.add(tag);
      v[dim] = [...values].sort();
    }
    return v;
  }, [tracks]);

  const compendiumResults = useMemo(() => {
    if (!compendiumQuery.trim()) return [];
    return compendiumIndex.search(compendiumQuery).slice(0, 10);
  }, [compendiumQuery]);

  const handleKindChange = (kind: LeafDeckAction['kind']) => {
    if (kind === value.kind) return;
    onChange(defaultLeafAction(kind, isMacroRow));
  };

  return (
    <div className="action-form">
      <div className="action-form-header">
        <select
          value={value.kind}
          onChange={(e) => handleKindChange(e.target.value as LeafDeckAction['kind'])}
          className="action-kind-select"
        >
          <option value="musicFilter" disabled={disabledKinds?.has('musicFilter')}>
            Music Filter
          </option>
          <option value="musicTrack" disabled={disabledKinds?.has('musicTrack')}>
            Music Track
          </option>
          <option value="sfxOneShot" disabled={disabledKinds?.has('sfxOneShot')}>
            SFX One-shot
          </option>
          <option value="sfxLoop" disabled={disabledKinds?.has('sfxLoop')}>
            SFX Ambience Loop
          </option>
          <option value="navigate" disabled={disabledKinds?.has('navigate')}>
            Navigate Page
          </option>
          <option value="openNote" disabled={disabledKinds?.has('openNote')}>
            Open Prep Note
          </option>
          <option value="openEntry" disabled={disabledKinds?.has('openEntry')}>
            Open Compendium Entry
          </option>
          <option value="openEncounter" disabled={disabledKinds?.has('openEncounter')}>
            Open Saved Encounter
          </option>
          <option value="counter" disabled={disabledKinds?.has('counter')}>
            Counter / Clock
          </option>
          <option value="roll" disabled={disabledKinds?.has('roll')}>
            Roll Dice
          </option>
          <option value="pluginAction" disabled={disabledKinds?.has('pluginAction')}>
            Plugin Action
          </option>
          <option value="scene" disabled={disabledKinds?.has('scene')}>
            Scene
          </option>
          <option value="quickNote" disabled={disabledKinds?.has('quickNote')}>
            Quick Capture Note
          </option>
          <option value="oracle" disabled={disabledKinds?.has('oracle')}>
            Oracle (Yes/No + Prompt)
          </option>
          <option value="escalate" disabled={disabledKinds?.has('escalate')}>
            Escalate (Combat & Complication)
          </option>
          <option value="quickNpc" disabled={disabledKinds?.has('quickNpc')}>
            Quick NPC on Demand
          </option>
          <option value="rollTable" disabled={disabledKinds?.has('rollTable')}>
            Roll on Note Table
          </option>
        </select>
        {onRemove && (
          <button type="button" className="icon-btn danger" onClick={onRemove} title="Remove action">
            ✕
          </button>
        )}
      </div>

      <div className="action-form-body">
        {value.kind === 'musicFilter' && (
          <div className="filter-panel" style={{ marginTop: '8px' }}>
            <FilterChips
              filter={fromSerializable(value.filter)}
              vocab={vocab}
              onToggleTag={(dim, val) => {
                const currentFilter = fromSerializable(value.filter);
                const nextSet = new Set(currentFilter.dims[dim]);
                if (nextSet.has(val)) nextSet.delete(val);
                else nextSet.add(val);
                const updated = {
                  ...currentFilter,
                  dims: { ...currentFilter.dims, [dim]: nextSet },
                };
                onChange({ ...value, filter: toSerializable(updated) });
              }}
              onReset={() => onChange({ ...value, filter: toSerializable(EMPTY_FILTER) })}
            />
          </div>
        )}

        {value.kind === 'musicTrack' && (
          <div className="form-group" style={{ marginTop: '8px' }}>
            <label className="small muted">Select Track</label>
            <select
              value={value.sig}
              onChange={(e) => {
                const sig = e.target.value;
                const found = tracks.find((t) => trackSignature(t.path, t.durationSec) === sig);
                onChange({
                  ...value,
                  sig,
                  title: found ? found.title : value.title || 'Unknown Track',
                });
              }}
            >
              <option value="">-- Choose a track --</option>
              {tracks.map((t) => {
                const sig = trackSignature(t.path, t.durationSec);
                return (
                  <option key={t.id} value={sig}>
                    {t.title} {t.artist ? `— ${t.artist}` : ''}
                  </option>
                );
              })}
            </select>
          </div>
        )}

        {value.kind === 'sfxOneShot' && (
          <div className="form-group" style={{ marginTop: '8px' }}>
            <label className="small muted">Select Sound Clip</label>
            <select
              value={value.sig}
              onChange={(e) => {
                const sig = e.target.value;
                const found = clips.find((c) => trackSignature(c.path, c.durationSec) === sig);
                onChange({
                  ...value,
                  sig,
                  name: found ? found.name : value.name || 'Unknown Clip',
                });
              }}
            >
              <option value="">-- Choose a sound clip --</option>
              {clips.map((c) => {
                const sig = trackSignature(c.path, c.durationSec);
                return (
                  <option key={c.id} value={sig}>
                    {c.name} {c.folder ? `(${c.folder})` : ''}
                  </option>
                );
              })}
            </select>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
              <label className="small muted" style={{ minWidth: '60px' }}>
                Volume: {Math.round(value.volume * 100)}%
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={value.volume}
                onChange={(e) => onChange({ ...value, volume: Number(e.target.value) })}
              />
              {value.sig && (
                <button
                  type="button"
                  className="chip"
                  onClick={() => {
                    const found = clips.find((c) => trackSignature(c.path, c.durationSec) === value.sig);
                    if (found) sfx.fire(found, value.volume);
                  }}
                >
                  ▶ Preview
                </button>
              )}
            </div>
          </div>
        )}

        {value.kind === 'sfxLoop' && (
          <div className="form-group" style={{ marginTop: '8px' }}>
            <label className="small muted">Select Ambience Loop</label>
            <select
              value={value.sig}
              onChange={(e) => {
                const sig = e.target.value;
                const found = clips.find((c) => trackSignature(c.path, c.durationSec) === sig);
                onChange({
                  ...value,
                  sig,
                  name: found ? found.name : value.name || 'Unknown Clip',
                });
              }}
            >
              <option value="">-- Choose a sound clip --</option>
              {clips.map((c) => {
                const sig = trackSignature(c.path, c.durationSec);
                return (
                  <option key={c.id} value={sig}>
                    {c.name} {c.folder ? `(${c.folder})` : ''}
                  </option>
                );
              })}
            </select>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
              <label className="small muted" style={{ minWidth: '60px' }}>
                Volume: {Math.round(value.volume * 100)}%
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={value.volume}
                onChange={(e) => onChange({ ...value, volume: Number(e.target.value) })}
              />
              {isMacroRow && (
                <select
                  value={value.mode}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      mode: e.target.value as 'toggle' | 'start' | 'stop',
                    })
                  }
                  style={{ marginLeft: 'auto' }}
                >
                  <option value="start">Force Start</option>
                  <option value="stop">Force Stop</option>
                  <option value="toggle">Toggle</option>
                </select>
              )}
            </div>
          </div>
        )}

        {value.kind === 'navigate' && (
          <div className="form-group" style={{ marginTop: '8px' }}>
            <label className="small muted">Destination Page</label>
            <select value={value.to} onChange={(e) => onChange({ ...value, to: e.target.value })}>
              {navOptions.map((opt) => (
                <option key={opt.path} value={opt.path}>
                  {opt.label} ({opt.path})
                </option>
              ))}
            </select>
          </div>
        )}

        {value.kind === 'openNote' && (
          <div className="form-group" style={{ marginTop: '8px' }}>
            <label className="small muted">Target Note</label>
            <select
              value={value.path}
              onChange={(e) => onChange({ ...value, path: e.target.value })}
            >
              <option value="">-- Choose a note --</option>
              {notes.map((n) => (
                <option key={n.path} value={n.path}>
                  {n.title} ({n.path})
                </option>
              ))}
            </select>
          </div>
        )}

        {value.kind === 'openEntry' && (
          <div className="form-group" style={{ marginTop: '8px' }}>
            <label className="small muted">Search Compendium</label>
            <input
              type="text"
              placeholder="Search spells, monsters, items…"
              value={compendiumQuery}
              onChange={(e) => setCompendiumQuery(e.target.value)}
            />
            {compendiumResults.length > 0 && (
              <div className="compendium-search-dropdown">
                {compendiumResults.map((r: CompendiumSearchHit) => (
                  <button
                    key={`${r.packId}:${r.entryId}`}
                    type="button"
                    className="compendium-search-item"
                    onClick={() => {
                      onChange({
                        ...value,
                        packId: r.packId,
                        entryId: r.entryId,
                      });
                      setCompendiumQuery('');
                    }}
                  >
                    <span>{r.name}</span>
                    <span className="muted small"> ({r.packId})</span>
                  </button>
                ))}
              </div>
            )}
            {value.entryId && (
              <p className="small muted" style={{ marginTop: '4px' }}>
                Selected: <strong>{value.entryId}</strong> ({value.packId})
              </p>
            )}
          </div>
        )}

        {value.kind === 'counter' && (
          <div className="form-group" style={{ marginTop: '8px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ flex: 1 }}>
                <label className="small muted">Counter ID (grouping key)</label>
                <input
                  type="text"
                  value={value.counterId}
                  placeholder="e.g. tension-clock"
                  onChange={(e) => onChange({ ...value, counterId: e.target.value })}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label className="small muted">Label Name</label>
                <input
                  type="text"
                  value={value.name}
                  placeholder="e.g. Tension Clock"
                  onChange={(e) => onChange({ ...value, name: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <div style={{ flex: 1 }}>
                <label className="small muted">Delta (Change per tap)</label>
                <select
                  value={value.delta}
                  onChange={(e) => onChange({ ...value, delta: Number(e.target.value) })}
                >
                  <option value={1}>+1 (Increment)</option>
                  <option value={-1}>-1 (Decrement)</option>
                  <option value={2}>+2</option>
                  <option value={-2}>-2</option>
                  <option value={0}>0 (Reset to 0)</option>
                </select>
              </div>

              <div style={{ flex: 1 }}>
                <label className="small muted">Max Segments / Cap (Optional)</label>
                <input
                  type="number"
                  min="1"
                  max="99"
                  placeholder="e.g. 4 or 6 (blank for none)"
                  value={value.max ?? ''}
                  onChange={(e) => {
                    const v = e.target.value ? Number(e.target.value) : undefined;
                    onChange({ ...value, max: v });
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {value.kind === 'roll' && (
          <div className="form-group" style={{ marginTop: '8px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ flex: 1 }}>
                <label className="small muted">Dice Formula</label>
                <input
                  type="text"
                  value={value.formula}
                  placeholder="e.g. 1d20+5, 2d6, 4d6kh3"
                  onChange={(e) => onChange({ ...value, formula: e.target.value })}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label className="small muted">Roll Label (Optional)</label>
                <input
                  type="text"
                  value={value.label ?? ''}
                  placeholder="e.g. Fireball Damage"
                  onChange={(e) => onChange({ ...value, label: e.target.value || undefined })}
                />
              </div>
            </div>
          </div>
        )}

        {value.kind === 'openEncounter' && (
          <div className="form-group" style={{ marginTop: '8px' }}>
            <label className="small muted">Saved Encounter</label>
            {encounters.length > 0 ? (
              <select
                value={value.encounterId}
                onChange={(e) => onChange({ ...value, encounterId: e.target.value })}
              >
                <option value="">-- Select Saved Encounter --</option>
                {encounters.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name || e.id}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                placeholder="Encounter ID (e.g. enc-123)"
                value={value.encounterId}
                onChange={(e) => onChange({ ...value, encounterId: e.target.value })}
              />
            )}

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
              <input
                type="checkbox"
                checked={value.autoStart ?? false}
                onChange={(e) => onChange({ ...value, autoStart: e.target.checked })}
              />
              <span className="small">Auto-start (open roll initiative dialog immediately)</span>
            </label>
          </div>
        )}

        {value.kind === 'pluginAction' && (
          <div className="form-group" style={{ marginTop: '8px' }}>
            <label className="small muted">Plugin Action</label>
            <select
              value={`${value.pluginId}:${value.actionId}`}
              onChange={(e) => {
                const [pId, aId] = e.target.value.split(':');
                const plug = availableClientPlugins.find((p) => p.id === pId);
                const act = plug?.actions?.find((a) => a.id === aId);
                if (pId && aId) {
                  onChange({
                    ...value,
                    pluginId: pId,
                    actionId: aId,
                    label: act?.label ?? aId,
                  });
                }
              }}
            >
              {availableClientPlugins.flatMap((p) =>
                (p.actions ?? []).map((a) => (
                  <option key={`${p.id}:${a.id}`} value={`${p.id}:${a.id}`}>
                    {p.name}: {a.icon} {a.label}
                  </option>
                )),
              )}
            </select>
          </div>
        )}

        {value.kind === 'scene' && (
          <div className="form-group" style={{ marginTop: '8px' }}>
            <label className="small muted">Target Scene</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select
                style={{ flex: 1 }}
                value={value.sceneId}
                onChange={(e) => {
                  const sId = e.target.value;
                  const found = scenes.find((s) => s.id === sId);
                  onChange({
                    ...value,
                    sceneId: sId,
                    name: found ? found.name : value.name,
                  });
                }}
              >
                <option value="">-- Select a Scene --</option>
                {scenes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.icon} {s.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  const current = scenes.find((s) => s.id === value.sceneId) ?? null;
                  setEditingScene(current);
                  setIsSceneEditorOpen(true);
                }}
              >
                {scenes.some((s) => s.id === value.sceneId) ? 'Edit Scene' : '+ New Scene'}
              </button>
            </div>
          </div>
        )}

        {value.kind === 'quickNote' && (
          <div className="form-group" style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label>
              <span className="small muted">Prompt Label</span>
              <input
                value={value.prompt ?? ''}
                onChange={(e) => onChange({ ...value, prompt: e.target.value })}
                placeholder="e.g. Quick capture note:"
              />
            </label>
            <label>
              <span className="small muted">Target Heading</span>
              <input
                value={value.heading ?? ''}
                onChange={(e) => onChange({ ...value, heading: e.target.value })}
                placeholder="e.g. In-session Notes"
              />
            </label>
          </div>
        )}

        {value.kind === 'oracle' && (
          <div className="form-group" style={{ marginTop: '8px' }}>
            <label>
              <span className="small muted">Probability Odds</span>
              <select
                value={value.odds ?? 'even'}
                onChange={(e) => onChange({ ...value, odds: e.target.value as any })}
              >
                <option value="likely">Likely (skewed towards Yes)</option>
                <option value="even">Even (50/50 balance)</option>
                <option value="unlikely">Unlikely (skewed towards No)</option>
              </select>
            </label>
          </div>
        )}

        {value.kind === 'escalate' && (
          <div className="form-group" style={{ marginTop: '8px' }}>
            <div className="small muted">
              One-press lever: generates an oracle complication, spins up combat music, logs to session note, and opens the combat tracker.
            </div>
          </div>
        )}

        {value.kind === 'quickNpc' && (
          <div className="form-group" style={{ marginTop: '8px' }}>
            <div className="small muted">
              One-press lever: generates an NPC name, voice, quirk, and disposition on the fly, toasts the details, and logs them to the session note.
            </div>
          </div>
        )}

        {value.kind === 'rollTable' && (
          <div className="form-group" style={{ marginTop: '8px' }}>
            <label>
              <span className="small muted">Table Note</span>
              <select
                value={value.notePath}
                onChange={(e) => onChange({ ...value, notePath: e.target.value })}
              >
                <option value="">Select a note containing a table…</option>
                {notes.map((n) => (
                  <option key={n.path} value={n.path}>
                    {n.title} ({n.path})
                  </option>
                ))}
              </select>
            </label>
            <div className="small muted" style={{ marginTop: '4px' }}>
              Rolls a random row from the first markdown table in this note and toasts the result.
            </div>
          </div>
        )}
      </div>

      {isSceneEditorOpen && (
        <SceneEditor
          scene={editingScene}
          isOpen={isSceneEditorOpen}
          onClose={() => setIsSceneEditorOpen(false)}
          onSave={async (saved) => {
            const existingIdx = scenes.findIndex((s) => s.id === saved.id);
            const nextScenes =
              existingIdx >= 0
                ? scenes.map((s, i) => (i === existingIdx ? saved : s))
                : [...scenes, saved];
            await saveSceneLibrary({ version: 1, scenes: nextScenes });
            onChange({
              kind: 'scene',
              sceneId: saved.id,
              name: saved.name,
            });
            qc.invalidateQueries({ queryKey: ['scenes'] });
          }}
          onDelete={async (deletedId) => {
            const nextScenes = scenes.filter((s) => s.id !== deletedId);
            await saveSceneLibrary({ version: 1, scenes: nextScenes });
            if (value.kind === 'scene' && value.sceneId === deletedId) {
              onChange({ kind: 'scene', sceneId: '', name: 'Scene' });
            }
            qc.invalidateQueries({ queryKey: ['scenes'] });
          }}
        />
      )}
    </div>
  );
}
