# Plan 024: Investigate adding `-pix_fmt yuv420p` for player compatibility

> **Executor instructions**: This is an **investigate** plan. Encode a tiny mosaic with the bundled ffmpeg, probe `pix_fmt` of the output, and play it if you can. Only add `-pix_fmt yuv420p` if output is not already yuv420p or a target player rejects it. Update the investigation result.
>
> **Drift check (run first)**: `git diff --stat b558cb8..HEAD -- lib/mosaic.js test/mosaic.test.js`

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/001-add-node-test-runner.md
- **Category**: bug
- **Planned at**: commit `b558cb8`, 2026-08-26

## Why this matters

Audit confidence was **LOW**. Encode uses `libx264` without `-pix_fmt yuv420p`. The filter graph mixes `color` sources and `overlay`. Some players (historically QuickTime) reject yuv444/yuv422 high-profile files or show black frames. Others play them. This is compatibility, not a confirmed bug.

## Current state

`buildFfmpegArgs` / `main.js:471-483`: `-vcodec libx264 -r 25` without pix_fmt. Plan 014 may add `-preset veryfast -crf 23`.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| ffmpeg | bundled `@ffmpeg-installer/ffmpeg` path | runs |
| Tests | `npm test` | exit 0 if argv changes |

## Scope

**In scope**: one experimental encode; optionally `'-pix_fmt', 'yuv420p'` in `buildFfmpegArgs` + mosaic tests

**Out of scope**: Hardware encode, changing CRF, container format

## Git workflow

- Branch: `advisor/024-investigate-yuv420p`
- Message: `Document output pixel format and pin yuv420p if needed.`
- Do not push unless asked.

## Steps

### Step 1: Produce a 1s mosaic

Using extracted `buildFfmpegArgs` if possible, or a minimal filter `color=black:1280x720:d=1 [final]` mapped to an mp4. Probe with the same ffmpeg: `-i out.mp4` and look for `yuv420p` vs `yuv444p` / `yuv422p`.

**Verify**: result section lists `pix_fmt`

### Step 2: Decide

- If already `yuv420p`: do **not** add a redundant flag unless you want explicit pinning (allowed; say why).
- If not yuv420p: add `'-pix_fmt', 'yuv420p'` after `-vcodec libx264` (or before `-r`). Update tests.

**Verify**: `npm test` if code changed

## Test plan

- Argv golden includes `yuv420p` only if you add it.
- Optional QuickTime/VLC — note if unavailable.

## Done criteria

- [ ] Investigation result has measured `pix_fmt`
- [ ] Code change only if needed or explicit pin documented
- [ ] `plans/README.md` 024 DONE or BLOCKED (no ffmpeg)

## STOP conditions

- Adding pix_fmt makes ffmpeg fail on this 4.4 binary — revert and report.

## Maintenance notes

- Reviewer: yuv420p is the compatible default for H.264 web/desktop.

## Investigation result

_(executor fills in)_

- Measured pix_fmt:
- Flag added (yes/no):
