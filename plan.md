# Stream Deck front page — implementation plan

> Implementation plan for the next feature. Written to be executed commit-by-commit.
> Every decision below was agreed with the repo owner — do not revisit them, and do not
> expand scope beyond what is listed. Nothing here has been implemented yet.

## Notes for the implementing agent

**Take one commit at a time.** The nine commits are ordered by dependency and each is
independently revertable. Do not attempt several at once, and do not reorder them —
commit 1 must land before the audio work, and commit 7 before 8 and 9.

**Verify after every commit. Nothing else will.**

```bash
npm run typecheck && npm test    # at the repo root
```

There is no linter and no formatter in this repo, and **CI runs neither the tests nor the
typecheck** — `.github/workflows/android.yml` only builds the APK (it does run on
`claude/**` branches, so it is a genuine safety net for the Android edits in commit 1,
which cannot be verified locally without the SDK). If typecheck or tests fail, fix them
before committing rather than after.

### Risk per commit — where to slow down

| Commit | Risk | Why |
| --- | --- | --- |
| 1 Remove Chromecast | low, unverifiable locally | Mostly deletion against an explicit list. The Gradle/manifest edits need the CI APK build to confirm. |
| 2 SFX library | low | Deliberately mirrors `server/src/music.ts` and the existing backend methods. Follow the existing shapes rather than inventing new ones. |
| 3 SFX engine | **highest** | Imperative audio: element pooling, volume ramps, duck factor × user volume held in refs. This is code that compiles, looks right, and misbehaves audibly. There is no jsdom, so tests will not catch a wrong ramp — construct `SfxEngine` with the injected fake element factory and assert on the fake. |
| 4 Deck data model | low–medium | `migrateDeck` must **never throw**: it parses a document that arrives over Drive sync from another device. Every malformed-input case in the test table must pass. |
| 5 Deck UI | **high** | Largest surface. dnd-kit sensors, the edit-mode/press separation, long-press vs drag, the `ActionForm` extraction, the macro list. Build `ActionForm` as a reusable component from the start — retrofitting it is the expensive path. |
| 6 Routing/settings/README | low | Small localized edits. |
| 7 Toast | low | Prerequisite for 8 and 9. Keep the event detail serializable — no ReactNodes through a CustomEvent. |
| 8 Counters | low | The pure `bumpCounter` carries the logic; keep it pure and test it. |
| 9 Dice | low | Self-contained pure logic. `parseDice` returns `null` on bad input and never throws. |

### Repo traps that catch agents

- **`noUncheckedIndexedAccess` is on.** Indexing an array yields `T | undefined`. Handle it
  properly; do not scatter `!` to silence the compiler. The existing `a[j]!` uses are in
  code that has already proven the index — match that bar.
- **No formatter.** Match the surrounding file by hand: 2-space indent, single quotes,
  semicolons, trailing commas, ~100 columns.
- **`client/test` is not typechecked** (`client/tsconfig.json` includes only `src`). Keep
  test code simple; a type error there will not surface until it fails at runtime.
- **`.js` extensions** on relative imports inside `shared/` and `server/` only — never in
  `client/` or `plugins/`.
- **Add no dependencies** beyond the three `@dnd-kit` packages named in commit 5.
- **Do not reformat, rename, or refactor files you are not otherwise changing.** The diff
  should be readable as the feature.

### When something is unspecified

Prefer the smaller option and say so in the commit message. The "Explicitly **out**" row in
the decisions table and the "Deliberately not in scope" section at the end are binding —
they are choices the repo owner already made, not gaps to fill.

## Context

The app is a GM's companion used live at the table: tagged ambient music, prep notes,
and a D&D 5e plugin (SRD compendium + combat tracker). Today it opens on the **Music**
page, and every function is reached by hunting through the sidebar — which is the wrong
interaction model mid-session, when you have three seconds and one hand free.

The goal is a **stream deck front page**: a customizable grid of big, tappable buttons
that fire the app's functions directly. Press one button to swing the music to "tense
battle", another to drop a thunderclap over the top of it, another to jump to the combat
tracker. It becomes the app's landing page.

This needs one genuinely new capability — **sound effects layered over the music**, which
does not exist today (the app has exactly one audio path and it can only play one thing).
It also removes Chromecast support, which the owner reports never really worked and which
otherwise complicates every audio change below.

Commits 1–6 deliver the deck itself. Commits 7–9 add two further button kinds that came out
of a follow-on brainstorm — **counters on the button face** and a **dice roller** — together
with the transient-overlay chrome they both need, which the app also lacks entirely. Take
them in order; 7–9 depend on the deck existing but not on each other beyond the overlay.

### Decisions already made (do not re-litigate)

| Decision | Choice |
| --- | --- |
| Landing page | Deck takes `/`; Music moves to `/music` |
| Layout | Multi-page (tabs), responsive grid, drag-to-arrange, explicit Edit mode |
| Button actions, commits 1–6 | music filter / pinned track · SFX one-shot + ambience loop · navigate · **macro** (one press, several actions) |
| Button actions, commits 7–9 | counter / clock on the button face · dice roll (with optional DC) |
| Explicitly **out** | transport buttons, panic/stop-all button, deck volume sliders, "pin to deck" from Music page, plugin-contributed actions |
| SFX source | Its own folders, scanned into a separate library |
| SFX metadata | Folder + filename only. No tags, no intensity |
| SFX folder selection on Android | A **separate** SFX folder picker, distinct from the music one |
| Ducking | Always on, no per-button setting; one global duck-amount slider in Settings |
| Chromecast | Removed, as commit 1 |

---

## House rules (this repo has no linter — match by hand)

