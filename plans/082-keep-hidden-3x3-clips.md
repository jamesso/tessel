# Plan 082: Keep 3×3 clips when switching to 2×2

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat f14caf4..HEAD -- app/js/index.js lib/prefs.js lib/mosaic.js test/prefs.test.js README.md`
> Compare excerpts against live code; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: MED
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `f14caf4`, 2026-08-27

## Why this matters

The grid is the work surface (`PRODUCT.md`). Toggling 2×2 `clearSlot`s indices 4–8 (`app/js/index.js` `switchGrid`) and `normalizePaths` nulls slots 5–9 for `gridType === '2x2'` (`lib/prefs.js`). Encode already slices with `selectSlotPaths` (`lib/mosaic.js`). Prior audits rejected “2×2 convert with hidden slots 5–9 filled” because toggle **destroyed** those clips. Users comparing 4 vs 9 cells lose five picks.

## Current state

```javascript
        if (gridType === '2x2') {
            if (index < 4) {
                dz.classList.remove('hidden')
            } else {
                dz.classList.add('hidden')
                clearSlot(dz, index + 1)
            }
```

```javascript
    if (gridType === '2x2') {
        for (let i = 4; i < 9; i++) {
            paths[i] = null;
        }
    }
```

`test/prefs.test.js` “2x2 clears hidden slots 5-9” **locks the destroy behavior**. Convert uses `selectSlotPaths(originalPaths, gridType)` so hidden filled slots would not enter a 2×2 encode **if** they were kept in `vidPath5-9` but UI still sent them in the payload — `selectSlotPaths` for 2×2 is `slice(0, 4)`. Still send all nine in IPC; session slices. Safe if `switchGrid` stops clearing.

Audio `refreshAudioOptions` uses `visibleSlotCount()` — hidden occupied cells must **not** appear in the 2×2 audio list (only visible slots).

**Conventions**: `markGridTouched` / `applyingPrefs` (050). Do not revive convert of hidden cells. Short imperative commits. No AI co-author trailers.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 |
| Prefs | `node --test test/prefs.test.js` | exit 0 |

## Scope

**In scope**:

- `app/js/index.js` `switchGrid` — hide extra cells **without** `clearSlot` (do not `hideCellPreview` unless you must; hidden CSS should not keep huge decoders if possible — optional `hideCellPreview` while hidden and `showCellPreview` when returning to 3×3 if path still set)
- `lib/prefs.js` — **stop** nulling indices 4–8 on 2×2 in `normalizePaths`; convert still slices. Update the prefs test that required clearing
- `persistPrefs` may store nine paths while `gridType` is 2×2
- README: switching to 2×2 hides extra clips; they return on 3×3
- Audio options: visible slots only (already `visibleSlotCount`)

**Out of scope**:

- 4×4 grids
- Encoding hidden slots in 2×2
- Import merge (083)

## Git workflow

- Branch: `advisor/082-keep-hidden-3x3-clips`
- Message: `Keep extra 3×3 clips when switching the grid to 2×2.`
- Do not push unless asked.

## Steps

### Step 1: Prefs

Remove 2×2 path wiping in `normalizePaths`. Replace `test/prefs.test.js` “2x2 clears hidden slots 5-9” with “2x2 persist may keep slots 5-9; encode still uses first four” (grep `selectSlotPaths` in mosaic tests already).

**Verify**: `node --test test/prefs.test.js test/mosaic.test.js`

### Step 2: switchGrid

Hide without `clearSlot`. When showing 3×3, do not clear visible empties. If you paused previews on hide, restore from `vidPathN`.

**Verify**: `grep -n "clearSlot" app/js/index.js` — `switchGrid` 2×2 branch must not call `clearSlot`

### Step 3: README + full suite

**Verify**: `npm test` → exit 0

## Test plan

- Prefs: 2×2 JSON may contain paths[4].
- Mosaic: 2×2 still four slots.
- Grep: switchGrid hide without clearSlot.
- Pattern: `test/prefs.test.js`, `test/mosaic.test.js` `selectSlotPaths`.

## Done criteria

- [ ] 2×2 encode still uses only slots 0–3
- [ ] Slots 5–9 paths survive a 2×2 round-trip in the UI
- [ ] Audio list on 2×2 does not list hidden files
- [ ] `npm test` exits 0
- [ ] `plans/README.md` 082 DONE

## STOP conditions

- You would overlay/xstack hidden 2×2 cells.
- `switchGrid` during `applyPrefs` would mark `userTouchedGrid` incorrectly (050: `clearSlot` during apply is skipped via `applyingPrefs`; hiding without clearSlot is safer).

## Maintenance notes

- Reviewer: logo/Clear (081) should still clear hidden paths if those dropzones are in the NodeList.
- Rejected finding “hidden 5–9 filled convert” stays rejected **for encode**; this plan makes hide ≠ delete.
