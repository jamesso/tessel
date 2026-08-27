# Plan 035: Document that releases ship GPL FFmpeg next to the MIT app

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat c2b112f..HEAD -- LICENSE README.md package.json package-lock.json`
> On excerpt mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs
- **Planned at**: commit `c2b112f`, 2026-08-26

## Why this matters

Tessel’s `LICENSE` is MIT. The bundled encoder is `ffmpeg-static@5.3.0` (`GPL-3.0-or-later` on the npm package). The darwin-arm64 binary reports `ffmpeg version 6.0` configured with `--enable-gpl` and `--enable-nonfree` (and libx264). GitHub Release archives include that binary via `--asar.unpackDir=node_modules/ffmpeg-static`. README License + Acknowledgments say MIT and “powered by FFmpeg” only. Redistributors cannot see the split. This plan is documentation, not a license rewrite and not legal advice.

## Current state

- `LICENSE` — MIT, copyright James Sorbello.
- `README.md` “License” — MIT + link to `LICENSE`.
- `package.json` `"license": "MIT"`, dependency `"ffmpeg-static": "^5.3.0"`.
- `plans/026-ffmpeg-migration-notes.md` already records GPL-3.0-or-later for the package.
- `node_modules/ffmpeg-static/ffmpeg.LICENSE` is downloaded next to the binary at install; packager unpacks that directory.

**Conventions**: keep the app MIT. Do not paste the full GPL text into `LICENSE`. Short imperative commits. No AI co-author trailers.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 (docs-only; suite unchanged) |
| NOTICE exists | `test -f NOTICE && grep -q -i ffmpeg NOTICE` | exit 0 |

## Scope

**In scope**:

- `NOTICE` (create at repo root)
- `README.md` License (and Acknowledgments if one sentence is cleaner there)
- Optional one line in `.github/workflows/release.yml` release-notes heredoc **Downloads/Installation** is enough; if you touch it, say FFmpeg is bundled under its own license — do not invent GPL obligations

**Out of scope**:

- Relicensing Tessel to GPL
- Replacing `ffmpeg-static` to dodge GPL
- Hash-pinning the GitHub ffmpeg download (not selected as a migration plan here)
- Apple notarization (`plans/DEFERRED.md`)

## Git workflow

- Branch: `advisor/035-ffmpeg-license-notice`
- Message: `Document the bundled FFmpeg license next to Tessel’s MIT license.`
- Do not push unless asked.

## Steps

### Step 1: Add `NOTICE`

Create `NOTICE` at the repo root. Required facts (wording can vary):

- Tessel application source is MIT (`LICENSE`).
- Releases include a copy of FFmpeg from the `ffmpeg-static` npm package.
- That package is `GPL-3.0-or-later`; the binary is an FFmpeg build (this repo’s 6.0 binary was configured with GPL and nonfree libraries).
- Point at `node_modules/ffmpeg-static/ffmpeg.LICENSE` after install, and https://ffmpeg.org/legal.html
- One line: this NOTICE is not legal advice.

**Verify**: `grep -i "MIT\\|GPL\\|ffmpeg" NOTICE` → all three ideas present

### Step 2: README License section

Replace the License paragraph so it states: app MIT; bundled FFmpeg is **not** MIT. Link `NOTICE` and `LICENSE`. Do not claim the whole GitHub zip is MIT-only.

**Verify**: `grep -n "NOTICE\\|GPL\\|FFmpeg" README.md` → License section mentions the split

### Step 3: Mark the plan

`plans/README.md` row 035 → DONE.

## Test plan

- No new unit tests. `npm test` still exit 0.
- Human: README License is no longer MIT-only.

## Done criteria

- [ ] `NOTICE` exists and names MIT app + GPL/FFmpeg bundle
- [ ] README License points at `NOTICE`
- [ ] `npm test` exits 0
- [ ] No files outside the in-scope list are modified
- [ ] `plans/README.md` 035 DONE

## STOP conditions

- Changing `package.json` `"license"` to GPL without a human asking.
- Copying the entire GPL into the repo as if Tessel were GPL.

## Maintenance notes

- Reviewer: packager unpack must still include `ffmpeg.LICENSE` (already under `node_modules/ffmpeg-static`). Do not add `--ignore` that drops it.
- Exact GPL vs LGPL vs nonfree redistribution duties are for a lawyer; the finding is “docs were silent.”
