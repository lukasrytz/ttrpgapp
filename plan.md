# Feature implementation plan

> Implements `features.md`. Written to be executed commit-by-commit.
> Every decision here was agreed with the repo owner — do not revisit them, and do not
> expand scope beyond what is listed.

This replaces the previous stream-deck plan, which is finished: the deck, SFX layer,
counters, dice and toast all shipped and are on `main`. Read `features.md` first — it
explains *why* each of these, against how this table actually runs. This file is the *how*.

## Notes for the implementing agent

**Take one commit at a time.** They are ordered by dependency. Commits 1–2 are enablers with
no user-visible effect on their own; resist the urge to fold them into 3.

**Verify after every commit. Three commands, not two:**

```bash
npm run typecheck && npm test && npm run build -w client
```

The build step is not optional and is not decoration. A previous merge left an import
pointing at a deleted file; **typecheck and tests both passed** and only `vite build` caught
it, because TypeScript resolves differently from rollup and Vitest never bundles. CI now
builds on every pull request, but do not rely on that — run it locally.

There is no linter and no formatter in this repo. Match the surrounding file by hand.

### Risk per commit

| Commit | Risk | Why |
| --- | --- | --- |
| 1 Plugin actions | medium | New public contract on `ClientPlugin`. Get the shape right; everything system-specific rides on it. |
| 2 SRD structured fields | low–medium | Data pipeline. Regenerating the pack is easy to get almost-right; the parser needs real tests. |
| 3 Turn card | medium | The one combat ask. State (used/recharged) must reset at the right moments or it silently misleads. |
| 4 Scene model | medium | Enter/exit is the whole point. Get teardown right or ambience layers stack up. |
| 5 Scene UI | medium | Largest UI surface here. Reuse the deck's existing pickers rather than writing new ones. |
| 6 Home Assistant | low | One POST. The work is CORS, cleartext and token storage, not the call. |
| 7 Running order | low | Pure derivation from existing data. |
| 8 Capture | **high** | The notes editor holds an unsaved buffer. Naive append **destroys user data**. See the commit. |
| 9 Session clock | low | |
| 10 Oracle / escalate | low | Content quality matters more than code here. |
| 11 Small wins | low | Independent; can be done any time. |

### Repo traps

- **`noUncheckedIndexedAccess` is on.** Indexing an array yields `T | undefined`. Handle it;
  do not scatter `!` to silence the compiler.
- **`client/test` is not typechecked** (`client/tsconfig.json` includes only `src`).
- **`.js` extensions** on relative imports inside `shared/` and `server/` only.
- **Three genre themes exist** (`theme-fantasy` / `-horror` / `-scifi`, plus `theme-universal`),
  with fonts and radii per theme. Anything new must work in all of them — drive colour through
  the existing custom properties, never literals.
- **Do not reformat, rename, or refactor files you are not otherwise changing.**

### When something is unspecified

Prefer the smaller option and say so in the commit message. The "Deliberately not in scope"
section at the end is binding — those are choices already made, not gaps to fill.

---

## The design spine

Two ideas carry most of this document. Understand them before writing code.

**1. Scenes are stateful; macros are not.** A macro fires and forgets, so leaving the tavern
leaves the tavern crowd murmuring under the road ambush. A scene has **enter and exit**: it
knows it is active, and entering another scene tears the previous one down. Every pacing
feature depends on the app knowing which scene is active.

**2. Structure is derived, not authored.** The owner preps a light skeleton and improvises.
Anything that requires authoring structure will not get used. `splitSections` in
`client/src/components/Markdown.tsx` already splits a note on `## ` headings — so the session
note *already contains* the running order. Read it; do not build an editor for it.

---

## Commit 1 — `ClientPlugin.actions[]` contribution point

Carried forward from the previous plan as an agreed decision. The deck must be able to fire
system-specific things without core code importing `@ttrpgapp/plugin-dnd5e`. The rejected
alternative was importing the plugin directly — faster, but it hard-codes game-system
knowledge into core and breaks the `PluginRuntime` boundary the repo maintains.

In `shared/src/plugin-client.ts`:

```ts
export interface PluginAction {
  id: string;
  label: string;
  /** Emoji, matching the app's icon convention. */
  icon: string;
  /** Optional gate — e.g. hide "next turn" when no combat is running. */
  isAvailable?(runtime: PluginRuntime): Promise<boolean>;
  run(runtime: PluginRuntime): void | Promise<void>;
}

export interface ClientPlugin {
  // …existing fields
  actions?: PluginAction[];
}
```

New leaf action in `shared/src/deck.ts`:

```ts
| { kind: 'pluginAction'; pluginId: string; actionId: string; label: string }
```

