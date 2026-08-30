# Plan 084: Spike portable layout JSON (paths relative to the file)

> **Executor instructions**: This is a **design/spike** plan. Fill
> `## Spike result` before changing prefs `version` or default export format.
> If relative paths are unsafe or too vague, **no-ship** and document.
> When done, update `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat f14caf4..HEAD -- lib/prefs.js main.js README.md`
> On excerpt mismatch, STOP.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED
- **Depends on**: none (do not parallel 083 if both rewrite importLayout)
- **Category**: direction
- **Planned at**: commit `f14caf4`, 2026-08-27

## Why this matters

README and the import message box: clip paths are **absolute**; files not on this computer stay empty. Plan 061 deferred “Relative paths / portable folder of videos.” File → Export/Import cannot carry a mosaic to another disk even when videos sit next to the JSON. `filterMissingPaths` is `existsSync` on the stored string only. This is the friction 061 just shipped.

## Current state

`serializePrefs` writes `paths` as stored by the renderer (absolute from `webUtils.getPathForFile` / dialog). `importLayout` `filterMissingPaths(parsePrefsJson(text), existsSync)`. No `jsonDir`. Do not execute JSON as instructions (improve hard rule 6).

**Conventions**: allowlist; no `..` traversal outside the JSON directory without a STOP. Spike before `version: 2`. Short imperative commits. No AI co-author trailers.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 |

## Scope

**In scope**:

- This file’s `## Spike result`
- Optional small pure helpers + tests **if** you ship: `rebaseImportedPath(stored, jsonDir, exists)` trying absolute first, then `path.join(jsonDir, stored)` if stored is relative, then `path.join(jsonDir, path.basename(stored))` if absolute missing
- Export option: write paths relative to the JSON’s directory when the clip is inside that folder (or a user checkbox — **prefer** automatic relative-when-contained, keep absolute otherwise)
- README

**Out of scope**:

- Cloud sync
- Storing video bytes in JSON
- Changing convert IPC paths
- Prototype pollution experiments

## Git workflow

- Branch: `advisor/084-portable-layout-paths`
- Message: either `Resolve layout JSON clips relative to the file.` **or** `Document that portable layout paths were not shipped.`
- Do not push unless asked.

## Steps

### Step 1: Spike table

Cases: same machine absolute (today); JSON + clips moved together to a new folder; Windows drive letter change; `paths: ["../other/secret.mp4"]`; missing file.

Decide: import-only rebase vs export relative. Fill Spike result.

**Verify**: table in this file

### Step 2: Ship or not

If shipping: helpers reject resolved paths that are not `existsSync` after normalize; reject if `path.relative(jsonDir, resolved)` starts with `..` **unless** you explicitly allow only basename fallback inside `jsonDir`. Tests in `test/prefs.test.js`. Wire `importLayout` to pass `path.dirname(filePaths[0])`.

If any case requires executing JSON keys other than the known prefs shape: STOP.

**Verify**: `npm test` → exit 0

## Test plan

- Unit: relative join, basename fallback, `..` rejected, absolute hit first.
- Pattern: `filterMissingPaths` tests.

## Done criteria

- [ ] `## Spike result` filled
- [ ] Either portable import/export shipped with tests **or** explicit no-ship
- [ ] `npm test` exits 0
- [ ] `plans/README.md` 084 DONE

## STOP conditions

- Resolved path escapes `jsonDir` via `..` and you would still `existsSync` it as a feature.
- You would bump `version` without a parse path for v1 absolute-only files.

## Spike result

_(executor fills)_

## Maintenance notes

- Reviewer: 083 merge + rebase order — apply rebase then merge into empties.
- Windows: `path.win32` in tests if you add fixtures with backslashes.