- 2-space indent, single quotes, semicolons, trailing commas, ~100 col.
- Function components only. `export default function Foo()`. Props typed **inline in the
  parameter position**, never a named `Props` interface.
- `interface` for object shapes, `type` for unions. Const-tuple + derived union for
  vocabularies (`export const X = [...] as const; export type X = (typeof X)[number]`).
- No import aliases. Relative imports, or `@ttrpgapp/shared`. Relative imports inside
  `shared/` and `server/` carry an explicit `.js` extension; `client/` and `plugins/` do not.
- `tsconfig.base.json` sets `noUncheckedIndexedAccess` — indexing an array gives `T | undefined`.
- Styling: append to the single global `client/src/styles.css` under a new
  `/* --- stream deck --- */` banner comment. No CSS modules, no Tailwind. Icons are emoji.
  Reuse `.page`, `.page-header`, `.header-actions`, `.chip`/`.chip-on`, `.muted`, `.small`,
  `.primary`, `.palette-backdrop`, `.icon-btn`. Respect the single breakpoint
  `@media (max-width: 759px)` and the 44px minimum tap target.
- Persistence writes follow the pattern in `plugins/dnd5e/src/TrackerPage.tsx`: optimistic
  `setState`, `useRef` debounce timer, then
  `void kvSet(...).then(() => window.dispatchEvent(new Event('ttrpg-local-changed')))`.
  Reads reload on the `ttrpg-sync-updated` window event.
- Tests are **logic-only** Vitest units in the sibling `test/` dir, using hand-written fake
  classes, no jsdom and no React Testing Library. Design new classes to accept their
  collaborators via constructor injection so they stay testable.
- Run `npm run typecheck` and `npm test` before every commit — **CI runs neither.**

---

## Commit 1 — Remove Chromecast

Do this first and alone, so it is trivially revertable and so the audio work lands on a
simple player.

**Delete outright**
- `client/src/cast/manager.ts`, `client/src/cast/plugin.ts`, `client/src/cast/types.ts`
- `client/src/player/CastButton.tsx`
- `client/test/cast.test.ts`
- `client/android/app/src/main/java/ch/rytz/ttrpgapp/`: `CastPlugin.java`,
  `CastOptionsProvider.java`, `MediaServerPlugin.java`, `MediaHttpServer.java`,
  `MediaServerService.java`

**Edit**
- `client/src/player/PlayerProvider.tsx` — drop the `castManager` import; collapse `playOn`
  to `void engine().play(backend().trackUrl(track))`; delete the `castManager.onProgress /
  onEnded` effect and the `ttrpg-cast-status` effect; remove the cast branches from `toggle`
  and `setVolume`. `advance` can then call the engine directly.
- `client/src/player/PlayerBar.tsx` — remove the `CastButton` import and its element.
- `client/src/main.tsx` — remove the `castManager` import and the lazy
  `import('./cast/plugin')` block inside the `isNativePlatform()` branch.
- `client/android/app/src/main/java/ch/rytz/ttrpgapp/MainActivity.java` — drop the
  `registerPlugin(MediaServerPlugin.class)` and `registerPlugin(CastPlugin.class)` lines.
- `client/android/variables.gradle` — remove `castFrameworkVersion`,
  `androidxMediaRouterVersion`, `nanohttpdVersion`.
