# Plan 001: Add `npm test` and characterize the mosaic pipeline

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat b558cb8..HEAD -- package.json main.js app/js/index.js .github/workflows/release.yml`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `b558cb8`, 2026-08-26

## Why this matters

There is no command that answers “does Convert still work?” `package.json` only has `start`, `dev`, and three packager scripts. CI packages Electron for three OSes and never runs a test. `convertVideo` in `main.js` is the product (2×2/3×3 mosaic via a hand-built `-filter_complex` + `spawn`) and is unexported. Later plans change duration probing, filter geometry, and spawn args; without extracted helpers and characterization tests those plans will silently break output. This plan is the verification baseline and must land first.

## Current state

- `package.json` — scripts and engines; no `test` key:
```json
  "scripts": {
    "start": "electron .",
    "dev": " nodemon --exec electron .",
    "package-mac": "npx @electron/packager . --overwrite --no-asar --platform=darwin --arch=arm64 --icon=assets/icons/mac/icon.icns --prune=true --out=release-builds",
    "package-win": "npx @electron/packager . --overwrite --no-asar --platform=win32 --arch=x64 --icon=assets/icons/win/icon.ico --prune=true --out=release-builds --win32metadata.CompanyName=CE --win32metadata.FileDescription=CE --win32metadata.ProductName=\"Tessel\"",
    "package-linux": "npx @electron/packager . --overwrite --no-asar --platform=linux --arch=x64 --icon=assets/icons/linux/icon.png --prune=true --out=release-builds"
  },
  "engines": {
    "node": ">=22.12.0"
  },
```
- `main.js` — Electron main process. `parseTimeToSeconds` at lines 204–214 is **never called**. Live duration/progress parsing is inline regexes at 231 and 499. `convertVideo` (257–576) builds a fluent-ffmpeg `command` that is never `.run()`, then `spawn`s argv (471–483). 2×2 uses `originalPaths.slice(0, 4)` (349). Empty slots become `color=black` sources. `scale` uses `[blockWidth, blockHeight]` (405–410). `-an`, `-r 25`, `-t longestDuration`, 1280×720.
- `.github/workflows/release.yml` — `build` job runs `npm ci` then `npm run package-*`. No test job.
- No `test/` directory, no Jest/Mocha/Vitest. Node `>=22.12` ships `node:test`.

**Conventions to match**: CommonJS (`require`/`module.exports`) like `main.js` and `preload.js`. Vanilla JS, no TypeScript, no extra test-runner dependency. Commit messages are short imperative sentences (example from history: `Add agent commit rules and a commit-msg hook.`). Never add AI co-author trailers.

**Product output contract** (do not change in this plan): 1280×720, 25 fps, no audio (`-an`), libx264.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0, all tests pass |
| Tests (direct) | `node --test test/` | exit 0 |
| Confirm no extra runners | `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')).devDependencies"` | still only electron, packager, nodemon (plus nothing like jest/mocha) |

There is no lint or typecheck script in this repo. Do not add one here.

## Scope

**In scope**:
- `package.json` (add `test` script only; do not bump deps)
- `lib/timecode.js` (create)
- `lib/mosaic.js` (create)
- `main.js` (require the new modules; replace inlined parser/filter/argv construction with calls; behavior must stay identical)
- `test/timecode.test.js` (create)
- `test/mosaic.test.js` (create)
- `.github/workflows/release.yml` (add an Ubuntu `test` job that runs `npm ci && npm test`; do **not** change when `build` or `release` run)

**Out of scope**:
- Duration-probe spawn (`getVideoDurationWithFFmpeg` `-f null -`) — plan 002
- Overlay/`video:error` completeness — plan 003
- Job mutex/cancel — plan 004
- Gating packaging on version bumps — plan 005
- Renderer `vidPath1..9` refactor — plan 020
- Adding Jest/Vitest/Playwright/Spectron
- Changing filter math (letterbox, 3×3 leftover pixels, x264 preset) — later plans

## Git workflow

- Branch: `advisor/001-add-node-test-runner`
- Commit per logical unit (script + lib + tests + CI). Message style: `Add a node:test script and mosaic characterization tests.`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add the test script

In `package.json` `scripts`, add:

```json
"test": "node --test test/"
```

Keep the existing scripts unchanged (including the leading space in `"dev"`).

**Verify**: `node -e "const p=require('./package.json'); if(p.scripts.test!=='node --test test/') process.exit(1)"` → exit 0

### Step 2: Extract timecode helpers without changing match rules

Create `lib/timecode.js` (CommonJS) that **preserves current regexes**:

1. `parseFfmpegClock(timemark)` — move the body of `parseTimeToSeconds` (`main.js:204-214`) here. Keep the same behavior: missing/non-`H:M:S` → `0`.
2. `matchDurationInStderr(text)` — the regex `Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})` from `main.js:231`. Return a finite number of seconds or `null`.
3. `matchProgressTimeInStderr(text)` — the regex `time=(\d{2}):(\d{2}):(\d{2}\.\d{2})` from `main.js:499`. Return seconds or `null`.
4. `progressPercent(currentTime, longestDuration)` — `Math.min(Math.round((currentTime / longestDuration) * 100), 99)` as at `main.js:505`. If `longestDuration` is not a finite number `> 0`, return `0`.

In `main.js`: delete `parseTimeToSeconds`; `require('./lib/timecode')`; use `matchDurationInStderr` / `matchProgressTimeInStderr` / `progressPercent` at the two call sites. Do not “improve” the regex to accept `N/A` or one-decimal times (plans 023–025).

