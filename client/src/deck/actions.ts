import type { DeckAction, LeafDeckAction, SfxClip, Track } from '@ttrpgapp/shared';
import {
  formatDiceResult,
  planTransition,
  rollDice,
  rollOnMarkdownTable,
  rollOracle,
  trackSignature,
} from '@ttrpgapp/shared';
import type { PlayerApi } from '../player/PlayerProvider';
import { shuffleTracks } from '../player/PlayerProvider';
import type { SfxApi } from '../player/SfxProvider';
import { fromSerializable, matches } from '../music/filter';
import { showToast } from '../toast';
import { modifyCounter } from './counterStore';
import { availableClientPlugins } from '../plugins';
import { getActiveSceneState, loadSceneLibrary, setActiveSceneState } from '../scene/store';
import { backend } from '../backend';
import { appendQuickNote } from '../session/quickNote';
import { generateNameBatch, generateQuirkFlaw } from '../pages/generatorsData';

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
    case 'pluginAction': {
      const plugin = availableClientPlugins.find((p) => p.id === action.pluginId);
      const plugAction = plugin?.actions?.find((a) => a.id === action.actionId);
      if (!plugin || !plugAction) {
        showToast(`${action.label || 'Action'} unavailable`, '⚠️');
        break;
      }
      try {
        const rt = typeof window !== 'undefined' ? window.__ttrpgappRuntime : undefined;
        if (!rt) {
          showToast('Plugin runtime not ready', '⚠️');
          break;
        }
        void plugAction.run(rt);
      } catch {
        showToast(`${action.label} failed`, '⚠️');
      }
      break;
    }
    case 'scene': {
      void (async () => {
        try {
          const activeState = await getActiveSceneState();
          const lib = await loadSceneLibrary();
          const current = activeState.sceneId
            ? lib.scenes.find((s) => s.id === activeState.sceneId) ?? null
            : null;
          const target = lib.scenes.find((s) => s.id === action.sceneId) ?? null;

          if (!target) {
            showToast('Scene not found', '⚠️');
            return;
          }

          const isCurrentlyActive = activeState.sceneId === action.sceneId;
          const next = isCurrentlyActive ? null : target;
          const transition = planTransition(current, next);

          // Stop loops
          for (const sig of transition.stopLoops) {
            deps.sfx.stopLoop(sig);
          }

          // Start loops
          for (const loop of transition.startLoops) {
            const clip = deps.clips.find(
              (c) => trackSignature(c.path, c.durationSec) === loop.sig,
            );
            if (clip) {
              deps.sfx.startLoop(clip, loop.volume);
            }
          }

          // Music
          if (transition.music) {
            const filter = fromSerializable(transition.music);
            const filtered = deps.tracks.filter((t) => matches(t, filter));
            if (filtered.length > 0) {
              deps.player.playQueue(shuffleTracks(filtered));
            }
          }

          // Note Section
          if (transition.openNote) {
            deps.navigate(`/notes?path=${encodeURIComponent(transition.openNote.path)}`);
          }

          // Home Assistant scene
          if (transition.haScene) {
            const be = backend();
            if ('triggerHaScene' in be && typeof (be as any).triggerHaScene === 'function') {
              void (be as any).triggerHaScene(transition.haScene).catch((err: unknown) => {
                showToast(
                  `Lighting failed: ${err instanceof Error ? err.message : String(err)}`,
                  '💡',
                );
              });
            }
          }

          await setActiveSceneState(next ? next.id : null);
          if (next) {
            showToast(`Scene: ${next.name}`, next.icon || '🎭');
          } else {
            showToast(`Exited ${action.name || 'scene'}`, '🎭');
          }
        } catch {
          showToast('Scene transition failed', '⚠️');
        }
      })();
      break;
    }
    case 'quickNote': {
      const promptText = action.prompt || 'Quick capture note:';
      const heading = action.heading || 'In-session Notes';
      const text = window.prompt(promptText);
      if (text && text.trim()) {
        void appendQuickNote(text.trim(), heading)
          .then(() => showToast('Note captured', '📝'))
          .catch(() => showToast('Failed to save note', '⚠️'));
      }
      break;
    }
    case 'oracle': {
      const res = rollOracle(action.odds ?? 'even');
      showToast(`🔮 ${res.answerLabel} (${res.action} / ${res.theme})`, '🔮', 3500);
      break;
    }
    case 'escalate': {
      const complication = rollOracle('unlikely');
      const combatFilter = fromSerializable({
        dims: { theme: ['combat'] },
        minIntensity: 1,
        search: '',
      });
      const combatTracks = deps.tracks.filter((t) => matches(t, combatFilter));
      if (combatTracks.length > 0) {
        deps.player.playQueue(shuffleTracks(combatTracks));
      }
      void appendQuickNote(
        `⚔️ ESCALATION: ${complication.action} / ${complication.theme} (${complication.answerLabel})`,
        'In-session Notes',
      );
      showToast(`⚔️ Escalation! ${complication.action} / ${complication.theme}`, '⚔️', 4000);
      deps.navigate('/p/dnd5e/tracker');
      break;
    }
    case 'quickNpc': {
      const nameBatch = generateNameBatch(1, 'Any', 'Any', 'All Styles');
      const name = nameBatch[0] ?? { fullName: 'Unknown Stranger', race: 'Human' };
      const quirk = generateQuirkFlaw();
      void appendQuickNote(
        `👤 NPC: ${name.fullName} (${name.race}) — Disposition: ${quirk.disposition}, Quirk: ${quirk.quirk}, Flaw: ${quirk.flaw}, Voice: ${quirk.voice}`,
        'NPCs Met',
      );
      showToast(`👤 ${name.fullName} (${name.race}) · ${quirk.voice}`, '👤', 4000);
      break;
    }
    case 'rollTable': {
      void backend()
        .readNote(action.notePath)
        .then((note) => {
          const res = rollOnMarkdownTable(note.content);
          if (!res) {
            showToast('No markdown table found in note', '⚠️');
            return;
          }
          showToast(`🎲 ${res.text}`, '🎲', 4500);
        })
        .catch(() => {
          showToast('Failed to read table note', '⚠️');
        });
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
