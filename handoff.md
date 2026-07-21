# Handoff — music auto-tagging (local session)

State as of 2026-07-21. Switching from the cloud session to running Claude Code
locally on Windows. This captures exactly where things stand so the local
session can pick up without re-deriving anything.

## Branch

Work continues on **`claude/ttrpg-app-brainstorm-xd85xt`**. Latest pushed commit
surfaces the LM Studio error body (see below). `git pull` before starting.

## Where we are

The standalone auto-tagger (`npm run autotag`, task #15) is built and runs on the
Windows machine. Both blockers below are resolved; one is in progress.

- ✅ **better-sqlite3 native binding** — was failing on Node 24 (no prebuild for
  ABI v137). Fixed by switching to **Node 22 LTS**. The binary now lives at
  `node_modules\better-sqlite3\build\Release\better_sqlite3.node`.
- ✅ **Heuristics path works** — a `--scan --dry-run` over the real library
  (`D:/DnD`, ~92 tracks incl. the Curse of Strahd soundtrack) produces sensible
  folder/keyword tags with `--no-llm` or when the LLM is skipped.
- ⏳ **LLM half fails with `400 Bad Request` on every call.** Being identical
  every time, it's a malformed-request issue, not per-track. Diagnosis in
  progress — see next section.

## Immediate task: fix the LM Studio 400

The script now includes LM Studio's response body in the `! LLM failed` line
(commit already pushed), so a re-run shows the real reason. Fastest check, no
re-run needed — hit the endpoint directly in PowerShell:

```powershell
curl.exe -s http://localhost:1234/v1/chat/completions -H "Content-Type: application/json" -d "{\"model\":\"google/gemma-4-12b\",\"messages\":[{\"role\":\"user\",\"content\":\"hi\"}],\"response_format\":{\"type\":\"json_object\"}}"
```

Two likely causes, in order of suspicion:

1. **Model id mismatch.** `config.json` says `"model": "google/gemma-4-12b"`, but
   the model actually loaded in LM Studio was `google/gemma-4-26b-a4b-qat`. If the
   `model` field doesn't match a loaded model, LM Studio 400s.
   → Run `npm run autotag -- --test`, copy the exact id it lists into
   `config.json`'s `autotag.model`.
2. **`response_format: json_object` unsupported** by this model/LM Studio build.
   → If the curl above 400s but the same curl *without* the `response_format`
   block succeeds, that's it. Fix: make `response_format` optional in
   `server/scripts/autotag.ts` (the `callLlm` request body, ~line 127) — e.g.
   gate it behind an `autotag.jsonMode` config flag, defaulting off, and rely on
   the existing defensive `parseLlmTags` (which already extracts the first JSON
   object from free-form replies).

## Config (`config.json`, root)

The `autotag` block drives the script. Committed default:

```json
"autotag": { "endpoint": "http://localhost:1234/v1", "model": "google/gemma-4-12b", "useLlm": true }
```

Local machine needs:
- `endpoint` **must end in `/v1`** (was missing it earlier — a frequent gotcha).
- `model` must exactly match `--test` output.
- `musicFolders` set to `["D:/DnD"]` — **forward slashes on Windows**.

`config.local.json` (gitignored) can override without touching the committed file.

## How to run

```powershell
npm run autotag -- --test            # check LM Studio reachable + model loaded
npm run autotag -- --scan --dry-run  # index D:/DnD + preview tags, write nothing
npm run autotag -- --scan            # index + tag untagged tracks (writes)
npm run autotag                      # tag untagged (library already scanned)
npm run autotag -- --all             # re-tag everything
npm run autotag -- --folder Strahd   # limit to a folder (fast for testing)
npm run autotag -- --no-llm          # heuristics only, no model needed
```

Writing is **additive** — only fills dimensions it has suggestions for, never
wipes manual tags. Tags land in `tracks.intensity` + `track_tags` in the server
SQLite DB (`data/app.db`); the app shows them on next load. **The app is
unchanged** by any of this.

## Environment gotchas (Windows)

- **Node 22, not 24.** Node 24 has no better-sqlite3 prebuild for our pin and
  falls back to a source compile that needs VS C++ build tools. Stay on Node 22
  LTS (also what CI uses). `node -v` → `v22.x`.
- **PowerShell, not cmd.** To wipe `node_modules` use
  `Remove-Item -Recurse -Force node_modules`, *not* `rmdir /s /q` (that's cmd
  syntax and silently no-ops in PowerShell — it's why an earlier reinstall didn't
  take).
- After any Node switch: delete `node_modules`, `npm install`, then confirm
  `Test-Path node_modules\better-sqlite3\build\Release\better_sqlite3.node` → `True`.

## Suggested plan for the local session

1. Run the curl test → identify which 400 cause it is.
2. Apply the fix (swap model id in config, and/or make `response_format`
   optional in `autotag.ts`). Keep `parseLlmTags` as the safety net.
3. `npm run autotag -- --folder Strahd --dry-run` → sanity-check tag quality on a
   small slice before the full run.
4. `npm run autotag -- --scan --dry-run` over the whole library, eyeball it.
5. Real run: `npm run autotag -- --scan`.
6. `npm run dev`, open the Music view, confirm tags/intensity show and filter.
7. Commit + push tagging-script tweaks to the branch.

Keep `npm run typecheck` and `npm test` green.

## Deferred (not part of this)

- **Getting tags onto the Android phone.** The phone keeps its own tag store;
  tags produced here live in the computer's DB. The only bridge is the Drive
  sync, and wiring music tags into a device-independent synced signature is a
  separate future step. Not started.
- Optional DSP energy pass for intensity on files with no useful metadata —
  only if the LLM's metadata-based intensity proves too weak.
- music-metadata v10→v11 upgrade to clear the 2 npm-audit findings (both from
  transitive `file-type`, server-only, reads your own local files — safe to
  ignore for now; do **not** `npm audit fix --force`).

## Key files

- `server/scripts/autotag.ts` — the CLI (arg parsing, LM Studio call in
  `callLlm`, DB read/write). The `response_format` fix goes here.
- `shared/src/autotag.ts` — pure heuristics + `parseLlmTags`/`mergeTags` + vocab.
- `server/src/music.ts` — `scan()` (exported, reused by `--scan`).
- `config.json` — `autotag` block + `musicFolders`.
- `server/test/autotag.test.ts` — unit tests for the heuristics/parse/merge.
