# Plan 048: Document duration cap, restore, swap, and cell previews

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat a7bd825..HEAD -- README.md .github/workflows/release.yml app/index.html`
> Compare excerpts against live code; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs
- **Planned at**: commit `a7bd825`, 2026-08-27

## Why this matters

Plans 040–043 shipped restore, duration cap, cell swap/move, and muted posters. README Features/Usage and the CI release-notes heredoc still describe the 1.5.0 product (grid, drop, three output knobs, convert session). The next GitHub Release will omit four behaviors users already see. Restore has no control in the UI — if README stays silent, “it forgot my grid” looks like a bug when `existsSync` skips missing paths.

## Current state

`README.md` Features (`:24-33`): 2×2/3×3, 1–9 videos, drag & drop, clip names, output settings (resolution / mute-or-first-clip / letterbox-or-crop), convert session, platforms, H.264. No duration, restore, swap, or preview.

Usage (`:66-74`): grid toggle, drop/click, output settings, convert, progress. No “drag a filled cell onto another cell”, no duration select, no “grid and settings come back on launch.”

`.github/workflows/release.yml:180-184`:

```
### Features
- 2×2 and 3×3 mosaics with clip names and multi-file drop
- 720p or 1080p, mute or first-clip audio, letterbox or crop
- Cancel an in-progress convert; grid stays filled after success
- MP4, MOV, M4V, WebM, AVI, and MKV inputs
```

Live UI: `app/index.html:122-130` Duration select; `app/js/index.js` `restorePrefs` on `DOMContentLoaded`; `swapOrMove` on in-app drag; `app/js/cell-preview.js` muted posters. Screenshots in `assets/screenshots/` already show the Duration row.

**Conventions**: README is marketing-plain, not an API spec. Release notes heredoc is the user-facing GitHub Release body (plan 005). Short imperative commits. No AI co-author trailers.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 |
| README mentions | `grep -n -i "duration\\|preview\\|swap\\|remember\\|restore" README.md` | duration + preview + swap/move + remember/restore each appear |

## Scope

**In scope**:

- `README.md` Features + Usage (and Technical Details only if a one-liner about duration/previews is needed)
- `.github/workflows/release.yml` `### Features` list in the heredoc

**Out of scope**:

- New screenshots (optional; do not block on them)
- Changing restore, duration, swap, or preview code
- CI pack/publish gates (plan 047)
- Claiming CSS preview fit equals encode letterbox/crop (043: preview-only)

## Git workflow

- Branch: `advisor/048-document-shipped-session-features`
- Message: `Document duration cap, session restore, cell swap, and previews.`
- Do not push unless asked.

## Steps

### Step 1: README Features and Usage

Add four bullets (wording can vary; facts must not):

1. **Duration** — Full length (pad-to-longest, default) or cap at 5 / 15 / 30 / 60 seconds from the start.
2. **Remember session** — Output settings, last save folder, and occupied cells restore on launch when those files still exist. There is **no** import button; this is automatic. Do not invent a “Restore” menu item.
3. **Rearrange** — Drag a filled cell onto another cell to swap, or onto an empty cell to move.
4. **Previews** — Occupied cells show a muted first frame; filenames stay. Do **not** say the poster is encode crop/letterbox.

Usage: mention the Duration select next to the other output settings; mention drag-between-cells; one sentence that quitting and reopening brings the grid back if the files are still on disk.

Keep “first clip” audio as the **first occupied cell in grid order** if you touch that sentence (swap can change which cell that is). Do not promise mix-all.

**Verify**: `grep -n "Duration\\|5 seconds\\|save folder\\|swap\\|preview" README.md` shows Features **and** Usage coverage

### Step 2: Release-notes heredoc

Replace/extend `.github/workflows/release.yml` Features list so the next tag includes the same four behaviors (duration, remember, swap/move, muted preview) plus the existing mosaic/output/cancel/formats lines. Keep the macOS Gatekeeper / `xattr` block unchanged.

**Verify**: `grep -n "Duration\\|remember\\|swap\\|preview" .github/workflows/release.yml` → matches inside the `EOF` heredoc, not only this plan

## Test plan

- No app tests. `npm test` must still pass.
- Pattern: existing README Features list; keep the same voice.

Verification: `npm test` → exit 0.

## Done criteria

- [ ] README Features lists duration, restore, swap/move, and cell previews
- [ ] README Usage tells a first-run user where Duration is and that cells can be dragged
- [ ] Release-notes heredoc lists those four behaviors
- [ ] Docs do not claim preview fit === encode fit
- [ ] Docs do not invent an import/export UI (plan 061)
- [ ] `npm test` exits 0
- [ ] No files outside the in-scope list are modified
- [ ] `plans/README.md` status row for 048 set to DONE

## STOP conditions

- Excerpts drifted (UI removed a feature — then document reality, do not re-add the feature here).
- You would add File-menu import/export or a Restore button “so the docs match.”
- You would rewrite the whole README.

## Maintenance notes

- Reviewer: restore is silent; the README must say missing files are skipped, not that every launch is a full snapshot of last week’s NAS.
- Plan 047 may also edit README/AGENTS for dispatch; rebase rather than overlapping the Features list.
