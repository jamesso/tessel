# Plan 053: Load `slot-fill` and `media-accept` from one UMD file each

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat a7bd825..HEAD -- lib/slot-fill.js app/js/slot-fill.js lib/media-accept.js app/js/media-accept.js test/slot-fill.test.js test/media-accept.test.js app/index.html README.md`
> Compare excerpts against live code; on a mismatch, treat it as a STOP condition.
> Do **not** parallel 060 (it edits slot-fill).

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (060 should wait for this)
- **Category**: tech-debt
- **Planned at**: commit `a7bd825`, 2026-08-27

## Why this matters

Runtime loads `app/js/slot-fill.js` and `app/js/media-accept.js`. Tests `require('../lib/...')`. Comments say “keep this loop in sync.” `cell-preview.js` already uses **one** UMD file that tests `require` (`test/cell-preview.test.js`). The copies have not drifted yet; the next swap/copy change (060) will. `main.js` does not `require` these modules.

## Current state

`app/js/slot-fill.js:1`: `// Tests cover lib/slot-fill.js. Keep this loop in sync with that module.` then IIFE assigning `root.nextEmptySlots`, `assignDrops`, `swapOrMove`, plus `module.exports` when present.

`lib/slot-fill.js`: same three functions, CommonJS only.

`app/js/media-accept.js:1`: same “keep in sync” comment; UMD with `VIDEO_EXTENSIONS` / `isProbablyVideoFile`.

`lib/media-accept.js`: CommonJS copy.

Tests:

- `test/slot-fill.test.js` requires `../lib/slot-fill` and compares renderer `require('../app/js/slot-fill')` in “exports the same helpers as lib”
- `test/media-accept.test.js` requires `../lib/media-accept` and the same dual-require test
- `app/index.html:144-145` script tags

**Conventions**: classic renderer scripts, not `type="module"`. Match `app/js/cell-preview.js` UMD (`typeof window !== 'undefined' ? window : globalThis`). Short imperative commits. No AI co-author trailers.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 |
| Slot/media | `node --test test/slot-fill.test.js test/media-accept.test.js test/cell-preview.test.js` | exit 0 |
| No lib copies | `ls lib/slot-fill.js lib/media-accept.js` | both missing (exit 1 from ls) |

## Scope

**In scope**:

- Delete `lib/slot-fill.js` and `lib/media-accept.js`
- Keep/adjust UMD in `app/js/slot-fill.js` and `app/js/media-accept.js` (remove “keep in sync” comments)
- `test/slot-fill.test.js`, `test/media-accept.test.js` — require `app/js/...` only
- `README.md` project structure line that says lib contains media-accept helpers (`README.md:152`)

**Out of scope**:

- Changing `assignDrops` / `swapOrMove` / MIME rules
- Copy-drag (060)
- Moving mosaic/prefs into `app/js`

## Git workflow

- Branch: `advisor/053-single-copy-slot-fill-media-accept`
- Message: `Test and load slot-fill and media-accept from one file each.`
- Do not push unless asked.

## Steps

### Step 1: Point tests at `app/js`

Change requires to `../app/js/slot-fill` and `../app/js/media-accept`. Delete the “renderer exports the same helpers as lib” tests (they become tautologies). Keep behavioral tests (`assignDrops`, `swapOrMove`, MIME cases) and the HTML script-tag greps in `test/media-accept.test.js`.

Remove the keep-in-sync comments from the UMD files.

**Verify**: `node --test test/slot-fill.test.js test/media-accept.test.js` → exit 0 with tests still requiring `app/js`

### Step 2: Delete `lib` copies

Delete `lib/slot-fill.js` and `lib/media-accept.js`. `grep -n "lib/slot-fill\\|lib/media-accept" test/ lib/ main.js app/` → no production/test requires.

Update README project structure: lib is mosaic/session/prefs/etc., renderer helpers live under `app/js/`.

**Verify**: `npm test` → exit 0; `test -e lib/slot-fill.js` → exit 1

## Test plan

- Existing slot-fill and media-accept cases, now against UMD files.
- HTML still includes both scripts before `index.js`.
- Pattern: `test/cell-preview.test.js` require path.

Verification: `npm test` → exit 0.

## Done criteria

- [ ] `lib/slot-fill.js` and `lib/media-accept.js` are gone
- [ ] Tests require `app/js/` only
- [ ] Dual-copy comparison tests removed
- [ ] `app/index.html` script tags unchanged in order (`media-accept`, `slot-fill`, `cell-preview`, `index`)
- [ ] `npm test` exits 0
- [ ] No files outside the in-scope list are modified
- [ ] `plans/README.md` status row for 053 set to DONE

## STOP conditions

- Excerpts drifted (logic already diverged — merge into the UMD file using **test** behavior as source of truth, then delete lib).
- `main.js` started requiring `lib/media-accept` — then keep a lib file for main only and STOP to report (do not invent a bundler).

## Maintenance notes

- Reviewer: UMD must keep `module.exports` so `node --test` can require the same file the window loads.
- Plan 060 should edit only `app/js/slot-fill.js`.