- `client/android/app/build.gradle` — remove the three cast/nanohttpd `implementation` lines
  and their comment; reword the `minifyEnabled false` comment so it no longer cites the Cast SDK
  (Capacitor's reflective plugin lookup is still a valid reason to keep R8 off).
- `client/android/app/src/main/res/values/strings.xml` — remove `cast_app_id` and its comment.
- `client/android/app/src/main/AndroidManifest.xml` — remove the Cast `OPTIONS_PROVIDER_CLASS_NAME`
  meta-data, the `.MediaServerService` `<service>`, and the whole "Casting:" permission block
  (`ACCESS_NETWORK_STATE`, `ACCESS_WIFI_STATE`, `CHANGE_WIFI_MULTICAST_STATE`, `WAKE_LOCK`,
  `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK`, `NEARBY_WIFI_DEVICES`,
  `POST_NOTIFICATIONS`). **Keep** `INTERNET`, `READ_MEDIA_AUDIO`, `READ_EXTERNAL_STORAGE`.
- `README.md` — delete the "Casting (Android, Chromecast)" section, the "Cast to speakers"
  bullet under Features, the `### Casting (client/src/cast/)` subsection under Architecture,
  and the `[Casting](#casting-android-chromecast)` cross-links.

Verify: `npm run typecheck && npm test`, then `grep -ri cast client server shared` returns
nothing outside `plugins/dnd5e` SRD data (which legitimately contains spellcasting text).

---

## Commit 2 — The SFX library

A second audio library, deliberately much thinner than the music one: no tags, no
intensity, no editor. A clip is a file with a name.

### Shared types — new `shared/src/sfx.ts`, re-exported from `shared/src/index.ts`

```ts
/** A sound-effect clip. Deliberately thinner than Track: no tags, no intensity. */
export interface SfxClip {
  id: number;
  /** Server: path relative to its folder root. Android: the device path. */
  path: string;
  /** Server: the configured folder root. Android: '' (device paths are absolute). */
  folder: string;
  /** Display name — the filename without its extension. */
  name: string;
  durationSec: number | null;
}
```

Reuse `trackSignature(pathOrName, durationSec)` from `shared/src/music.ts` for clip identity —
it is already the app's device-independent audio identity and works verbatim here.

### Config

- `shared/src/config.ts` — add `sfxFolders: string[]` to `AppConfig`.
- `server/src/config.ts` — default it to `[]` in the `DEFAULTS` object used by `loadConfig()`.
- `config.json` — add `"sfxFolders": []` and document it in the README config block.

### Server

Extract the shared file-walking bits so music and SFX do not diverge. New
`server/src/audio.ts` holding `AUDIO_EXTS`, `MIME`, `walk()`, and a
`sendFileRange(req, reply, abs)` helper carrying the existing 206/`Accept-Ranges` logic
verbatim out of `server/src/music.ts`. Rewrite `music.ts` to import them (no behaviour change).

New `server/src/sfx.ts` mirroring `music.ts`:
- table in `server/src/db.ts` (`migrate()` is plain idempotent DDL — just add it):
  ```sql
  CREATE TABLE IF NOT EXISTS sfx (
    id INTEGER PRIMARY KEY,
    folder TEXT NOT NULL,
    path TEXT NOT NULL,
    name TEXT NOT NULL,
    duration_sec REAL,
    UNIQUE (folder, path)
  );
  ```
- `scanSfx(db, config)` over `config.sfxFolders`, same add/remove diff as `scan()`, returning
  the existing `MusicScanResult` shape. Use `music-metadata` only for duration; the name is
  always the filename stem (SFX files rarely carry useful ID3 titles).
- `registerSfxRoutes(app, db, config)` → `GET /api/sfx/clips`, `POST /api/sfx/scan`,
  `GET /api/sfx/stream/:id`. Register it from `server/src/index.ts` beside the music routes.

### Folder selection — `client/src/music/folders.ts`

Generalize the module over the storage key, keeping existing call sites and
`client/test/musicFolders.test.ts` untouched via default parameters:

```ts
export const MUSIC_FOLDERS_KEY = 'music.folders';
export const SFX_FOLDERS_KEY = 'sfx.folders';

export async function getFolderSelection(key = MUSIC_FOLDERS_KEY): Promise<Set<string> | null>
export async function setFolderSelection(paths: string[] | null, key = MUSIC_FOLDERS_KEY): Promise<void>
```

> **Trap — opposite defaults.** For music, "no selection stored" means *every folder*. For
> SFX that would turn the whole music library into sound effects on first launch. So SFX
> folders are **opt-in**: add a dedicated pair that treats a missing selection as *empty*.
> ```ts
> /** SFX folders are opt-in — unlike music, no stored selection means NO folders. */
> export async function getSfxFolders(): Promise<Set<string>>
> export async function setSfxFolders(paths: string[]): Promise<void>
> ```
> `filterByFolders` and `foldersOf` already take a `Set | null` and are reused as-is.

A folder may legitimately be selected for both libraries; allow it, and have the SFX picker
mark such folders "also in music library" rather than forbidding it.

### Backend interface — `client/src/backend/types.ts`

```ts
listSfx(): Promise<SfxClip[]>;
scanSfx(): Promise<MusicScanResult>;
/** Every folder holding audio, so the user can pick which hold sound effects. */
listSfxFolders(): Promise<MusicFolder[]>;
setSfxFolders(paths: string[]): Promise<void>;
/** Playable URL for a clip (sync, like trackUrl). */
sfxUrl(clip: SfxClip): string;
```

`MusicFolder` is structurally just "a folder with N audio files in it" — reuse it rather
than cloning the type; add a line to its JSDoc in `shared/src/music.ts` saying so.

- `client/src/backend/http.ts` — straight passthrough to the new routes;
  `sfxUrl` → `/api/sfx/stream/${clip.id}`.
- `client/src/backend/capacitor.ts` — **no native changes needed.** Derive SFX from the same
  `MusicLibrary.list()` MediaStore listing, filtered by the `sfx.folders` selection, and map
  each entry to an `SfxClip` (`name` = filename stem, `folder` = `''`). `sfxUrl` →
  `Capacitor.convertFileSrc(clip.path)`. `scanSfx` mirrors the existing `scanMusic` counting.
  Assign ids over the *full* device listing exactly as `listDeviceTracks` does, so ids stay
  stable while the selection changes.

> **Android caveat to note in the README:** `MusicLibraryPlugin.java` queries MediaStore with
> `IS_MUSIC != 0`. Ordinary audio files the user copies into a folder are flagged that way, but
> clips MediaStore has classified as notification/alarm/ringtone will not appear. If that bites,
> the one-line fix is to widen the `selection` string in `doList()`.

**Durable references.** Backend ids are positional on Android and therefore not stable across
devices or rescans. A deck button must store `trackSignature(clip.path, clip.durationSec)`,
never an id — same rule the music tag catalog already follows.

---

## Commit 3 — The SFX audio engine

### The key design call: no Web Audio

`CrossfadeEngine` already degrades to ramping `HTMLAudioElement.volume` on a 50ms interval,
because `createMediaElementSource` can fail or output silence in the Android WebView. Building
the SFX layer on Web Audio would therefore be unreliable on the one platform that matters most.

**`SfxEngine` uses plain `HTMLAudioElement`s and nothing else.** Multiple `<audio>` elements
play simultaneously in the Android WebView — that is all the layering we need — and per-element
`.volume` is all the level control we need, since SFX require no crossfading. It gets **no
`AudioContext` of its own and does not touch the music engine's** (an element can only ever be
attached to one `MediaElementSource`, so sharing is not an option anyway).

Ducking is therefore not a gain-graph operation but a volume ramp applied to the music engine's
existing master volume, which works identically on both of `CrossfadeEngine`'s paths.

### New `client/src/player/ramp.ts`

A tiny shared linear-ramp helper, used by both loop fades and ducking. Inject the clock so it
is unit-testable without jsdom:

```ts
export interface RampHandle { cancel(): void }
export function rampValue(
  from: number, to: number, ms: number,
  onStep: (v: number) => void,
  now: () => number = () => performance.now(),
  schedule: (fn: () => void, ms: number) => unknown = setInterval,
): RampHandle
```

