# Plan 040: Remember output settings, last save folder, and the filled grid

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat c2b112f..HEAD -- app/js/index.js app/index.html preload.js main.js`
> On excerpt mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `c2b112f`, 2026-08-26

## Why this matters

Output selects always start at HTML defaults (720p, mute, letterbox). Save dialog always uses `Desktop/tesselate${Date.now()}.mp4`. Slot paths live only in renderer `vidPath1…9` for this process; quit forces a full re-pick. Plan 019’s “tweak and export again” loop dies at process exit. Persist settings + last save directory + occupied paths in `userData`, restore on load when files still exist.

## Current state

```javascript
// app/index.html:94-110 — selected 1280x720, none, letterbox
// app/js/index.js:52-59 getOutputSettings from DOM
// app/js/index.js:238 getDefaultPath('saveFile')
// main.js:164-169
if (type === 'desktop') return path.join(os.homedir(), 'Desktop')
else if (type === 'saveFile') return path.join(os.homedir(), 'Desktop', `tesselate${Date.now()}.mp4`)
```

No `localStorage` / `userData` store. Preload whitelist: `video:convert`, `video:cancel`, dialogs, `get-default-path`, `getPathForFile`. Sandboxed renderer cannot `fs.existsSync`.

Production window 450×600, not resizable (`main.js:186-191`). Keep it.

**Conventions**: contextIsolation, channel whitelist in `preload.js`. Classic renderer scripts (not `type="module"`). Do not fold `vidPath1…9` into an array unless it simplifies restore — IPC may keep nine keys. Short imperative commits. No AI co-author trailers.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 |
| Prefs helper | `node --test test/prefs.test.js` | exit 0 after you add it |

## Scope

**In scope**:

- `lib/prefs.js` + `test/prefs.test.js` (schema, merge defaults, skip missing files)
- `main.js` IPC: load/save JSON under `app.getPath('userData')` (e.g. `prefs.json`); `existsSync` when restoring paths
- `preload.js` invoke whitelist (`prefs:load`, `prefs:save`)
- `app/js/index.js` apply prefs on startup; save on setting change, successful slot fill/clear, grid toggle, and after a chosen save path
- `get-default-path` `saveFile`: last directory + new timestamped name (or last basename) — if last dir missing, Desktop

**Out of scope**:

- Public layout file format / import-export
- Cloud sync
- `type="module"`
- Signed macOS (`plans/DEFERRED.md`)
- In-cell video preview (043)

## Git workflow

- Branch: `advisor/040-remember-session`
- Message: `Remember output settings, save folder, and grid clips between launches.`
- Do not push unless asked.

## Steps

### Step 1: Schema and merge

JSON shape:

```javascript
{
  version: 1,
  gridType: '2x2' | '3x3',
  width: 1280 | 1920,
  height: 720 | 1080,
  audio: 'none' | 'first',
  fit: 'letterbox' | 'crop',
  lastSaveDir: string | null,
  paths: [string|null, ... /* length 9 */]
}
```

`normalizePrefs(raw)` fills defaults on missing/invalid fields (720p, mute, letterbox, 2×2, empty paths). Unknown `version`: still read known keys or reset — pick one and test it.

**Verify**: `test/prefs.test.js` covers invalid JSON → defaults; 1080p/crop/first preserved; paths length 9

### Step 2: Main process file + existence filter

`prefs:load` reads `userData/tessel-prefs.json` (or similar). For each path, if `!fs.existsSync(p)` set that slot to `null`. `prefs:save` writes pretty JSON, no other files.

Whitelist invoke in preload. Do not expose arbitrary fs.

**Verify**: `grep -n "prefs:load\\|prefs:save" preload.js main.js` matches; preload has no `require('./lib/prefs')` (keep preload require-free of app relative modules — put logic in main via `lib/prefs.js`)

### Step 3: Renderer restore and persist

On startup (after DOM ready): `prefs:load`, set `<select>` values, `switchGrid`, `setSlotOccupied` / `clearSlot` for paths that survived.

On change: debounce or save immediately when resolution/audio/fit/grid changes, when slots change, and when save dialog returns a `filePath` (store `path.dirname(filePath)`).

`get-default-path` `saveFile`: `path.join(lastSaveDir || Desktop, \`tesselate${Date.now()}.mp4\`)`.

Logo “clear all” should save empty paths.

**Verify**: `grep -n "prefs:load\\|prefs:save" app/js/index.js` matches

### Step 4: Mark the plan

`plans/README.md` row 040 → DONE.

## Test plan

- `test/prefs.test.js` normalize + missing-file filter (pure; pass a fake `exists`).
- Do not require Electron E2E.
- Pattern: `test/job-lock.test.js`.

## Done criteria

- [ ] Prefs round-trip schema tests pass
- [ ] Load skips missing files
- [ ] Selects + grid + slots restore when files exist
- [ ] Save dialog default dir is last used folder
- [ ] `npm test` exits 0
- [ ] No files outside the in-scope list are modified
- [ ] `plans/README.md` 040 DONE

## STOP conditions

- Storing prefs next to the videos or on the Desktop.
- Using `nodeIntegration: true` to get `fs` in the renderer.
- A layout file the user must pick on every launch (this is silent userData).

## Maintenance notes

- Reviewer: 2×2 restore must not fill hidden slots 5–9; if `gridType` is 2×2, clear or ignore paths 5–9 on apply (match `switchGrid`).
- After 041 duration control, add that field to the same schema in a follow-up (out of scope here unless 041 already merged — then persist it).
