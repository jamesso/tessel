# Plan 073: Cache FFmpeg and Electron downloads in CI

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat f14caf4..HEAD -- .github/workflows/release.yml scripts/install-ffmpeg.js`
> Compare excerpts against live code; on a mismatch, treat it as a STOP condition.
> If 072 also edits the workflow, rebase.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (067 stamp makes skip-if-exists safer; not required)
- **Category**: perf
- **Planned at**: commit `f14caf4`, 2026-08-27

## Why this matters

`postinstall` downloads a ~100MB+ FFmpeg archive into gitignored `vendor/ffmpeg/` on every `npm ci` when the binary is missing. Electron’s installer also fetches its zip; `setup-node` `cache: npm` does not cover that. The test job and each packager OS repeat both downloads. Wall time is dominated by those fetches, not `node --test`.

## Current state

`.github/workflows/release.yml` test and build jobs: checkout, setup-node with `cache: 'npm'`, `npm ci`, then test or `npm run package-*`. `.gitignore` includes `vendor/ffmpeg/`. `install-ffmpeg.js` skips download if `binDest` exists (067 will also stamp the pin).

Do **not** set `ELECTRON_SKIP_BINARY_DOWNLOAD` on the test job (`plans/README.md` rejected that as unplanned hygiene; integration tests need a real ffmpeg binary, not Electron, but `npm ci` still installs the electron devDependency).

**Conventions**: official `actions/cache` (use a Node 24 major if 072 has landed). Key on `scripts/ffmpeg-hashes.json` and `package-lock.json`. Short imperative commits. No AI co-author trailers.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 |

## Scope

**In scope**:

- `.github/workflows/release.yml` — cache restore/save for `vendor/ffmpeg` (keyed on `hashFiles('scripts/ffmpeg-hashes.json')`) and Electron’s download cache (typical path `~/.cache/electron` on Linux/macOS; Windows `$LOCALAPPDATA/electron/Cache` — look up the current electron-download cache dir for Electron 44 and document it in a workflow comment). Apply on **test** and **build** jobs.

**Out of scope**:

- Committing binaries into git
- Skipping `npm ci`
- Changing packager matrix OS

## Git workflow

- Branch: `advisor/073-cache-ci-ffmpeg`
- Message: `Cache FFmpeg and Electron binaries in GitHub Actions.`
- Do not push unless asked.

## Steps

### Step 1: vendor/ffmpeg cache

After checkout, before `npm ci`: restore `vendor/ffmpeg` with key `${{ runner.os }}-ffmpeg-${{ hashFiles('scripts/ffmpeg-hashes.json') }}`. `npm ci` / postinstall should no-op the download when the binary exists (067 stamp if present).

**Verify**: YAML contains `vendor/ffmpeg` and `ffmpeg-hashes.json`

### Step 2: Electron cache

Cache the electron download directory similarly, keyed on `package-lock.json` (or the electron version). Restore before `npm ci`.

**Verify**: workflow mentions electron cache path

### Step 3: Local tests

**Verify**: `npm test` → exit 0 (workflow not executed locally)

## Test plan

- None required beyond YAML sanity. Operator: second CI run should show cache hit.

## Done criteria

- [ ] Test and packager jobs restore `vendor/ffmpeg` by hashes file
- [ ] Electron zip cache is restored when the lockfile matches
- [ ] `ELECTRON_SKIP_BINARY_DOWNLOAD` is **not** set
- [ ] `npm test` exits 0
- [ ] `plans/README.md` 073 DONE

## STOP conditions

- Cache would restore a binary that fails 067’s pin stamp without re-download (empty stamp + wrong binary) — then depend on 067 or always hash-check in install-ffmpeg.
- You would disable `npm ci`.

## Maintenance notes

- Reviewer: Windows cache path differs; a missing path should not fail the job (`lookup-only` / `if: always()` save patterns as used by GitHub docs).
- After 067, a hashes change must miss the cache (hashFiles key).