### New `client/src/player/sfx.ts` — `SfxEngine`

React-free and unit-testable, in the same spirit as `CrossfadeEngine`.

```ts
export class SfxEngine {
  /** Element factory is injected so tests can pass fakes (no jsdom in this repo). */
  constructor(createAudio: () => HTMLAudioElement = () => new Audio()) {}

  /** 0..1 applied on top of every clip's own volume. */
  setMasterVolume(v: number): void;

  /** Fire a layered one-shot. Several may overlap. */
  playOneShot(url: string, volume: number): void;

  /** Start or restart a named ambience loop (key = the clip's signature). */
  startLoop(key: string, url: string, volume: number): void;
  setLoopVolume(key: string, volume: number): void;
  /** Fade out over `fadeSec` (default 1.5) then stop and release the element. */
  stopLoop(key: string, fadeSec?: number): void;
  stopAll(): void;
  activeLoops(): string[];

  /** True while ≥1 one-shot is sounding; drives ducking. Fires on both edges. */
  onOneShotActiveChange: ((active: boolean) => void) | null;
}
```

Implementation notes: keep a small pool of one-shot elements and reuse idle ones (creating an
element per press leaks in a long session); track a live-one-shot count and fire
`onOneShotActiveChange` only on 0→1 and 1→0; loops set `audio.loop = true` and fade in over
~0.8s via `rampValue`. Element `.volume` is always `clipVolume * masterVolume`.

### Ducking — a minimal addition to `PlayerProvider`

`PlayerApi` gains exactly one member (this is the only transport-adjacent API added in v1,
and it exists solely to serve ducking):

```ts
/** Temporarily scale playback level without changing the user's volume setting. */
setDuck: (factor: number) => void;
```

Hold the user volume and the duck factor in refs, push `volume * duck` into
`engine().setVolume(...)`, and ramp the transition with `rampValue` (dip over ~250ms, restore
over ~600ms) so the dip is not a jump. This needs **no change to `crossfade.ts`**.

### New `client/src/player/SfxProvider.tsx`

Context + `useSfx()` hook, following the `PlayerProvider` shape exactly (nullable context,
throwing accessor hook, engine held in a `useRef` so it survives route changes). Mounted in
`App.tsx` **inside** `PlayerProvider`, because it calls `usePlayer().setDuck`.

```ts
interface SfxApi {
  /** Clip signatures currently looping, for lighting up deck buttons. */
  activeLoops: string[];
  fire(clip: SfxClip, volume: number): void;
  /** Explicit start/stop as well as toggle — macros need to force a loop on or off
   *  rather than flip it (see `sfxLoop.mode` in commit 4). */
  toggleLoop(clip: SfxClip, volume: number): void;
  startLoop(clip: SfxClip, volume: number): void;
  stopLoop(sig: string): void;
  stopAllSfx(): void;
  masterVolume: number;
  setMasterVolume(v: number): void;
  duckAmount: number;
  setDuckAmount(v: number): void;
}
```

It wires `engine.onOneShotActiveChange = (active) => player.setDuck(active ? duckAmount : 1)`.
`masterVolume` and `duckAmount` persist via `kvGet/kvSet('deck', 'audio')` (see the namespace
note in commit 4) and are edited in Settings, not on the deck.

**Lifecycle, stated so it is not a surprise:** ambience loops survive route changes (the engine
lives in a root-level ref) and keep playing when the app is backgrounded, which is what you want
for ambience. They do **not** survive a reload or app restart — nothing about playback is
persisted anywhere in this app today, and v1 does not change that. After a reload, loop buttons
render "off", which matches reality.

---

## Commit 4 — Deck data model and storage

### New `shared/src/deck.ts`, re-exported from `shared/src/index.ts`

Add `export * from './deck.js';` to the barrel (and `'./sfx.js'` from commit 2) — note the
`.js` extension, which `shared/` requires. `deck.ts` needs
`import type { TagDimension } from './music.js';`.

```ts
export const DECK_SCHEMA_VERSION = 1;

export const DECK_COLORS = ['slate', 'amber', 'crimson', 'forest', 'indigo', 'plum'] as const;
export type DeckColor = (typeof DECK_COLORS)[number];

export const DECK_SIZES = ['1x1', '2x1'] as const;
export type DeckSize = (typeof DECK_SIZES)[number];

/** JSON-safe form of the music page's Filter, whose `dims` holds Sets. */
export interface SerializedFilter {
  dims: Partial<Record<TagDimension, string[]>>;
  minIntensity: number;
  search: string;
}

/** Everything a macro may contain. Split out so macros cannot nest — by construction, not
 *  by a runtime guard. */
export type LeafDeckAction =
  | { kind: 'musicFilter'; filter: SerializedFilter }
  | { kind: 'musicTrack'; sig: string; title: string }
  | { kind: 'sfxOneShot'; sig: string; name: string; volume: number }
  | { kind: 'sfxLoop'; sig: string; name: string; volume: number; mode: 'toggle' | 'start' | 'stop' }
  | { kind: 'navigate'; to: string }
  | { kind: 'openNote'; path: string }
  | { kind: 'openEntry'; packId: string; entryId: string };

export type DeckAction = LeafDeckAction | { kind: 'macro'; actions: LeafDeckAction[] };

export interface DeckButton {
  id: string;
  label: string;
  /** Emoji, matching the app's icon convention. */
  icon: string;
  color: DeckColor;
  size: DeckSize;
  action: DeckAction;
}

export interface DeckPage { id: string; name: string; buttons: DeckButton[] }
export interface DeckLayout { version: number; pages: DeckPage[] }

/** Tolerant load: never throws, drops malformed buttons, stamps the current version. */
export function migrateDeck(raw: unknown): DeckLayout;
```

