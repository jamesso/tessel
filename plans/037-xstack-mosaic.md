# Plan 037: Compose occupied mosaic cells with xstack instead of N overlays

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat c2b112f..HEAD -- lib/mosaic.js test/mosaic.test.js test/output-settings.test.js test/ffmpeg-integration.test.js`
> Plan 036 should already skip black placeholder overlays. If 036 is not done, **STOP** and do 036 first. On excerpt mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/036-skip-black-overlays.md
- **Category**: perf
- **Planned at**: commit `c2b112f`, 2026-08-26

## Why this matters

After 036, occupied cells are still blended with serial `overlay` onto a full-canvas `color` source (`mosaicN` depends on `mosaicN-1`). A full 3×3 at 1080p does nine full-frame overlays per output frame on top of libx264 `veryfast`. `xstack` (or row `hstack` + `vstack`) is one layout node. Pixel sizes, leftover 428px last column, letterbox/crop, and tpad-to-longest must stay identical. If a spike cannot match overlay pixels, **do not ship xstack** — report and leave 036’s overlay-on-canvas.

## Current state (after 036)

`buildFilterComplex` still overlays each non-black `blockN` onto `canvas` / `mosaicN` at `val.coord.x` / `val.coord.y`. Per-cell `setpts` / scale / pad or crop / tpad stay. `buildFfmpegArgs` maps `[final]`.

FFmpeg 6.0 (`ffmpeg-static`) is the binary. Integration test today encodes a 1s lavfi **color** clip without a mosaic graph (`test/ffmpeg-integration.test.js`).

**Conventions**: goldens in `test/mosaic.test.js`. Letterbox default, crop optional (021). Short imperative commits. No AI co-author trailers.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 |
| Bundled ffmpeg | `node -e "console.log(require('ffmpeg-static'))"` | prints a path |
| Spike (step 1) | encode two tiny lavfi mosaics (overlay vs xstack) and compare | see step 1 |

## Scope

**In scope**:

- `lib/mosaic.js` `buildFilterComplex` overlay section
- `test/mosaic.test.js`, `test/output-settings.test.js`
- Optional `test/ffmpeg-integration.test.js` one lavfi 2×2 mosaic through `buildFilterComplex` + `buildFfmpegArgs`

**Out of scope**:

- Duplicate-file `split` (same path many `-i`s)
- Hardware encode
- Changing 25 fps / crf / preset / yuv420p
- Signed macOS (`plans/DEFERRED.md`)

## Git workflow

- Branch: `advisor/037-xstack-mosaic`
- Message: `Compose mosaic cells with xstack instead of chained overlays.`
- Do not push unless asked.

## Steps

### Step 1: Spike overlay vs xstack pixels

Using bundled ffmpeg, 2×2, two 64×64 lavfi colors (red/blue) in opposite corners, letterbox, 2s, 1280×720 (or 256×144 to keep it tiny — then **also** run one 1280×720 2×2 if the small size matches, because leftover math differs). Extract one PNG or rawframe from each encode (`-frames:v 1`). If pixels differ, STOP, write the result in this file under `## Spike result`, leave overlay in place, mark the plan **BLOCKED** (spike mismatch) — do not “fix” by changing letterbox.

If they match (or differ only in encoder noise below a threshold you record), proceed.

**Verify**: you wrote spike dimensions, ffmpeg version, and match/mismatch in `## Spike result` at the bottom of this plan

### Step 2: Implement xstack (or hstack/vstack) for occupied cells

Keep per-cell filter chains producing `blockN` at `cellWidth`×`cellHeight`.

Replace the overlay loop with one `xstack` whose `layout` uses the same `coord.x` / `coord.y` as `buildVideoInfo` (720p 3×3 last column x=852). Inputs are only non-black blocks. Output size must be the canvas (`resolved.width` × `resolved.height`). Empty regions stay black: `xstack` `fill=black` **or** overlay the xstack result once onto the existing canvas. Prefer whichever the spike used.

Map that output to `[final]`.

Do not change `-i` order or audio `firstReal.inputIndex`.

**Verify**: goldens: no chained `overlay=x=` hops for mosaicN; `xstack` (or documented hstack/vstack) present; 3×3 last cell still 428×240 at x=852

### Step 3: Tests

Update overlay-position tests to assert xstack layout contains `852` and `480` for 720p 3×3 bottom-right (or the equivalent layout token). Letterbox/crop/tpad assertions stay.

Optional: lavfi 2×2 through production `buildFfmpegArgs` in `test/ffmpeg-integration.test.js` (few-second timeout, skip if no binary).

**Verify**: `npm test` → exit 0

### Step 4: Mark the plan

`plans/README.md` 037 DONE or BLOCKED (spike mismatch).

## Test plan

- Goldens for layout coordinates (015 leftover).
- Pattern: `test/mosaic.test.js` 3×3 overlay positions test — rewrite to xstack layout.
- Spike is mandatory before swapping production filters.

## Done criteria

- [ ] `## Spike result` filled
- [ ] If spike matched: production graph uses xstack (or hstack/vstack), not N overlays; `npm test` exits 0
- [ ] If spike mismatched: overlay left in place; status BLOCKED with one line; `npm test` still 0
- [ ] No files outside the in-scope list are modified (except this plan’s spike section)
- [ ] `plans/README.md` updated

## STOP conditions

- Pixel mismatch on the spike — do not ship xstack.
- Changing pad-to-longest into freeze-frame (`tpad` must stay `stop_mode=add` + black).
- Reintroducing per-empty-slot `color=black` cell sources (036).

## Spike result

- **ffmpeg**: 6.0 (`ffmpeg-static`, bundled)
- **Dimensions**: 1280×720 (2×2 opposite corners, red/blue 64×64 lavfi → letterbox 640×360 cells); also verified 2×2 sparse, 3×3 sparse, and 3×3 full at 1280×720
- **Overlay graph**: production post-036 chain (canvas + serial `overlay` per occupied cell)
- **xstack graph**: same per-cell `blockN` chains + `xstack=inputs=N:fill=black:layout=x_y|...` + single `[canvas][stacked]overlay=0:0[final]` (plain `xstack` with `fill=black` alone mismatched on 3×3 full — bounding box / uneven 428px column — so production uses canvas composite)
- **Comparison**: frame 0 extracted as `rgb24` rawvideo; byte-for-byte pixel compare
- **Result**: **MATCH** (0 mismatched pixels on all verified scenarios with canvas+xstack composite)

## Maintenance notes

- Reviewer: 428px last column and letterbox/crop must be bit-identical in intent to overlay.
- Uneven columns make `xstack=grid=3x3` the wrong API; use explicit `layout=x_y|...`.
