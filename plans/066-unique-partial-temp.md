# Plan 066: Do not `-y` overwrite a kept rename-failure temp

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat f14caf4..HEAD -- lib/convert-session.js lib/ffmpeg-session.js test/convert-session.test.js test/ffmpeg-session.test.js`
> Compare excerpts against live code; on a mismatch, treat it as a STOP condition.
> Sequence **after** 064 if both are TODO (same `lib/ffmpeg-session.js`).

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MED
- **Depends on**: none (after 064 if parallel worktrees share the session file)
- **Category**: bug
- **Planned at**: commit `f14caf4`, 2026-08-27

## Why this matters

Plan 046 keeps `*.tessel-partial.mp4` when `renameSync` to the user dest fails, and tells the user the basename. The next Convert to the same dest uses a **deterministic** sibling path and ffmpeg `-y`, which immediately overwrites that recovery file. If the retry also fails or is cancelled, both the good encode and the new attempt are gone. Plan 028’s maintenance note assumed leftover temps were junk after a hard kill, not a successful mux 046 asked the user to keep.

## Current state

`lib/convert-session.js`:

```javascript
function tempOutputPath(filePath) {
    const ext = path.extname(filePath);
    if (!ext) {
        return `${filePath}.tessel-partial.mp4`;
    }
    return `${filePath.slice(0, -ext.length)}.tessel-partial${ext}`;
}
```

`lib/ffmpeg-session.js` `startConversion`: `const tempPath = tempOutputPath(destPath);` then `buildFfmpegArgs(..., tempPath)` which includes `-y`. Rename failure: `signalError(renameFailureMessage(tempPath), { keepTemp: true })`.

`test/convert-session.test.js` asserts the deterministic sibling name.

**Conventions**: inject `fs` into `createFfmpegSession`. Fake `existsSync` in `test/ffmpeg-session.test.js` (`createTrackingFs`). Short imperative commits. No AI co-author trailers.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 |
| Convert/session | `node --test test/convert-session.test.js test/ffmpeg-session.test.js` | exit 0 |

## Scope

**In scope**:

- `lib/convert-session.js` — choose a temp path that does not clobber an existing recovery file (unique suffix, e.g. `.tessel-partial-2.mp4` or a counter)
- `lib/ffmpeg-session.js` — pass `fs.existsSync` (or equivalent) into that helper
- Tests for unique names and for encode using the unique path when the default sibling exists

**Out of scope**:

- Changing rename / keepTemp policy (046)
- Encoding directly to dest (028)
- User-facing “open the partial” UI (085)

## Git workflow

- Branch: `advisor/066-unique-partial-temp`
- Message: `Encode to a new partial file when a kept temp already exists.`
- Do not push unless asked.

## Steps

### Step 1: Helper

Extend `tempOutputPath` (or add `tempOutputPathUniq(filePath, existsSync)`) so:

- If the default sibling does **not** exist, return today’s path (keep `test/convert-session.test.js` names).
- If it exists, return a different sibling in the same directory, still ending in `.mp4` (FFmpeg mux), e.g. `out.tessel-partial-2.mp4` then `-3` if needed. Cap the loop (e.g. 100) and throw if exhausted.

**Verify**: `node --test test/convert-session.test.js` → default names unchanged; new tests for collision

### Step 2: Session uses it

`startConversion` must call the exists-aware helper with session `fs.existsSync`. Encode args `-i` dest remains the user path; only the temp argv output path changes.

**Verify**: fake-fs test: `existsSync` true for `/tmp/out.tessel-partial.mp4`; after probe+encode, `buildFfmpegArgs` last arg (or spawn argv) is **not** that path. Pattern: `test/ffmpeg-session.test.js` rename/temp tests.

### Step 3: Full suite

**Verify**: `npm test` → exit 0

## Test plan

- Default temp name when free.
- Collision → different `.mp4` sibling.
- Session spawn output path follows the helper.
- Pattern: `test/convert-session.test.js` `tempOutputPath`; `test/ffmpeg-session.test.js` tracking fs.

## Done criteria

- [ ] Existing recovery `*.tessel-partial.mp4` is not passed as `-y` output on the next job
- [ ] Happy-path temp name unchanged when the sibling is absent
- [ ] `npm test` exits 0
- [ ] No files outside the in-scope list are modified
- [ ] `plans/README.md` 066 DONE

## STOP conditions

- Excerpts drifted.
- You would encode to dest in place again.
- Unique names would not end in `.mp4` (028/mux).
- You would `unlinkSync` the kept recovery file to reuse the old name.

## Maintenance notes

- Reviewer: cancel/fail of the *retry* must still unlink **that job’s** temp via `shouldUnlinkPartialOutput`, not the previous recovery file.
- Error string `left ${basename}` should name the file that was kept (046) or the new unique temp on a later failure — keep it accurate.