**Verify**: `node -e "const t=require('./lib/timecode'); if (t.matchDurationInStderr('Duration: 00:00:10.50')!==10.5) process.exit(1)"` → exit 0

### Step 3: Extract mosaic filter + argv builders

Create `lib/mosaic.js` that exports:

- `OUTPUT = { width: 1280, height: 720, fps: 25 }`
- `gridMetrics(gridType)` — `gridSize` 3 if `gridType === '3x3'` else 2; `blockWidth = Math.floor(1280 / gridSize)`; `blockHeight = Math.floor(720 / gridSize)` (same as `main.js:337-341`).
- `selectSlotPaths(originalPaths, gridType)` — 9 paths for 3×3, first 4 for 2×2 (`main.js:349`).
- `buildVideoInfo(slotPaths, videoDurations, longestDuration)` — same `filename` / `inputIndex` / `isBlack` / `duration` / `coord` as `main.js:351-385`.
- `buildFilterComplex(videoInfo, longestDuration, blockWidth, blockHeight)` — same filter list including `color=black` empties, `setpts`/`scale`/`tpad`/`copy`, canvas color, serial overlays to `[final]` (`main.js:389-467`). Keep tpad threshold `paddingDuration > 0.1`.
- `buildFfmpegArgs(videoInfo, filterComplex, longestDuration, filePath)` — same argv as `main.js:471-483` including `videoInfo.find(v => !v.isBlack).filename` (preserve the throw if all black).

`startConversion` in `main.js` must call these instead of inlining. Keep `spawn(ffmpegPath.path, args)` in `main.js`. You may delete the unused `let command = ffmpeg(); command.addInput(...)` **only if** `ffmpeg.ffprobe` / `setFfmpegPath` still compile — actually **do not** remove fluent-ffmpeg usage here (plan 009). You **may** delete the dead `command` / `addInput` locals because they do not affect ffprobe; that is behavior-neutral. If you are unsure, leave `command` in place.

**Verify**: `node -e "const m=require('./lib/mosaic'); const g=m.gridMetrics('3x3'); if(g.blockWidth!==426||g.blockHeight!==240) process.exit(1)"` → exit 0

### Step 4: Write characterization tests

Create `test/timecode.test.js` and `test/mosaic.test.js` using `node:test` and `node:assert/strict`.

`test/timecode.test.js` must cover:

- `parseFfmpegClock('01:02:03.5')` → `3723.5`
- `parseFfmpegClock('')` / `'N/A'` → `0`
- `matchDurationInStderr` on a snippet containing `Duration: 00:01:00.00` → `60`
- `matchDurationInStderr` with no match → `null`
- `matchProgressTimeInStderr` on `time=00:00:05.00` → `5`
- `progressPercent(50, 100)` → `50`; `progressPercent(100, 100)` → `99` (current cap)

`test/mosaic.test.js` must cover:

- 2×2 four-slot vs 3×3 nine-slot `selectSlotPaths`
- Sparse 2×2 (only slot 1 filled): filter contains `color=black` and overlay to `[final]`; args contain `-map`, `[final]`, `-an`, `-r`, `25`, `-vcodec`, `libx264`
- Unequal durations: shorter clip gets `tpad`; duration within 0.1 of max gets `copy` not `tpad`
- Args include `-t` equal to `String(longestDuration)`
- All-black `buildFfmpegArgs` throws (documents current `find` behavior)

Do not spawn ffmpeg in this plan.

**Verify**: `npm test` → exit 0, both files run, assertions above pass

### Step 5: Add a CI test job

In `.github/workflows/release.yml`, add a `test` job on `ubuntu-latest` that: checkout, `actions/setup-node@v4` with `node-version: '22'` and `cache: 'npm'`, `npm ci`, `npm test`. Do not add `needs: test` on `build` yet (plan 005). Do not change `on:` triggers.

**Verify**: `python3 -c "import pathlib; t=pathlib.Path('.github/workflows/release.yml').read_text(); assert 'npm test' in t"` → exit 0

### Step 6: Update the index

Set plan 001 to DONE in `plans/README.md`.

**Verify**: `git status --short` shows only in-scope files plus `plans/README.md`

## Test plan

- New: `test/timecode.test.js`, `test/mosaic.test.js` as listed in step 4.
- No existing test file to copy — this is the first suite. Use `const { test } = require('node:test')` and `const assert = require('node:assert/strict')`.
- Verification: `npm test` → all pass.

## Done criteria

- [ ] `npm test` exits 0
- [ ] `package.json` `scripts.test` is `node --test test/`
- [ ] `grep -n "parseTimeToSeconds" main.js` returns no matches
- [ ] `main.js` `require`s `./lib/timecode` and `./lib/mosaic`
- [ ] `.github/workflows/release.yml` contains a job that runs `npm test`
- [ ] No Jest/Mocha/Vitest added to `package.json`
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row for 001 is DONE

## STOP conditions

- The code at the locations in "Current state" doesn't match the excerpts.
- Extracting the filter string changes a golden string in `test/mosaic.test.js` that you cannot make match without altering scale/tpad/overlay order — stop; do not “fix” the filter.
- You believe you need a bundler to test `app/js/index.js` — skip renderer tests (out of scope); do not add jsdom.
- A step’s verification fails twice after a reasonable fix attempt.

## Maintenance notes

- Plans 002, 007, 014, 015, 016 must update `test/mosaic.test.js` / `test/timecode.test.js` when they change filter or progress math.
- Reviewer: confirm argv still includes `-an`, `-r 25`, `-map [final]`, and that fluent-ffmpeg `ffprobe` usage in `main.js` still exists.
- Renderer slot-state tests are deferred to plan 020 (classic script cannot `require` without a bundler).
