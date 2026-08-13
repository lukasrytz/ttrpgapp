import type { DeckAction, LeafDeckAction, SfxClip, Track } from '@ttrpgapp/shared';
import { formatDiceResult, rollDice, trackSignature } from '@ttrpgapp/shared';
import type { PlayerApi } from '../player/PlayerProvider';
import { shuffleTracks } from '../player/PlayerProvider';
import type { SfxApi } from '../player/SfxProvider';
import { fromSerializable, matches } from '../music/filter';
import { showToast } from '../toast';
import { modifyCounter } from './counterStore';
import { availableClientPlugins } from '../plugins';

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
        showToast(`${filtered.length} tracks queued`, '🎵');
      } else {
        showToast('No tracks matched filter', '⚠️');
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
      const name = found ? found.name : action.name || 'SFX';
      if (found) {
        deps.sfx.fire(found, action.volume);
      }
      showToast(`Playing ${name}`, '🔊');
      break;
    }
    case 'sfxLoop': {
      const found = deps.clips.find((c) => trackSignature(c.path, c.durationSec) === action.sig);
      const name = found ? found.name : action.name || 'Ambience';
      if (action.mode === 'stop') {
        deps.sfx.stopLoop(action.sig);
        showToast(`Stopped ${name}`, '🌊');
      } else if (found) {
        if (action.mode === 'start') {
          deps.sfx.startLoop(found, action.volume);
          showToast(`Started ${name}`, '🌊');
        } else {
          // Use the toggle's return value: `activeLoops` is React state and still
          // holds the pre-toggle value at this point, so reading it here reports
          // the opposite of what just happened.
          const isNowActive = deps.sfx.toggleLoop(found, action.volume);
          showToast(`${isNowActive ? 'Started' : 'Stopped'} ${name}`, '🌊');
        }
      }
      break;
    }
    case 'navigate': {
      let target = action.to;
      if (
        !target.startsWith('/p/') &&
        target !== '/' &&
        target !== '/music' &&
        !target.startsWith('/notes') &&
        target !== '/generators'
      ) {
        for (const plugin of availableClientPlugins) {
          if (plugin.nav.some((item) => item.path === target)) {
            target = `/p/${plugin.id}${target}`;
            break;
          }
        }
      }
      deps.navigate(target);
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
      showToast(`Opened ${action.entryId}`, '📚');
      break;
    }
    case 'openEncounter': {
      const startParam = action.autoStart ? '&start=1' : '';
      deps.navigate(`/p/dnd5e/encounters?id=${encodeURIComponent(action.encounterId)}${startParam}`);
      showToast(`Opened encounter`, '📋');
      break;
    }
    case 'counter': {
      const newVal = modifyCounter(action.counterId, action.delta, action.max);
      const display = action.max !== undefined ? `${newVal}/${action.max}` : `${newVal}`;
      showToast(`${action.name}: ${display}`, '🔢');
      break;
    }
    case 'roll': {
      try {
        const res = rollDice(action.formula);
        const label = action.label || action.formula;
        const breakdown = formatDiceResult(res);
        showToast(`${label}: ${res.total}${breakdown ? ` ${breakdown}` : ''}`, '🎲');
      } catch {
        showToast(`Invalid dice formula: ${action.formula}`, '⚠️');
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
