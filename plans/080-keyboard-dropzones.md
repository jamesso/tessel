# Plan 080: Make empty and filled cells keyboard-activatable

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat f14caf4..HEAD -- app/index.html app/js/index.js app/css/style.css`
> Compare excerpts against live code; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none (076 click picker can land first; keyboard should call the same fill path)
- **Category**: direction
- **Planned at**: commit `f14caf4`, 2026-08-27

## Why this matters

`PRODUCT.md` Accessibility: the window is keyboard-operable (focus-visible rings, labeled icon buttons, native dialog, combobox listboxes). Dropzones are `<div class="dropzone">` with `onclick` only — not in tab order, no `role`, no Enter/Space. The grid is the work surface. Convert, grid toggle, Advanced, and custom selects already have focus-visible CSS.

## Current state

`app/index.html`: nine `.dropzone` divs; close buttons are `<button>` with `aria-label="Remove clip"`. `app/js/index.js` binds `dz[i].onclick` for the picker. `.dropzone` CSS has hover, not `:focus-visible`. `.grid-btn:focus-visible` exists as the pattern.

Do not turn dropzones into `<input type="file">` (Electron path via `webUtils` / dialog is the existing path).

**Conventions**: native `<button>` or `tabindex="0"` + `role="button"` + `aria-label`. Prefer **button** wrapping or making the dropzone a `<button type="button">` **only if** drag-and-drop still works (HTML5 drag on a button is OK if `draggable` stays on the filled cell). If drag breaks, keep the div and add `tabindex="0"` `role="button"` `aria-label="Add clip"` / filename. Honor `prefers-reduced-motion` (already). Short imperative commits. No AI co-author trailers.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 |

## Scope

**In scope**:

- `app/index.html` + `app/css/style.css` — focus-visible ring on dropzones matching other controls (`outline: 2px solid #fff`)
- `app/js/index.js` — Enter/Space on the focused cell runs the same picker path as click (`preventDefault` on Space so the page does not scroll). Do not double-fire with click.
- Tests: grep `tabindex` or `role="button"` on dropzones; grep `focus-visible` for `.dropzone`
- Close buttons remain the remove control (already keyboard)

**Out of scope**:

- Full WCAG claim
- Keyboard reorder (Alt-move is mouse)
- Custom combobox changes (`select.js`)

## Git workflow

- Branch: `advisor/080-keyboard-dropzones`
- Message: `Let keyboard users add clips to mosaic cells.`
- Do not push unless asked.

## Steps

### Step 1: Focus + keydown

Make each visible dropzone focusable. `aria-label`: empty “Add video”; filled use the file basename (update in `setSlotOccupied` / `clearSlot`). Keydown Enter/Space → existing click handler logic (extract `openPickerForDropzone(dz)` to avoid duplication).

**Verify**: `grep -n "tabindex\\|aria-label\\|keydown" app/index.html app/js/index.js`

### Step 2: CSS

`.dropzone:focus-visible` ring. Hidden 2×2 cells stay `display`/`hidden` class so they are not tabbable (`tabindex=-1` when `.hidden` or skip in the loop).

**Verify**: `grep -n "dropzone:focus-visible" app/css/style.css`

### Step 3: Tests

Grep tests in `test/cell-preview.test.js` or a small new assertion file. `npm test`.

**Verify**: `npm test` → exit 0

## Test plan

- Source greps. No Playwright.

## Done criteria

- [ ] Visible cells are in the tab order
- [ ] Enter/Space opens the same picker as click
- [ ] Hidden 2×2 cells are not tabbable
- [ ] `npm test` exits 0
- [ ] `plans/README.md` 080 DONE

## STOP conditions

- You would drop `draggable` / in-app swap.
- You would set `tabindex` on hidden slots 5–9 while 2×2 is active.

## Maintenance notes

- Reviewer: `switchGrid` must update tabindex when showing/hiding 3×3 cells.
- Logo clear (081) is separate.
