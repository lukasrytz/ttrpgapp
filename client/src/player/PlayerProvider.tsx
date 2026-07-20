import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Track } from '@ttrpgapp/shared';
import { CrossfadeEngine } from './crossfade';

interface PlayerState {
  current: Track | null;
  queue: Track[];
  queueIndex: number;
  playing: boolean;
  volume: number;
  position: number;
  duration: number;
}

interface PlayerApi extends PlayerState {
  /** Replace the queue and start playing at index (crossfades from whatever is on). */
  playQueue: (tracks: Track[], index?: number) => void;
  playTrack: (track: Track) => void;
  next: () => void;
  toggle: () => void;
  setVolume: (v: number) => void;
}

const PlayerContext = createContext<PlayerApi | null>(null);

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export function shuffleTracks(tracks: Track[]): Track[] {
  return shuffle(tracks);
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const engineRef = useRef<CrossfadeEngine | null>(null);
  const [state, setState] = useState<PlayerState>({
    current: null,
    queue: [],
    queueIndex: -1,
    playing: false,
    volume: 1,
    position: 0,
    duration: 0,
  });
  const stateRef = useRef(state);
  stateRef.current = state;

  const engine = () => {
    if (!engineRef.current) {
      const e = new CrossfadeEngine();
      e.onTimeUpdate = (position, duration) =>
        setState((s) => ({ ...s, position, duration }));
      e.onNearEnd = () => advance();
      e.onEnded = () => {
        // fallback for tracks too short for the near-end crossfade window
        const s = stateRef.current;
        if (s.queue.length > 0 && s.queueIndex < s.queue.length - 1) advance();
        else setState((prev) => ({ ...prev, playing: false }));
      };
      engineRef.current = e;
    }
    return engineRef.current;
  };

  const startTrack = useCallback((track: Track) => {
    void engine().play(`/api/music/stream/${track.id}`);
    setState((s) => ({ ...s, current: track, playing: true, position: 0, duration: 0 }));
  }, []);

  const advance = useCallback(() => {
    const s = stateRef.current;
    if (s.queue.length === 0) return;
    const nextIndex = (s.queueIndex + 1) % s.queue.length;
    const track = s.queue[nextIndex]!;
    void engine().play(`/api/music/stream/${track.id}`);
    setState((prev) => ({
      ...prev,
      current: track,
      queueIndex: nextIndex,
      playing: true,
      position: 0,
      duration: 0,
    }));
  }, []);

  const api = useMemo<PlayerApi>(
    () => ({
      ...state,
      playQueue: (tracks, index = 0) => {
        if (tracks.length === 0) return;
        setState((s) => ({ ...s, queue: tracks, queueIndex: index }));
        startTrack(tracks[index]!);
        setState((s) => ({ ...s, queue: tracks, queueIndex: index }));
      },
      playTrack: (track) => {
        setState((s) => ({ ...s, queue: [track], queueIndex: 0 }));
        startTrack(track);
      },
      next: advance,
      toggle: () => {
        const s = stateRef.current;
        if (!s.current) return;
        if (s.playing) {
          engine().pause();
          setState((prev) => ({ ...prev, playing: false }));
        } else {
          void engine().resume();
          setState((prev) => ({ ...prev, playing: true }));
        }
      },
      setVolume: (v) => {
        engine().setVolume(v);
        setState((prev) => ({ ...prev, volume: v }));
      },
    }),
    [state, advance, startTrack],
  );

  return <PlayerContext.Provider value={api}>{children}</PlayerContext.Provider>;
}

export function usePlayer(): PlayerApi {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer outside PlayerProvider');
  return ctx;
}
