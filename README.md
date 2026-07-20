# TTRPG Companion

A game master's companion for the table: ambient music, session prep notes,
and optional game-system plugins (rules compendium, combat tracker). It runs
two ways from one codebase — as an **Android app** (everything on-device) or as
a **local web app** on a computer. Your music and notes never leave the device.

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
   `ch.rytz.ttrpgapp`, and the signing certificate SHA-1 fingerprint
   (`keytool -list -v -keystore <your.keystore>`; use the debug keystore's SHA-1
   for the debug APK).
4. Put the resulting client ID in **Settings → Connect Google Drive** (or bake it
   in at build time via `VITE_GOOGLE_CLIENT_ID`), then tap **Connect**.

Repeat step 4 on each device with the same Google account, and they'll converge.
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

## Development

```bash
npm run typecheck   # all workspaces
npm test            # vitest (all workspaces)
```

Workspaces: `shared` (types, plugin interfaces, compendium search), `server`
(Fastify, better-sqlite3), `client` (React + Vite + Capacitor), `plugins/dnd5e`.
