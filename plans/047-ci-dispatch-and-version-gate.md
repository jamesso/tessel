# Plan 047: Pack on dispatch; publish only when a new version is pushed

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat a7bd825..HEAD -- .github/workflows/release.yml AGENTS.md README.md`
> Compare excerpts against live code; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `a7bd825`, 2026-08-27

## Why this matters

`AGENTS.md` and README say GitHub Releases publish on a **version-bump push** to `master`/`main`. The workflow also runs `gh release create` on `workflow_dispatch` with no version check, so a manual run on any ref can publish (or overwrite) `v${{ package.json version }}`. Separately, `check-version` only diffs `HEAD~1`. A push whose version bump is not the tip commit (bump + follow-up commit) sets `version-changed=false` and **skips** the release. Plan 005 wanted dispatch as pack-smoke, not a second publish path.

## Current state

`.github/workflows/release.yml`:

```yaml
on:
  push:
    branches: [ master, main ]
  pull_request:
    branches: [ master, main ]
  workflow_dispatch:
```

`check-version` (`:43-56`) uses `git diff HEAD~1 HEAD` on `package.json` / `"version"`. Checkout `fetch-depth: 2`.

`build` (`:60`) and `release` (`:134`):

```yaml
if: (github.event_name == 'push' && needs.check-version.outputs.version-changed == 'true') || github.event_name == 'workflow_dispatch'
```

Release job runs `gh release create "v${{ needs.check-version.outputs.version }}"` (`:190-199`).

`AGENTS.md:25`: bump version and **push**; PRs do not release.

**Conventions**: keep `actions/checkout@v4`, `setup-node@v4`, `upload-artifact@v4`, `gh release create`. Short imperative commits. No AI co-author trailers.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| YAML parse | `python3 -c "import yaml,pathlib; yaml.safe_load(pathlib.Path('.github/workflows/release.yml').read_text())"` | exit 0, or skip if PyYAML missing and inspect indent by eye |
| Dispatch cannot publish | `grep -n "workflow_dispatch" -n .github/workflows/release.yml` plus the `release:` `if:` | `release` `if:` does **not** contain `workflow_dispatch` |
| Tests | `npm test` | exit 0 (no app change expected) |

No lint/typecheck script.

## Scope

**In scope**:

- `.github/workflows/release.yml`
- `AGENTS.md` and `README.md` only to state: dispatch packs artifacts; only a push of a version that is not already a GitHub Release publishes

**Out of scope**:

- Changing packager scripts
- Changelog generation
- Signed macOS (`plans/DEFERRED.md`)
- Splitting test vs pack into different workflow files

## Git workflow

- Branch: `advisor/047-ci-dispatch-and-version-gate`
- Message: `Publish GitHub Releases only for new version pushes, not dispatch.`
- Do not push unless asked.

## Steps

### Step 1: Detect a *new* package version, not `HEAD~1`

Replace the `HEAD~1` diff with: **this `package.json` version has no GitHub Release tag yet**.

In `check-version`:

1. Checkout with `fetch-depth: 0` and `fetch-tags: true` (or `gh release view` without git tags).
2. `version=$(node -p "require('./package.json').version")` (keep the existing output).
3. Set `changed=true` only when release `v$version` does **not** already exist.

Preferred implementation (hosted runners have `gh`):

```yaml
- name: Check if version is unpublished
  id: check
  env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  run: |
    VERSION=$(node -p "require('./package.json').version")
    if gh release view "v${VERSION}" >/dev/null 2>&1; then
      echo "changed=false" >> $GITHUB_OUTPUT
      echo "Release v${VERSION} already exists"
    else
      echo "changed=true" >> $GITHUB_OUTPUT
      echo "No GitHub Release for v${VERSION}"
    fi
```

`check-version` needs `permissions: contents: read` if the job would otherwise lack `GH_TOKEN` for `gh release view`.

Do **not** treat “`package.json` touched in this push” as sufficient; that is the `HEAD~1` bug.

**Verify**: `grep -n "HEAD~1" .github/workflows/release.yml` → no matches

### Step 2: Split pack vs publish

- `build` `if:` keep pack-smoke: `(github.event_name == 'push' && needs.check-version.outputs.version-changed == 'true') || github.event_name == 'workflow_dispatch'`
- `release` `if:` **only** `github.event_name == 'push' && needs.check-version.outputs.version-changed == 'true'`

PRs still run `test` only (build already excludes `pull_request`).

**Verify**: `python3 -c "import pathlib; t=pathlib.Path('.github/workflows/release.yml').read_text(); assert 'workflow_dispatch' in t; rel=t.split('release:')[1].split('runs-on:')[0]; assert 'workflow_dispatch' not in rel"` → exit 0

### Step 3: Docs one-liners

`AGENTS.md` GitHub Release bullet: add that **workflow_dispatch builds artifacts only** and does not `gh release create`.

README “Cutting a GitHub Release”: same sentence. Keep “push, not pull requests.”

**Verify**: `grep -n "workflow_dispatch" AGENTS.md README.md` → each file mentions pack-only / no publish

## Test plan

- No app tests. Mentally trace:
  - PR → `test` only
  - push, version already released → `test` only
  - push, version not released → `test` + `build` + `release`
  - `workflow_dispatch` → `test` + `build`, no `release`
- Pattern: plan 005’s workflow `if:` style.

Verification: `npm test` → exit 0.

## Done criteria

- [ ] `grep HEAD~1 .github/workflows/release.yml` is empty
- [ ] `release` job `if:` has no `workflow_dispatch`
- [ ] `build` job still runs on `workflow_dispatch`
- [ ] Version gate is “no existing `v$version` GitHub Release”, not `HEAD~1`
- [ ] `npm test` exits 0
- [ ] No files outside the in-scope list are modified
- [ ] `plans/README.md` status row for 047 set to DONE

## STOP conditions

- Excerpts drifted.
- You would publish from `workflow_dispatch` when the version is new (that still bypasses “push only”).
- You would delete `workflow_dispatch` entirely (005 wanted pack-smoke).
- Fix seems to require `workflow_dispatch` inputs that create a release.

## Maintenance notes

- Reviewer: a failed `release` job after `gh release create` may leave tag `vX` in place; a later push of the same version will not republish. Re-run the **push** workflow or delete the broken release, not dispatch-to-publish.
- Next real version bump on `master` is the live smoke (operator).