`sig` fields hold `trackSignature(...)` values, never backend ids. `musicTrack.title` /
`sfx*.name` are cached copies so a button can still render a sensible label when the underlying
file is missing on this device.

**Why `sfxLoop` carries a `mode`.** A plain toggle is wrong inside a macro — pressing
"Tavern" twice must not silence the tavern. `mode` defaults to `'toggle'` for a standalone
button and to `'start'` inside a macro. It pays for itself immediately: `'stop'` lets a
scene macro end the *previous* scene's ambience, which is exactly what you want when the
party leaves the tavern for the road.

`migrateDeck` must be genuinely defensive — this doc arrives over Drive sync from another
device and may predate any schema change. Drop unrecognised action kinds and malformed buttons
rather than throwing; a corrupt deck must never white-screen the app's landing page.
Specifically: default a missing `sfxLoop.mode` to `'toggle'`, drop malformed entries *within*
a macro individually rather than discarding the whole button, and drop any nested macro that
arrives from a future schema version.

### Filter serialization — `client/src/music/filter.ts`

`Filter.dims` holds `Set`s, which `JSON.stringify` silently flattens to `{}`. Add the explicit
conversions next to the type they convert, and round-trip them in `client/test/filter.test.ts`:

```ts
export function toSerializable(f: Filter): SerializedFilter
export function fromSerializable(s: SerializedFilter): Filter
```

### Storage — new `client/src/deck/store.ts`

`kvGet`/`kvSet` under the synthetic namespace **`deck`** (keys `layout` and `audio`), exactly as
music tags use the synthetic `music` namespace. On web this lands in the SQLite `plugin_state`
table; on Android it is written through `setStateRaw`, which registers `state/deck/layout` in
`sync.state.index` — so **the deck syncs across devices via Google Drive for free**, with no
sync-engine changes at all.

```ts
export async function loadDeck(): Promise<DeckLayout>   // migrateDeck, falling back to starterDeck()
export function saveDeck(layout: DeckLayout): void      // 400ms debounce + 'ttrpg-local-changed'
```

### Starter deck — new `client/src/deck/starter.ts`

First launch must not show an empty grid. Seed one page, "Session", with navigation buttons
(Combat Tracker, Compendium, Prep Notes, Music) and three music-filter buttons built from
`DEFAULT_TAG_VOCAB` — battle/tense, peaceful/exploration, social. Do not seed SFX buttons; there
is no SFX library yet on a fresh install.

Seed one **macro** too — "Combat!" = the battle/tense filter + navigate to the tracker. It costs
nothing and it is how a new user discovers that a button can do more than one thing.

---

## Commit 5 — Deck UI

Files: `client/src/pages/DeckPage.tsx` (route component) plus a feature directory
`client/src/deck/` holding `store.ts`, `starter.ts`, `actions.ts`, `ButtonEditor.tsx` —
mirroring how `player/`, `music/`, `sync/` are organised.

### The action runner — `client/src/deck/actions.ts`

Keep it a plain function over injected dependencies so it is unit-testable with fakes, per
house style:

```ts
export interface DeckActionDeps {
  tracks: Track[];
  clips: SfxClip[];
  player: PlayerApi;
  sfx: SfxApi;
  navigate: (to: string) => void;
}
export function runDeckAction(action: DeckAction, deps: DeckActionDeps): void
```

- `musicFilter` → `fromSerializable`, `tracks.filter(t => matches(t, f))`, then
  `player.playQueue(shuffleTracks(filtered))`. Reuses `matches` from `client/src/music/filter.ts`
  and `shuffleTracks` from `PlayerProvider.tsx`. No-op if the filter matches nothing.
- `musicTrack` → resolve by signature, `player.playTrack(track)`.
- `sfxOneShot` → resolve by signature, `sfx.fire(...)`.
- `sfxLoop` → resolve by signature, then `toggleLoop` / `startLoop` / `stopLoop` per `mode`.
- `navigate` → `navigate(to)`.
- `openNote` → `navigate('/notes?path=' + encodeURIComponent(path))`.
- `openEntry` → `window.dispatchEvent(new CustomEvent('open-compendium-entry', { detail: { packId, entryId } }))`.
  `CommandPalette` is mounted app-wide and already listens for this, so it works from anywhere.
- `macro` → run every non-`navigate` action in order, then at most one `navigate` **last**, so
  navigation cannot pre-empt the rest. Every leaf action is synchronous, and `PlayerProvider` /
  `SfxProvider` live at the root, so audio a macro starts survives the navigation that follows it.

**Small enabling change:** `client/src/pages/NotesPage.tsx` currently keeps its selection in
`useState` and is not deep-linkable. Read an optional `?path=` via `useSearchParams` on mount to
preselect the note. This is a few lines and makes notes linkable generally.

### Grid, tabs, edit mode — `DeckPage.tsx`

- Page tabs across the top (`.deck-tabs`), one per `DeckPage`. Add / rename / delete / reorder
  pages only in edit mode.
- CSS Grid: `grid-template-columns: repeat(auto-fill, minmax(96px, 1fr))`; a `2x1` button gets
  `grid-column: span 2`. Buttons render icon over label, colour from `DeckColor` mapped to CSS
  custom properties defined in the new styles block. Minimum 88px tall — these are meant to be
  hit without looking.
- A loop button whose signature is in `sfx.activeLoops` renders lit (`.deck-btn-on`), giving the
  deck live state.
- A button whose referenced track/clip is missing on this device renders dimmed with a `⚠`, and
  does nothing when pressed. Expected on a device that has the synced deck but not the audio file.
