# Plan 044: Overlay a single occupied cell; keep xstack for two or more

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat a7bd825..HEAD -- lib/mosaic.js test/mosaic.test.js test/output-settings.test.js test/ffmpeg-integration.test.js`
> Compare excerpts against live code; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `a7bd825`, 2026-08-27

## Why this matters

README promises mosaics of **1–9** videos. After plan 037, `buildFilterComplex` always emits `xstack=inputs=N` for any occupied count, including `N=1`. Bundled FFmpeg 6.0 (`ffmpeg-static`) documents xstack `inputs` as `(from 2 to INT_MAX)` and rejects a 1-input graph:

```
Value 1.000000 for parameter 'inputs' out of range [2 - 2.14748e+09]
Error applying option 'inputs' to filter 'xstack'
```

Dropping one file and clicking Convert — the first-run path — always fails at encode. Plan 037’s spike used two-or-more occupied cells (2×2 opposite corners). Tests never run the one-cell graph through ffmpeg (`test/mosaic.test.js` sparse 2×2 is string-only; the only xstack golden is `inputs=9`).

## Current state

`lib/mosaic.js` `buildFilterComplex` (after per-cell `blockN` chains):

```javascript
if (occupiedIndices.length > 0) {
    const layout = occupiedIndices
        .map(function (index) {
            const val = videoInfo[index];
            return `${val.coord.x}_${val.coord.y}`;
        })
        .join('|');

    complexFilter.push({
        filter: 'xstack',
        options: `inputs=${occupiedIndices.length}:fill=black:layout=${layout}`,
        inputs: occupiedIndices.map(function (index) {
            return 'block' + index;
        }),
        outputs: 'stacked',
    });

    complexFilter.push({
        filter: 'overlay',
        options: { x: 0, y: 0 },
        inputs: ['canvas', 'stacked'],
        outputs: 'final',
    });
}
```

`test/mosaic.test.js` “sparse 2x2 filter and args contract” (`:27-62`) asserts one canvas `color=`, letterbox pad, `[final]`, encoder flags — **not** `xstack`. `test/output-settings.test.js` `sparseTwoByTwo()` is the same one-clip graph.

Confirm the binary yourself:

```
node -e "console.log(require('ffmpeg-static'))"
# then: ffmpeg -h filter=xstack
# inputs (from 2 to INT_MAX)
```

**Conventions**: goldens in `test/mosaic.test.js`. `filterEntryToString` already serializes overlay `{ x, y }` to `overlay=x=…:y=…`. Integration smoke pattern: `test/ffmpeg-integration.test.js` (skip if no `ffmpeg-static`). Short imperative commits. No AI co-author trailers.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 |
| Mosaic tests | `node --test test/mosaic.test.js test/output-settings.test.js test/ffmpeg-integration.test.js` | exit 0 |
| Bundled ffmpeg | `node -e "console.log(require('ffmpeg-static'))"` | prints a path |
| xstack help | `"$FFMPEG" -h filter=xstack` | `inputs` range starts at **2** |

No lint/typecheck script. Do not add one.

## Scope

**In scope**:

- `lib/mosaic.js` `buildFilterComplex` occupied-cell compose (the `if (occupiedIndices.length > 0)` block)
- `test/mosaic.test.js` (N=1 goldens; keep N=9 xstack golden)
- `test/output-settings.test.js` only if a golden starts matching `xstack=inputs=1`
- `test/ffmpeg-integration.test.js` — add a one-cell mosaic encode through `buildFilterComplex` + `buildFfmpegArgs`

**Out of scope**:

- Unique-path `split` / fewer `-i`s (plan 049)
- Removing canvas+overlay for N≥2 (037 required it for 720p 3×3 leftover column)
- Hardware encode, fps, crf, letterbox/crop math
- Signed macOS (`plans/DEFERRED.md`)

## Git workflow

- Branch: `advisor/044-xstack-single-cell`
- Message: `Overlay a single mosaic cell instead of xstack with one input.`
- Do not push unless asked.

## Steps

### Step 1: Branch the N=1 compose path

When `occupiedIndices.length === 1`, do **not** emit xstack. Overlay that `blockK` onto `[canvas]` at `videoInfo[k].coord.x` / `.coord.y` (same positions `buildVideoInfo` already sets). Output label `[final]`.

When `occupiedIndices.length >= 2`, keep the current xstack + `[canvas][stacked]overlay=x=0:y=0[final]`.

When `occupiedIndices.length === 0`, leave the canvas-only graph as today (`buildFfmpegArgs` still throws `No video inputs`).

Target shape for one occupied slot at index `k`:

```javascript
complexFilter.push({
    filter: 'overlay',
    options: { x: val.coord.x, y: val.coord.y },
    inputs: ['canvas', 'block' + index],
    outputs: 'final',
});
```

**Verify**: `node -e "const m=require('./lib/mosaic'); const slots=['/only.mp4',null,null,null]; const vi=m.buildVideoInfo(slots,{'/only.mp4':10},10); const f=m.buildFilterComplex(vi,10,...m.gridMetrics('2x2')); if(/xstack=inputs=1/.test(f)) process.exit(1); if(!/overlay=x=0:y=0/.test(f) && !/overlay=x=0:y=0\\[final\\]/.test(f)) { console.log(f); process.exit(1);} "` — adjust the overlay regex to whatever `filterEntryToString` emits; the filter string must **not** contain `xstack=inputs=1`.

### Step 2: Goldens

In `test/mosaic.test.js` sparse 2×2 test:

- `assert.doesNotMatch(filterComplex, /xstack=/)` (one cell)
- `assert.match(filterComplex, /\[canvas\]\[block0\]overlay=/)` **or** the exact `filterEntryToString` form you produce (include `x=0` and `y=0` for slot 0)
- Keep `[final]` and the existing letterbox/canvas assertions

Keep `3x3 xstack layout…` asserting `xstack=inputs=9`.

Add a 2×2 **two-cell** golden (e.g. slots 0 and 3 occupied) that still has `xstack=inputs=2` and no `xstack=inputs=1`.

**Verify**: `node --test test/mosaic.test.js test/output-settings.test.js` → exit 0

### Step 3: Real ffmpeg smoke for N=1

In `test/ffmpeg-integration.test.js` (same skip-if-no-binary pattern):

1. Encode a tiny lavfi color clip to a temp `.mp4` (copy the existing 1s green clip test, shorter is fine, e.g. `d=0.2`).
2. `buildVideoInfo(['<that path>', null, null, null], { [path]: 0.2 }, 0.2)` (or probe-free: pass duration 0.2).
3. `buildFilterComplex` + `buildFfmpegArgs` to a second temp path.
4. `spawnSync(ffmpegBinary, args)` — **status 0**, output file size > 0.
5. Unlink temps in `finally`.

If this encode fails with xstack `inputs` out of range, step 1 is not done.

**Verify**: `node --test test/ffmpeg-integration.test.js` → exit 0 (or skip only when `ffmpeg-static` is missing)

## Test plan

- Sparse 2×2 / `sparseTwoByTwo`: no `xstack=`; `[final]` present; letterbox unchanged.
- Two occupied 2×2 cells: `xstack=inputs=2`.
- Existing 3×3 nine-cell xstack golden unchanged.
- New integration: one real file, production argv, ffmpeg exit 0.
- Pattern: `test/mosaic.test.js` sparse test; `test/ffmpeg-integration.test.js` skip + `spawnSync`.

Verification: `npm test` → exit 0, including the new tests.

## Done criteria

- [ ] `npm test` exits 0
- [ ] `grep -n "xstack=inputs=1" lib/ test/` returns no production graph that can emit `inputs=1` (test files may mention it in `doesNotMatch`)
- [ ] One-cell convert through bundled ffmpeg exits 0 in `test/ffmpeg-integration.test.js`
- [ ] N≥2 still uses xstack (existing `inputs=9` golden passes)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row for 044 set to DONE

## STOP conditions

- Excerpts in Current state do not match live `buildFilterComplex`.
- Bundled ffmpeg **accepts** `xstack=inputs=1` (then this bug is gone — STOP and report; do not change the graph without evidence).
- N=1 overlay pixels would require changing letterbox/crop/cell sizes — do not; overlay at existing `coord`.
- You think the fix is `xstack=inputs=2` with a dummy input — that is wrong; overlay the one block.
- Need to touch `lib/ffmpeg-session.js` — you should not; this is filter-graph only.

## Maintenance notes

- Reviewer: one-cell must overlay at **cell origin**, not `0,0` of a stacked bbox unless that origin is the cell’s coord (slot 0 is `0,0`; slot 3 in 2×2 is `640,360` at 720p).
- Plan 049 may rewrite `-i` / `inputIndex`; keep this N=1 overlay branch.
- Do not reintroduce per-empty-slot `color=` sources (036).