`label` is a cached copy so a button still renders sensibly when the plugin is disabled.
`runDeckAction` resolves through `availableClientPlugins` (`client/src/plugins.ts`); an
unknown plugin or action is a **no-op with a toast**, matching how missing clips already
degrade. `migrateDeck` must accept the new kind, and `ActionForm` gains a picker listing the
enabled plugins' actions.

**dnd5e contributes three actions** to prove the hook: `nextTurn`, `previousTurn`, `endCombat`.
Two notes on that:

- **`previousTurn` does not exist yet** — add it.
- The tracker's verbs are closures inside `TrackerPage` JSX behind a single `update(fn)`
  funnel. Extract them first as pure `(Encounter) => Encounter` reducers beside
  `sortedCombatants` in `plugins/dnd5e/src/trackerTypes.ts`, then have both the page and the
  plugin actions call those. Pure reducers are the testable part.
- No new plumbing is needed to *drive* the tracker from outside: `kvSet` the encounter, then
  dispatch `ttrpg-local-changed` and `ttrpg-sync-updated`, and a mounted `TrackerPage` reloads
  itself. `EncountersPage` already does exactly this.

---

## Commit 2 — Structured monster actions in the SRD pack

The turn card needs a monster's abilities as data. Today `fields` carries only
`{ hp, ac, dexMod, cr, size, monsterType }`; abilities live as prose in the markdown `body`.

Extend `plugins/dnd5e/scripts/convert.ts` to emit them structured, then regenerate with
`npm run build-srd`:

```ts
export interface MonsterAbility {
  name: string;
  text: string;
  /** Parsed from "(Recharge 5-6)" in the name. */
  recharge?: { min: number };
  /** Parsed from "(1/Day)", "(3/Day)". */
  usesPerDay?: number;
}
// fields: { …existing, traits: MonsterAbility[], actions: MonsterAbility[], legendary: MonsterAbility[] }
```

**Leave `body` untouched** — the existing stat-block panel renders it and must keep working.
This is additive.

Parse recharge and per-day markers off the ability name and strip them from the displayed
name. Cover the parser in `plugins/dnd5e/test/convert.test.ts`: plain traits, `(Recharge 5-6)`,
`(Recharge 6)`, `(1/Day)`, and a monster with no traits at all.

Commit the regenerated `plugins/dnd5e/data/srd-pack.json`.

---

## Commit 3 — Turn card with nag-until-used chips

The one combat ask. Today you can open a full stat block — which is "go and read it", exactly
what does not happen mid-fight.

New `plugins/dnd5e/src/TurnCard.tsx`, rendered in `TrackerPage` when the active combatant has
a `monsterRef`. It shows **what the creature can do**, not its stat block: four to six chips
drawn from `fields.traits` / `actions` / `legendary`.

**Chips nag until used.** Forgetting is usually not "didn't know" but "knew, and the round went
past". So:

- A chip with `usesPerDay` or `recharge` renders **lit** until tapped, then dims.
- Tapping a chip opens its full text in the existing `BottomSheet` **and** marks it used.
- At the start of that creature's turn, any dimmed `recharge` ability rolls `d6` via
  `rollDice` from `@ttrpgapp/shared`; on `>= recharge.min` it re-lights, with a toast.

State lives on the combatant so it survives reload and sync — extend `Combatant` in
`trackerTypes.ts`:

```ts
usedAbilities?: string[];   // ability names marked used
```

**Reset semantics, which are easy to get wrong:** clear `usedAbilities` when combat *starts*
(`turnIndex` moving from `-1` to `0`), not each round — a once-per-day ability must stay used
across rounds. `EMPTY_ENCOUNTER` naturally clears it when combat ends.

Optional, only if lairs get used: a lair-action reminder at the top of each round rather than
on a creature's turn. Skip unless asked.

---

## Commit 4 — Scene model and store

New `shared/src/scene.ts`:

```ts
export interface Scene {
  id: string;
  name: string;
  icon: string;
  color: DeckColor;
  /** Music to swing to on enter. */
  music?: SerializedFilter;
  /** Ambience loops this scene owns — started on enter, stopped on exit. */
  ambience: { sig: string; name: string; volume: number }[];
  /** Optional note section to open on enter. */
  noteSection?: { path: string; heading: string };
  /** Home Assistant scene entity id (commit 6). */
  haScene?: string;
}

export interface SceneLibrary { version: number; scenes: Scene[] }

/** Tolerant load, same contract as migrateDeck: never throws. */
export function migrateScenes(raw: unknown): SceneLibrary;
```

**Storage — two stores, deliberately different:**