- **Edit mode** is an explicit toggle in `.page-header` (`✎ Edit` / `✓ Done`). Out of edit mode,
  pressing a button fires its action and drag is disabled. In edit mode, pressing opens the
  editor and buttons are draggable. This separation is the whole point — nothing should move by
  accident mid-session.

### Drag and drop — add `@dnd-kit`

The repo has no DnD dependency. Hand-rolling touch-correct dragging in an Android WebView is
a real trap; add `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` to
`client/package.json`. They are pure JS and do not affect the Capacitor build.

Use `DndContext` + `SortableContext` with `rectSortingStrategy` over the flat button array, and a
`PointerSensor` with `activationConstraint: { distance: 8 }` so a tap still registers as a press
rather than a drag. Enable the sensors **only in edit mode**.

### Button editor — `client/src/deck/ButtonEditor.tsx`

A modal reusing `.palette-backdrop`. Fields: label, emoji (plain text input, 1–2 chars), colour
swatches, size toggle, action kind select, then kind-specific pickers.

> **Structure this deliberately, it is the load-bearing decision here.** Extract the per-kind
> portion into its own reusable `ActionForm` component — an action kind select plus that kind's
> picker, editing one `LeafDeckAction`. A plain button renders a single `ActionForm`; a macro
> button renders a reorderable list of them. Built as one flat form with a `switch` in the
> middle instead, macro support means restructuring the whole editor later.

The per-kind pickers:

- **musicFilter** — the same tag chips the Music page uses. Extract that chip row out of
  `MusicPage.tsx` into `client/src/music/FilterChips.tsx` and use it in both places rather than
  duplicating it.
- **musicTrack** — searchable list over `useQuery(['tracks'])`.
- **sfxOneShot / sfxLoop** — searchable list over `useQuery(['sfx'])` grouped by folder, plus a
  volume slider and a ▶ preview button that calls the engine directly.
- **navigate** — a select built from `CORE_NAV` plus the enabled plugins' nav items
  (`availableClientPlugins` from `client/src/plugins.ts`).
- **openNote** — picker over `backend().listNotes()`.
- **openEntry** — reuses `compendiumIndex.search()` from `client/src/compendium.ts`.

**Macro buttons** render a reorderable list of `ActionForm`s with add/remove, reusing the same
dnd-kit sortable machinery as the grid. Constraints enforced in the editor, not at runtime: at
most one music action and at most one navigate action per macro (a second of either is
meaningless — last would simply win), and a cap of 8 actions so the form stays legible. New
`sfxLoop` rows added inside a macro default to `mode: 'start'`; standalone ones to `'toggle'`.

---

## Commit 6 — Routing, nav, settings, styles, README

- `client/src/App.tsx` — `/` → `DeckPage`, new `/music` → `MusicPage`. `CORE_NAV` becomes
  `[{ '/', 'Deck', '🎛️' }, { '/music', 'Music', '🎵' }, { '/notes', 'Prep Notes', '📓' }]`;
  keep `end={item.path === '/'}` on the NavLink. Wrap the shell in `<SfxProvider>` inside
  `<PlayerProvider>`.
- `client/src/pages/SettingsPage.tsx` — a new "Sound effects" block: the SFX folder picker
  (reuse the `FolderPicker` pattern from `MusicPage.tsx` — extract it to
  `client/src/music/FolderPicker.tsx` and parameterise it over the two selections rather than
  copying it), a "Rescan sound effects" button, an SFX master volume slider, and the global
  duck-amount slider.
- `client/src/styles.css` — append `/* --- stream deck --- */` and `/* --- sfx --- */` sections
  after the existing `/* --- party roster & encounters --- */` block. Add deck rules to the
  `max-width: 759px` block: fewer, larger columns on phones.
- `README.md` — a "Stream deck" bullet under Features and a short section explaining pages,
  edit mode, and the three button kinds; `sfxFolders` in the config example plus a line on
  pointing it at a sound-effects folder; the MediaStore `IS_MUSIC` caveat; and a note that the
  deck syncs across Android devices like notes do.

---

## Commit 7 — Transient overlay (prerequisite for the two below)

The app has **no toast or notification system at all**. Transient feedback today is
`window.alert` / `window.confirm` / `window.prompt` plus inline text. A dice result and a
counter reset both need somewhere to go, so build the overlay once, first.

New `client/src/components/Toast.tsx`, following the app's window-CustomEvent convention
exactly — a `ttrpg-toast` event and a `<ToastHost />` mounted once in `App.tsx` beside
`CommandPalette`:

```ts
export function showToast(msg: { title: string; detail?: string; ttlMs?: number }): void
```

Bottom-centre, above the player bar. Auto-dismiss ~3.5s (5s for rolls), tap to dismiss,
stacks at most 3, `aria-live="polite"`. Keep the detail serializable — no ReactNodes
through the event. Styles copy the existing `.entry-panel` / `.palette-backdrop` patterns
already in `styles.css`.

---

## Commit 8 — Counters and clocks on button faces

Torches burning, rations, arrows, legendary resistances, a doom clock, "rounds until the
ritual completes". This is the feature that makes the deck something you *read* rather
than only press. There is no generic counter primitive today — every counter in the app
(round, death saves, exhaustion, HP, intensity) is domain-specific.

New `DeckAction` variant in `shared/src/deck.ts`:

```ts
| { kind: 'counter'; counterId: string; initial: number; step: number;
    min: number | null; max: number | null; wrap: boolean }
```

**Values live separately from layout.** Button config stays in `deck:layout`; counter
*values* go in a second doc `deck:counters` (`Record<string, number>`), so pressing a
button does not rewrite the whole layout and the two sync independently. Both ride the
existing `deck` kv namespace — still no sync-engine changes.

