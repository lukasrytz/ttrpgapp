import type { DeckLayout } from '@ttrpgapp/shared';
import { migrateDeck } from '@ttrpgapp/shared';
import { backend } from '../backend';
import { starterDeck } from './starter';

const DECK_NS = 'deck';
const LAYOUT_KEY = 'layout';

export async function loadDeck(): Promise<DeckLayout> {
  try {
    const raw = await backend().kvGet(DECK_NS, LAYOUT_KEY);
    if (!raw) return starterDeck();
    const parsed: unknown = JSON.parse(raw);
    const migrated = migrateDeck(parsed);
    if (migrated.pages.length === 0) return starterDeck();
    return migrated;
  } catch {
    return starterDeck();
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function saveDeck(layout: DeckLayout): void {
  if (saveTimer !== null) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void backend()
      .kvSet(DECK_NS, LAYOUT_KEY, JSON.stringify(layout))
      .then(() => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('ttrpg-local-changed'));
        }
      });
  }, 400);
}