- **Scene definitions** go in the synced `deck` kv namespace, key `scenes`, exactly like the
  deck layout. They are content and should follow you across devices.
- **Which scene is active, and when it was entered**, goes in `@capacitor/preferences`
  directly (localStorage on web), following the precedent of `music.folders` in
  `client/src/music/folders.ts`. This is **per-device session state** — syncing it would mean
  entering a scene on the tablet changes what the phone thinks is happening.

New `client/src/scene/store.ts` for persistence and `client/src/scene/transition.ts` for the
pure part:

```ts
export interface SceneTransition {
  stopLoops: string[];    // signatures to stop (previous scene's ambience)
  startLoops: { sig: string; volume: number }[];
  music?: SerializedFilter;
  openNote?: { path: string; heading: string };
  haScene?: string;
}
/** Pure: what entering `next` from `current` implies. Unit-tested. */
export function planTransition(current: Scene | null, next: Scene | null): SceneTransition;
```

Keep `planTransition` free of React and of the backend — it is the piece worth testing.
Entering the same scene twice must be idempotent (do not restart loops already running).

---

## Commit 5 — Scenes on the deck

New leaf action:

```ts
| { kind: 'scene'; sceneId: string; name: string }
```

Running it calls `planTransition`, then applies the result through the APIs that already
exist: `sfx.stopLoop(sig)` / `sfx.startLoop(clip, volume)` from `SfxProvider`, and
`player.playQueue(shuffleTracks(filtered))` for the music, reusing `matches` and
`fromSerializable` from `client/src/music/filter.ts`. **Do not duplicate `runDeckAction`'s
logic** — extract the shared bits if needed.

UI:

- **Active scene is visible.** The scene's deck button renders lit, the same way an active
  ambience loop already does.
- A **scene editor** reached from the deck's edit mode. Reuse `FilterChips`
  (`client/src/music/FilterChips.tsx`) for the music filter and the SFX clip picker from
  `ButtonEditor.tsx` for ambience. Do not write new pickers.
- Exiting to "no scene" must be reachable — a scene button pressed while active clears it and
  stops its ambience.

---

## Commit 6 — Home Assistant lighting

Fires a scene you have **already defined in Home Assistant**. Do not build light control:
HA owns colours, brightness, transitions and groups; the app stores one entity id.

Because the app has two runtimes, this goes through the `Backend` interface like everything
else — that is the established pattern and it solves the token problem for free:

```ts
// client/src/backend/types.ts
/** Fire-and-forget: resolves even on failure. Never blocks a deck press. */
triggerHaScene(entityId: string): Promise<void>;
```

- **`HttpBackend`** → `POST /api/ha/scene` on the Fastify server, which holds the base URL and
  long-lived token in `config.json` / gitignored `config.local.json` and forwards to HA. This
  keeps the token **out of the browser** and sidesteps CORS entirely.
- **`CapacitorBackend`** → direct `fetch` to HA, with base URL and token in
  `@capacitor/preferences` (same pattern as the Drive client id). Needs a **cleartext HTTP
  exception in `AndroidManifest.xml`**, because the WebView serves from `https://localhost`
  and HA is plain `http://` on the LAN. Add it narrowly, via a network security config
  domain exception rather than blanket `usesCleartextTraffic`.

Keep the request builder pure and unit-test it against a fake fetch:

```ts
// shared/src/homeAssistant.ts
export function buildSceneRequest(baseUrl: string, token: string, entityId: string):
  { url: string; init: { method: string; headers: Record<string, string>; body: string } };
```

The call is `POST {baseUrl}/api/services/scene/turn_on`, `Authorization: Bearer <token>`,
body `{"entity_id": entityId}`.

**The rule that matters:** a deck press must never block or fail because HA is unreachable.
Fire it, do not await it in the transition path, toast on failure. Music and ambience land
whether or not the lights do.

Settings gets a "Home Assistant" block: base URL, token, and a **Test** button that fires a
named scene and reports success or failure plainly.

---

## Commit 7 — The running order

Derived, not authored. New `client/src/session/runningOrder.ts`:

```ts
export interface Beat { heading: string; doneAt: number | null }
export interface SessionState {
  notePath: string;
  startedAt: number;
  beats: Beat[];
  activeBeat: string | null;
  activeBeatAt: number | null;
}
/** Pure: derive beats from a note's markdown, preserving done-state by heading. */
export function deriveBeats(markdown: string, previous: Beat[]): Beat[];
```

`deriveBeats` uses `splitSections` from `client/src/components/Markdown.tsx` — sections with a
non-null `heading` become beats, in order. Preserving previous done-state **by heading text**
matters: the owner edits the note mid-session, and ticked beats must not un-tick.

