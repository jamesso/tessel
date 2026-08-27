# Plan 036: Do not generate or overlay black placeholder cells

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat c2b112f..HEAD -- lib/mosaic.js test/mosaic.test.js test/output-settings.test.js`
> On excerpt mismatch, STOP. Do **not** switch to xstack in this plan (plan 037).

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (mosaic tests from 001 already exist)
- **Category**: perf
- **Planned at**: commit `c2b112f`, 2026-08-26

## Why this matters

Empty slots emit `color=black:size=…:duration=${longestDuration}` and are still `overlay`ed onto an already-black canvas. A one-clip 2×2 therefore runs four overlays; a one-clip 3×3 runs nine. Occupied cells and the 3×3 leftover column (428px at 720p) must look the same: canvas black shows through holes. Skip `isBlack` color sources and their overlays only.

## Current state

```javascript
// lib/mosaic.js:112-183
if (val.isBlack) {
    complexFilter.push(`color=black:size=${cellWidth}x${cellHeight}:duration=${longestDuration}:rate=${resolved.fps} [block${index}]`);
} else {
    // setpts / scale / pad or crop / tpad or copy → [blockN]
}
complexFilter.push(`color=black:size=${x}x${y}:duration=${longestDuration}:rate=${resolved.fps} [canvas]`);
videoInfo.forEach(function (val, index) {
    // overlay every index including isBlack
});
```

`test/mosaic.test.js` “sparse 2x2” asserts `color=black` and `[final]`. After this plan, canvas `color=black` remains; per-cell black `blockN` for empty slots must **not** appear. Occupied overlay positions (`coord.x` / `coord.y`) stay.

**Conventions**: keep `filterEntryToString` unless you only add a `continue`. Goldens in `test/mosaic.test.js` / `test/output-settings.test.js`. Short imperative commits. No AI co-author trailers.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 |
| Mosaic | `node --test test/mosaic.test.js test/output-settings.test.js` | exit 0 |

## Scope

**In scope**:

- `lib/mosaic.js` `buildFilterComplex` (and only argv if a test requires a comment)
- `test/mosaic.test.js`, `test/output-settings.test.js` goldens

**Out of scope**:

- xstack / hstack (037)
- Duplicate `-i` / `split` for the same file
- Crop-before-scale, `fps=25` inside the graph
- Changing letterbox/crop/tpad for occupied cells

## Git workflow

- Branch: `advisor/036-skip-black-overlays`
- Message: `Skip black placeholder cells in the mosaic filter graph.`
- Do not push unless asked.

## Steps

### Step 1: Occupied overlays only

In the overlay loop, `continue` (or skip push) when `val.isBlack`. Do **not** push the per-cell `color=black` for `isBlack` in the first loop.

Keep the full-canvas `color=black:size=${x}x${y}:… [canvas]`.

Overlay chain must still start from `canvas` and end at `[final]`. If only one occupied cell, one overlay `canvas` + `blockK` → `final` is enough. If zero occupied, `buildFfmpegArgs` already throws `'No video inputs'` — do not change that.

Empty-slot **coordinates** can remain on `videoInfo` (harmless).

**Verify**: sparse 2×2 filter string has exactly **one** `color=black` (the canvas), not four; still has `overlay` and `[final]`

### Step 2: Update goldens

`test/mosaic.test.js` sparse test currently `assert.match(filterComplex, /color=black/)`. Tighten if needed: canvas size 1280x720 (or resolved output), and `doesNotMatch` a 640x360 (2×2 cell) black color source if that is distinguishable.

Full 2×2 occupied: still four scale/pad (or crop) chains and four overlays (until 037). 3×3 leftover column tests still check 428px on **occupied or canvas** — last-column black placeholder test (`3x3 black placeholder in last column uses 428px width`) must still prove the **hole** is 428px wide via canvas showing through, **or** keep a cellWidth assertion on `videoInfo` without requiring a `color=black:size=428x240` filter. Prefer asserting `videoInfo[8].cellWidth === 428` and no `428x240` color source.

**Verify**: `npm test` → exit 0

### Step 3: Mark the plan

`plans/README.md` row 036 → DONE.

## Test plan

- Sparse 2×2: one canvas black, overlays only for occupied indices.
- 3×3 last-column geometry unchanged on `videoInfo`.
- Pattern: `test/mosaic.test.js`.

## Done criteria

- [ ] `isBlack` entries do not add `color=black:size=cell` or `overlay` hops
- [ ] Canvas `color=black` at output size remains
- [ ] `npm test` exits 0
- [ ] No files outside the in-scope list are modified
- [ ] `plans/README.md` 036 DONE

## STOP conditions

- Replacing overlay with xstack (that is 037).
- Reintroducing stretch instead of letterbox/crop.
- Pixel-gap regressions on 3×3 720p last column (428).

## Maintenance notes

- Reviewer: holes must stay black, not transparent or last-frame freeze.
- 037 may xstack occupied tiles; canvas-as-background is the sparse design this plan locks in.
