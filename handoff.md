# Handoff — cross-device music tags

State as of 2026-07-22. Continuing locally on Windows (Node 22, PowerShell).
`git pull origin claude/ttrpg-app-brainstorm-xd85xt` before starting.

## What this change does

Made music tags portable and syncable across desktop → phone → tablet. Tags used
to be keyed by **file path**, which every device stores differently, so they
couldn't travel. Now they're keyed by a **device-independent signature** and the
Android tag catalog is a **synced document** (rides the existing Drive engine).

- **Signature** = base filename (no dir, no ext, lowercased) + duration rounded
  to the second, e.g. `goblin ambush|212`. `trackSignature()` in
  `shared/src/music.ts`. Desktop duration (music-metadata) and Android duration
  (MediaStore ms ÷ 1000) are both seconds, so they line up.
- **Desktop → devices**: `npm run export-tags` re-keys your already-tagged DB
  into a portable `music-tags.json` (no LLM, no DB writes). Copy it to a device,
  then **Settings → Import music tags**. It merges and syncs to your other device.
- **Android storage**: tags now live in Preferences as sync doc `state/music/tags`
  (synthetic `music` namespace), keyed by signature. A legacy path-keyed
  `music-tags.json` on-device is auto-migrated on first read.

## To use it (your workflow)

1. On the computer, after tagging: `npm run export-tags` → `./music-tags.json`.
2. Get that one file onto the phone (USB / Drive download / etc.).
3. In the app: **Settings → Import music tags** → pick the file. Done — it syncs
   to the tablet on its own.

Note: copying the raw `.db` to Drive does **not** work — the phone can't read
SQLite, and the sync engine ignores any Drive file lacking its own
`appProperties.syncId` marker (so a manual drag-drop into the Drive folder is
invisible to sync). Use the export/import path above.

## What changed (files)

- `shared/src/music.ts` — `trackSignature()`, `MusicTagCatalog`, `TrackTagEntry`.
- `server/scripts/export-tags.ts` — new; `npm run export-tags`. Re-keys DB tags
  by signature → `music-tags.json`. Merges signature collisions.
- `client/src/backend/capacitor.ts` — tags keyed by signature; catalog is the
  synced `state/music/tags` doc; legacy-file migration; `importMusicTags()`;
  `notifyLocalChanged()` guard (backend can run without a DOM).
- `client/src/pages/SettingsPage.tsx` — **Import music tags** section (native).
- `client/src/sync/manager.ts` — invalidate `['tracks']` on synced change.
- Tests: `server/test/signature.test.ts` (7), new cases in
  `client/test/capacitorBackend.test.ts` (signature stability, import, migration).
- `README.md` — export/import flow + signature scheme.

Also (earlier this session): `server/scripts/autotag.ts` now prints the LM Studio
error body on non-200 responses.

## Verify

`npm run typecheck` and `npm test` are green here (server 20, client 44,
dnd5e 13). `npm run build -w client` bundles clean.

Quick local sanity for export (Windows), against your real tagged DB:
```powershell
npm run export-tags
Get-Content .\music-tags.json -TotalCount 20
```

## Known caveats / possible follow-ups

- **Single-file catalog, whole-doc LWW.** If you edit *different* tracks on two
  devices while both offline, the last sync wins the whole catalog and the other
  device's edits to other tracks are lost. Rare for tagging (bulk on desktop,
  occasional tweaks). If it ever bites, split to per-signature sync docs
  (`music/<sig>`) so each track merges independently — the engine already does
  per-doc LWW, so it's a store-shape change, not an engine change.
- **Duration rounding boundary.** A track whose duration sits right on an `X.5`
  second boundary could round differently between two sources and miss the match.
  Uncommon; if you spot untagged tracks that clearly were tagged, this is the
  suspect. Mitigation would be a ±1s tolerant match.
- **Import file picker** uses a hidden `<input type=file>` → Android document
  picker. Verify it opens on-device (works in the Capacitor WebView; untested on
  hardware here).

## Task board (this session)

#16 signature + types ✓  #17 export-tags ✓  #18 Android re-key + sync ✓
#19 Import UI ✓  #20 verify/README/push (in progress — push is the last step).
