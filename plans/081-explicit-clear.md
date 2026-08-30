# Plan 081: Clear the grid from an explicit control, not the logo

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat f14caf4..HEAD -- app/js/index.js app/index.html README.md test/convert-session.test.js`
> Compare excerpts against live code; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `f14caf4`, 2026-08-27

## Why this matters

Logo click calls `clearAllVideos()` (`app/js/index.js`) with no confirm and no README mention. Plan 019 **kept** that gesture on purpose. `PRODUCT.md`: familiar desktop controls over invented affordances. Clicking the wordmark to “go home” wipes a 9-clip layout and immediately `persistPrefs()`. Per-cell × already exists.

## Current state

```javascript
document.querySelector('.logo').addEventListener('click', (e) => {
    e.preventDefault()
    clearAllVideos()
})
```

`app/index.html` logo is `<a class="logo" href="#">`. `test/convert-session.test.js` asserts `clearAllVideos` still exists and is not called from `video:done`.

**Conventions**: keep `clearAllVideos` for the new control. Do not confirm-dialog unless the control is still too easy — prefer an explicit **Clear** next to the grid toggle (secondary button pattern: `#advanced-settings-open`). Short imperative commits. No AI co-author trailers.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 |

## Scope

**In scope**:

- Remove logo click → `clearAllVideos` (logo becomes non-interactive branding: `div` or `href` removed / `preventDefault` without clear)
- Add a **Clear** control (footer or beside 2×2/3×3) that calls `clearAllVideos`
- README: mention Clear (and × per cell)
- Tests: grep logo click does **not** call `clearAllVideos`; grep Clear button does

**Out of scope**:

- Undo stack
- Confirm modal (not required if Clear is labeled)
- About window

## Git workflow

- Branch: `advisor/081-explicit-clear`
- Message: `Clear the mosaic from a Clear button instead of the logo.`
- Do not push unless asked.

## Steps

### Step 1: UI

Add `button type="button"` e.g. `id="clear-grid"` labeled Clear, `button-secondary` if it sits near Advanced. Wire to `clearAllVideos`. Strip logo listener.

**Verify**: `grep -n "clear-grid\\|clearAllVideos\\|logo" app/js/index.js app/index.html`

### Step 2: Tests + README

Update convert-session greps if they assume logo. Add grep for `#clear-grid`.

**Verify**: `npm test` → exit 0

## Test plan

- Source greps. Pattern: `test/convert-session.test.js`.

## Done criteria

- [ ] Logo does not clear the grid
- [ ] Labeled Clear clears all visible slots via `clearAllVideos`
- [ ] Success toast still does not clear (019)
- [ ] `npm test` exits 0
- [ ] `plans/README.md` 081 DONE

## STOP conditions

- You would remove per-cell ×.
- You would clear on Convert success.

## Maintenance notes

- Reviewer: 2×2 hidden slots 5–9: `clearAllVideos` already loops all dropzones (same as today).
- Keyboard: Clear is a real button (helps 080).
