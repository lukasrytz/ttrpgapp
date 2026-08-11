import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { CompendiumSearchHit, LeafDeckAction, TagDimension } from '@ttrpgapp/shared';
import { DEFAULT_TAG_VOCAB, TAG_DIMENSIONS, trackSignature } from '@ttrpgapp/shared';
import { backend } from '../backend';
import { useSfx } from '../player/SfxProvider';
import { EMPTY_FILTER, fromSerializable, toSerializable } from '../music/filter';
import FilterChips from '../music/FilterChips';
import { availableClientPlugins } from '../plugins';
import { compendiumIndex } from '../compendium';

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
      options.push({ path: item.path, label: item.label });
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
  }
}

export default function ActionForm({
  value,
  onChange,
  isMacroRow = false,
  onRemove,
  disabledKinds,
}: ActionFormProps) {
  const sfx = useSfx();
  const [compendiumQuery, setCompendiumQuery] = useState('');

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
      </div>
    </div>
  );
}
