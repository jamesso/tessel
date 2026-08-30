# Plan 079: Modifier-drop moves a clip onto an empty cell; default stays copy

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat f14caf4..HEAD -- app/js/index.js app/js/slot-fill.js test/slot-fill.test.js README.md`
> Compare excerpts against live code; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `f14caf4`, 2026-08-27

## Why this matters

Plan 060: empty dest **copies** (source stays filled); occupied dest **swaps**. `swapOrMove` already moves onto empty (`app/js/slot-fill.js`) but the drop handler never uses that for an empty dest. `effectAllowed` is already `copyMove`. After 060, rearranging into a hole is copy then ×. `PRODUCT.md`: familiar desktop controls — Option/Alt (and documented modifier) for move is a standard pair.

## Current state

```javascript
            const next = !paths[i]
                ? window.copyToSlot(paths, fromIndex, i)
                : window.swapOrMove(paths, fromIndex, i);
```

`test/slot-fill.test.js` “in-app drop copies onto an empty cell with no modifier” greps that there is **no** `altKey`/`ctrlKey`/`metaKey`. `ondragover` sets `dropEffect` to `copy` when dest empty, `move` when occupied.

**Conventions**: keep **unmodified** empty dest = copy (060). Occupied dest stays swap (no modifier change). Short imperative commits. No AI co-author trailers.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 |

## Scope

**In scope**:

- `app/js/index.js` in-app `ondrop` / `ondragover`: if dest empty **and** modifier (use `altKey` as the documented move modifier on all platforms; do not use ctrl on Windows for copy because that fights OS file copy). Empty + Alt → `swapOrMove`; empty + no modifier → `copyToSlot`.
- `test/slot-fill.test.js` — update the “no modifier” grep; add grep or a tiny helper `function emptyDestAction(altKey) { return altKey ? 'move' : 'copy' }` in `slot-fill.js` and unit-test it
- README: Alt-drag onto empty moves; default copy

**Out of scope**:

- Changing occupied-dest swap
- OS file drops (still fill/replace)
- Keyboard cells (080)

## Git workflow

- Branch: `advisor/079-alt-move-to-empty`
- Message: `Move a clip onto an empty cell with Alt-drop.`
- Do not push unless asked.

## Steps

### Step 1: Helper + drop

Export `emptyDestUsesMove(altKey)` from `slot-fill.js` (UMD like the rest). Wire ondrop. `ondragover` for in-app empty dest: `dropEffect = e.altKey ? 'move' : 'copy'`.

**Verify**: `node --test test/slot-fill.test.js` after tests

### Step 2: README

One sentence under Rearrange.

**Verify**: `npm test` → exit 0

## Test plan

- Unit: alt true → move; false → copy.
- Source: ondrop uses helper.
- Pattern: `test/slot-fill.test.js`.

## Done criteria

- [ ] Unmodified empty dest still copies
- [ ] Alt + empty dest moves (source clears)
- [ ] Occupied dest still swaps
- [ ] `npm test` exits 0
- [ ] `plans/README.md` 079 DONE

## STOP conditions

- You would make unmodified empty dest move again (042/060 regression).
- You would use Meta/Ctrl as the only move key with no Alt (macOS Option is `altKey`).

## Maintenance notes

- Reviewer: `e.altKey` during HTML5 drag can be flaky on some platforms; if dropEffect and drop disagree, prefer the drop event’s altKey.
- Linux: Alt is still `altKey`.