New `client/src/deck/counters.ts`:

```ts
/** Pure: clamp to min/max, or wrap around when `wrap`. The unit-testable core. */
export function bumpCounter(state: CounterState, id: string, step: number,
                            opts: { min: number | null; max: number | null; wrap: boolean }): CounterState
export async function loadCounters(): Promise<CounterState>
export function saveCounters(state: CounterState): void   // 400ms debounce + 'ttrpg-local-changed'
```

Behaviour:
- The button face renders the value large, above the label.
- Press = `+step`. **Long-press = reset to `initial`**, acknowledged with a toast so the
  reset is never silent.
- Long-press applies only *outside* edit mode, so it cannot collide with dnd-kit's
  `PointerSensor`, which is enabled only *inside* edit mode. Keep that separation strict.
- Two buttons may deliberately share a `counterId` — bump it on one page, read it on
  another. Do not de-duplicate them.

---

## Commit 9 — Dice roller

The app has no dice module, no expression parser, and no advantage/crit/damage logic. Its
entire randomness is two **duplicated, module-private** helpers —
`plugins/dnd5e/src/TrackerPage.tsx:20` and `plugins/dnd5e/src/rosters.ts:38`, both
`1 + Math.floor(rng() * 20)`.

New pure `shared/src/dice.ts`, with an injectable RNG in the established style of
`instantiate(enc, party, rng = Math.random)` (`plugins/dnd5e/src/rosters.ts:50`):

```ts
export interface DiceTerm { count: number; sides: number; keep?: { mode: 'h' | 'l'; n: number } }
export interface DiceFormula { terms: DiceTerm[]; modifier: number }
export interface DiceResult {
  formula: string; total: number; modifier: number;
  rolls: { sides: number; values: number[]; kept: boolean[] }[];
}

/** Returns null on invalid input — never throws. */
export function parseDice(input: string): DiceFormula | null;
export function rollDice(f: DiceFormula, rng: () => number = Math.random): DiceResult;
export function formatDiceResult(r: DiceResult): string;
export function d20(rng?: () => number): number;
```

Grammar: `NdM`, `dM` (count defaults to 1), `+K` / `-K`, several terms (`1d8+2d6+3`), and
keep-highest / keep-lowest (`4d6kh3`, `2d20kl1`). **Advantage and disadvantage fall out of
`2d20kh1` / `2d20kl1`** — they need no separate concept.

New `DeckAction` variant, with an optional target number:

```ts
| { kind: 'roll'; formula: string; label: string; dc?: number }
```

The result goes to the toast from commit 7: total large, breakdown small, and
`17 vs DC 15 — success` when `dc` is set. A persistent roll log is deliberately deferred.

**De-duplicate while here:** replace both private `d20()` copies with the shared one.
Keep `instantiate`'s injectable-`rng` parameter exactly as it is so
`plugins/dnd5e/test/rosters.test.ts` keeps passing unchanged.

Editor support: the button editor gets a formula field that validates live via
`parseDice` (invalid input disables save), an optional DC field, and a 🎲 preview button.

---

## Tests

Logic-only Vitest units in `client/test/` (remember: `client/tsconfig.json` includes only
`src`, so `client/test` is **not** typechecked — keep test code simple).

| File | Covers |
| --- | --- |
| `client/test/deck.test.ts` | `migrateDeck` tolerance (missing version, unknown action kind, malformed button, non-object input), plus macro cases: a nested macro is dropped, a malformed entry inside a macro is dropped without losing the button, missing `sfxLoop.mode` defaults to `'toggle'`; `starterDeck()` shape |
| `client/test/filter.test.ts` (extend) | `toSerializable`/`fromSerializable` round-trip, incl. empty dims and unicode search |
| `client/test/deckActions.test.ts` | `runDeckAction` for every kind, against fake `player`/`sfx`/`navigate`; missing-signature cases are no-ops; `sfxLoop` honours all three `mode` values; a macro runs its actions in order with `navigate` last |
| `client/test/sfxEngine.test.ts` | Layering, loop start/stop/volume, `onOneShotActiveChange` edges — using an injected fake audio-element factory |
| `client/test/ramp.test.ts` | `rampValue` with injected clock and scheduler |
| `client/test/musicFolders.test.ts` (extend) | SFX opt-in semantics: no stored selection ⇒ empty, not all |
| `client/test/counters.test.ts` | `bumpCounter` — clamp at min/max, wrap-around, negative steps, unknown id starts from `initial` |
| `client/test/dice.test.ts` | `parseDice` (`d20`, `2d6+3`, `1d8+2d6+3`, `4d6kh3`, `2d20kl1`, whitespace, invalid ⇒ `null`), `rollDice` against a seeded fake RNG, keep-h/l picks the right dice, `formatDiceResult` |
| `server/test/sfx.test.ts` | Scan add/remove diffing against a temp directory (this workspace *is* typechecked) |

---

## Verification

1. `npm run typecheck && npm test` at the repo root — both must be clean. CI runs neither, so
   this is the only gate.
2. `npm run dev`, open http://localhost:5173:
   - The deck is the landing page and shows the starter buttons; Music is at `/music` and still
     works (filter chips, play, tag editor, folder picker).
   - Edit mode: add a page, add one button of each action kind, drag to reorder, rename and
     delete a page. Reload — everything persists.
   - **Macros:** build a "Tavern" button — start the crowd ambience + a social music filter +
     open the tavern note. Press it **twice** and confirm the ambience keeps playing rather
     than toggling off (this is what `mode: 'start'` buys). Then build a "Back on the road"
     macro that stops that loop and starts another, and confirm the handover is clean.
   - Point `sfxFolders` in `config.json` at a folder of short clips, rescan in Settings, then
     bind a one-shot and a loop button.
   - **The core acceptance test:** start music from a filter button, fire a one-shot — the clip
     is audible *over* the music and the music dips and recovers. Start two ambience loops — both
     sound at once, on top of the music, and their buttons light up. Navigating between views
     does not interrupt them.
