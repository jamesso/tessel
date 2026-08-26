# Plan 015: Fill the 2px gap on 3×3 mosaics

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat b558cb8..HEAD -- lib/mosaic.js test/mosaic.test.js`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/001-add-node-test-runner.md
- **Category**: bug
- **Planned at**: commit `b558cb8`, 2026-08-26

## Why this matters

`blockWidth = Math.floor(1280 / 3) = 426`; third column `x = 852`; `852+426 = 1278`. Canvas is `1280x720`. Every 3×3 export has a 2px black strip on the right. 2×2 divides evenly (640×360).

## Current state

```javascript
let x=1280, y=720;
const gridSize = isGrid3x3 ? 3 : 2;
const blockWidth = Math.floor(x / gridSize);
const blockHeight = Math.floor(y / gridSize);
// coord: x: col * blockWidth, y: row * blockHeight
```

`gridMetrics` after 001 uses the same floor division.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 |

## Scope

**In scope**: `lib/mosaic.js`, `test/mosaic.test.js`

**Out of scope**: Letterbox (plan 007) — if 007 landed, last-column width still applies to pad/scale target size. Do not change 1280×720 canvas.

## Git workflow

- Branch: `advisor/015-fix-3x3-pixel-gap`
- Message: `Give leftover pixels to the last 3x3 column.`
- Do not push unless asked.

## Steps

### Step 1: Per-cell size and origin

For grid size 3, widths `[426, 426, 428]` (or compute `w, w, 1280-2w`). Heights: `floor(720/3)=240` exactly, no leftover.

`coord.x` for column 0 = 0, col 1 = 426, col 2 = 852. `scale`/`pad`/`color=black` size for that cell uses **that cell’s** width/height, not a uniform 426.

2×2 remains uniform 640×360.

**Verify**: tests: last 3×3 overlay x + width === 1280; first two widths 426

### Step 2: Tests

`gridMetrics('3x3')` returns column widths summing to 1280. Filter `color=black:size=` for index 2 (top-right) uses 428×240 if you use row-major index 2 = column 2. Indices: 0,1,2 first row — index 2 is last column.

**Verify**: `npm test` → exit 0

## Test plan

- Characterization in `test/mosaic.test.js`.

## Done criteria

- [ ] 3×3 cell widths sum to 1280
- [ ] 2×2 unchanged
- [ ] `npm test` exits 0
- [ ] `plans/README.md` 015 DONE

## STOP conditions

- Overlay chain assumes equal block sizes in a way that breaks with 428 vs 426 — fix coords/sizes together; do not stretch the whole mosaic with a second scale (that would reshift letterboxing).

## Maintenance notes

- Reviewer: black placeholders for column 3 must be 428 wide or a 2px gap remains.
