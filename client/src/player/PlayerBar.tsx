import { usePlayer } from './PlayerProvider';

function fmt(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function PlayerBar() {
  const player = usePlayer();
  const { current, playing, position, duration, volume, queue, queueIndex } = player;

  return (
    <div className="player-bar">
      <button onClick={player.toggle} disabled={!current} title={playing ? 'Pause' : 'Play'}>
        {playing ? '⏸' : '▶'}
      </button>
      <button onClick={player.next} disabled={queue.length < 2} title="Next (crossfade)">
        ⏭
      </button>
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
  );
}