3. Android: `npm run build -w client && cd client && npx cap sync android && cd android &&
   ./gradlew assembleDebug`. The build must succeed with the Cast SDK and NanoHTTPD removed.
   On device, verify separately that SFX layering and ducking work in the WebView — this is the
   path where Web Audio may be unavailable, and the reason `SfxEngine` avoids it. Also confirm
   the SFX folder picker sees the clips folder (see the `IS_MUSIC` caveat).
4. Deck sync: with Drive connected on two Android devices, edit the deck on one and confirm it
   appears on the other after a sync.
5. Counters: bind a counter button (initial 4, step −1, min 0), press it four times and confirm
   the face counts down and stops at 0; long-press and confirm it resets to 4 with a toast.
   Reload — the value persists. Bind a second button to the same `counterId` on another page
   and confirm both show the same value.
6. Dice: bind `2d6+3`, `4d6kh3` and `2d20kh1`, and one with a DC. Confirm the toast shows the
   total, the breakdown, which dice were kept, and success/failure against the DC. Type an
   invalid formula in the editor and confirm save is disabled rather than the app throwing.
   Confirm rolling initiative in the tracker and starting an encounter still work after the
   `d20()` de-duplication.

## Recorded decisions — agreed, not scheduled

**Combat-tracker verbs** (next turn, previous turn, start encounter X, damage/heal the current
combatant, apply/clear conditions, short/long rest, end combat) are **not planned yet**. When
they are picked up, the agreed approach is a contribution point on `ClientPlugin`:

```ts
actions?: { id: string; label: string; icon: string; run(runtime: PluginRuntime): void }[]
```

so the deck lists whatever the enabled plugins offer and stays system-agnostic. The rejected
alternative was having core deck code import `@ttrpgapp/plugin-dnd5e` directly — faster to
ship, but it hard-codes game-system knowledge into core and breaks the `PluginRuntime` boundary
the repo deliberately maintains. Recorded so it is not re-litigated.

Two notes for whoever picks that up:
- **`previousTurn` does not exist** in the tracker at all.
- The tracker's verbs are closures inside `TrackerPage` JSX with a single `update(fn)` funnel
  (`TrackerPage.tsx:42-54`); they would want extracting as pure `(Encounter) => Encounter`
  reducers beside `sortedCombatants` in `plugins/dnd5e/src/trackerTypes.ts` first.
- No new plumbing is needed to *drive* the tracker: `EncountersPage.tsx:103-112` shows the whole
  trick — `kvSet` the encounter, then dispatch `ttrpg-local-changed` + `ttrpg-sync-updated`, and
  a mounted `TrackerPage` reloads itself. `instantiate()` is already exported and pure.

## Deliberately not in scope

Transport / panic / stop-all buttons, deck volume sliders, "pin current filter to deck" from the
Music page, per-button ducking overrides, restoring ambience loops after a reload, timers,
random generators from the SRD pack, a persistent roll log, and a player-facing full-screen
display. Each is a clean follow-up on top of the structures above — `DeckAction` is a
discriminated union precisely so new kinds are additive.

## Unrelated bug noticed while planning

`plugins/dnd5e/src/TrackerPage.tsx:168` is a no-op in both branches:

```ts
concentration: sign < 0 && prev.concentration ? prev.concentration : prev.concentration
```

It appears to have been meant to flag a concentration check when a combatant takes damage.
The visible consequence is that a combatant dropped to 0 HP keeps its concentration flag,
which 5e ends outright. Logged as entry 3 in `bugs.md`; not fixed, because whether it should
clear concentration or prompt for the Constitution save is a rules call, not a mechanical
one. Unrelated to the deck — do not fix it as part of these commits.

---

## Appendix — prompts for driving this

*For the person running the implementation, not for the implementing agent.*

Each session starts cold, which is why every prompt begins by pointing at this file. One
reusable template covers all nine commits — the per-step detail is already above, and
duplicating it into nine bespoke prompts would only let the two drift apart:

```
Read plan.md in the repo root. Implement Commit N — <title>. Only that commit.

Follow the "Notes for the implementing agent" section at the top of the file.

When you're done:
1. Run `npm run typecheck && npm test` at the root — both must pass before you commit
2. Commit with a message saying what changed and why
3. Report back: what you did, anything in the plan that was wrong or
   underspecified, and what you chose instead
```

Step 3 matters. This plan was written without running the code, so it will have defects;
the point is for each session to surface them rather than quietly work around them — that
is how you learn commit 2's backend signatures do not quite fit *before* commit 5 depends
on them.

**Two commits are worth a checkpoint before any code exists.** Append to the template:

- **Commit 3** — *"Before writing code, explain how the duck factor and the user's volume
  combine, and what happens on the Android fallback path where Web Audio is unavailable.
  Wait for my go-ahead."*
- **Commit 5** — *"Before writing code, show me the component breakdown — specifically how
  `ActionForm` is factored so that a plain button and a macro row share it. Wait for my
  go-ahead."*

These interrogate the approach rather than instruct it, which is why they belong in a
prompt rather than in the plan.

> If you find yourself wanting to write a long prompt for some commit, that is a sign the
> **plan** is thin there, not that the prompt needs to be fatter. Fix the plan instead — it
> stays in sync, and the next session gets the improvement for free.
