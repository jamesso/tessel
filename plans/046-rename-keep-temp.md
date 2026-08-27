# Plan 046: Keep the encoded temp (and dest) when rename fails

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat a7bd825..HEAD -- lib/ffmpeg-session.js lib/convert-session.js test/ffmpeg-session.test.js test/convert-session.test.js`
> Compare excerpts against live code; on a mismatch, treat it as a STOP condition.
> If 045 is in flight on this file, wait or rebase. Do **not** parallel 045 or 055.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MED
- **Depends on**: none (sequence after 045 if both are TODO)
- **Category**: bug
- **Planned at**: commit `a7bd825`, 2026-08-27

## Why this matters

Encode writes `filePath + '.tessel-partial'` then `renameSync` onto the destination (plan 028). On `EEXIST`/`EPERM`, the code **unlinks dest** then retries rename. If that retry throws, it returns `false`. The close handler then `signalError('Could not save output file')`, and `signalError` **unlinks the temp** — the file that just encoded successfully. The user can lose the previous mosaic **and** the new one. `EXDEV` (cross-device) is not handled: dest stays, but the temp is still deleted, so the encode is thrown away.

Temp is a same-directory sibling (`lib/convert-session.js` `tempOutputPath`), so `EXDEV` is rare; the Windows dest-exists fallback is the dangerous path. Tests never make `renameSync` throw.

## Current state

```javascript
// lib/ffmpeg-session.js
function renameOutputFile(tempPath, destPath) {
    try {
        fs.renameSync(tempPath, destPath);
        return true;
    } catch (err) {
        if (err.code === 'EEXIST' || err.code === 'EPERM') {
            try {
                fs.unlinkSync(destPath);
                fs.renameSync(tempPath, destPath);
                return true;
            } catch (err2) {
                return false;
            }
        }
        return false;
    }
}

const signalError = (message) => {
    // ...
    signaled = true;
    if (activeOutputPath) {
        unlinkTempFile(activeOutputPath);
    }
    finishEncode();
    sendToRenderer('video:error', message);
};

// close code === 0:
if (!renameOutputFile(tempPath, destPath)) {
    signalError('Could not save output file');
    return;
}
```

Happy-path tests: `test/ffmpeg-session.test.js` “encode writes to temp…”, “success renames temp…”, “cancel unlinks temp only…”. `createTrackingFs` records `renameSync` / `unlinkSync`.

**Conventions**: injected `fs` on `createFfmpegSession`. Do not move temps to `os.tmpdir()` (028: same directory so rename is not a copy). Short imperative commits. No AI co-author trailers.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 |
| Session tests | `node --test test/ffmpeg-session.test.js test/convert-session.test.js` | exit 0 |

## Scope

**In scope**:

- `lib/ffmpeg-session.js` `renameOutputFile`, success-close branch, `signalError` only if you add a “keep temp” variant
- `test/ffmpeg-session.test.js`
- `lib/convert-session.js` / `test/convert-session.test.js` only if you extract a tiny rename-result helper

**Out of scope**:

- Implementing `copyFile` + unlink for `EXDEV` as the default success path (028 declined cross-volume copy). Leaving the temp and telling the user is enough.
- Recycle-bin / Windows shadow copies
- Changing `tempOutputPath` suffix
- Probe failure (045)

## Git workflow

- Branch: `advisor/046-rename-keep-temp`
- Message: `Keep mosaic temp files when replacing the destination fails.`
- Do not push unless asked.

## Steps

### Step 1: Rename results that do not destroy the temp

Change `renameOutputFile` so the caller can distinguish success vs failure **without** always unlinking temp.

Required behavior:

| Outcome | dest | temp | IPC |
|---------|------|------|-----|
| First `renameSync` succeeds | new mosaic | gone (renamed) | `video:done` (unchanged) |
| `EEXIST`/`EPERM`, unlink dest, second rename succeeds | new mosaic | gone | `video:done` |
| `EEXIST`/`EPERM`, unlink dest, second rename **fails** | dest may already be gone | **keep** `.tessel-partial` | `video:error` mentioning the temp basename or `.tessel-partial` |
| Other errors including `EXDEV` | **unchanged** | **keep** temp | `video:error` mentioning `.tessel-partial` |

Do **not** call the existing `signalError` on rename failure if it still unlinks `activeOutputPath`. Either:

- `finishEncode()` without `unlinkTempFile`, then `send('video:error', 'Could not save output file (left <temp basename>)')`, or
- `signalError(msg, { keepTemp: true })`.

Error string must stay short (alert UI). Include `tessel-partial` so the user can find the file next to the chosen dest.

**Verify**: `grep -n "Could not save output file" -A 12 lib/ffmpeg-session.js` — rename-failure path does not `unlinkTempFile` / `unlinkSync` the temp.

### Step 2: Tests with throwing `renameSync`

Use `createTrackingFs` / a custom `fs` in `test/ffmpeg-session.test.js`. Happy path: probe Duration, encode `close` 0.

1. **`EXDEV`**: `renameSync` throws `{ code: 'EXDEV' }`. Expect `video:error` matching `/tessel-partial/`, dest **not** in `unlinks`, temp **not** in `unlinks` (or unlinks only if you never created dest). No `video:done`.

2. **`EEXIST` then success**: first `renameSync` throws `{ code: 'EEXIST' }`, then `unlinkSync(dest)`, second `renameSync` succeeds. Expect `video:done`, dest was unlinked once, temp renamed.

3. **`EEXIST` then retry fails**: first throw `EEXIST`, unlink dest, second `renameSync` throws. Expect `video:error` matching `/tessel-partial/`, temp **not** unlinked after the failed retry.

Keep existing success/cancel/fail-unlink-temp tests (encode `close` 1 still unlinks temp).

**Verify**: `node --test test/ffmpeg-session.test.js` → exit 0

## Test plan

- EXDEV: dest intact, temp kept, error names partial suffix.
- EEXIST retry success: dest replaced, done.
- EEXIST retry fail: temp kept, error, no done.
- Encode `close` 1 still unlinks temp (failed encode, not failed rename).
- Pattern: `createTrackingFs` in `test/ffmpeg-session.test.js`.

Verification: `npm test` → exit 0.

## Done criteria

- [ ] `npm test` exits 0
- [ ] Rename-failure after `code === 0` does not unlink `.tessel-partial`
- [ ] EXDEV does not unlink dest
- [ ] Error message includes `tessel-partial`
- [ ] No files outside the in-scope list are modified
- [ ] `plans/README.md` status row for 046 set to DONE

## STOP conditions

- Excerpts drifted (especially if 045 already edited this file — rebase, then continue).
- You would write temps to a different filesystem by default.
- You would unlink dest on `EXDEV`.

## Maintenance notes

- Reviewer: Windows overwrite still unlinks dest **only** when the second rename is attempted; if that fails, dest is gone — keeping the temp is the recovery file. Mention that in the error string.
- 055 will cap stderr in this file; rebase if needed.
