# Plan 002: Probe duration without decoding files or inventing 10 seconds

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat b558cb8..HEAD -- main.js package.json lib/timecode.js`
> If plan 001 has landed, `lib/timecode.js` existing is expected. Compare
> duration-probe code in `main.js` against "Current state"; on a mismatch
> other than 001's require/extract, STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: plans/001-add-node-test-runner.md
- **Category**: bug
- **Planned at**: commit `b558cb8`, 2026-08-26

## Why this matters

Convert finds the longest input so shorter clips can `tpad` and the output can use `-t <max>`. Packaged apps do not ship ffprobe: `main.js` `require('@ffmpeg-installer/ffprobe')` uses a **nonexistent** package name (the real npm package is `@ffprobe-installer/ffprobe`) and it is not in `package.json`, so the try/catch always fails. Fallback spawn is `ffmpeg -i <file> -f null -`, which **decodes the entire file**, and the Promise waits for `close` even after `Duration:` is already on stderr. If both probes fail, duration is hardcoded to **10 seconds**, which truncates long videos or pads short ones. Users see a stuck 0% overlay during this extra decode pass.

## Current state

At planned-at HEAD (plan 001 will move regexes into `lib/timecode.js` but the spawn and 10s fallback stay until this plan):

```javascript
// main.js:66-73 — wrong module id, not in package.json
try {
    const ffprobePath = require('@ffmpeg-installer/ffprobe')
    ffmpeg.setFfprobePath(ffprobePath.path);
} catch (err) {
    debugLog('FFprobe not available, will use alternative method:', err.message)
}

// main.js:221-222
const args = ['-i', videoPath, '-f', 'null', '-'];
const ffmpegProcess = spawn(ffmpegPath.path, args);
// Duration parsed at 231-238; resolve only on close at 241-248; never .kill()

