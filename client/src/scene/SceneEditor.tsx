import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ALL_CUES,
  DEFAULT_TAG_VOCAB,
  TAG_DIMENSIONS,
  trackSignature,
  type DeckColor,
  type Scene,
  type SceneAmbience,
  type TagDimension,
} from '@ttrpgapp/shared';
import { backend } from '../backend';
import { EMPTY_FILTER, fromSerializable, toSerializable } from '../music/filter';
import FilterChips from '../music/FilterChips';
import BottomSheet from '../components/BottomSheet';

const COLORS: DeckColor[] = ['slate', 'amber', 'crimson', 'forest', 'indigo', 'plum'];

export interface SceneEditorProps {
  scene: Scene | null;
  isOpen: boolean;
  onSave: (scene: Scene) => void;
  onClose: () => void;
  onDelete?: (sceneId: string) => void;
}

export default function SceneEditor({
  scene,
  isOpen,
  onSave,
  onClose,
  onDelete,
}: SceneEditorProps) {
  const [name, setName] = useState(scene?.name ?? 'New Scene');
  const [icon, setIcon] = useState(scene?.icon ?? '🎭');
  const [color, setColor] = useState<DeckColor>(scene?.color ?? 'slate');
  const [music, setMusic] = useState(scene?.music ?? toSerializable(EMPTY_FILTER));
  const [ambience, setAmbience] = useState<SceneAmbience[]>(scene?.ambience ?? []);
  const [notePath, setNotePath] = useState(scene?.noteSection?.path ?? '');
  const [noteHeading, setNoteHeading] = useState(scene?.noteSection?.heading ?? '');
  const [haScene, setHaScene] = useState(scene?.haScene ?? '');

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

  const vocab = useMemo(() => {
    const v: Record<TagDimension, string[]> = { theme: [], mood: [], landscape: [] };
    for (const dim of TAG_DIMENSIONS) {
      const values = new Set(DEFAULT_TAG_VOCAB[dim]);
      for (const t of tracks) for (const tag of t.tags[dim]) values.add(tag);
      v[dim] = [...values].sort();
    }
    return v;
  }, [tracks]);

  if (!isOpen) return null;

  const handleAddLoop = (sig: string) => {
    if (!sig) return;
    const clip = clips.find((c) => trackSignature(c.path, c.durationSec) === sig);
    if (!clip) return;
    if (ambience.some((a) => a.sig === sig)) return;
    setAmbience([...ambience, { sig, name: clip.name, volume: 1 }]);
  };

  const handleSave = () => {
    const id = scene?.id || `scene-${Date.now()}`;
    const savedScene: Scene = {
      id,
      name: name.trim() || 'Untitled Scene',
      icon: icon.trim() || '🎭',
      color,
      music,
      ambience,
      noteSection: notePath ? { path: notePath, heading: noteHeading.trim() } : undefined,
      haScene: haScene.trim() || undefined,
    };
    onSave(savedScene);
    onClose();
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={scene ? 'Edit Scene' : 'New Scene'}>
      <div className="scene-editor" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <label style={{ width: '60px' }}>
            <span className="small muted">Icon</span>
            <input value={icon} onChange={(e) => setIcon(e.target.value)} />
          </label>
          <label style={{ flex: 1 }}>
            <span className="small muted">Scene Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Tavern" />
          </label>
        </div>

        <div>
          <span className="small muted">Color</span>
          <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`deck-btn-color-dot ${color === c ? 'active' : ''}`}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  border: color === c ? '2px solid white' : '1px solid var(--border)',
                  background: `var(--deck-${c})`,
                  cursor: 'pointer',
                }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </div>

        <div className="settings-section" style={{ padding: '10px', background: 'var(--bg-hover)', borderRadius: '8px' }}>
          <h3 style={{ fontSize: '13px', margin: '0 0 6px 0' }}>🎵 Music Filter</h3>
          <FilterChips
            filter={fromSerializable(music)}
            vocab={vocab}
            onToggleTag={(dim, val) => {
              const currentFilter = fromSerializable(music);
              const nextSet = new Set(currentFilter.dims[dim]);
              if (nextSet.has(val)) nextSet.delete(val);
              else nextSet.add(val);
              const updated = {
                ...currentFilter,
                dims: { ...currentFilter.dims, [dim]: nextSet },
              };
              setMusic(toSerializable(updated));
            }}
            onReset={() => setMusic(toSerializable(EMPTY_FILTER))}
          />
        </div>

        <div className="settings-section" style={{ padding: '10px', background: 'var(--bg-hover)', borderRadius: '8px' }}>
          <h3 style={{ fontSize: '13px', margin: '0 0 6px 0' }}>🌊 Ambience Loops</h3>
          {ambience.map((a, idx) => (
            <div key={a.sig} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ flex: 1, fontSize: '13px' }}>{a.name}</span>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={a.volume}
                style={{ width: '80px' }}
                onChange={(e) => {
                  const vol = Number(e.target.value);
                  setAmbience(ambience.map((item, i) => (i === idx ? { ...item, volume: vol } : item)));
                }}
              />
              <span className="small muted" style={{ width: '32px' }}>
                {Math.round(a.volume * 100)}%
              </span>
              <button
                type="button"
                className="icon-btn danger"
                onClick={() => setAmbience(ambience.filter((_, i) => i !== idx))}
              >
                ✕
              </button>
            </div>
          ))}
          <select
            value=""
            onChange={(e) => handleAddLoop(e.target.value)}
            style={{ width: '100%', marginTop: '6px' }}
          >
            <option value="">+ Add Ambience Loop…</option>
            {clips.map((c) => {
              const sig = trackSignature(c.path, c.durationSec);
              return (
                <option key={sig} value={sig}>
                  {c.name}
                </option>
              );
            })}
          </select>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <label style={{ flex: 1 }}>
            <span className="small muted">Open Note (optional)</span>
            <select value={notePath} onChange={(e) => setNotePath(e.target.value)}>
              <option value="">-- None --</option>
              {notes.map((n) => (
                <option key={n.path} value={n.path}>
                  {n.title}
                </option>
              ))}
            </select>
          </label>
          <label style={{ flex: 1 }}>
            <span className="small muted">Heading / Section</span>
            <input
              value={noteHeading}
              onChange={(e) => setNoteHeading(e.target.value)}
              placeholder="e.g. The Tavern"
              disabled={!notePath}
            />
          </label>
        </div>

        <div className="settings-section" style={{ padding: '10px', background: 'var(--bg-hover)', borderRadius: '8px' }}>
          <h3 style={{ fontSize: '13px', margin: '0 0 6px 0' }}>💡 Home Assistant Lighting Cue</h3>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <select
              style={{ flex: 1 }}
              value={haScene}
              onChange={(e) => setHaScene(e.target.value)}
            >
              <option value="">-- No Lighting Cue --</option>
              {ALL_CUES.map((c) => (
                <option key={c.entity_id} value={c.entity_id}>
                  [{c.system.toUpperCase()}] {c.label} ({c.category})
                </option>
              ))}
            </select>
            <input
              style={{ width: '160px' }}
              value={haScene}
              onChange={(e) => setHaScene(e.target.value)}
              placeholder="or custom entity_id"
            />
          </div>
          {(() => {
            const selectedCue = ALL_CUES.find((c) => c.entity_id === haScene);
            if (!selectedCue) return null;
            return (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 10px',
                  background: 'var(--bg-panel)',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                }}
              >
                <div
                  style={{
                    width: '36px',
                    height: '20px',
                    borderRadius: '4px',
                    border: '1px solid var(--border)',
                    background:
                      selectedCue.preview.length >= 4
                        ? `linear-gradient(90deg, ${selectedCue.preview[1]} 0%, ${selectedCue.preview[2]} 33%, ${selectedCue.preview[3]} 66%, ${selectedCue.preview[4]} 100%)`
                        : selectedCue.preview[0] || 'var(--accent)',
                  }}
                />
                <div style={{ flex: 1, fontSize: '12px' }}>
                  <div>
                    <strong>{selectedCue.label}</strong> ({selectedCue.category})
                  </div>
                  <div className="small muted">{selectedCue.description}</div>
                </div>
              </div>
            );
          })()}
        </div>

        <div className="header-actions" style={{ marginTop: '12px', justifyContent: 'space-between' }}>
          {scene && onDelete ? (
            <button
              type="button"
              className="danger"
              onClick={() => {
                if (window.confirm(`Delete scene "${scene.name}"?`)) {
                  onDelete(scene.id);
                  onClose();
                }
              }}
            >
              Delete Scene
            </button>
          ) : (
            <div />
          )}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="primary" onClick={handleSave}>
              Save Scene
            </button>
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}
