# TTRPG Companion

A local web app for game masters at the table: ambient music, session prep
notes, and optional game-system plugins (rules compendium, combat tracker).
Runs entirely on your machine — your music and notes never leave it.

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:5173. The Fastify API listens on port 8787.

## Configuration

`config.json` (overridable by a gitignored `config.local.json`):

```json
{
  "musicFolders": ["./music"],
  "notesVault": "./vault",
  "dataDir": "./data",
  "plugins": { "dnd5e": true }
}
```

Paths are relative to the repo root. Point `musicFolders` at your audio
library and hit **Rescan library** in the Music view.

## Features

- **Music** — tracks tagged along theme / mood / landscape dimensions plus an
  intensity rating (1–5). Filter chips build a shuffled queue; playback
  crossfades between tracks via a dual-deck Web Audio engine. The player bar
  persists across all views.
- **Prep notes** — markdown files in your vault. New sessions are created from
  `template.md` (`{{title}}` / `{{date}}` placeholders are filled in).
  `[[wiki-links]]` connect sessions to NPC/location notes; the read-only
  **Play view** shows a session with collapsible sections for use at the table.
- **⌘K / Ctrl+K** — quick rules search from anywhere (whatever the enabled
  plugins provide).
- **D&D 5e plugin** — SRD 5.1 compendium (spells, monsters, conditions,
  equipment, magic items, rules; CC-BY-4.0 via
  [5e-bits/5e-database](https://github.com/5e-bits/5e-database)) and a combat
  tracker: initiative, HP, AC, the 5e conditions incl. exhaustion levels,
  concentration, death saves, and add-monster-from-SRD with inline stat
  blocks. Encounter state survives reloads.

## Game-system plugins

Rules content and system-specific tools live in plugins (`plugins/*`), toggled
in `config.json`. A plugin implements `ServerPlugin`
(`@ttrpgapp/shared/plugin-server`: compendium packs + API routes) and
`ClientPlugin` (`@ttrpgapp/shared/plugin-client`: nav items + views), and is
registered in `server/src/pluginHost.ts` and `client/src/plugins.ts`. The
`dnd5e` plugin is the reference implementation; other systems can be added the
same way.

To rebuild the SRD pack from upstream: `npm run build-srd`.

## Development

```bash
npm run typecheck   # all workspaces
npm test            # vitest (all workspaces)
```

Workspaces: `shared` (types + plugin interfaces), `server` (Fastify,
better-sqlite3), `client` (React + Vite), `plugins/dnd5e`.
