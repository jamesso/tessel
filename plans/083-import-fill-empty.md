# Plan 083: Offer fill-empty when importing a layout, keep replace as the default

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat f14caf4..HEAD -- main.js app/js/index.js lib/prefs.js test/prefs.test.js`
> Compare excerpts against live code; on a mismatch, treat it as a STOP condition.
> Sequence **after** 065 (both edit import).

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: MED
- **Depends on**: plans/065-block-import-during-convert.md
- **Category**: direction
- **Planned at**: commit `f14caf4`, 2026-08-27

## Why this matters

`prefs:imported` always `applyPrefs(..., { applyGrid: true })`, overwriting every visible slot and Advanced settings. Multi-drop only fills empties. Import is the only layout I/O and it clobbers. Missing files already skip (`filterMissingPaths`). Users cannot drop a 2-clip layout onto an in-progress mosaic. Replace must remain default so backups restore exactly (061).

## Current state

`main.js` `importLayout` → `sendToRenderer('prefs:imported', prefs)` then a message box about absolute paths. No merge. `applyPrefs` with `applyGrid: true` fills all visible slots from `prefs.paths`.

**Conventions**: `dialog.showMessageBox` with buttons. Main process reads JSON. Short imperative commits. No AI co-author trailers.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 |
| Prefs | `node --test test/prefs.test.js` | exit 0 |

## Scope

**In scope**:

- After successful parse + `filterMissingPaths`, `dialog.showMessageBox` with **Replace** (default) and **Fill empty cells** (or equivalent). Cancel = do not apply.
- Fill empty: **paths only** — for each visible slot, if current renderer path is empty and imported path is set, take imported; do not change Advanced settings, `lastSaveDir`, or occupied cells. Requires asking the renderer for current paths (new IPC) **or** sending `{ prefs, mode }` and letting the renderer merge with `collectSlotPaths()`.
- Replace: today’s `applyPrefs` including settings + grid type
- `lib/prefs.js` helper `mergeImportedPaths(currentPaths, importedPaths)` for tests
- README one sentence

**Out of scope**:

- Relative paths (084)
- Merging Advanced settings on fill-empty
- Import while converting (065)

## Git workflow

- Branch: `advisor/083-import-fill-empty`
- Message: `Let import fill empty mosaic cells instead of only replacing.`
- Do not push unless asked.

## Steps

### Step 1: Pure merge

```javascript
function mergeImportedPaths(currentPaths, importedPaths) {
    const next = currentPaths.slice();
    const n = Math.min(9, importedPaths.length, next.length);
    for (let i = 0; i < n; i++) {
        if (!next[i] && importedPaths[i]) next[i] = importedPaths[i];
    }
    return next;
}
```

Tests: occupied stays; empty fills; length 9.

**Verify**: `node --test test/prefs.test.js`

### Step 2: Dialog + renderer

`showMessageBox` buttons. Renderer: if fill, `applyPrefs` settings **skipped**; only `setSlotOccupied` for merged empties; keep `currentGrid` unless you also apply `gridType` from import when filling — **specified:** fill-empty does **not** switch 2×2/3×3 (user’s current grid). Hidden 3×3 slots: only merge indices `< visibleSlotCount()`.

**Verify**: `grep -n "Fill empty\\|mergeImportedPaths" main.js app/js/index.js lib/prefs.js`

### Step 3: Full suite + README

**Verify**: `npm test` → exit 0

## Test plan

- Unit merge helper.
- Grep message box / mode.
- Pattern: `test/prefs.test.js`.

## Done criteria

- [ ] Replace remains the default and restores settings + all slots
- [ ] Fill empty only writes empty visible cells; settings unchanged
- [ ] Cancel does not change the grid
- [ ] `npm test` exits 0
- [ ] `plans/README.md` 083 DONE

## STOP conditions

- Silent merge with no Replace option.
- Fill-empty overwrites occupied cells.
- Import during `isBusy()` (065).

## Maintenance notes

- Reviewer: 082 may keep hidden 3×3 paths; fill-empty on 2×2 must not write indices 4–8.
- Absolute-path warning box can stay after apply or before — do not drop it.
