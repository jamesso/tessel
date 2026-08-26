# Plan 020: Make the grid a layout editor (names, filters, multi-drop)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat b558cb8..HEAD -- app/js/index.js app/index.html app/css/style.css`
> Plan 006 may already widen picker extensions — reuse that list.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/006-align-file-picker-formats.md
- **Category**: direction
- **Planned at**: commit `b558cb8`, 2026-08-26

**Spike-then-build:** thumbnails are optional and must not ship if they freeze a 450×600 window. Basenames + multi-drop + aligned filters are the required slice.

## Why this matters

README says drag/drop or click, “Supports MP4 and other common video formats,” and “Arrange Layout: Videos will be positioned in the order you add them.” Filled cells swap `+` for `✓` with **no filename**. Drop uses `files[0]` only (`app/js/index.js:101-102`). Users cannot see which clip is in which cell; dropping four files fills one slot.

## Current state

Dropzone markup (`app/index.html:33-36`): empty-icon `+`, file-icon `✓`, close button. `window['vidPath'+vidNum] = filePath`. `var vidPath1` … `vidPath9` at `app/js/index.js:54-62`. Do **not** treat `var` vs `window['vidPath'+n]` as a split-brain bug in a classic script (they alias). Do **not** introduce `type="module"` without moving state to an array (out of scope unless you also update all assignments).

**Conventions**: Vanilla DOM; CSS Grid already used for `.grid-2x2` / `.grid-3x3`. Keep the 450×600 production window.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 |
| Basename in UI | `grep -n "basename\\|file-name\\|video-label" app/js/index.js app/index.html` | a label node is updated on drop/click |

## Scope

**In scope**:
- `app/index.html` (label element per dropzone)
- `app/css/style.css` (truncate long names)
- `app/js/index.js` (set label from `path.basename` equivalent in renderer: split on `/` and `\\`; multi-file drop into empty slots in grid order)
- `lib/slot-fill.js` + `test/slot-fill.test.js` for pure “assign files to empty indices” logic

**Out of scope**:
- `<video>` thumbnail generation unless a spike in this branch shows it stays smooth with 9 files — default **off**; filename only
- Refactoring `vidPath1..9` into an array **required** only if it reduces bugs for multi-drop; if you do it, keep IPC keys `vidPath1`…`vidPath9` for main.js unless you change `convertVideo` in the same PR (allowed if tests/mosaic still get 9 slots)
- Output settings (plan 021)

## Git workflow

- Branch: `advisor/020-grid-layout-editor`
- Message: `Show clip names in the grid and fill multiple dropped files.`
- Do not push unless asked.

## Steps

### Step 1: Filename label

Each dropzone: `<span class="file-label hidden"></span>`. On successful path set, show `label` = last path segment. On clear (×, logo, switchGrid hiding 2×2 extras), hide and empty the label. CSS: `overflow: hidden; text-overflow: ellipsis; max-width: 100%; font-size` smaller than instruction text. Still show ✓ or replace ✓ with the name — name is required; ✓ may remain.

**Verify**: grep for `file-label`

### Step 2: Multi-file drop

If `e.dataTransfer.files.length > 1`, treat as a list of videos (same accept rules as plan 006). Assign in order to **empty** slots among currently visible dropzones (2×2: indices 0–3; 3×3: 0–8), starting at the drop target index then wrapping, **or** starting at the first empty slot. Document the chosen rule in a comment. Files beyond empty slots: ignore extras (`alert` once).

Extract `function assignDrops(emptyIndices, startIndex, fileCount)` in `lib/slot-fill.js` if it helps tests; renderer can duplicate a 15-line loop if CommonJS in renderer is impossible — then test the lib and copy the algorithm comments. Prefer `lib/slot-fill.js` tested, and a tiny copy in index.js **or** expose via a non-module `app/js/slot-fill.js` script tag included before `index.js` (plain functions on `window`).

**Verify**: `npm test` covers wrapping/empty-slot assignment

### Step 3: Thumbnail spike (optional, default skip)

If you try `<video src=file://>` posters: abort if 3×3 stutters. Do not add ffmpeg frame extraction in this plan.

**Verify**: if no thumbnails, skip

## Test plan

- `test/slot-fill.test.js`: 4 files onto 2×2 with slot 0 filled → next three empties fill; 10 files onto 3×3 → 9 fills + extra ignored.
- Manual: drop two files on an empty 2×2; names visible; × clears name.

## Done criteria

- [ ] Occupied cells show a basename
- [ ] Multi-file drop fills multiple empty visible slots
- [ ] Plan 006 accept list still used
- [ ] `npm test` exits 0
- [ ] `plans/README.md` 020 DONE

## STOP conditions

- Adding `type="module"` to `index.js` without converting `var vidPathN` to a module-scoped array — STOP (split-brain).
- Thumbnail decode OOMs — ship names only.

## Maintenance notes

- Reviewer: 2×2 must not assign into hidden slots 5–9.
- IPC still sends nine paths.
