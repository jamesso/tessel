# Plan 070: Fix stale agent and product copy (platform, release gate, python3, macOS 13)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat f14caf4..HEAD -- PRODUCT.md AGENTS.md README.md plans/README.md scripts/githooks/commit-msg`
> Compare excerpts against live code; on a mismatch, treat it as a STOP condition.
> If 071 also edits README, rebase.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs
- **Planned at**: commit `f14caf4`, 2026-08-27

## Why this matters

`PRODUCT.md` is the product register for later audits and UI work; it says `Platform: web` while the rest of the file (and the app) is a local Electron desktop. `AGENTS.md` says CI publishes when there is no `v$version` **tag**; the workflow uses `gh release view` (GitHub Release). README Prerequisites omit `python3`, which the commit-msg hook requires. Electron 44 dropped macOS 12; Installation never states an OS floor. `plans/README.md` intro still reads as a live execution queue though 001–062 are DONE. Rejected-list bullets still cite ffmpeg-static 6.0 after 051.

## Current state

- `PRODUCT.md:7-9` — `## Platform` / `web` (Purpose already says Electron).
- `AGENTS.md:25` — “no existing `v$version` tag yet”; `.github/workflows/release.yml` `gh release view "v${VERSION}"`.
- `AGENTS.md:22` — `npm test` (`node --test test/`) vs `package.json` `"test": "node --test test/*.test.js"`.
- `README.md` Development Prerequisites: Node + npm only.
- `scripts/githooks/commit-msg` header still talks about copying into `.git/hooks` though `prepare` sets `core.hooksPath`.
- `plans/README.md` already lists **063–085** as the live queue (fourth audit). This plan’s index work is leftover copy, not re-adding those rows.

**Conventions**: keep “How to work in this repo” canonical in `AGENTS.md`; `CLAUDE.md` points there. Short imperative commits. No AI co-author trailers.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 (docs-only) |

## Scope

**In scope**:

- `PRODUCT.md` — Platform `desktop` or `electron` (not `web`)
- `AGENTS.md` — GitHub **Release** not git tag; test command parenthetical `test/*.test.js`
- `README.md` — python3 for hooks; macOS 13+ (Ventura) for current Electron 44 builds; do not promise Monterey
- `scripts/githooks/commit-msg` — header: hooksPath via `prepare`; python3; do not copy to `.git/hooks`
- `plans/README.md` — keep 001–062 historical and 063–085 as the live queue; rewrite any remaining ffmpeg-static 6.0 evidence sentences **without** re-opening hardware encode / WebM / Intel Mac; do not tell executors to re-run 001–062

**Out of scope**:

- Release workflow `### Changes` (071)
- NOTICE / darwin LICENSE (069)
- Signed macOS
- Deleting `test/index.js` (optional one-liner in AGENTS only: do not run `node test/index.js` as the suite)

## Git workflow

- Branch: `advisor/070-docs-product-agents-readme`
- Message: `Fix product platform, release-gate wording, and setup docs.`
- Do not push unless asked.

## Steps

### Step 1: PRODUCT.md

Set Platform to desktop/Electron. Leave Users / Purpose / anti-references.

**Verify**: `grep -n "^web$" PRODUCT.md` → no match; Purpose still says Electron

### Step 2: AGENTS.md + hook comment + README

Release gate = no existing GitHub Release `v$version`. Test glob = `test/*.test.js`. README Prerequisites: Node 22.12+, npm, python3 on PATH for git hooks. Installation: Apple Silicon + macOS 13 or later for GitHub Release builds (Electron 44).

**Verify**: `grep tag AGENTS.md` does not describe the publish gate; `grep python3 README.md`

### Step 3: plans/README.md leftover copy only

The fourth-audit index (banner, 063–085 rows, finding map, deps, rejected list) is already written. Do not revert it. If considered-and-rejected still says `ffmpeg-static 6.0` / darwin ffmpeg-static libvpx, replace with vendor FFmpeg 7.1; keep the **verdicts** (no hardware encode, no WebM output, no Intel Mac). Historical finding-map mentions of plans 026/051 may still say ffmpeg-static.

**Verify**: `grep ffmpeg-static plans/README.md` → none in rejected bullets (mentions in historical finding maps for 026/051 are OK)

### Step 4: Tests

**Verify**: `npm test` → exit 0

## Test plan

- Docs only. No new tests required.

## Done criteria

- [ ] PRODUCT.md platform is not `web`
- [ ] AGENTS.md publish gate matches `gh release view`
- [ ] README documents python3 and macOS 13 floor
- [ ] plans index does not tell executors to run 001–062
- [ ] `npm test` exits 0
- [ ] `plans/README.md` 070 DONE

## STOP conditions

- You would claim a WCAG level (`PRODUCT.md` says none claimed).
- You would re-propose signed/notarized macOS.
- You would change `package.json` test script.

## Maintenance notes

- Reviewer: Electron 45+ may raise the macOS floor again — update README with the next bump.
- `test/index.js` remains unused by `npm test`; deleting it is still not this plan.
