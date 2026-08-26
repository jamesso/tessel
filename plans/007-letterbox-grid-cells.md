# Plan 007: Letterbox mosaic cells instead of stretching

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat b558cb8..HEAD -- lib/mosaic.js main.js test/mosaic.test.js`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/001-add-node-test-runner.md
- **Category**: bug
- **Planned at**: commit `b558cb8`, 2026-08-26

## Why this matters

Each cell is `scale=blockWidth:blockHeight` with no aspect-ratio preservation (`main.js:405-410` / `lib/mosaic.js` after 001). 2×2 cells are 640×360 (16:9); 3×3 cells are 426×240. 4:3 and 9:16 sources are distorted. README claims “High Quality Output: Maintains video quality in mosaic format.” Output canvas stays 1280×720 (product contract until plan 021).

## Current state

Scale filter object:

```javascript
complexFilter.push({
    filter: 'scale',
    options: [blockWidth, blockHeight],
    inputs: 'reset' + index,
    outputs: 'scaled' + index
});
```

Stringifier joins array options with `:` → `scale=640:360` (2×2).

**Conventions**: Keep building filters as objects + strings in `lib/mosaic.js`. Update golden strings in `test/mosaic.test.js`.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 |
| Scale flags | `grep -n "force_original_aspect_ratio" lib/mosaic.js main.js` | match in mosaic builder |

## Scope

**In scope**:
- `lib/mosaic.js` (and `main.js` only if 001 did not finish extraction)
- `test/mosaic.test.js`

**Out of scope**:
- User-facing crop vs letterbox setting (plan 021)
- Changing 1280×720 canvas
- 3×3 leftover pixels (plan 015)

## Git workflow

- Branch: `advisor/007-letterbox-grid-cells`
- Message: `Letterbox mosaic cells instead of stretching videos.`
- Do not push unless asked.

## Steps

### Step 1: Scale + pad

For non-black cells, replace naked `scale=w:h` with:

1. `scale=blockWidth:blockHeight:force_original_aspect_ratio=decrease`
2. `pad=blockWidth:blockHeight:(ow-iw)/2:(oh-ih)/2:black` (or `color=black`)

Keep `setpts` before scale and `tpad`/`copy` after pad. Output label of the pad step should still feed the current `scaledN` / `blockN` chain — e.g. scale → `fittedN`, pad → `scaledN`, then existing tpad/copy.

FFmpeg pad `ow`/`iw` expressions must be valid in the version shipped (`@ffmpeg-installer` FFmpeg 4.4). If `pad=w:h:(ow-iw)/2:(oh-ih)/2` fails on 4.4, use `pad=${blockWidth}:${blockHeight}:(ow-iw)/2:(oh-ih)/2:black`.

**Verify**: `npm test` — `test/mosaic.test.js` asserts filter string contains `force_original_aspect_ratio=decrease` and `pad=`

### Step 2: Update characterization tests

Any test that expected `scale=640:360` without pad must be updated. Add a case: 2×2 occupied cell filter includes both scale decrease and pad.

**Verify**: `npm test` → exit 0

## Test plan

- Update `test/mosaic.test.js` goldens.
- Manual (optional): 4:3 clip in one cell shows side bars, not a squash.

## Done criteria

- [ ] No `scale` to cell size without `force_original_aspect_ratio=decrease` for real inputs
- [ ] `pad` present for those cells
- [ ] Black `color=` placeholders unchanged
- [ ] `npm test` exits 0
- [ ] `plans/README.md` 007 DONE

## STOP conditions

- Pad/scale syntax is rejected by the bundled ffmpeg 4.4 — capture the error, stop; do not upgrade ffmpeg here (plan 026).
- Plan 001 not landed (`lib/mosaic.js` missing).

## Maintenance notes

- Plan 021 may add a “fill/crop” alternative; keep letterbox as default.
- Reviewer: overlay coordinates still use `blockWidth`/`blockHeight`.
