# Plan 060: Copy a clip onto an empty cell (keep the source filled)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat a7bd825..HEAD -- app/js/slot-fill.js app/js/index.js test/slot-fill.test.js lib/slot-fill.js`
> If 053 deleted `lib/slot-fill.js`, edit `app/js/slot-fill.js` only. On excerpt mismatch, STOP.
> Prefer **049 DONE** (same file in many slots should not mean nine `-i`s). Prefer **053 DONE** (one slot-fill file).

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/049-unique-inputs-split.md (recommended), plans/053-single-copy-slot-fill-media-accept.md (recommended)
- **Category**: direction
- **Planned at**: commit `a7bd825`, 2026-08-27

## Why this matters

In-app drag is **move-only**: `effectAllowed = 'move'` (`app/js/index.js:299`) and `swapOrMove` copies `from` onto `to` then writes the old `to` into `from` (`app/js/slot-fill.js:31-45`). Onto an empty cell that **clears the source**. Encode already allows the same path in many slots. Users who want a 2×2 of one clip must drop the file four times. If this ships without 049, a 3×3 of one clip is nine demuxes.

## Current state

```javascript
function swapOrMove(paths, fromIndex, toIndex) {
    const next = paths.slice();
    // bounds / empty source → no-op
    const fromVal = next[fromIndex];
    next[fromIndex] = next[toIndex];
    next[toIndex] = fromVal;
    return next;
}
```

`ondrop` without OS files: `window.swapOrMove(paths, fromIndex, i)` then `applyVisiblePaths`.

OS file drop is unchanged (replace one / fill empties) — do not alter 020.

Tests: `swapOrMove moves a clip onto an empty visible slot` expects source cleared (`test/slot-fill.test.js:50-53`).

**Conventions**: vanilla DnD. Classic scripts. After 053, tests require `app/js/slot-fill.js`. Short imperative commits. No AI co-author trailers.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 |
| Slot | `node --test test/slot-fill.test.js` | exit 0 |

## Scope

**In scope**:

- `swapOrMove` **or** a new `copyToEmpty` / `placeClip(paths, from, to, mode)` in the slot-fill UMD
- `app/js/index.js` drag: `effectAllowed = 'copyMove'`; `dropEffect` `copy` when Alt/Option (or Ctrl) is held **or** when dest is empty and a dedicated modifier is held — pick **one** rule in step 1 and test it
- `test/slot-fill.test.js`
- README one sentence if 048 already documented move-only (optional)

**Out of scope**:

- Changing OS-file drop
- Duplicate via a button instead of drag (unless DnD modifier is impossible — then STOP and report)
- Mix-all audio
- Implementing unique `-i` (049)

## Git workflow

- Branch: `advisor/060-copy-clip-to-empty-cell`
- Message: `Allow copying a clip onto an empty mosaic cell.`
- Do not push unless asked.

## Steps

### Step 1: Pure helper

Keep current `swapOrMove` behavior as **move** (including empty dest). Add copy:

```javascript
function copyToSlot(paths, fromIndex, toIndex) {
    const next = paths.slice();
    if (fromIndex === toIndex) return next;
    if (!next[fromIndex]) return next;
    next[toIndex] = next[fromIndex];
    return next;
}
```

Copy onto an **occupied** dest: either no-op (user can swap) or replace dest and keep source — **replace dest, keep source** is copy-over. Prefer: copy only allowed when dest is empty; occupied dest stays swap/move. That matches “copy onto an empty cell” in the finding.

Tests:

- copy empty dest: source stays, dest gets path
- copy occupied dest: no-op (or document replace)
- move empty dest: still clears source (existing test)

**Verify**: `node --test test/slot-fill.test.js` → exit 0

### Step 2: DnD wiring

`effectAllowed = 'copyMove'`. On `dragover` for in-app drags (not OS files): if dest empty and modifier (Alt on macOS, Ctrl on Windows — `e.altKey` / `e.ctrlKey`) then `dropEffect = 'copy'`, else `move`.

On drop: if `dropEffect`/`altKey` says copy and dest empty, `copyToSlot`; else `swapOrMove`.

If modifiers are unreliable in Electron, use **copy when dest is empty** and **move/swap when dest is occupied** (no modifier). That is simpler and matches the finding (“copy onto an empty cell”). Prefer that if Alt does not fire in a quick `npm start` check.

Document the chosen rule in a one-line comment above `ondrop`.

**Verify**: `grep -n "copyToSlot\\|copyMove" app/js/index.js app/js/slot-fill.js`

## Test plan

- Existing swap/move tests still pass.
- New copy-to-empty.
- Pattern: `test/slot-fill.test.js` move-onto-empty.

Verification: `npm test` → exit 0.

## Done criteria

- [ ] Empty dest can receive a copy without clearing the source
- [ ] Occupied dest still swaps (unless you documented otherwise)
- [ ] OS file drop unchanged
- [ ] `npm test` exits 0
- [ ] No files outside the in-scope list are modified
- [ ] `plans/README.md` 060 DONE

## STOP conditions

- 049 not done **and** you would ship copy as the default for empty dest without unique `-i` — STOP and report (operator should run 049 first). If 049 is DONE, proceed.
- You would change `assignDrops` / multi-file OS drop.

## Maintenance notes

- Reviewer: nine copies of one path must hit the 049 golden (`split=9`, one `-i`) if 049 landed.
- Audio “first clip” is still first occupied slot unless 059 shipped.
