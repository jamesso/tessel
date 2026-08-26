# Plan 005: Gate packaging and GitHub Releases so PRs cannot publish

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat b558cb8..HEAD -- .github/workflows/release.yml`

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MED
- **Depends on**: plans/001-add-node-test-runner.md
- **Category**: security
- **Planned at**: commit `b558cb8`, 2026-08-26

## Why this matters

The workflow runs on every `push` and `pull_request` to `master`/`main`. The `build` matrix packages macOS, Windows, and Linux with no `if:` — README-only PRs still download Electron and pack three apps. The `release` job runs when `version-changed` is true, **without** requiring `github.event_name == 'push'`. `check-version` diffs `HEAD~1` (`release.yml:27-28`); on a PR merge commit that is the whole PR, so a same-repo version-bump PR can create a public GitHub Release. Release upload uses archived `actions/create-release@v1` and `actions/upload-release-asset@v1` (Node 12, unmaintained since 2021).

## Current state

```yaml
on:
  push:
    branches: [ master, main ]
  pull_request:
    branches: [ master, main ]
```

`release` job (`release.yml:111-114`):

```yaml
  release:
    needs: [check-version, build]
    if: needs.check-version.outputs.version-changed == 'true'
    permissions:
      contents: write
```

Create/upload steps at `release.yml:129-203` use `actions/create-release@v1` and three `actions/upload-release-asset@v1` with paths:

- `artifacts/tessel-macos-arm64/tessel-macos-arm64.tar.gz`
- `artifacts/tessel-linux-x64/tessel-linux-x64.tar.gz`
- `artifacts/tessel-windows-x64/tessel-windows-x64.zip`

Artifact names from the build matrix: `tessel-macos-arm64`, `tessel-linux-x64`, `tessel-windows-x64`.

Plan 001 added an Ubuntu `test` job running `npm test`. Keep it.

**Conventions**: GitHub Actions YAML already uses `actions/checkout@v4`, `actions/setup-node@v4`, `actions/upload-artifact@v4`. Hosted runners have `gh`. Permissions already `contents: write` on release.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| YAML parse | `python3 -c "import yaml,pathlib; yaml.safe_load(pathlib.Path('.github/workflows/release.yml').read_text())"` | exit 0 **or** if PyYAML missing: visual check that indentation is valid |
| Archived actions gone | `grep -n "create-release@v1\\|upload-release-asset@v1" .github/workflows/release.yml` | no matches |

## Scope

**In scope**:
- `.github/workflows/release.yml` only
- `README.md` only if you add one sentence that GitHub Releases publish on a version bump **push** to `master`/`main` (full “Cutting a release” docs are plan 010)

**Out of scope**:
- Changing packager scripts in `package.json`
- Changelog generation (deferred; keep the existing release body text unless `gh release create` needs a file — you may pass the same markdown via a heredoc)
- macOS notarization

## Git workflow

- Branch: `advisor/005-ci-gate-packaging-releases`
- Message: `Run packager on version bumps only and publish releases with gh.`
- Do not push unless asked.

## Steps

### Step 1: Run tests on every PR/push; pack only when needed

- `test` job: runs on all workflow triggers (keep plan 001).
- `build` job: add `needs: [test]` and `if: github.event_name == 'push' && needs.check-version.outputs.version-changed == 'true'`.
- `check-version` still runs on PRs so the output exists; on PRs `version-changed` may be true but `build` must **not** run.

Alternative if `needs.check-version.outputs` is empty when skipped: keep `check-version` always-on (it already is).

**Verify**: `grep -A6 "^  build:" .github/workflows/release.yml` includes `if:` with `push` and `version-changed`

### Step 2: Release only on push to default branches

```yaml
if: github.event_name == 'push' && needs.check-version.outputs.version-changed == 'true'
```

Keep `needs: [check-version, build]`.

**Verify**: `grep -A8 "^  release:" .github/workflows/release.yml` includes `github.event_name == 'push'`

### Step 3: Replace archived actions with `gh release create`

Delete `actions/create-release@v1` and all three `upload-release-asset@v1` steps.

After `actions/download-artifact@v4` (path `artifacts`), run something equivalent to:

```yaml
- name: Create GitHub Release
  env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  run: |
    gh release create "v${{ needs.check-version.outputs.version }}" \
      artifacts/tessel-macos-arm64/tessel-macos-arm64.tar.gz \
      artifacts/tessel-linux-x64/tessel-linux-x64.tar.gz \
      artifacts/tessel-windows-x64/tessel-windows-x64.zip \
      --title "Tessel v${{ needs.check-version.outputs.version }}" \
      --notes-file - <<'EOF'
    …same user-facing notes as the current `body:` block…
    EOF
```

If heredoc + `gh` is painful on the runner, write notes to `release-notes.md` in the step with `cat > file <<EOF` then `--notes-file release-notes.md`. Keep the same Downloads/Installation/macOS Gatekeeper text. Tag `v${version}`. Do not use `softprops/action-gh-release` unless `gh` is unavailable (it is on GitHub-hosted runners).

**Verify**: `grep -n "actions/create-release@v1" .github/workflows/release.yml` → no matches; `grep -n "gh release create" .github/workflows/release.yml` → match

### Step 4: PR smoke for packaging (optional but recommended)

If you want PRs to still catch packager breakage without 3 OS: add `workflow_dispatch` on the workflow (no extra jobs required) **or** a single-OS `package-linux` job with `if: github.event_name == 'pull_request'`. Prefer **workflow_dispatch only** to save minutes unless you already know Linux packaging is the usual breakage.

**Verify**: workflow file still has `on.pull_request` so `test` runs on PRs

## Test plan

- No app tests. Mentally trace: PR without version bump → `test` only; push with version bump → `test` + `build` + `release`.
- Do not create a real GitHub Release from this plan.

## Done criteria

- [ ] `build` does not run on `pull_request`
- [ ] `release` requires `push` and version change
- [ ] No `create-release@v1` / `upload-release-asset@v1`
- [ ] `gh release create` attaches the three existing archive names
- [ ] `test` job still runs `npm test` on PRs
- [ ] `plans/README.md` 005 DONE

## STOP conditions

- Artifact download layout is not `artifacts/<artifact-name>/<file>` — list a dry-run comment and stop rather than guessing paths.
- `gh release create` cannot take three files and notes together on the runner image — stop; do not re-add archived actions.

## Maintenance notes

- Next version bump on `master` is the real smoke (operator).
- Reviewer: fork PRs must not get `contents: write` publish (this `if:` is the guard).
- Release notes still omit a changelog (called out in considered-and-rejected / later docs); do not block on CHANGELOG.md.
