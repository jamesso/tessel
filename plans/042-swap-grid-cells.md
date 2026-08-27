# Plan 042: Swap or move clips between occupied grid cells

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat c2b112f..HEAD -- app/js/index.js app/js/slot-fill.js lib/slot-fill.js test/slot-fill.test.js app/index.html app/css/style.css`
> On excerpt mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: S–M
- **Risk**: LOW
- **Depends on**: none (020 multi-drop already shipped)
- **Category**: direction
- **Planned at**: commit `c2b112f`, 2026-08-26

## Why this matters

Single-file OS drop **replaces** the target slot (`app/js/index.js:146-160`). Multi-drop fills **empty** visible slots only (`assignDrops`). There is no dropzone-to-dropzone swap. Changing which clip is “first” (the only audio source, `lib/mosaic.js` `firstReal`) or fixing a mis-drop means × plus re-pick. `maxFiles` is parsed from dropzone ids and never read (`app/js/index.js:117`).

## Current state

- `setSlotOccupied` / `clearSlot` update `window['vidPath'+n]` and labels.
- `ondrop` handles OS `dataTransfer.files`.
- Visible slots: 4 vs 9 via `currentGrid`.
- IPC still `vidPath1…vidPath9`.

**Conventions**: vanilla DOM; keep OS-file drop behavior (replace one / fill empties). Duplicate `app/js/slot-fill.js` in sync with `lib/slot-fill.js` if you add helpers. Short imperative commits. No AI co-author trailers. Do not add `type="module"`.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 |
| Slot tests | `node --test test/slot-fill.test.js` | exit 0 |

## Scope

**In scope**:

- `lib/slot-fill.js` + `app/js/slot-fill.js` + `test/slot-fill.test.js` (pure swap/move)
- `app/js/index.js` drag between `.dropzone`s
- Optional CSS for drag source highlight
- Delete unused `maxFiles` parse (or honor it — prefer **delete**)

**Out of scope**:

- Changing ffmpeg audio mapping (still first occupied slot)
- OS multi-drop algorithm (020)
- Preview (043)
- Persist (040) — if 040 already saves paths, swap should trigger the same save if that hook exists

## Git workflow

- Branch: `advisor/042-swap-grid-cells`
- Message: `Allow swapping and moving clips between mosaic cells.`
- Do not push unless asked.

## Steps

### Step 1: Pure swap/move helper

```javascript
function swapOrMove(paths, fromIndex, toIndex) {
  // paths: array length visibleCount, entries string or empty
  // fromIndex/toIndex: 0-based visible indices
}
```

Rules:

- If `from === to`, no-op.
- If `from` empty, no-op.
- If `to` empty: move (clear from, set to).
- If `to` occupied: swap.

Test those four cases. Copy the function into `app/js/slot-fill.js` (keep in sync comment) and parity-test like `test/media-accept.test.js`.

**Verify**: `node --test test/slot-fill.test.js` includes swap/move + renderer parity

### Step 2: In-app drag

Use HTML5 drag **from a filled cell** (e.g. `draggable="true"` on `.dropzone.file` or a handle). `dataTransfer.setData('application/x-tessel-slot', vidNum)` or `text/plain` slot index.

On drop on another **visible** dropzone: if the drag is an in-app slot (not OS files, or check types: if `files.length` use existing OS handler; else swap/move).

Never assign into hidden 2×2 slots 5–9.

After swap, labels and `vidPathN` must match (reuse `setSlotOccupied` / `clearSlot`).

**Verify**: `grep -n "swapOrMove\\|application/x-tessel-slot\\|draggable" app/js/index.js app/js/slot-fill.js`

### Step 3: Remove dead `maxFiles`

Delete `let maxFiles = parseInt(options[2])` if still unused.

**Verify**: `grep -n "maxFiles" app/js/index.js` → no matches

### Step 4: Mark the plan

`plans/README.md` 042 DONE.

## Test plan

- `swapOrMove` unit tests + renderer copy parity.
- Pattern: `test/slot-fill.test.js` / `test/media-accept.test.js` dual require.
- No Electron E2E required.

## Done criteria

- [ ] Swap two occupied visible cells; move onto empty; no-op on empty source
- [ ] OS file drop unchanged
- [ ] `maxFiles` gone
- [ ] `npm test` exits 0
- [ ] No files outside the in-scope list are modified
- [ ] `plans/README.md` 042 DONE

## STOP conditions

- Implementing reorder by rewriting `vidPath1…9` IPC without updating `convertVideo` / session.
- Filling hidden 2×2 slots.

## Maintenance notes

- Reviewer: first-clip audio follows **slot order** (lowest occupied index / first `-i`), not drag history. Swapping slot 1 and 2 is how users pick audio.
- 020 wrap-fill stays for OS multi-drop.
