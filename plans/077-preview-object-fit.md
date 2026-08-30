# Plan 077: Drive cell posters from Advanced Fit (contain vs cover)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat f14caf4..HEAD -- app/css/style.css app/js/index.js app/js/cell-preview.js test/cell-preview.test.js`
> Compare excerpts against live code; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `f14caf4`, 2026-08-27

## Why this matters

Encode Fit is letterbox (`scale` + `pad`) vs crop (`scale` + `crop`) in `lib/mosaic.js`. Cell HTML5 posters always use `object-fit: contain` (`app/css/style.css`). Crop is invisible on the work surface; users discover a bad 3×3 after libx264. Plan 043 already warned CSS must not be sold as encode crop. This plan only toggles approximate `contain` / `cover` from `#output-fit`.

## Current state

```css
.cell-preview {
    /* ... */
    object-fit: contain;
    object-position: center;
}
```

`test/cell-preview.test.js` locks letterbox CSS. `#output-fit` values `letterbox` | `crop` (`lib/output-allowlist.js` `FIT`). `getOutputSettings().fit` already used on convert. `applyPrefs` sets `#output-fit`. `syncSelectFaces` exists after prefs.

`PRODUCT.md`: grid is the work surface; Advanced stays secondary.

**Conventions**: classic script; class on `#video-grid` or `body` is enough. Do not run `buildFilterComplex` in the renderer. Short imperative commits. No AI co-author trailers.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 |

## Scope

**In scope**:

- `app/css/style.css` — e.g. `#video-grid.fit-crop .cell-preview { object-fit: cover; }` default remain contain
- `app/js/index.js` — on fit change, `applyPrefs`, and restore: set/remove that class from `#video-grid` (or `document.body`) from `#output-fit`
- `test/cell-preview.test.js` — contain default; crop class uses cover; copy must **not** claim CSS equals ffmpeg crop
- README one clause: previews follow letterbox/crop approximately

**Out of scope**:

- Live xstack preview
- Changing encode crop math
- Playing videos in cells (043 STOP)
- Hiding posters during convert (058 no-ship)

## Git workflow

- Branch: `advisor/077-preview-object-fit`
- Message: `Preview letterbox and crop with object-fit contain and cover.`
- Do not push unless asked.

## Steps

### Step 1: CSS + class

Keep default contain. Crop → `cover`. Call a `syncPreviewFit()` from `applyPrefs`, fit `change` (already `persistPrefs` on change — add the class sync there or inside persist), and DOMContentLoaded after restore.

**Verify**: `grep -n "object-fit:\\s*cover\\|fit-crop" app/css/style.css app/js/index.js`

### Step 2: Tests + README

Update `test/cell-preview.test.js` “letterboxes” test so contain is default and cover is behind a class. Do not assert encode filter strings.

**Verify**: `npm test` → exit 0

## Test plan

- CSS/source greps. Pattern: existing cell-preview CSS test.

## Done criteria

- [ ] Letterbox fit → posters `contain`; crop fit → `cover`
- [ ] Encode graph unchanged
- [ ] Tests do not call CSS crop “the same as ffmpeg”
- [ ] `npm test` exits 0
- [ ] `plans/README.md` 077 DONE

## STOP conditions

- You would spawn ffmpeg to generate posters.
- You would autoplay cell videos.

## Maintenance notes

- Reviewer: `object-fit: cover` is not `force_original_aspect_ratio=increase` + crop; README must stay honest.
- 3×3 leftover column (015) is encode-only.
