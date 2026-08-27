# Plan 028: Encode to a temp file and replace the destination only on success

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat c2b112f..HEAD -- lib/ffmpeg-session.js lib/convert-session.js lib/mosaic.js main.js test/ffmpeg-session.test.js test/convert-session.test.js`
> If `lib/ffmpeg-session.js` does not exist, **STOP** — plan 027 must land first.
> Compare excerpts against live code; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/027-characterize-ffmpeg-session.md
- **Category**: bug
- **Planned at**: commit `c2b112f`, 2026-08-26

## Why this matters

Convert writes the user’s chosen path in place (`-y` on `filePath`). If that file already exists, ffmpeg truncates it as soon as encode starts. Cancel then **refuses** to unlink (`outputCreatedByThisJob = !fs.existsSync(filePath)` is false), so the original mosaic is gone and a truncated file remains. A failed encode also leaves a partial `.mp4` at the save path. New files are unlinked on cancel, which is correct, but a finish-vs-cancel race can delete a completed export. Encode to a sibling temp path, `rename` onto `filePath` only when ffmpeg exits 0, and never unlink the user’s destination.

## Current state (at c2b112f, before 027)

`main.js` (027 moves this into `lib/ffmpeg-session.js` — **edit the session module**, not a re-inlined `main.js`):

```javascript
outputCreatedByThisJob = !fs.existsSync(filePath)
const ffmpegProcess = spawn(ffmpegBinary, args)
activeEncode = ffmpegProcess
activeOutputPath = filePath
```

`lib/mosaic.js` `buildFfmpegArgs` last args include `'-y'` and `filePath` as the output.

`lib/convert-session.js`:

```javascript
function shouldUnlinkPartialOutput({ encodeStarted, createdByThisJob }) {
    return Boolean(encodeStarted && createdByThisJob)
}
```

`discardPartialOutput` unlinks `activeOutputPath` only when that helper is true. Encode `close` with `code !== 0` calls `signalError` and does **not** unlink.

Save dialog in the renderer already asks where to put the file; overwriting an existing name is a user choice. The bug is truncating **before** success.

**Conventions**: keep `shouldUnlinkPartialOutput` as a pure predicate tested in `test/convert-session.test.js`. Session uses injected `fs` (027). Fake-spawn tests in `test/ffmpeg-session.test.js` are the pattern for new cases. Short imperative commit messages. No AI co-author trailers.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 |
| Session tests | `node --test test/ffmpeg-session.test.js test/convert-session.test.js` | exit 0 |

No lint/typecheck script. Do not add one.

## Scope

**In scope**:

- `lib/ffmpeg-session.js` (temp path, rename on success, unlink temp on cancel/fail)
- `lib/convert-session.js` and `test/convert-session.test.js` only if you extend the predicate (e.g. distinguish dest vs temp). Prefer keeping the predicate about “may unlink **this path**” and always treat the temp as `createdByThisJob: true`.
- `test/ffmpeg-session.test.js` (new cases below)
- `lib/mosaic.js` only if you must pass a different output path into `buildFfmpegArgs` (you should: pass the **temp** path as `filePath`)

**Out of scope**:

- Job generation ids / stale `close` — plan 029
- asar path / protocol whitelist — plan 030
- Changing `-y` to prompt again (the save dialog already confirmed)
- Writing temps into `os.tmpdir()` on another filesystem (rename would copy; stay in the **same directory** as `filePath`)
- Windows-specific recycle-bin restore of the original file (impossible after truncate; this plan prevents truncate)

## Git workflow

- Branch: `advisor/028-atomic-convert-output`
- Message: `Encode mosaics to a temp file and replace the destination on success.`
- Do not push unless asked.

## Steps

### Step 1: Choose a sibling temp path

Add a small helper (in `lib/convert-session.js` or `lib/ffmpeg-session.js`):

```javascript
function tempOutputPath(filePath) {
    return filePath + '.tessel-partial'
}
```

Example: `/Users/me/Desktop/out.mp4` → `/Users/me/Desktop/out.mp4.tessel-partial`. Same directory so `rename` stays on one volume.

Export it if you put it in `lib/convert-session.js` and unit-test the string. Do **not** put the temp inside `node_modules` or the app asar.

**Verify**: `node -e "const p=require('./lib/convert-session'); console.log(p.tempOutputPath('/tmp/a.mp4'))"` → prints `/tmp/a.mp4.tessel-partial` (or the equivalent export path you chose)

### Step 2: Spawn ffmpeg against the temp path

In the session’s `startConversion`:

1. `const destPath = filePath` (the IPC destination).
2. `const tempPath = tempOutputPath(destPath)`.
3. Pass `tempPath` into `buildFfmpegArgs(...)` as the output file (still include `-y` on the temp).
4. Set `activeOutputPath = tempPath`.
5. Set `outputCreatedByThisJob = true` always for the temp (do **not** use `!fs.existsSync(destPath)`).
6. Keep `destPath` in a local `const` closed over by the encode `close` handler.

Do not spawn onto `destPath`.

**Verify**: a fake-spawn test (step 4) that `spawn`’s encode `args` end with the `.tessel-partial` path, not the dest `.mp4`.

### Step 3: Success = rename; failure/cancel = unlink temp only

On encode `close` with `code === 0` and not `killedByUs`:

1. `fs.renameSync(tempPath, destPath)` (injected `fs`).
2. If rename throws with `code === 'EEXIST'` or `code === 'EPERM'` (Windows dest exists): `fs.unlinkSync(destPath)` then `fs.renameSync(tempPath, destPath)` again.
3. If rename still throws: `signalError` with `'Could not save output file'` (or the existing conversion-failed string plus that idea). Do **not** unlink `destPath` in that failure path if unlink already happened — STOP and report if you cannot make this safe; prefer leaving the temp file and erroring.
4. Then `finishEncode()`, `video:progress` 100, `video:done` as today.

On cancel (`discardPartialOutput`) and on encode `close` with `code !== 0`:

- Unlink **`tempPath` only** (`activeOutputPath` should already be the temp).
- Never `unlinkSync(destPath)`.

Failed encodes today leave a partial at `filePath`. After this plan they must leave `destPath` untouched and remove the temp.

**Verify**: grep the session for `existsSync(filePath)` / `existsSync(destPath)` used to set `outputCreatedByThisJob` → no matches

### Step 4: Tests

Extend `test/ffmpeg-session.test.js` (027 harness). Track `fs` calls:

```javascript
const calls = { exists: [], unlinks: [], renames: [] }
const fs = {
    existsSync(p) { calls.exists.push(p); return false },
    unlinkSync(p) { calls.unlinks.push(p) },
    renameSync(from, to) { calls.renames.push([from, to]) },
}
```

Cases:

1. **Success** — dest `/out.mp4`, encode `close` 0 → `renameSync` from `/out.mp4.tessel-partial` to `/out.mp4`; `unlinks` does not include `/out.mp4`; `video:done`.
2. **Cancel** — after encode spawn, `killActiveFfmpeg({ notify: 'cancelled' })` → `unlinkSync` of the `.tessel-partial` path only; never `/out.mp4`.
3. **Encode failure** — `close` 1 → unlink temp only; dest not unlinked; `video:error`.
4. **Pre-existing dest** — `existsSync` returns `true` for `/out.mp4` → still encode to temp; success still `renameSync` onto `/out.mp4`; dest is not unlinked **before** success.

Keep the 027 cases passing (update them: encode args output path is now the temp; `existsSync` may still be called — if you no longer call it, that is fine).

**Verify**: `npm test` → exit 0

### Step 5: Mark the plan

`plans/README.md` row 028 → DONE.

## Test plan

- New session tests listed in step 4.
- Pattern: `test/ffmpeg-session.test.js` from 027.
- Optional one-liner unit test for `tempOutputPath` in `test/convert-session.test.js`.
- Do not add a real ffmpeg write-to-disk integration for this plan (`test/ffmpeg-integration.test.js` already encodes to `os.tmpdir()`).

## Done criteria

- [ ] Encode argv output is `filePath + '.tessel-partial'` (or the documented helper)
- [ ] `grep -n "outputCreatedByThisJob = !fs.existsSync" lib/ffmpeg-session.js main.js` → no matches
- [ ] Session tests cover success rename, cancel unlink-temp, fail unlink-temp, existing dest
- [ ] `npm test` exits 0
- [ ] No files outside the in-scope list are modified
- [ ] `plans/README.md` 028 DONE

## STOP conditions

- Plan 027 not merged (`lib/ffmpeg-session.js` missing).
- You need `fs.copyFile` + delete because rename cannot work even with the Windows EEXIST fallback — report instead of silently copying across volumes.
- Changing `buildFfmpegArgs` goldens in `test/mosaic.test.js` because you altered flags other than the **output path passed in** — callers should pass the temp path; mosaic goldens that use `'/out.mp4'` can stay if tests still call `buildFfmpegArgs` with that string.
- Implementing 029 job ids in the same diff.

## Maintenance notes

- Reviewer: dest file must be byte-identical to a successful ffmpeg output (rename, not a second encode). Cancel must not delete a pre-existing dest.
- If a crash happens after rename and before `video:done`, the dest is already complete — acceptable.
- Leftover `*.tessel-partial` after a hard kill: next convert to the same name should `-y` the temp (same path). Optional future: unlink stale temp at convert start.
- Plan 029 should keep rename/unlink tied to the **job that owns** the temp path.