`SessionState` lives in Preferences (per-device, not synced), like the scene state.

UI on the deck: a compact panel listing beats, each a full-width tappable row (44px minimum).
Tap marks done; long-press makes it the active beat. The active beat shows elapsed time. What
is left is visible at a glance — that is the entire point.

**Starting a session** picks the note: default to the newest note under `sessions/`, with a
picker to override. If there is no session note, the panel is empty and nothing breaks.

Optional and good: making a beat active also enters the scene of the same name, if one exists —
so the running order and the scene switcher become one control.

---

## Commit 8 — One-press capture

**Highest-risk commit here. A naive implementation destroys notes.**

The goal: a button opens a single-line input, appends a timestamped line to tonight's session
note under the active beat, and gets out of the way. Because most of what happens was
improvised, this is how the session note gets written at all.

Two hard constraints:

1. **There is no append API.** `Backend` offers only whole-file `writeNote(path, content)`, so
   this is read → modify → write.
2. **`NotesPage` holds a debounced unsaved buffer.** If that note is open in the editor, a
   read-modify-write **will clobber whatever is being typed.**

Required sequence, do not shortcut it:

- `NotesPage` gains a listener for a new `ttrpg-flush-notes` window event that flushes its
  pending save immediately (it already flushes on unmount and visibilitychange — reuse that
  path, do not write a second one).
- Capture dispatches `ttrpg-flush-notes`, waits for the flush to resolve, *then* reads,
  appends and writes.
- If the flush cannot be confirmed, **refuse and toast** rather than writing. Losing a captured
  line is annoying; losing a paragraph the owner was typing is not acceptable.

Insert under the active beat's `## ` heading when there is one, otherwise at the end of the
file. Format: `- HH:MM — <text>`.

---

## Commit 9 — Session clock and summary

Small once commits 4 and 7 exist, because the timestamps are already being kept.

- **Session clock** on the deck: elapsed since `SessionState.startedAt`.
- **Time in the current beat**, and in the current scene.
- **End session** writes a summary into the session note: time per beat, total, and which beats
  were never reached. Three of these teach more about pacing than any amount of theorising.

Deliberately **not**: turn timers, countdowns, or anything that beeps. The ask was to *know*
where the session is, not to be interrupted.

---

## Commit 10 — Levers for when energy drops

All of these must work cold, with no prep.

New `shared/src/oracle.ts` — a small, curated, **system-agnostic** table of complications:
*someone arrives · a demand is made · it costs more than expected · it goes wrong now · an
old obligation surfaces.* Twenty to thirty entries that are actually good beat two hundred
that are not. Keep it short and keep it sharp; this is a content problem more than a code one.

New leaf actions:

```ts
| { kind: 'oracle' }
| { kind: 'escalate' }
```

- **`oracle`** draws a prompt and shows it in a toast, with the same injectable-`rng` pattern
  used by `shared/src/dice.ts` so it is testable.
- **`escalate`** raises the current music filter's `minIntensity` by one (the tag model already
  supports 1–5) and draws a complication.
- **Cut to** is the running-order panel from commit 7 — jumping to another beat without
  pretending the current one resolved. No new action needed.
- **NPC on demand:** wire the existing `generateNameBatch` / `generateQuirkFlaw` from
  `client/src/pages/generatorsData.ts` to a deck action that shows one NPC in a toast, with a
  second press to capture it into the session note via commit 8.

---

## Commit 11 — Small wins

Independent of everything above; do them whenever.

- **Party passive perceptions.** `PartyMember.passivePerception` is already stored and edited
  and read by nothing. Surface it as a dnd5e plugin action (commit 1) showing a small card.
- **Keep the screen awake** — add `@capacitor/keep-awake`, enable while a session is running.
- **Haptics on deck press** — add `@capacitor/haptics`. A touch deck you are not looking at
  benefits more than usual.
- **Roll on a table stored as a note** — pick a random `- ` list item from a markdown note.
  No new data model; the owner writes their own tables in the vault.

---

## Tests

Logic-only Vitest units in the sibling `test/` directory, hand-written fakes, no jsdom.

