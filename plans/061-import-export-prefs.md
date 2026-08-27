# Plan 061: Import and export the session prefs JSON

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat a7bd825..HEAD -- lib/prefs.js main.js preload.js app/js/index.js`
> On excerpt mismatch, STOP.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (040 already shipped `serializePrefs`)
- **Category**: direction
- **Planned at**: commit `a7bd825`, 2026-08-27

## Why this matters

`serializePrefs` / `parsePrefsJson` already define a versioned layout document (`lib/prefs.js`). Plan 040 explicitly deferred public import/export. Silent `userData` restore does not move a layout to another machine or back up before an experiment. The File menu is stock `role: 'fileMenu'` (`main.js:223-225`) — no custom items. Absolute paths **will not** survive another computer; the UI must say so.

## Current state

JSON shape (`normalizePrefs`): `version: 1`, `gridType`, `width`, `height`, `audio`, `fit`, `durationMode`, optional `seconds`, `lastSaveDir`, `paths[9]`.

IPC: `prefs:load` / `prefs:save` (`preload.js:36-42`, `main.js` handlers). Renderer `applyPrefs` / `persistPrefs`.

Sandboxed renderer cannot `fs.readFile` a user-picked JSON file — main process must read/write after a dialog.

**Conventions**: contextIsolation, channel whitelist. `parsePrefsJson` already returns defaults on bad JSON. `filterMissingPaths` on import with `existsSync`. Short imperative commits. No AI co-author trailers.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 |
| Prefs | `node --test test/prefs.test.js` | exit 0 |

## Scope

**In scope**:

- File menu items: **Export layout…** / **Import layout…** (wording flexible)
- `main.js` dialogs + read/write UTF-8 JSON via existing `serializePrefs` / `parsePrefsJson` / `filterMissingPaths`
- `preload.js` whitelist if the renderer applies imported prefs (or apply entirely in main and `webContents.send` a new channel — then whitelist `receive`)
- After import: same path as `applyPrefs` (grid, settings, slots). Export: current `collectPrefs()` or main re-reads last saved prefs — **export what is on screen** (ask renderer via `ipcMain.handle` or export from last `prefs:save`; prefer asking renderer for `collectPrefs` so unsaved drops are included)
- README one paragraph: layouts are absolute paths; missing files skip

**Out of scope**:

- Cloud sync
- Replacing silent userData persist
- Relative paths / portable folder of videos
- Changing prefs `version` unless a field is added (then bump and still parse v1)

## Git workflow

- Branch: `advisor/061-import-export-prefs`
- Message: `Add File menu import and export for mosaic layout JSON.`
- Do not push unless asked.

## Steps

### Step 1: Export

`dialog.showSaveDialog` default `tessel-layout.json`. Main writes `serializePrefs(payload)`. If the payload is fetched from the renderer, add `ipcMain.handle('prefs:collect')` implemented in renderer via `ipcRenderer` **or** handle export entirely from last written `tessel-prefs.json` plus a note that unsaved UI can differ — **do not** do that; collect from renderer.

Preload: `collectPrefs` invoke if needed; keep save/load.

**Verify**: `grep -n "Export layout\\|prefs:collect\\|serializePrefs" main.js preload.js`

### Step 2: Import

`dialog.showOpenDialog` json filter. Main `readFileSync` / `fs.promises.readFile`, `parsePrefsJson`, `filterMissingPaths(..., existsSync)`. Send normalized prefs to renderer (`prefs:imported` receive channel) and `applyPrefs`. Then `persistPrefs` so userData matches.

On parse failure: dialog/error string, do not wipe the grid.

Alert or dialog: **“Clip paths are absolute. Files that are not on this computer are left empty.”** once per import (or README only + a short `dialog.showMessageBox`). Prefer a message box on import.

**Verify**: `grep -n "prefs:imported\\|Import layout" main.js preload.js app/js/index.js`

### Step 3: Tests

`test/prefs.test.js`: round-trip `serializePrefs` → `parsePrefsJson` already exists — add import filter: missing path → null. No Electron menu test.

**Verify**: `npm test` → exit 0

## Test plan

- Round-trip JSON.
- Missing files cleared.
- Pattern: `test/prefs.test.js` `filterMissingPaths`.

Verification: `npm test` → exit 0.

## Done criteria

- [ ] File menu can export and import JSON
- [ ] Import uses `filterMissingPaths`
- [ ] User is told paths are absolute / machine-local
- [ ] Bad JSON does not clear the live grid
- [ ] `npm test` exits 0
- [ ] No files outside the in-scope list are modified
- [ ] `plans/README.md` 061 DONE

## STOP conditions

- You would upload prefs to a server.
- You would store video bytes inside the JSON.
- Renderer `fs` via `nodeIntegration`.

## Maintenance notes

- Reviewer: stock `fileMenu` on macOS also has Close; add items without removing Quit.
- 050 race: import during launch should set `userTouchedGrid` or run after restore — import is user-initiated after load, OK.
