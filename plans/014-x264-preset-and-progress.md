# Plan 014: Speed up libx264 and show progress during duration probe

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat b558cb8..HEAD -- lib/mosaic.js main.js app/js/index.js test/mosaic.test.js`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: MED
- **Depends on**: plans/001-add-node-test-runner.md, plans/002-fix-duration-probing.md
- **Category**: perf
- **Planned at**: commit `b558cb8`, 2026-08-26

## Why this matters

Encode argv is `-vcodec libx264 -r 25` with **no** `-preset` or `-crf` (`main.js:471-483`). x264 defaults to preset `medium` and CRF 23 — slow for an interactive 9-cell mosaic. Progress is parsed only from encode stderr (`main.js:498-512`) **after** probing, so the overlay sits at 0% during duration analysis. Percent is capped at 99 (`main.js:505`). Product output remains 25 fps / 1280×720 / no audio.

## Current state

```javascript
'-vcodec', 'libx264',
'-r', '25',
'-t', longestDuration.toString(),
```

`progressPercent` after 001: `Math.min(round(...), 99)`. Renderer: `progressText.textContent = \`${percent}%\`` (`app/js/index.js:222-231`).

**Conventions**: Argv built in `lib/mosaic.js` `buildFfmpegArgs`. IPC `video:progress` `{ percent }`.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 |
| Preset | `grep -n "veryfast\\|preset" lib/mosaic.js main.js` | `-preset` in argv |

## Scope

**In scope**:
- `lib/mosaic.js` `buildFfmpegArgs`
- `test/mosaic.test.js`
- `main.js` (send progress during probe; 100% on success)
- `lib/timecode.js` `progressPercent` + tests
- `app/js/index.js` if progress payload gains a `phase` string (optional)

**Out of scope**:
- Changing CRF if it would violate “high quality” — **keep `-crf 23`** and only add `-preset veryfast` (or `fast` if you have evidence `veryfast` is too ugly). Do not switch to `ultrafast` without reporting.
- Hardware encoders
- Replacing progress regex (plan 025)
- `-pix_fmt yuv420p` (plan 024)

## Git workflow

- Branch: `advisor/014-x264-preset-and-progress`
- Message: `Use a faster x264 preset and report probe progress.`
- Do not push unless asked.

## Steps

### Step 1: Encoder flags

In `buildFfmpegArgs`, after `-vcodec libx264`, add `'-preset', 'veryfast'` and `'-crf', '23'`. Keep `-r 25`, `-an`, `-vsync cfr`. Optional: insert `fps=25` in the filter graph immediately after scale — only if tests still match overlay labels; if filter tests explode, skip fps-in-filter and keep output `-r 25` only.

**Verify**: `node -e "const m=require('./lib/mosaic'); const a=m.buildFfmpegArgs(/*minimal videoInfo*/);"` — easier via `npm test` asserting argv includes `veryfast` and `23`

### Step 2: Probe-phase progress

During `processDurations`, after each video finishes probing, `sendToRenderer('video:progress', { percent: Math.round((done/total)*100) })` **or** `{ percent: 0, phase: 'Analyzing 2/3' }`. If you add `phase`, renderer must display it in `#progress-text` when `percent` is 0. Keep this simple: percent 0–10 during probe is enough.

On encode `close` code 0, send `{ percent: 100 }` then `video:done`. Change `progressPercent` cap from 99 to 100 (or send 100 only on done). Update `test/timecode.test.js` that expected 99 at completion.

**Verify**: `grep -n "99" lib/timecode.js test/timecode.test.js` — completion cap is 100 unless you still cap in-progress samples at 99 and send 100 separately (document in tests)

### Step 3: Tests

- `buildFfmpegArgs` contains `-preset veryfast` and `-crf 23` in that order relative to libx264.
- `progressPercent(100, 100) === 100` if you lifted the cap.

**Verify**: `npm test` → exit 0

## Test plan

- Update mosaic argv goldens.
- Manual: overlay should move before encode stderr `time=` lines.

## Done criteria

- [ ] argv includes `-preset veryfast` and `-crf 23`
- [ ] Overlay is not stuck at 0% for the entire probe if more than one file (or shows a phase string)
- [ ] Successful encode can display 100% or skip straight to done without a 99 freeze
- [ ] `npm test` exits 0
- [ ] `plans/README.md` 014 DONE

## STOP conditions

- CRF change is requested to “make files smaller” — do not lower quality in this plan; preset only plus explicit CRF 23.
- Filter fps insertion breaks tpad timestamps — revert fps-in-filter; keep `-r 25` on output.

## Maintenance notes

- Plan 021 may expose CRF/preset; default should stay these values.
- Reviewer: README “high quality” still holds at CRF 23.
