# Plan 078: Default Convert’s save dialog to the last mosaic filename

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat f14caf4..HEAD -- lib/prefs.js app/js/index.js main.js test/prefs.test.js`
> Compare excerpts against live code; on a mismatch, treat it as a STOP condition.
> Sequence **after** 063 (both touch `collectPrefs` / normalizePrefs).

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/063-persist-padmode.md (soft)
- **Category**: direction
- **Planned at**: commit `f14caf4`, 2026-08-27

## Why this matters

`PRODUCT.md` / README: keep the grid after success to tweak and export again. `resolveSaveDefaultPath` only reuses `lastSaveDir` and always names `tesselate${now}.mp4` (`lib/prefs.js`). Plan 040 allowed “last basename” and shipped timestamp-only. The primary loop always proposes a new file; the user must re-type the previous name to overwrite. The save dialog still confirms — do not silent-overwrite without the dialog.

## Current state

```javascript
function resolveSaveDefaultPath(lastSaveDir, desktopDir, now, exists) {
    const existsFn = typeof exists === 'function' ? exists : () => false;
    const dir =
        asNonEmptyString(lastSaveDir) && existsFn(lastSaveDir) ? lastSaveDir : desktopDir;
    return path.join(dir, `tesselate${now}.mp4`);
}
```

`app/js/index.js` after save: `lastSaveDir = fileDirname(filePath)` then `persistPrefs()`. `main.js` `get-default-path` `saveFile` uses `resolveSaveDefaultPath(lastSaveDir, desktop, Date.now(), existsSync)`. `defaultPrefs` has `lastSaveDir: null` only.

**Conventions**: `normalizePrefs` allowlists unknown keys by dropping them. Add `lastSaveName` (basename only, e.g. `mosaic.mp4`) **or** store the last full dest path and join with existing dir logic. Keep `version: 1` if you only add an optional string field `normalizePrefs` already can accept (unknown keys dropped — you **must** plumb the new key like `lastSaveDir`). Pattern: `test/prefs.test.js` `resolveSaveDefaultPath`. Short imperative commits. No AI co-author trailers.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 |
| Prefs | `node --test test/prefs.test.js` | exit 0 |

## Scope

**In scope**:

- `lib/prefs.js` — persist last basename (allowlisted, non-empty `.mp4` or any basename from the save dialog); `resolveSaveDefaultPath` uses `path.join(dir, lastSaveName)` when set, else today’s `tesselate${now}.mp4`
- `app/js/index.js` — `collectPrefs` / `applyPrefs` / after successful save dialog (even before encode) store basename from `filePath`
- `main.js` — pass the extra field into `resolveSaveDefaultPath`
- Tests for: no name → timestamp; name + existing dir → that file in that dir; missing dir → desktop + name or timestamp (pick one: **desktop + last name** if name set, else timestamp)

**Out of scope**:

- Silent overwrite without the save dialog
- Revealing the file in Finder (085)
- Changing encode dest after dialog

## Git workflow

- Branch: `advisor/078-last-save-basename`
- Message: `Reuse the last mosaic filename in the save dialog.`
- Do not push unless asked.

## Steps

### Step 1: Prefs helper

Extend `resolveSaveDefaultPath(lastSaveDir, desktopDir, now, exists, lastSaveName)` (or an options object). Sanitize: `asNonEmptyString`, reject `..` path segments (basename only via `path.basename`). Tests in `test/prefs.test.js`.

**Verify**: `node --test test/prefs.test.js` → FAIL until implemented, then PASS

### Step 2: Renderer + IPC

`collectPrefs` includes the new field (063 already added padMode). After `showSaveDialog` returns a path, set basename and `lastSaveDir` before convert send. `get-default-path` reads stored prefs for both dir and name.

**Verify**: `grep -n "lastSaveName\\|resolveSaveDefaultPath" lib/prefs.js app/js/index.js main.js`

### Step 3: Full suite

**Verify**: `npm test` → exit 0

## Test plan

- Unit: timestamp default; basename reuse; path traversal rejected.
- Pattern: existing `resolveSaveDefaultPath` tests.

## Done criteria

- [ ] Second Convert proposes the previous basename in the last save dir when that dir exists
- [ ] First Convert still uses a timestamped default when no name stored
- [ ] User must still confirm in the save dialog
- [ ] `npm test` exits 0
- [ ] `plans/README.md` 078 DONE

## STOP conditions

- You would `fs.writeFile` the mosaic without a dialog.
- You would store a full path from the renderer without `path.basename` (path control).

## Maintenance notes

- Reviewer: Windows vs POSIX basename. `fileDirname` already exists in `index.js`.
- Import layout JSON may omit the new key — default timestamp is OK.
