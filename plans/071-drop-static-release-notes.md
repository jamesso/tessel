# Plan 071: Stop republishing the v1.6.0 changelog on every GitHub Release

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat f14caf4..HEAD -- .github/workflows/release.yml README.md`
> Compare excerpts against live code; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs
- **Planned at**: commit `f14caf4`, 2026-08-27

## Why this matters

`.github/workflows/release.yml` writes `release-notes.md` with a hardcoded `### Changes` list for 1.6.0 (Advanced dialog, freeze pad, audio cell, import/export, copy-to-empty, FFmpeg 7.1, `*.tessel-partial.mp4`). The next `package.json` version bump + push reuses that heredoc. Plan 047 left changelog generation out of scope; 048 already had to refresh Features once. A 1.7.0 release would advertise 1.6.0 deltas as new.

## Current state

`release.yml` job `release` step “Write release notes”: Features (evergreen product snapshot) then `### Changes` with seven 1.6.0 bullets. `gh release create … --notes-file release-notes.md`. Gate remains `gh release view` (047).

**Conventions**: PRs still must not `gh release create`. `workflow_dispatch` still must not create a GitHub Release. Short imperative commits. No AI co-author trailers.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 |
| YAML | `grep -n "### Changes\\|tessel-partial" .github/workflows/release.yml` | Changes gone or not 1.6.0-specific |

## Scope

**In scope**:

- `.github/workflows/release.yml` release-notes heredoc: **delete** `### Changes` or replace with a one-liner that does not name 1.6.0-only work (e.g. “See the commit history since the previous release.”). Keep Downloads, Installation (including unsigned macOS / `xattr`), and the evergreen Features list. You may add `git log` notes **only** if the recipe is explicit and does not require a network at plan-write time — prefer deleting Changes.

**Out of scope**:

- Auto-changelog tools / npm packages
- Changing who can publish (047)
- Signing macOS

## Git workflow

- Branch: `advisor/071-drop-static-release-notes`
- Message: `Stop shipping the v1.6.0 changelog on every GitHub Release.`
- Do not push unless asked.

## Steps

### Step 1: Edit the heredoc

Remove the `### Changes` section and its 1.6.0 bullets. Keep Features in sync with README Features (already updated in 048/1.6.0). Do not invent a 1.7 changelog.

**Verify**: `grep "Move output settings into an Advanced" .github/workflows/release.yml` → no match

### Step 2: Tests

**Verify**: `npm test` → exit 0

## Test plan

- Optional grep test in an existing workflow-related test if one exists; none required.

## Done criteria

- [ ] Release notes template has no static 1.6.0 change list
- [ ] Features / install instructions remain
- [ ] `workflow_dispatch` still does not `gh release create`
- [ ] `npm test` exits 0
- [ ] `plans/README.md` 071 DONE

## STOP conditions

- You would publish releases from pull_request.
- You would add a changelog generator dependency.

## Maintenance notes

- Reviewer: next human bump can add a one-off Changes section in the same file **for that version only**, or keep Features-only notes.
- 070 may also touch README Features; do not fight copy.
