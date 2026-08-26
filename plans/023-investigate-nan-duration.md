# Plan 023: Investigate non-finite / `N/A` durations in the filter graph

> **Executor instructions**: This is an **investigate** plan. Confirm whether ffprobe/ffmpeg can yield `NaN` or `N/A` that reaches `-t` / `duration=`. Plan 002 already refuses non-finite `> 0` durations — verify that guard and only add tests/fixtures if a gap remains. Update this file’s investigation result. Do not reintroduce a 10-second default.
>
> **Drift check (run first)**: `git diff --stat b558cb8..HEAD -- main.js lib/timecode.js test/timecode.test.js`

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/002-fix-duration-probing.md
- **Category**: bug
- **Planned at**: commit `b558cb8`, 2026-08-26

## Why this matters

Audit confidence was **LOW**. `metadata.format.duration` was used if truthy (`main.js:292-293`); `parseFloat('N/A')` is `NaN`. `Math.max(maxDuration, NaN)` is `NaN`, then `-t` and `duration=` become `"NaN"`. Duration `0` is falsy and used to fall through to the 10s path (removed in 002). Some containers print `Duration: N/A` until a full scan.

## Current state (planned-at)

```javascript
if (!err && metadata && metadata.format && metadata.format.duration) {
    const duration = parseFloat(metadata.format.duration);
```

Stderr regex requires `\d{2}:\d{2}:\d{2}\.\d{2}` (`main.js:231`) — `Duration: N/A` does not match (good).

After 002: convert should error if any duration is not finite `> 0`.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 |
| Guard | `grep -n "isFinite\\|Number.isFinite" lib/timecode.js main.js` | match after 002 |

## Scope

**In scope**: `lib/timecode.js`, `test/timecode.test.js`, this file’s result section; `main.js` only if 002’s guard is missing

**Out of scope**: Full-file decode to resolve `N/A` (that is the bug 002 removed). Do not scan entire files to invent duration.

## Git workflow

- Branch: `advisor/023-investigate-nan-duration`
- Message: `Guard mosaic duration against NaN and N/A.`
- Do not push unless asked.

## Steps

### Step 1: Trace the live code

Read `processDurations` / duration helper after 002. Confirm `Number.isFinite(duration) && duration > 0` (or equivalent) before `startConversion`.

**Verify**: write findings below

### Step 2: Tests for poison strings

If not already present, add tests:

- `parseFloat('N/A')` must not be accepted by `isFinitePositiveDuration`
- `matchDurationInStderr('Duration: N/A')` → `null`

If 002 already covers this, cite the test names in the result and do not duplicate.

**Verify**: `npm test` → exit 0

### Step 3: Optional real file

If you have a WebM with `Duration: N/A` in ffmpeg banner, run the probe helper and record whether convert errors cleanly. Do not add large binaries to git.

## Test plan

- Unit tests for N/A / NaN / 0 / negative.

## Done criteria

- [ ] Investigation result states whether NaN can still reach `buildFfmpegArgs`
- [ ] If yes, a guard + test landed; if no, tests prove rejection
- [ ] No 10s fallback reintroduced
- [ ] `plans/README.md` 023 DONE

## STOP conditions

- You want to decode the whole file to get duration for `N/A` headers — that undoes 002; report instead.

## Maintenance notes

- Some live streams have no duration; Tessel is a local file app — failing the job is correct.

## Investigation result

**Can `NaN` reach `-t` / `buildFfmpegArgs` today?** No.

**Trace (post-002):**

1. **`getVideoDurationWithFFmpeg`** (`main.js`): stderr is parsed with `matchDurationInStderr`, which requires `\d{2}:\d{2}:\d{2}\.\d{2}` — `Duration: N/A` does not match and returns `null`. A parsed value is accepted only when `Number.isFinite(parsed) && parsed > 0`. On process `close`, if no finite positive duration was found, the probe **rejects** (`Could not extract duration`); it never resolves `NaN`.

2. **`processDurations`**: after all probes, **`assertAllFiniteDurations`** then **`maxDurationFromMap`** run before **`startConversion`**. Both delegate to **`isFinitePositiveDuration`** (`Number.isFinite(n) && n > 0`). Any `NaN`, `0`, or missing entry throws; the catch path sends **`Could not read video duration`** and does not call `startConversion`.

3. **`buildFfmpegArgs`** (`lib/mosaic.js`): receives `longestDuration` only from the guarded path above. No 10s fallback remains.

**Poison strings:** `parseFloat('N/A')` is `NaN`; it is rejected at probe acceptance, `assertAllFiniteDurations`, and `maxDurationFromMap`.

**Tests added:**

- `isFinitePositiveDuration rejects parseFloat N/A` (`test/duration-probe.test.js`)
- `matchDurationInStderr returns null for Duration N/A banner` (`test/timecode.test.js`)

**Tests already present (cited, not duplicated):**

- `parseFfmpegClock returns 0 for empty or N/A` (`test/timecode.test.js`)
- `assertAllFiniteDurations fails on NaN or non-positive` (`test/duration-probe.test.js`)
- `maxDurationFromMap rejects NaN or non-positive values` (`test/duration-probe.test.js`)

**Optional real file:** not run (no `Duration: N/A` WebM fixture in repo; unit coverage is sufficient per STOP — no full-file decode).
