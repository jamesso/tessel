# Plan 043: Spike in-cell clip previews (abort if the window stutters)

> **Executor instructions**: This is a **spike** plan. Thumbnails must not ship if they freeze the 450×600 window (plan 020 already deferred this). Fill `## Spike result`, then either ship muted posters **or** mark the plan DONE with “not shipped” and no `<video>` in production. When done, update `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat c2b112f..HEAD -- app/index.html app/js/index.js app/css/style.css main.js`
> On excerpt mismatch, STOP.

## Status

- **Priority**: P3
- **Effort**: M (coarse)
- **Risk**: MED
- **Depends on**: none (020 names already shipped)
- **Category**: direction
- **Planned at**: commit `c2b112f`, 2026-08-26

## Why this matters

Filled cells are `+` / `✓` / `file-label` only (`app/index.html` dropzones). Users cannot see framing, crop vs letterbox, or which take is in a cell beyond a truncated basename. A bad 3×3 is discovered after a full libx264 pass. Plan 020: thumbnails “must not ship if they freeze a 450×600 window,” default off. Production window is `width: 450`, `height: 600`, `resizable: false` (`main.js:186-191`). Do **not** run `buildFilterComplex` live.

## Current state

- Labels via `fileBasename` + `.file-label`.
- No `<video>` in dropzones.
- Convert still file-picker → encode (`app/js/index.js:225-275`).

**Conventions**: vanilla DOM/CSS. Letterbox/crop remain encode-time unless the spike proves CSS `object-fit` is honest enough **and** you document that it is preview-only. Short imperative commits. No AI co-author trailers.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 |
| Dev | `npm start` or `npm run dev` | window opens (manual spike) |

## Scope

**In scope**:

- This file’s `## Spike result`
- If shipping: `app/index.html`, `app/css/style.css`, `app/js/index.js` (muted `<video>` or img poster per occupied cell)
- Optional main-process ffmpeg **one frame** extract only if HTML5 posters stutter — still not a live mosaic filter

**Out of scope**:

- Live xstack preview of the mosaic
- Changing encode letterbox/crop
- Signed macOS (`plans/DEFERRED.md`)
- Making the window resizable in production to “fix” jank (do not)

## Git workflow

- Branch: `advisor/043-cell-preview-spike`
- Message: either `Show muted clip previews in occupied mosaic cells.` **or** `Document that in-cell video previews stutter; keep filenames only.`
- Do not push unless asked.

## Steps

### Step 1: Spike HTML5 posters

In a throwaway or this branch: occupied cell gets `<video muted playsinline preload="metadata">` (or `preload="none"` + first-frame) with `src` as `file://` from the existing path. 3×3 with nine local files. Production-sized window (450×600).

If the UI stutters, scrolls jank, or CPU pegs: **do not ship**. Write that in `## Spike result` and revert UI. Status DONE (decision recorded). Filenames stay.

**Verify**: spike result says ship / no-ship and why (one paragraph)

### Step 2: If shipping

- Show preview only when a slot is filled; hide on `clearSlot`.
- Keep the filename label (020).
- `pointer-events` so × and click-to-replace still work.
- Do not autoplay with sound.
- CSS: cover the cell without blowing the 16:9 grid (`object-fit: contain` ≈ letterbox preview; do not pretend this **is** encode crop unless you also preview crop and label it “approximate”).

**Verify**: `grep -n "<video" app/index.html app/js/index.js` only if shipping

### Step 3: Tests

No Playwright. If you add DOM helpers, unit-test show/hide. `npm test` must pass either way.

### Step 4: Mark the plan

DONE with note “shipped posters” or “not shipped, filenames only”.

## Test plan

- Manual spike is the product test.
- `npm test` regression.

## Done criteria

- [ ] `## Spike result` filled
- [ ] Either posters in occupied cells **or** a documented no-ship (no half-broken `<video>` nodes)
- [ ] `npm test` exits 0
- [ ] No files outside the in-scope list are modified
- [ ] `plans/README.md` 043 DONE or DONE (not shipped)

## STOP conditions

- Live `buildFilterComplex` preview encode on every drop.
- Shipping 9 looping videos after the spike showed freeze.
- Resizable production window as the “fix.”

## Spike result

_(executor fills)_

## Maintenance notes

- Reviewer: encode fit (letterbox/crop) may not match CSS; if shipped, UI copy should not claim they are identical unless the spike proved it.
- 020’s freeze warning is the acceptance bar.
