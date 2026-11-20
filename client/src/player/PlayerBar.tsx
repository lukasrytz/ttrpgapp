import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePlayer } from './PlayerProvider';
import { useSfx } from './SfxProvider';
import { getActiveSceneState, loadSceneLibrary, setActiveSceneState } from '../scene/store';
import { showToast } from '../toast';

function fmt(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function PlayerBar() {
  const player = usePlayer();
  const sfx = useSfx();
  const { current, playing, position, duration, volume, queue, queueIndex, canGoBack } = player;

  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);

  useEffect(() => {
    void getActiveSceneState().then((s) => setActiveSceneId(s.sceneId));
    const onSceneChanged = (e: Event) => {
      const detail = (e as CustomEvent<{ sceneId: string | null }>).detail;
      setActiveSceneId(detail?.sceneId ?? null);
    };
    window.addEventListener('ttrpg-scene-changed', onSceneChanged);
    return () => window.removeEventListener('ttrpg-scene-changed', onSceneChanged);
  }, []);

  const scenesQuery = useQuery({
    queryKey: ['scenes'],
    queryFn: () => loadSceneLibrary(),
  });
  const activeScene = activeSceneId
    ? scenesQuery.data?.scenes.find((s) => s.id === activeSceneId) ?? null
    : null;

  const handleExitActiveScene = async () => {
    if (!activeScene) return;
    for (const loop of activeScene.ambience) {
      sfx.stopLoop(loop.sig);
    }
    await setActiveSceneState(null);
    showToast(`Exited ${activeScene.name}`, '🎭');
  };

  const hasStatusStrip = Boolean(activeScene) || sfx.activeLoopItems.length > 0;

  return (
    <div className="player-bar">
      {hasStatusStrip && (
        <div className="player-status-strip">
          {activeScene && (
            <button
              type="button"
              className="status-pill status-pill-scene"
              onClick={() => void handleExitActiveScene()}
              title={`Exit scene ${activeScene.name}`}
            >
              <span>{activeScene.icon || '🎭'}</span>
              <span>{activeScene.name}</span>
              <span className="status-pill-close">✕</span>
            </button>
          )}
          {sfx.activeLoopItems.map((loop) => (
            <button
              key={loop.sig}
              type="button"
              className="status-pill status-pill-loop"
              onClick={() => sfx.stopLoop(loop.sig)}
              title={`Stop loop ${loop.name}`}
            >
              <span>🌊</span>
              <span>{loop.name}</span>
              <span className="status-pill-close">✕</span>
            </button>
          ))}
          {sfx.activeLoopItems.length > 1 && (
            <button
              type="button"
              className="status-pill status-pill-mute"
              onClick={() => sfx.stopAllSfx()}
              title="Stop all sound effects & ambience"
            >
              🔇 Stop all SFX
            </button>
          )}
        </div>
      )}

      <div className="player-transport">
        <div className="player-controls">
          <button
            type="button"
            onClick={player.previous}
            disabled={!canGoBack}
            title="Previous track (crossfade)"
            aria-label="Previous track"
          >
            ⏮
          </button>
          <button
            type="button"
            onClick={player.toggle}
            disabled={!current}
            title={playing ? 'Pause' : 'Play'}
          >
            {playing ? '⏸' : '▶'}
          </button>
          <button
            type="button"
            onClick={player.next}
            disabled={queue.length < 2}
            title="Next (crossfade)"
          >
            ⏭
          </button>
        </div>
        <div className="player-info">
          {current ? (
            <>
              <span className="player-title">{current.title}</span>
              {current.artist && <span className="muted"> — {current.artist}</span>}
              <span className="muted player-time">
                {fmt(position)} / {fmt(duration)}
                {queue.length > 1 && ` · ${queueIndex + 1}/${queue.length} in queue`}
              </span>
            </>
          ) : (
            <span className="muted">Nothing playing</span>
          )}
        </div>
        <input
          className="player-volume"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          title="Volume"
          onChange={(e) => player.setVolume(Number(e.target.value))}
        />
      </div>
    </div>
  );
}
