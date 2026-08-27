# Plan 041: Let users cap mosaic length (spike, then one footer control)

> **Executor instructions**: This is a **spike-then-build** plan. Run the spike, write `## Spike result`, then implement **one** duration policy in the UI. Do not add fps pickers, mix-all audio, or 4×4 (plan 021 wont-ship). If the spike cannot keep A/V aligned, STOP and report. When done, update `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat c2b112f..HEAD -- lib/mosaic.js lib/timecode.js main.js app/index.html app/js/index.js test/mosaic.test.js test/output-settings.test.js`
> If `lib/ffmpeg-session.js` exists, duration is applied there when calling `buildFfmpegArgs` / `buildFilterComplex`. On mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: M (coarse — spike then a day-ish build)
- **Risk**: MED
- **Depends on**: none (mosaic helpers already exist; 021 notes freeze 25 fps)
- **Category**: direction
- **Planned at**: commit `c2b112f`, 2026-08-26

## Why this matters

Convert always uses `maxDurationFromMap` then `-t longestDuration` and `tpad` shorter cells to the max (`main.js:400-403`, `lib/mosaic.js:152-160`, `213`). A 3×3 of 10-minute clips is a 10-minute encode even when the user wanted the first 15 seconds. Footer UI (`app/index.html:91-114`) has resolution/audio/fit only. Plan 021 shipped those three knobs and did **not** add duration; 021 wont-ship is fps/mix/4×4, not trim.

**Default must remain pad-to-longest** so existing goldens stay the no-arg path.

## Current state

- `maxDurationFromMap` / `assertAllFiniteDurations` in `lib/timecode.js`.
- First-clip audio: `-map 0:a?` `-af asetpts=PTS-STARTPTS,apad` and global `-t` (`plans/021-output-settings-notes.md`).
- 25 fps only (`OUTPUT.fps` in `lib/mosaic.js`).

**Conventions**: `resolveOutput` / `resolveAudio` / `resolveFit` style allowlists. Short imperative commits. No AI co-author trailers.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 |
| Spike encode | bundled ffmpeg + two lavfi clips (5s + 10s) | record durations in spike result |

## Scope

**In scope**:

- Spike notes in this file
- `lib/mosaic.js` / duration helper: compute `encodeDuration` from policy
- `app/index.html` + `app/js/index.js` + IPC payload field (e.g. `durationMode`)
- Tests for goldens: default path unchanged; shortest and/or N-seconds change `-t` and tpad
- After 027: session forwards the new field

**Out of scope**:

- 60 fps, mix-all audio, 4×4, arbitrary width/height (021)
- In-point UI more than “from start”
- Signed macOS (`plans/DEFERRED.md`)

## Git workflow

- Branch: `advisor/041-duration-cap`
- Message: `Add a mosaic duration cap without changing the pad-to-longest default.`
- Do not push unless asked.

## Steps

### Step 1: Spike two policies

Using bundled ffmpeg and current `buildFilterComplex` / `buildFfmpegArgs` as a baseline:

1. **Match shortest** — set `-t` to min duration; omit tpad (or tpad 0); two clips 2s + 5s → output ~2s.
2. **From start, N seconds** — `N=1` with clips longer than 1s → output ~1s; first-clip audio still ends with video (use `apad` + `-t` as today, or `apad=whole_dur=N` if `-t` is not enough).

Record: output duration (`ffmpeg -i`), whether audio extends past video, any filter errors.

Pick **one** extra UI mode to ship besides default longest:

- If shortest is clean, ship **Longest (default)** + **Shortest**.
- If N seconds is what users need and shortest is awkward, ship **Longest** + **First N s** with N from a small `<select>` (5, 15, 30, 60) **or** number input min 1 max 600.

Do **not** ship both extra modes in v1 unless the spike was trivial. Write the choice in `## Spike result`.

**Verify**: spike result names the shipped policy and A/V alignment

### Step 2: Implement default-preserving API

Add something like:

```javascript
function resolveEncodeDuration(durationsMap, policy) {
  const max = maxDurationFromMap(durationsMap)
  const min = Math.min(...Object.values(durationsMap))
  if (policy.mode === 'shortest') return min
  if (policy.mode === 'seconds') return Math.min(max, Number(policy.seconds))
  return max
}
```

Pass `encodeDuration` into `buildFilterComplex` as today’s `longestDuration` argument (tpad to **encode** duration, not necessarily the longest clip). `buildFfmpegArgs` `-t` uses the same number.

Invalid policy → longest (like `resolveFit`).

IPC: renderer `getOutputSettings()` spreads the new field. Allowlist in main/session (do not trust raw strings beyond the enum).

**Verify**: existing mosaic tests still pass **without** passing policy (longest)

### Step 3: Footer control

One `<select id="output-duration">` next to fit: e.g. “Full length” / “Shortest clip” or “Full length” / “15 seconds” according to the spike. Keep the 450×600 window usable (settings row may wrap; do not add a second window).

**Verify**: `grep -n "output-duration" app/index.html app/js/index.js`

### Step 4: Tests + mark DONE

Goldens: shortest → `-t` equals min; tpad not used when all clips ≥ encode duration. `npm test`. `plans/README.md` 041 DONE.

## Test plan

- Default longest: existing tests unchanged.
- New policy: `-t` and tpad math.
- Pattern: `test/output-settings.test.js`.
- Optional lavfi encode in integration test — skip if no binary.

## Done criteria

- [ ] `## Spike result` filled
- [ ] Default encode duration still max of clips
- [ ] One extra user-facing cap shipped and allowlisted
- [ ] `npm test` exits 0
- [ ] No files outside the in-scope list are modified
- [ ] `plans/README.md` 041 DONE

## STOP conditions

- Audio runs past video or ffmpeg errors on `apad` + new `-t` — do not guess; report.
- Adding 60 fps or mix-all audio.
- Changing default away from pad-to-longest.

## Spike result

Bundled ffmpeg: `ffmpeg version 6.0` (`node_modules/ffmpeg-static/ffmpeg`). Two lavfi sources (5s red + 10s blue, AAC), current `buildFilterComplex` / `buildFfmpegArgs` with first-clip `apad` + `-t`.

| Policy | `-t` | container `ffmpeg -i` | video decode | audio decode | tpad | ffmpeg exit | filter errors |
|--------|------|------------------------|--------------|--------------|------|-------------|---------------|
| First N seconds (`N=2`) | 2 | `00:00:02.02` | 2.00s (50 frames @ 25 fps) | 2.02s | no (both clips > N) | 0 | none |
| First N seconds (`N=1`) | 1 | `00:00:01.02` | 1.00s (25 frames) | 1.02s | no | 0 | none |
| Match shortest (min=5s, not shipped) | 5 | `00:00:05.02` | 5.00s | 5.01s | no | 0 | none |
| Pad-to-longest baseline (max=10s) | 10 | `00:00:10.02` | 10.00s (250 frames) | 10.00s | yes (5s cell) | 0 | none |

A/V: first-clip audio does **not** run past video. The ~20ms audio/container vs video is AAC encoder padding, same as today's longest path (`00:00:10.02`). `apad` + new `-t` did not error.

**Shipped policy:** Full length (default, pad-to-longest) + **First N seconds** (`5` / `15` / `30` / `60`) via one `<select id="output-duration">`. Not shortest — users want the start of long clips (e.g. first 15s of 10-minute sources), not whatever cell happens to be shortest.

## Maintenance notes

- Reviewer: 021 audio notes still apply (`0:a?`, optional stream).
- If 040 prefs exist, persist `durationMode` there (small extra; allowed if 040 already merged, otherwise leave a comment).
