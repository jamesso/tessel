# Plan 021: Spike user-visible output settings (resolution, audio, fit)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat b558cb8..HEAD -- main.js lib/mosaic.js app/js/index.js app/index.html`

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/007-letterbox-grid-cells.md, plans/014-x264-preset-and-progress.md
- **Category**: direction
- **Planned at**: commit `b558cb8`, 2026-08-26

This is a **design/spike plan**. Do not build a full mixer, custom fps control, or extra grid sizes. Deliver: a short written decision (in `plans/021-output-settings-notes.md`) **and**, if the spike is unambiguous, a **minimal** UI of at most three controls wired into existing `x/y`, `-an`, and scale/pad.

## Why this matters

`main.js` comments `// Change this to the desired output resolution` then hardcodes `x=1280, y=720`. Encode uses `rate=25`, `-an`, `-r 25`, `libx264`. Scale used to stretch (plan 007 letterboxes). README “High Quality Output” never mentions stripped audio. The production window is 450×600 with no settings chrome. Users re-run ffmpeg by hand for 1080p, sound, or crop-to-fill.

## Current state

`lib/mosaic.js` `OUTPUT = { width: 1280, height: 720, fps: 25 }` after plan 001. Args include `-an`. Letterbox via `force_original_aspect_ratio=decrease` + `pad` after 007.

**Product constraint:** keep 2×2 and 3×3 as the only grids. Default remains 1280×720, 25 fps, silent, letterbox so existing users are not surprised.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 |
| Notes file | `test -f plans/021-output-settings-notes.md` | exists at the end |

## Scope

**In scope**:
- `plans/021-output-settings-notes.md` (create) — decisions and open questions
- Optionally: `app/index.html` / `app/js/index.js` / `lib/mosaic.js` / `main.js` for **≤3** controls if notes say “implement now”:
  1. Resolution: 1280×720 vs 1920×1080
  2. Audio: mute (current) vs first-clip audio only
  3. Fit: letterbox (current) vs crop-to-fill (`force_original_aspect_ratio=increase` + `crop`)

**Out of scope**:
- Per-cell volume, ducking, sample-rate UI
- Arbitrary width/height text fields
- 4×4 grids, 60 fps picker
- macOS notarization

## Git workflow

- Branch: `advisor/021-output-settings-spike`
- Message: `Spike mosaic output settings (resolution, audio, fit).`
- Do not push unless asked.

## Steps

### Step 1: Write the decision notes

Create `plans/021-output-settings-notes.md` answering:

- Default policy (recommend: keep 720p / mute / letterbox)
- Whether 1080p 3×3 is acceptable on the slowest supported machine (qualitative)
- Audio: first input with an audio stream vs always mute — A/V sync risk if clips differ in length (tpad is video-only today)
- Fit: letterbox vs crop
- What will **not** ship

**Verify**: file exists and contains headings Default, Audio, Fit, Wont-ship

### Step 2: Implement only if notes say so

If notes conclude “docs-only / later,” stop after step 1 and mark this plan DONE with notes. That is a valid completion.

If notes conclude “ship three toggles,” pass `{ width, height, audio: 'none'|'first', fit: 'letterbox'|'crop' }` through existing `video:convert` payload (add fields; main ignores unknown today). Thread into `gridMetrics` / `buildFilterComplex` / `buildFfmpegArgs`. For audio `first`: drop `-an`, `-map [final]`, and add `-map 0:a?` or the first non-black input’s audio — **STOP and report** if you cannot keep A/V duration aligned with `-t longestDuration` without a new filter (`apad`/`tpad` audio). Do not guess an audio graph.

Update `test/mosaic.test.js` for 1080p block sizes and crop vs pad.

**Verify**: `npm test` → exit 0 if you implemented; else notes-only

## Test plan

- Notes review by human.
- If implemented: mosaic tests for 1920×1080 metrics; crop filter contains `increase` + `crop`.

## Done criteria

- [ ] `plans/021-output-settings-notes.md` exists with explicit defaults
- [ ] Either no code change (notes-only) **or** ≤3 controls + tests green
- [ ] Defaults remain 720p / mute / letterbox unless notes explicitly change them
- [ ] `plans/README.md` 021 DONE

## STOP conditions

- Audio mix of all clips — out of scope; do not implement.
- 1080p requires encoder preset change beyond plan 014 — mention in notes, do not silently drop to `ultrafast`.

## Maintenance notes

- Window is 450px wide — settings must fit without a new window if you implement UI.
- Reviewer: `-an` removal is the riskiest line.
