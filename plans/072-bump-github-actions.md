# Plan 072: Run GitHub Actions on a Node 24 action runtime

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat f14caf4..HEAD -- .github/workflows/release.yml`
> Compare excerpts against live code; on a mismatch, treat it as a STOP condition.
> If 071/073 also edit this file, rebase.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: MED
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `f14caf4`, 2026-08-27

## Why this matters

`.github/workflows/release.yml` pins `actions/checkout@v4`, `actions/setup-node@v4`, `actions/upload-artifact@v4`, `actions/download-artifact@v4`. Those majors run on the Node 20 **action** runtime. GitHub’s changelog (updated 2026-08-25) removes Node 20 from hosted runners on **2026-09-23**. After that, this workflow can fail even though Tessel’s own `engines` Node 22 is unrelated. App `npm audit` being clean does not update Actions.

## Current state

Test job: checkout@v4, setup-node@v4 with `node-version-file: '.nvmrc'` and `cache: 'npm'`. Packager matrix: same, plus upload-artifact@v4. Release job: checkout@v4, download-artifact@v4.

Keep: test on every PR/push; pack on version-bump **push** or `workflow_dispatch`; `gh release create` only on push when no existing GitHub Release (047).

**Conventions**: do not add eslint. Short imperative commits. No AI co-author trailers.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 |
| Action runtime | Inspect each bumped action’s `action.yml` `using:` | `node24` (not `node20`) |

## Scope

**In scope**:

- `.github/workflows/release.yml` — bump the four official actions to majors whose JavaScript action runtime is Node 24 (as of this plan, checkout and setup-node **v5/v6+** are documented that way; artifact actions need a current major that is not Node 20). Pin **full versions or majors** consistently with the rest of the file (today: `@v4` majors). Prefer the current stable major at implementation time; record the tags you chose in the commit message.

**Out of scope**:

- `ELECTRON_SKIP_BINARY_DOWNLOAD` on the test job (previously rejected)
- Changing Node for the **app** (`.nvmrc` stays 22)
- New workflows

## Git workflow

- Branch: `advisor/072-bump-github-actions`
- Message: `Run the release workflow on Node 24 GitHub Actions.`
- Do not push unless asked.

## Steps

### Step 1: Pick versions

For each of checkout, setup-node, upload-artifact, download-artifact: open the GitHub repo release / `action.yml`. Require `using: node24`. Do not stay on `@v4` if that tag is still node20.

Watch download-artifact path layout: release job uses `artifacts/tessel-macos-arm64/tessel-macos-arm64.tar.gz` (047). If v5+ changes merge behavior, keep `merge-multiple` / `path` so `gh release create` still finds the three archives.

**Verify**: no `@v4` left for those four actions

### Step 2: Tests

`npm test` locally. You cannot fully prove Actions here; the operator should run a PR or `workflow_dispatch` pack smoke after merge.

**Verify**: `npm test` → exit 0; `grep "@v4" .github/workflows/release.yml` → no checkout/setup-node/artifact v4

## Test plan

- YAML review. Optional: if a test greps the workflow, update it.

## Done criteria

- [ ] The four actions use a Node 24 runtime major
- [ ] Release artifact paths still match `gh release create` arguments
- [ ] Publish gate and dispatch-vs-push behavior unchanged
- [ ] `npm test` exits 0
- [ ] `plans/README.md` 072 DONE

## STOP conditions

- download-artifact layout would break `gh release create` and you cannot restore the three paths.
- You would set `ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION` as the fix.

## Maintenance notes

- Reviewer: setup-node `cache: npm` + `.nvmrc` must still work.
- 073 may add `actions/cache`; use a Node 24 cache action major too.