| File | Covers |
| --- | --- |
| `plugins/dnd5e/test/convert.test.ts` (extend) | ability parsing: plain, `(Recharge 5-6)`, `(Recharge 6)`, `(1/Day)`, none |
| `plugins/dnd5e/test/trackerTypes.test.ts` (new) | `nextTurn` / `previousTurn` / `endCombat` reducers, round wrapping, empty encounter |
| `client/test/scene.test.ts` | `planTransition`: enter from nothing, swap scenes stops only the previous scene's loops, re-entering the same scene is idempotent, exit to null |
| `client/test/runningOrder.test.ts` | `deriveBeats`: preserves done-state by heading across edits, handles a renamed heading, no headings, preamble-only |
| `client/test/homeAssistant.test.ts` | `buildSceneRequest` shape, trailing-slash base URLs |
| `client/test/oracle.test.ts` | draw with a seeded rng, no repeats within a short window |
| `client/test/deckActions.test.ts` (extend) | `scene`, `pluginAction`, `oracle`, `escalate`; unknown plugin/action is a no-op |
| `client/test/deck.test.ts` (extend) | `migrateDeck` accepts and round-trips the new action kinds; unknown kinds still dropped |

---

## Verification

1. `npm run typecheck && npm test && npm run build -w client` — all three, every commit.
2. `npm run dev`, then:
   - **Turn card:** start a fight with a monster that has a recharge ability. Its chip is lit;
     tap it, it dims and shows the text; on its next turn it either re-lights or stays dim.
     Reload mid-fight — used state survives. End combat and restart — state is cleared.
   - **Scenes:** build "Tavern" (social music + crowd ambience) and "The Road". Enter Tavern,
     then enter The Road: **the crowd stops**, the road ambience starts, the music swings.
     Press Tavern twice — the second press does not restart the loop.
   - **Running order:** open a session note with three `## ` headings; the panel lists them.
     Tick one, edit the note to add a fourth heading, and confirm the ticked one stays ticked.
   - **Capture (do this carefully):** open the session note in the editor, type a sentence but
     do **not** wait for the save, then fire capture. The typed sentence must survive.
   - **Home Assistant:** with HA reachable, entering a scene changes the lights. Then turn HA
     off and enter the scene again — music and ambience must still work, with a toast about
     the failure and no hang.
3. Android: `npm run build -w client && cd client && npx cap sync android && cd android &&
   ./gradlew assembleDebug`. Verify the turn card and running order are usable one-handed on a
   tablet, and that the HA cleartext exception works on a real LAN.

---

## Deliberately not in scope

From `features.md` §5, binding: player-facing displays, handouts or a second screen; player
accounts or shared characters; prep-time tooling such as encounter builders and campaign
wikis; turn-admin shortcuts, expiry reminders and faster encounter setup; and anything that
beeps or nags on a timer.

Also out: light-level control in Home Assistant (scenes only), lair actions unless asked, and a
persistent roll log.

---

## Still-open bugs, unrelated to this work

Logged in `bugs.md`; do not fix them as part of these commits.

- Concentration is never ended by damage — `applyHp` in `TrackerPage` does not touch it, so a
  combatant dropped to 0 HP keeps concentration, which 5e ends outright (entry 3).
- `sly.html` — a stray 43KB saved article at the repo root, third-party content, referenced by
  nothing (entry 4).
- `npm run build:apk` ends in `gradlew.bat`, so it is Windows-only (entry 5).

Two more worth knowing, not yet logged: `PluginRuntime.getBackend?(): any` puts an `any` into
a deliberately narrow boundary, and `BottomSheet.tsx` exists as identical copies in `client`
and in the dnd5e plugin.

---

## Appendix — prompts for driving this

*For the person running the implementation, not for the implementing agent.*

One template covers every commit; the detail is above, and duplicating it into per-commit
prompts only lets the two drift apart:

```
Read plan.md in the repo root, and features.md for the reasoning behind it.
Implement Commit N — <title>. Only that commit.

Follow the "Notes for the implementing agent" section at the top of plan.md.

When you're done:
1. Run `npm run typecheck && npm test && npm run build -w client` — all three must pass
2. Commit with a message saying what changed and why
3. Report back: what you did, anything in the plan that was wrong or
   underspecified, and what you chose instead
```

Step 3 matters. This plan was written without running the code, so it has defects; the point
is for each session to surface them rather than quietly work around them.

**Three commits are worth a checkpoint before any code exists.** Append to the template:

- **Commit 1** — *"Before writing code, show me the `PluginAction` shape and how a deck button
  resolves it when the plugin is disabled. Wait for my go-ahead."*
- **Commit 4** — *"Before writing code, explain what `planTransition` returns when swapping
  between two scenes that share an ambience loop. Wait for my go-ahead."*
- **Commit 8** — *"Before writing code, walk me through exactly what happens if the session
  note is open in the editor with unsaved changes when capture fires. Wait for my go-ahead."*

> If you find yourself wanting to write a long prompt for some commit, that is a sign the
> **plan** is thin there, not that the prompt needs to be fatter. Fix the plan instead.