// main.js:313-316
videoDurations[videoPath] = 10;
maxDuration = Math.max(maxDuration, 10);
```

`ffmpeg.ffprobe` (`main.js:291`) still runs first; without a set ffprobe path it searches PATH (works on some dev machines, fails in packaged builds).

**Conventions**: CommonJS; send renderer errors on channel `video:error` (preload whitelist already includes it). Do not add `@ffprobe-installer/ffprobe` in this plan (optional later; plan 026 may ship a new ffmpeg). Prefer spawn of the **already bundled** `@ffmpeg-installer/ffmpeg` binary.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 |
| Confirm dead require gone | `grep -n "@ffmpeg-installer/ffprobe" main.js` | no matches |
| Confirm no 10s fallback | `grep -n " = 10" main.js` | no duration-fallback assignment (other `10`s in CSS/UI files are irrelevant) |

## Scope

**In scope**:
- `main.js` (`getVideoDurationWithFFmpeg`, `processDurations` / duration aggregation, error send on probe failure)
- `lib/timecode.js` / `test/timecode.test.js` only if you add `isFinitePositiveDuration(n)`
- `test/duration-probe.test.js` (create) — unit tests around aggregation/failure, **not** requiring real video files if you extract a pure `chooseDuration(results)` helper

**Out of scope**:
- Adding `@ffprobe-installer/ffprobe` as a dependency
- Replacing `@ffmpeg-installer/ffmpeg` (plan 026)
- Overlay UX / progress phase text (plan 003 / 014)
- Job mutex (plan 004)
- `-nostdin` investigation beyond adding it as the first ffmpeg arg if you touch spawn (plan 022 documents the hang; adding `-nostdin` here is allowed and recommended)
- `lib/mosaic.js` filter graph

## Git workflow

- Branch: `advisor/002-fix-duration-probing`
- Commit message example: `Probe duration from ffmpeg headers instead of a 10s guess.`
- Do NOT push or open a PR unless asked.

## Steps

### Step 1: Replace the fallback spawn with header-only probing

Rewrite `getVideoDurationWithFFmpeg` so that it:

1. Spawns `ffmpegPath.path` with args starting with `-nostdin`, `-hide_banner`, `-i`, `videoPath`. **Do not** use `-f null -` (that decodes every frame).
2. Recommended pattern: parse `matchDurationInStderr` (from `lib/timecode.js` after plan 001) on stderr; **on first finite duration `> 0`, `kill` the child** and resolve. Also resolve on `close` if duration was already parsed.
3. Reject if the process exits without a finite duration `> 0`.
4. Track the child so a later cancel/close plan can kill it; a module-level `Set` of live probe processes is enough. Kill them in `getVideoDurationWithFFmpeg` after success so they do not leak.

If ffmpeg without an output file exits with code 1 after printing the header, that is success **if** duration parsed.

**Verify**: `grep -n "f null" main.js` → no matches

### Step 2: Delete the wrong ffprobe require; keep or drop fluent `ffprobe`

Remove `require('@ffmpeg-installer/ffprobe')` (lines 67–73). Either:

- **A (preferred)**: stop calling `ffmpeg.ffprobe` in `processDurations` and only use the rewritten spawn helper (one code path; aligns with plan 009), or
- **B**: keep `ffmpeg.ffprobe` as a fast path when `ffprobe` exists on PATH, then fallback to the spawn helper — still **must not** use the 10s default.

Do not add a new npm package.

**Verify**: `grep -n "@ffmpeg-installer/ffprobe" main.js package.json` → no matches

### Step 3: Fail the convert instead of duration `= 10`

If any input cannot produce a finite duration `> 0`, call a helper `sendToRenderer('video:error', 'Could not read video duration')` (create a small helper that no-ops if `mainWindow` is missing/destroyed — plan 003 will reuse it) and **do not** call `startConversion`. Do not set `videoDurations[path] = 10`.

Reject non-finite `parseFloat` results (`NaN` from `"N/A"`). Full `Duration: N/A` behavior is plan 023; this plan only refuses to put `NaN` or `10` into the graph.

**Verify**: `grep -n "videoDurations\[videoPath\] = 10" main.js` → no matches

### Step 4: Tests

Add `test/duration-probe.test.js` (or extend `test/timecode.test.js`) covering:

- Aggregator: given `[5, 12, 8]` max is `12`
- Failure: any missing/NaN/≤0 duration → error path, no max invented
- `matchDurationInStderr` still used for a realistic ffmpeg header snippet

You may extract `maxDurationFromMap(durations)` / `assertAllFiniteDurations(durations)` into `lib/timecode.js` to test without spawning.

**Verify**: `npm test` → exit 0, new cases run

## Test plan

- Characterization of “no 10s fallback” and finite-duration guard.
- Do not add a flaky live-ffmpeg fixture here (plan 026 / optional later).
- Pattern: `test/timecode.test.js` from plan 001.

## Done criteria

- [ ] `npm test` exits 0
- [ ] `grep -n "f null" main.js` no matches
- [ ] `grep -n "@ffmpeg-installer/ffprobe" main.js` no matches
- [ ] `grep -n "videoDurations\[videoPath\] = 10" main.js` no matches
- [ ] Probe spawn does not use `-f null`
- [ ] Convert does not start when a duration is missing
- [ ] No files outside in-scope list (`git status`)
- [ ] `plans/README.md` 002 is DONE

## STOP conditions

- Bundled ffmpeg does not print `Duration: HH:MM:SS.cc` on stderr without `-f null -` — capture a sample of real stderr, stop, and report (do not reintroduce full decode).
- Plan 001 has not landed (`lib/timecode.js` missing).
- You think you must add `@ffprobe-installer/ffprobe` to make packaged apps work — not required if header probe works; stop only if header probe cannot see Duration on this binary.

## Maintenance notes

- Plan 004 must kill in-flight probe children on window close / cancel.
- Plan 009 may remove fluent-ffmpeg entirely; prefer option A in step 2 to make that a delete of unused requires.
- Reviewer: confirm packaged-app path does not depend on system ffprobe.
