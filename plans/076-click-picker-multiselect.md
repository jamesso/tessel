# Plan 076: Let the click picker fill several empty cells like a multi-file drop

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

OS multi-drop already uses `assignDrops` / `nextEmptySlots` to fill visible empties from the target cell (`app/js/index.js` ondrop). Cell **click** `showOpenDialog` has no `multiSelections` and always `setSlotOccupied` on `filePaths[0]` only. README documents click as browse-one and drop as several. Users who live in the file dialog reopen it per cell. `PRODUCT.md`: incomplete layouts are valid; this is the non-drag path for the same job.

## Current state

```javascript
        const options = {
            defaultPath: defaultPath,
            filters :[
            {name: 'Movies', extensions: window.VIDEO_EXTENSIONS}
            ]
        }
        const { filePaths } = await electronAPI.showOpenDialog(options)
        // ...
        setSlotOccupied(dz[i], filePaths[0] || filePaths.toString())
```

`main.js` `dialog:openFile` passes renderer `options` through to `showOpenDialog`. Preload `showOpenDialog` is not channel-filtered beyond invoke. Multi-drop branch: `assignDrops(emptyIndices, i, videos.length)` then `setSlotOccupied` per index; extras alert.

**Conventions**: `window.assignDrops` from `app/js/slot-fill.js` (053). `VIDEO_EXTENSIONS` from `media-accept.js`. Source tests in `test/slot-fill.test.js`. Short imperative commits. No AI co-author trailers.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 |

## Scope

**In scope**:

- `app/js/index.js` click handler: `properties: ['openFile', 'multiSelections']`; one path still **replaces** the clicked cell; two or more use the same wrap-through-empties rule as multi-drop (`assignDrops` + `nextEmptySlots` + visible count). If the first file replaces the clicked slot, subsequent files fill **other empties** (do not also “assign” the clicked index as empty if you just filled it — match drop: multi-file drop does **not** replace occupied; click-one does replace. For click-many: **one file = replace target; several = fill empties starting at target like drop**, even if the target was occupied — pick one rule and test it).
- **Specified rule:** 1 file → replace clicked slot (today). 2+ files → treat like OS multi-drop: only **empty** visible slots, starting at the clicked index, wrap; if the clicked slot is occupied, it is not in `emptyIndices` so fill starts at the next empty (same as dropping several onto an occupied cell today). Excess files: existing alert.
- README one sentence: click picker can select several files to fill empties.
- Tests: grep `multiSelections`; reuse slot-fill unit tests (already cover assignDrops).

**Out of scope**:

- Changing OS drop behavior
- Alt-move (079)
- Keyboard cells (080)
- Image stills

## Git workflow

- Branch: `advisor/076-click-picker-multiselect`
- Message: `Fill empty mosaic cells from a multi-file click picker.`
- Do not push unless asked.

## Steps

### Step 1: Dialog + assignment

Add `properties: ['openFile', 'multiSelections']`. Branch on `filePaths.length`. Filter names with `isProbablyVideoFile` if you only have paths (no MIME) — use `{ name: path }` / extension like media-accept.

**Verify**: `grep -n "multiSelections\\|assignDrops" app/js/index.js`

### Step 2: README + tests

Grep test: click handler includes `multiSelections` and `assignDrops`. Pattern: `test/slot-fill.test.js` “in-app drop” grep test.

**Verify**: `npm test` → exit 0

## Test plan

- Source greps. `assignDrops` already unit-tested.
- Do not add Playwright.

## Done criteria

- [ ] One clicked file still replaces that cell
- [ ] Several clicked files fill visible empties with wrap; extras alert
- [ ] README mentions multi-select browse
- [ ] `npm test` exits 0
- [ ] `plans/README.md` 076 DONE

## STOP conditions

- You would replace N occupied cells with N picker files (drop does not do that).
- You would enable directory open.

## Maintenance notes

- Reviewer: 2×2 must not write hidden indices 4–8 (`visibleSlotCount`).
- macOS dialog multi-select is native; no extra UI.
