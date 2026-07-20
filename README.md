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
  Encounter state survives reloads.

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
