# TTRPG Companion

A game master's companion for the table: ambient music, session prep notes,
and optional game-system plugins (rules compendium, combat tracker). It runs
two ways from one codebase — as an **Android app** (everything on-device) or as
a **local web app** on a computer. Your music and notes never leave the device.

## Repository layout

An npm-workspaces monorepo. One codebase builds both the Android app and the
local web app; shared logic lives in `shared/`.

```
shared/          types, plugin interfaces, compendium search, music-tag heuristics
server/          Fastify API + SQLite — the web/desktop backend
  scripts/       maintenance CLIs (music auto-tagger — see "Auto-tagging" below)
client/          React + Vite UI, plus the Capacitor Android wrapper (client/android/)
plugins/dnd5e/   the D&D 5e system plugin (SRD compendium + combat tracker)
config.json      web/desktop config: music folders, notes vault, plugins, autotag
```

The **auto-tagger** is a server-side CLI (`server/scripts/autotag.ts`, with pure
heuristics in `shared/src/autotag.ts`), not part of the app itself — it writes
tags into the same store the app reads. See
[Auto-tagging music](#auto-tagging-music-offline-local-model).

## Android app

The Android build stores nothing on a server: notes are markdown files on the
device, and music is read from your device's own audio library.

- **Install:** grab the debug APK from the latest **Android debug APK** run
  under the repo's GitHub → Actions tab (artifact `ttrpg-companion-debug`),
  copy it to your device, and open it (allow "install from unknown sources").
- **First launch:** the app asks for permission to read audio; grant it, then
  tap **Rescan library** in the Music view to index your tracks.
- **Where things live:** prep notes are markdown under
  `Android/data/ch.rytz.ttrpgapp/…/vault/` (visible in a file manager, so you
  can back them up or edit them elsewhere); tags and combat state are kept in
  app storage.

Building the APK locally needs the Android SDK:

```bash
npm ci
npm run build -w client
cd client && npx cap sync android
cd android && ./gradlew assembleDebug
# → client/android/app/build/outputs/apk/debug/app-debug.apk
```

CI builds this automatically (`.github/workflows/android.yml`).

## Cross-device sync (Android, Google Drive)

Prep notes and combat/tracker state sync across your devices through **your own
Google Drive** — local-first, so the app keeps working fully offline and
reconciles when it's online. Files land in a visible `TTRPG Companion` folder in
your Drive (minimal `drive.file` scope: the app only ever sees files it created).
Music files and tags don't sync (audio stays per-device).

**How it reconciles:** two-way, last-write-wins by timestamp. If the same note is
edited on both devices while offline, the loser is kept as
`<name> (conflict <date>).md` so nothing is lost. Syncs on launch, on returning
to the app, a few seconds after edits, periodically, and on **Sync now** in
Settings.

**One-time Google setup** (free, personal use), then enter the client ID in the
app's Settings → *Cross-device sync*:

1. In the [Google Cloud Console](https://console.cloud.google.com/): create a
   project and **enable the Google Drive API**.
2. Configure the **OAuth consent screen**: User type *External*, publishing
   status *Testing*, and add your own Google account under *Test users* (no
   Google verification review is needed in testing mode).
3. Create an **OAuth client ID** → application type *Android*, package name
   `ch.rytz.ttrpgapp`, and the signing certificate **SHA-1 fingerprint**:

   ```
   D8:CC:78:83:45:E6:1A:41:D9:84:8E:55:E2:B7:CE:8A:3B:DD:C9:4F
   ```

   The debug APK is signed by a **fixed, committed keystore**
   (`client/android/app/ttrpg-debug.keystore`, wired in `app/build.gradle`), so
   this SHA-1 is stable across machines and CI — register it once. (Re-derive it
   any time with
   `keytool -list -v -keystore client/android/app/ttrpg-debug.keystore -storepass android -alias androiddebugkey`.)
   Then open the client's **Advanced settings** and enable **Custom URI scheme**
   — it is off by default on new Android clients, and the app's
   `ch.rytz.ttrpgapp:/oauth` redirect needs it (without it Google answers the
   sign-in with *Error 400: invalid_request*).
4. Put the resulting client ID in **Settings → Connect Google Drive** (or bake it
   in at build time via `VITE_GOOGLE_CLIENT_ID`), then tap **Connect**.

Repeat step 4 on each device with the same Google account, and they'll converge.
One gotcha worth knowing: while publishing status is *Testing*, Google expires
refresh tokens after 7 days, so sync stops until you reconnect. Publishing the
app (Testing → Production) avoids that — with only the non-sensitive
`drive.file` scope it should not need a verification review.

Other providers (Dropbox, self-hosted WebDAV) can be added later — the sync
engine is provider-agnostic (`client/src/sync/`), Google Drive is the first
`SyncTarget`.

## Local web app

```bash
npm install
npm run dev
```

Open http://localhost:5173. The Fastify API listens on port 8787. Configure via
`config.json` (overridable by a gitignored `config.local.json`):

```json
{
  "musicFolders": ["./music"],
  "notesVault": "./vault",
  "dataDir": "./data",
  "plugins": { "dnd5e": true }
}
```

Paths are relative to the repo root. Point `musicFolders` at your audio library
and hit **Rescan library**.

## Features

- **Music** — tracks tagged along theme / mood / landscape dimensions plus an
  intensity rating (1–5). Filter chips build a shuffled queue; playback
  crossfades between tracks via a dual-deck engine (Web Audio, with an
  audio-volume fallback for WebViews). A player bar persists across all views.
- **Prep notes** — markdown notes. New sessions start from `template.md`
  (`{{title}}` / `{{date}}` placeholders filled in). `[[wiki-links]]` connect
  sessions to NPC/location notes; the read-only **Play view** shows a session
  with collapsible sections for glancing at the table.
- **⌘K / Ctrl+K** (or the 🔎 button) — quick rules search from anywhere.
- **D&D 5e plugin** — SRD 5.1 compendium (spells, monsters, conditions,
  equipment, magic items, rules; CC-BY-4.0 via
  [5e-bits/5e-database](https://github.com/5e-bits/5e-database)) and a combat
  tracker: initiative, HP, AC, the 5e conditions incl. exhaustion levels,
  concentration, death saves, and add-monster-from-SRD with inline stat blocks.
  Encounter state survives reloads. A **Party** roster stores reusable PCs and
  a **Encounters** library lets you pre-build fights from SRD monsters and
  **Start** one — rolling initiative and loading the tracker with the chosen
  party members. (Party and encounters sync across devices like everything else.)

- **Cross-device sync** (Android) — notes and combat state kept in step across
  your phone and tablet through your own Google Drive, offline-first. See
  [Cross-device sync](#cross-device-sync-android-google-drive).

The UI is responsive: phones get a drawer nav, bottom sheets, and card-based
tracker; tablets and desktop keep the wide side-by-side layout.

## Architecture

The React client talks to a `Backend` interface, with two implementations
selected at startup (`client/src/backend/`):

- **HttpBackend** — the Fastify server (`server/`), for the web/desktop mode.
- **CapacitorBackend** — on-device storage for Android: `@capacitor/filesystem`
  for the notes vault, `@capacitor/preferences` for plugin state, and a native
  `MusicLibrary` plugin (`client/android/…/MusicLibraryPlugin.java`) that reads
  audio from MediaStore.

Compendium search runs entirely client-side over an in-memory index
(`shared/src/compendiumSearch.ts`) fed by plugin-bundled packs, so it works
identically in both modes and offline.

### Sync (`client/src/sync/`)

Sync is local-first and provider-agnostic. A `SyncEngine` (`engine.ts`)
reconciles a `SyncStore` (the device's notes + plugin state) against a
`SyncTarget` (Google Drive today) using two-way last-write-wins with conflict
copies and tombstones — all pure logic, unit-tested against in-memory fakes. The
`SyncManager` (`manager.ts`) drives it on the Android build (launch, app resume,
post-edit debounce, periodic, manual) and refreshes open views via query
invalidation. It's inert on web, where the server is already the shared store.

### Game-system plugins

System-specific content and tools live in `plugins/*`, enabled per config. A
plugin implements `ClientPlugin` (`@ttrpgapp/shared/plugin-client`: nav items,
views, and bundled compendium packs) and a minimal `ServerPlugin`
(`@ttrpgapp/shared/plugin-server`: identity only). Plugin views reach host
services — persistent key/value state, compendium search, the entry panel —
through the `PluginRuntime` bridge. Register a plugin in
`client/src/plugins.ts` (and `server/src/pluginHost.ts`). The `dnd5e` plugin is
the reference implementation.

To rebuild the SRD pack from upstream: `npm run build-srd`.

## Auto-tagging music (offline, local model)

Tagging a large library by ear is slow, so `npm run autotag` does it in bulk. It
runs on the computer (web/desktop mode) over the scanned library and writes tags
straight into the same store the app reads — **the app itself is unchanged**;
tags just appear in the Music view. It combines deterministic keyword/folder
heuristics with a **local LLM in [LM Studio](https://lmstudio.ai/)** (nothing
leaves your machine).

Setup: in LM Studio, load a model (e.g. Gemma) and start its **local server**
(Developer tab → Start Server, default `http://localhost:1234`). Point the
`autotag` block in `config.json` at it:

```json
"autotag": { "endpoint": "http://localhost:1234/v1", "model": "google/gemma-4-12b", "useLlm": true }
```

Point `musicFolders` in `config.json` at your library (forward slashes on
Windows, e.g. `"D:/DnD"`), then:

```bash
npm run autotag -- --test            # check LM Studio is reachable + model loaded
npm run autotag -- --scan --dry-run  # index the library + preview tags, write nothing
npm run autotag -- --scan            # index the library + tag untagged tracks
npm run autotag                      # tag untagged tracks (library already scanned)
npm run autotag -- --all             # re-tag everything
npm run autotag -- --folder Combat   # limit to a folder
npm run autotag -- --no-llm          # heuristics only (no model needed)
```

`--scan` indexes `musicFolders` first, so you don't need to open the web app to
populate the library. Omit it once the library is scanned.

Writing is **additive** — it only adds tags to dimensions it has suggestions for
and never wipes your manual tags. Getting these tags onto the Android device is a
separate future step (tags are per-device today).

## Development

```bash
npm run typecheck   # all workspaces
npm test            # vitest (all workspaces)
```

Workspaces: `shared` (types, plugin interfaces, compendium search), `server`
(Fastify, better-sqlite3), `client` (React + Vite + Capacitor), `plugins/dnd5e`.
