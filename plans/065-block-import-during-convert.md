# Plan 065: Do not import or export a layout while Convert is running

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat f14caf4..HEAD -- main.js app/js/index.js test/prefs.test.js test/convert-session.test.js lib/ffmpeg-session.js`
> Compare excerpts against live code; on a mismatch, treat it as a STOP condition.
> Do **not** parallel 083 (both edit import).

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `f14caf4`, 2026-08-27

## Why this matters

Convert snapshots slot paths, then shows `#overlay`. The overlay covers the window, not the native **File** menu. **Import layout…** always calls `applyPrefs(..., { applyGrid: true })` and `persistPrefs()`. The on-screen grid and `tessel-prefs.json` can change while ffmpeg still encodes the pre-import slots. Success toast then implies the visible layout was written. `converting` only blocks the Advanced dialog.

## Current state

`app/js/index.js` Convert sets `converting = true` **before** the save dialog, then `electronAPI.send('video:convert', …)` and `overlay.style.display = 'block'`. `resetConvertUi` clears `converting` on error/cancel/done.

```javascript
electronAPI.receive('prefs:imported', (prefs) => {
    applyingPrefs = true
    try {
        applyPrefs(prefs, { applyGrid: true })
    } finally {
        applyingPrefs = false
        userTouchedGrid = true
        persistPrefs()
    }
})
```

`openAdvancedSettings` returns if `converting`. File menu in `main.js` has no busy check. `createFfmpegSession` already exports `isBusy()` (`Boolean(activeEncode)` — true during probe as well).

**Conventions**: `test/prefs.test.js` and `test/convert-session.test.js` grep `main.js` / `index.js`. Match that style plus a tiny unit helper if you extract a `shouldApplyImportedPrefs(converting)` function. Short imperative commits. No AI co-author trailers.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 |
| Prefs / session UX | `node --test test/prefs.test.js test/convert-session.test.js` | exit 0 |

## Scope

**In scope**:

- `main.js` — no-op or error-box Import/Export when `ffmpegSession.isBusy()`
- `app/js/index.js` — ignore `prefs:imported` and skip `prefs:collect` handler work when `converting` (belt and suspenders; main must still gate because the menu is in main)
- Tests that grep or unit-test the guard

**Out of scope**:

- Fill-empty import (083)
- Portable relative paths (084)
- Disabling the entire File menu for other reasons
- Changing overlay CSS to cover the menu (it cannot)

## Git workflow

- Branch: `advisor/065-block-import-during-convert`
- Message: `Ignore layout import and export while a convert is running.`
- Do not push unless asked.

## Steps

### Step 1: Main-process guard

At the start of `exportLayout` and `importLayout`, if `ffmpegSession.isBusy()`, `dialog.showErrorBox` (short message: convert is running) and `return`. Do this **before** `whenRendererReady` / open dialogs.

**Verify**: `grep -n "isBusy\\|Import layout\\|Export layout" main.js` → both functions check busy

### Step 2: Renderer ignore

In `prefs:imported` handler: if `converting`, return without `applyPrefs`. In `prefs:collect` handler: if `converting`, return without `collectPrefs` invoke (main should already have blocked).

**Verify**: `grep -n "prefs:imported\\|converting" app/js/index.js` → imported handler reads `converting`

### Step 3: Tests

Grep tests: `main.js` `exportLayout` / `importLayout` contain `isBusy`. `index.js` `prefs:imported` contains `converting`. Pattern: `test/prefs.test.js` File menu tests.

**Verify**: `npm test` → exit 0

## Test plan

- Source greps as above.
- Optional: extract `function shouldIgnoreLayoutIo(busy) { return Boolean(busy) }` in `lib/prefs.js` and unit-test it — only if you want a non-grep assertion. Not required.

## Done criteria

- [ ] Busy session cannot import or export a layout from the File menu
- [ ] `prefs:imported` does not apply while `converting`
- [ ] `npm test` exits 0
- [ ] No files outside the in-scope list are modified
- [ ] `plans/README.md` 065 DONE

## STOP conditions

- Excerpts drifted.
- You would kill the in-flight encode in order to import.
- You would apply import to slots but skip Advanced settings (still clobbers the grid).

## Maintenance notes

- Reviewer: `isBusy()` is true during duration probe (`activeEncode = true` before spawn). That is correct — do not import mid-analyze.
- Save dialog is already up when `converting` is true; File menu during that dialog is the main hole.
