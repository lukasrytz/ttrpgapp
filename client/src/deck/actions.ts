import type { DeckAction, LeafDeckAction, SfxClip, Track } from '@ttrpgapp/shared';
import { trackSignature } from '@ttrpgapp/shared';
import type { PlayerApi } from '../player/PlayerProvider';
import { shuffleTracks } from '../player/PlayerProvider';
import type { SfxApi } from '../player/SfxProvider';
import { fromSerializable, matches } from '../music/filter';

export interface DeckActionDeps {
  tracks: Track[];
  clips: SfxClip[];
  player: PlayerApi;
  sfx: SfxApi;
  navigate: (to: string) => void;
}

function runLeafAction(action: LeafDeckAction, deps: DeckActionDeps): void {
  switch (action.kind) {
    case 'musicFilter': {
      const filter = fromSerializable(action.filter);
      const filtered = deps.tracks.filter((t) => matches(t, filter));
      if (filtered.length > 0) {
        deps.player.playQueue(shuffleTracks(filtered));
      }
      break;
    }
    case 'musicTrack': {
      const found = deps.tracks.find((t) => trackSignature(t.path, t.durationSec) === action.sig);
      if (found) {
        deps.player.playTrack(found);
      }
      break;
    }
    case 'sfxOneShot': {
      const found = deps.clips.find((c) => trackSignature(c.path, c.durationSec) === action.sig);
      if (found) {
        deps.sfx.fire(found, action.volume);
      }
      break;
    }
    case 'sfxLoop': {
      const found = deps.clips.find((c) => trackSignature(c.path, c.durationSec) === action.sig);
      if (action.mode === 'stop') {
        deps.sfx.stopLoop(action.sig);
      } else if (found) {
        if (action.mode === 'start') {
          deps.sfx.startLoop(found, action.volume);
        } else {
          deps.sfx.toggleLoop(found, action.volume);
        }
      }
      break;
    }
    case 'navigate': {
      deps.navigate(action.to);
      break;
    }
    case 'openNote': {
      deps.navigate(`/notes?path=${encodeURIComponent(action.path)}`);
      break;
    }
    case 'openEntry': {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('open-compendium-entry', {
            detail: { packId: action.packId, entryId: action.entryId },
          }),
        );
      }
      break;
    }
  }
}

export function runDeckAction(action: DeckAction, deps: DeckActionDeps): void {
  if (action.kind === 'macro') {
    const nonNav = action.actions.filter(
      (a) => a.kind !== 'navigate' && a.kind !== 'openNote',
    );
    const nav = action.actions.find(
      (a) => a.kind === 'navigate' || a.kind === 'openNote',
    );

    for (const a of nonNav) {
      runLeafAction(a, deps);
    }
    if (nav) {
      runLeafAction(nav, deps);
    }
  } else {
    runLeafAction(action, deps);
  }
}
