import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { SfxClip } from '@ttrpgapp/shared';
import { trackSignature } from '@ttrpgapp/shared';
import { backend } from '../backend';
import { usePlayer } from './PlayerProvider';
import { SfxEngine } from './sfx';

export interface SfxApi {
  /** Clip signatures currently looping, for lighting up deck buttons. */
  activeLoops: string[];
  fire(clip: SfxClip, volume: number): void;
  /** Explicit start/stop as well as toggle — macros need to force a loop on or off
   *  rather than flip it (see `sfxLoop.mode` in commit 4). */
  /** Returns whether the loop is running *after* the toggle. */
  toggleLoop(clip: SfxClip, volume: number): boolean;
  startLoop(clip: SfxClip, volume: number): void;
  stopLoop(sig: string): void;
  stopAllSfx(): void;
  masterVolume: number;
  setMasterVolume(v: number): void;
  duckAmount: number;
  setDuckAmount(v: number): void;
}

const SfxContext = createContext<SfxApi | null>(null);

export function SfxProvider({ children }: { children: ReactNode }) {
  const player = usePlayer();
  const engineRef = useRef<SfxEngine | null>(null);

  const [activeLoops, setActiveLoops] = useState<string[]>([]);
  const [masterVolume, setMasterVolumeState] = useState<number>(1);
  const [duckAmount, setDuckAmountState] = useState<number>(0.3);

  const duckAmountRef = useRef(duckAmount);
  duckAmountRef.current = duckAmount;

  if (!engineRef.current) {
    const e = new SfxEngine();
    engineRef.current = e;
  }
  const engine = engineRef.current;

  useEffect(() => {
    engine.onOneShotActiveChange = (active) => {
      player.setDuck(active ? duckAmountRef.current : 1);
    };
    return () => {
      engine.onOneShotActiveChange = null;
    };
  }, [player]);

  useEffect(() => {
    let cancelled = false;
    void backend()
      .kvGet('deck', 'audio')
      .then((raw) => {
        if (cancelled || !raw) return;
        try {
          const parsed = JSON.parse(raw) as { masterVolume?: number; duckAmount?: number };
          if (typeof parsed.masterVolume === 'number') {
            setMasterVolumeState(parsed.masterVolume);
            engine.setMasterVolume(parsed.masterVolume);
          }
          if (typeof parsed.duckAmount === 'number') {
            setDuckAmountState(parsed.duckAmount);
          }
        } catch {
          // ignore
        }
      });
    return () => {
      cancelled = true;
    };
  }, [engine]);

  const saveAudioConfig = useCallback((mv: number, da: number) => {
    void backend().kvSet('deck', 'audio', JSON.stringify({ masterVolume: mv, duckAmount: da }));
  }, []);

  const setMasterVolume = useCallback(
    (v: number) => {
      setMasterVolumeState(v);
      engine.setMasterVolume(v);
      saveAudioConfig(v, duckAmountRef.current);
    },
    [engine, saveAudioConfig],
  );

  const setDuckAmount = useCallback(
    (v: number) => {
      setDuckAmountState(v);
      saveAudioConfig(masterVolume, v);
    },
    [masterVolume, saveAudioConfig],
  );

  const fire = useCallback(
    (clip: SfxClip, volume: number) => {
      engine.playOneShot(backend().sfxUrl(clip), volume);
    },
    [engine],
  );

  const startLoop = useCallback(
    (clip: SfxClip, volume: number) => {
      const sig = trackSignature(clip.path, clip.durationSec);
      engine.startLoop(sig, backend().sfxUrl(clip), volume);
      setActiveLoops(engine.activeLoops());
    },
    [engine],
  );

  const stopLoop = useCallback(
    (sig: string) => {
      engine.stopLoop(sig);
      setActiveLoops(engine.activeLoops());
    },
    [engine],
  );

  const toggleLoop = useCallback(
    (clip: SfxClip, volume: number) => {
      const sig = trackSignature(clip.path, clip.durationSec);
      if (engine.activeLoops().includes(sig)) {
        stopLoop(sig);
        return false;
      }
      startLoop(clip, volume);
      return true;
    },
    [engine, startLoop, stopLoop],
  );

  const stopAllSfx = useCallback(() => {
    engine.stopAll();
    setActiveLoops(engine.activeLoops());
  }, [engine]);

  const api = useMemo<SfxApi>(
    () => ({
      activeLoops,
      fire,
      toggleLoop,
      startLoop,
      stopLoop,
      stopAllSfx,
      masterVolume,
      setMasterVolume,
      duckAmount,
      setDuckAmount,
    }),
    [
      activeLoops,
      fire,
      toggleLoop,
      startLoop,
      stopLoop,
      stopAllSfx,
      masterVolume,
      setMasterVolume,
      duckAmount,
      setDuckAmount,
    ],
  );

  return <SfxContext.Provider value={api}>{children}</SfxContext.Provider>;
}

export function useSfx(): SfxApi {
  const ctx = useContext(SfxContext);
  if (!ctx) throw new Error('useSfx outside SfxProvider');
  return ctx;
}
