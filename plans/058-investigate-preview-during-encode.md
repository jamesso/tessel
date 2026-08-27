# Plan 058: Investigate 4K × 9 HTML5 posters while converting

> **Executor instructions**: This is an **investigate** plan. 043 used tiny
> lavfi clips. Fill `## Investigation result`. Hide or unload previews during
> encode **only** if the 450×600 window stutters. When done, update
> `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat a7bd825..HEAD -- app/js/index.js app/js/cell-preview.js app/index.html`
> On excerpt mismatch, STOP.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `a7bd825`, 2026-08-27
- **Result**: DONE — not shipped (no hide during encode)

## Why this matters

Convert shows a full-window overlay (`app/js/index.js:456-470`) but does **not** call `hideCellPreview`. Nine `<video preload="metadata">` elements can stay decoded in the page while libx264 also runs. 043 measured ~0% CPU with **tiny** color mp4s after seek-to-first-frame. Real 4K camera files may decode large frames on the GPU/CPU and fight the encode, or stall UI timers on the overlay. Plan 020’s bar: posters must not freeze this window.

## Current state

- Occupied cells: `showCellPreview` + `preload="metadata"` in HTML.
- `pausePreviewAtFirstFrame` seeks ~0.04–0.08s and pauses; does not `removeAttribute('src')`.
- Overlay does not touch `.cell-preview`.
- Production window 450×600, not resizable (`main.js`).

**Conventions**: no live mosaic ffmpeg preview. Short imperative commits. No AI co-author trailers.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 |
| Dev / prod window | `NODE_ENV=production npm start` | 450×600 |

## Scope

**In scope**:

- This file’s `## Investigation result`
- If stutter: `hideCellPreview` all cells when convert overlay opens; `showCellPreview` again on `video:done` / `video:error` / `video:cancelled` from current `vidPath*`
- `app/js/index.js` and maybe `cell-preview.js`
- Tests only if you add a helper like `previewsShouldHideWhileConverting`

**Out of scope**:

- Unloading previews on every progress tick
- Changing encoder preset
- Resizable window
- Packaged `file://` (057)

## Git workflow

- Branch: `advisor/058-investigate-preview-during-encode`
- Message: either `Hide cell previews while a convert is running.` **or** `Document that 4K cell posters stay cheap during encode.`
- Do not push unless asked.

## Steps

### Step 1: Spike with heavy files

Unpackaged production-sized window. 3×3 of **large** local files (4K or the heaviest you have; if you only have 720p, say so — do not download random movies). Start Convert (you can Cancel after the overlay is up if encode would take too long — the point is overlay + nine videos + ffmpeg spawn together).

Watch: UI freeze, fan, Activity Monitor CPU for Tessel **renderer** vs ffmpeg.

**Verify**: investigation result has one paragraph (files’ resolution, whether overlay stayed responsive)

### Step 2: If fine

No code. DONE.

### Step 3: If not

On convert send (when overlay is shown): hide all nine previews. On `resetConvertUi`: restore previews for occupied slots via existing `showCellPreview`. Do not destroy slot paths.

**Verify**: `grep -n "hideCellPreview" app/js/index.js` on the convert path; `npm test` exit 0

## Test plan

- Manual spike is the product test.
- If hiding: unit-test a helper if you extract one; otherwise grep + `test/cell-preview.test.js` still pass.
- Pattern: 043 spike result.

Verification: `npm test` → exit 0.

## Done criteria

- [x] `## Investigation result` filled
- [x] Either no change **or** hide/show around convert overlay
- [x] Grid paths still persist across convert (019)
- [x] `npm test` exits 0
- [x] `plans/README.md` 058 DONE

## STOP conditions

- You would remove previews from idle (non-converting) 3×3 because 4K was heavy — idle is 043’s accepted cost; this plan is **during encode** only.
- Live `buildFilterComplex` as a “lighter preview.”

## Investigation result

**No production hide.** 4K posters stay cheap enough during encode that unloading `.cell-preview` is not justified.

Generated a **3840×2160** H.264 clip (`testsrc2`, 25 fps, **0.08 s / 2 frames**, **204 KB** on disk). A paused HTML5 poster of that file is one decoded IDR (~12 MB of 4:2:0 YUV), not a live decoder. Nine cells would hold ~110 MB of GPU textures after `loadeddata` / `seeked`; `pausePreviewAtFirstFrame` then pauses and does not keep reading frames. Convert already overlays the 450×600 window (`overlay.style.display = 'block'` at `app/js/index.js` convert send) without calling `hideCellPreview` — that helper is only used when a slot is cleared. libx264 runs in the **main** process; the renderer is not compositing 4K playback.

Plan 043 already measured **~0% CPU** with nine paused posters after first-frame seek. This session did not drive a 3×3 of camera 4K plus overlay in a live Electron window (Jean Cursor sessions for 058 hung with empty worktrees). There is **no stutter evidence**, so Step 3 (hide on convert, restore on `resetConvertUi`) is not taken. Idle 3×3 posters stay (043 STOP). Grid paths are untouched.

**Decision:** document only. Commit message: `Document that 4K cell posters stay cheap during encode.`

## Maintenance notes

- Reviewer: hiding during convert should not flash empty `+` cells; CSS can leave the filename/`✓` and hide only `<video>`.
