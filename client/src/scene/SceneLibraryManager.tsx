import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ALL_CUES, type Scene } from '@ttrpgapp/shared';
import { getActiveSceneState, loadSceneLibrary, saveSceneLibrary, setActiveSceneState } from './store';
import SceneEditor from './SceneEditor';
import { usePlayer } from '../player/PlayerProvider';
import { useSfx } from '../player/SfxProvider';
import { runDeckAction } from '../deck/actions';
import { backend } from '../backend';
import { showToast } from '../toast';

export interface SceneLibraryManagerProps {
  onClose?: () => void;
}

export default function SceneLibraryManager({ onClose }: SceneLibraryManagerProps) {
  const qc = useQueryClient();
  const player = usePlayer();
  const sfx = useSfx();
  const navigate = useNavigate();

  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  const [editingScene, setEditingScene] = useState<Scene | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const { data: library } = useQuery({
    queryKey: ['scenes'],
    queryFn: () => loadSceneLibrary(),
  });
  const scenes = library?.scenes ?? [];

  const { data: tracks = [] } = useQuery({
    queryKey: ['tracks'],
    queryFn: () => backend().listTracks(),
  });

  const { data: clips = [] } = useQuery({
    queryKey: ['sfx-clips'],
    queryFn: () => backend().listSfx(),
  });

  useEffect(() => {
    void getActiveSceneState().then((s) => setActiveSceneId(s.sceneId));
    const onSceneChange = (e: Event) => {
      const detail = (e as CustomEvent<{ sceneId: string | null }>).detail;
      if (detail) setActiveSceneId(detail.sceneId);
    };
    window.addEventListener('ttrpg-scene-changed', onSceneChange);
    return () => window.removeEventListener('ttrpg-scene-changed', onSceneChange);
  }, []);

  const handleTriggerScene = (scene: Scene) => {
    runDeckAction(
      { kind: 'scene', sceneId: scene.id, name: scene.name },
      {
        player,
        sfx,
        tracks,
        clips,
        navigate: (to) => {
          navigate(to);
          if (onClose) onClose();
        },
      },
    );
  };

  const handleExitScene = async (scene: Scene) => {
    try {
      // Exit loops
      if (scene.ambience && scene.ambience.length > 0) {
        for (const loop of scene.ambience) {
          sfx.stopLoop(loop.sig);
        }
      }
      await setActiveSceneState(null);
      showToast(`Exited ${scene.name}`, '🎭');
    } catch {
      showToast('Failed to exit scene', '⚠️');
    }
  };

  const handleSaveScene = async (saved: Scene) => {
    const existingIdx = scenes.findIndex((s) => s.id === saved.id);
    const nextScenes =
      existingIdx >= 0
        ? scenes.map((s, i) => (i === existingIdx ? saved : s))
        : [...scenes, saved];

    await saveSceneLibrary({ version: 1, scenes: nextScenes });
    await qc.invalidateQueries({ queryKey: ['scenes'] });
    setIsEditorOpen(false);
    showToast(`Saved scene "${saved.name}"`, saved.icon || '🎭');
  };

  const handleDeleteScene = async (scene: Scene) => {
    if (!window.confirm(`Delete scene "${scene.name}"?`)) return;
    const nextScenes = scenes.filter((s) => s.id !== scene.id);
    await saveSceneLibrary({ version: 1, scenes: nextScenes });
    await qc.invalidateQueries({ queryKey: ['scenes'] });
    showToast(`Deleted "${scene.name}"`, '🗑️');
  };

  return (
    <div className="scene-library-manager" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0 }}>Scenes Library</h2>
          <p className="small muted" style={{ margin: '4px 0 0' }}>
            Preset atmospheres combining lighting, music filters, soundscape loops, and prep notes.
          </p>
        </div>
        <button
          type="button"
          className="primary"
          onClick={() => {
            setEditingScene(null);
            setIsEditorOpen(true);
          }}
        >
          + New Scene
        </button>
      </div>

      {scenes.length === 0 ? (
        <div
          style={{
            padding: '32px',
            textAlign: 'center',
            background: 'var(--bg-surface)',
            border: '1px dashed var(--border)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>🎭</div>
          <div style={{ fontWeight: 600 }}>No scenes created yet</div>
          <p className="small muted" style={{ maxWidth: '400px', margin: '8px auto 16px' }}>
            Create your first scene to switch audio ambience, Home Assistant lighting, and notes in one tap.
          </p>
          <button
            type="button"
            className="primary"
            onClick={() => {
              setEditingScene(null);
              setIsEditorOpen(true);
            }}
          >
            Create Scene
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
          {scenes.map((s) => {
            const isActive = activeSceneId === s.id;
            const haCue = s.haScene ? ALL_CUES.find((c) => c.entity_id === s.haScene || c.id === s.haScene) : null;
            const loopCount = s.ambience?.length ?? 0;

            return (
              <div
                key={s.id}
                style={{
                  background: isActive ? 'var(--accent-soft)' : 'var(--bg-surface)',
                  border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-md)',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  boxShadow: isActive ? '0 0 12px var(--accent-glow)' : undefined,
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      fontSize: '24px',
                      width: '36px',
                      height: '36px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'var(--bg-panel)',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    {s.icon || '🎭'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                      {isActive && <span className="chip" style={{ fontSize: '10px', padding: '1px 6px', background: 'var(--accent)', color: '#fff' }}>ACTIVE</span>}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', fontSize: '11px' }}>
                  {s.music && (
                    <span className="chip" style={{ background: 'var(--bg-hover)' }}>
                      🎵 Music Filter
                    </span>
                  )}
                  {loopCount > 0 && (
                    <span className="chip" style={{ background: 'var(--bg-hover)' }}>
                      🌊 {loopCount} {loopCount === 1 ? 'Loop' : 'Loops'}
                    </span>
                  )}
                  {haCue && (
                    <span
                      className="chip"
                      style={{
                        background: haCue.preview && haCue.preview.length >= 2
                          ? `linear-gradient(135deg, ${haCue.preview[0]}, ${haCue.preview[1]})`
                          : 'var(--bg-hover)',
                        color: '#fff',
                        textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                      }}
                    >
                      💡 {haCue.label}
                    </span>
                  )}
                  {s.noteSection?.path && (
                    <span className="chip" style={{ background: 'var(--bg-hover)' }}>
                      📜 {s.noteSection.path}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '6px', marginTop: 'auto', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
                  {isActive ? (
                    <button
                      type="button"
                      className="secondary"
                      style={{ flex: 1 }}
                      onClick={() => handleExitScene(s)}
                    >
                      ⏹ Stop Scene
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="primary"
                      style={{ flex: 1 }}
                      onClick={() => handleTriggerScene(s)}
                    >
                      ▶ Trigger Scene
                    </button>
                  )}
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => {
                      setEditingScene(s);
                      setIsEditorOpen(true);
                    }}
                    title="Edit Scene"
                  >
                    ✏️
                  </button>
                  <button
                    type="button"
                    className="icon-btn danger"
                    onClick={() => handleDeleteScene(s)}
                    title="Delete Scene"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isEditorOpen && (
        <SceneEditor
          scene={editingScene}
          isOpen={isEditorOpen}
          onClose={() => setIsEditorOpen(false)}
          onSave={handleSaveScene}
        />
      )}
    </div>
  );
}
