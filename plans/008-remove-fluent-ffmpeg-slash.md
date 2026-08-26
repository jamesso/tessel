# Plan 008: Remove unused fluent-ffmpeg encode path and the slash dependency

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat b558cb8..HEAD -- main.js package.json package-lock.json`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/002-fix-duration-probing.md
- **Category**: tech-debt
- **Planned at**: commit `b558cb8`, 2026-08-26

## Why this matters

`package-lock.json` marks `fluent-ffmpeg@2.1.3` **deprecated** (“Package no longer supported”). Encode already `spawn`s ffmpeg (`main.js:489`); `let command = ffmpeg(); command.addInput(val)` (`main.js:334-361`) is never `.run()`. `slash@5.1.0` is ESM-only (`"type": "module"`) and is `require`d at `main.js:60` but **never called**. Node ≥22.12 can load it, so this is not a startup crash — it is dead weight and a future footgun if someone calls `slash(path)` without `.default`. After plan 002, duration should not need `ffmpeg.ffprobe`.

## Current state

```javascript
const ffmpeg = require('fluent-ffmpeg')
const slash = require('slash')
ffmpeg.setFfmpegPath(ffmpegPath.path);
// ffprobe require/try — plan 002 removes the fake @ffmpeg-installer/ffprobe
```

`package.json` dependencies: `@ffmpeg-installer/ffmpeg`, `fluent-ffmpeg`, `slash`.

**Conventions**: Keep `@ffmpeg-installer/ffmpeg` and `spawn`. CommonJS.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 |
| Install lockfile | `npm uninstall fluent-ffmpeg slash` | exit 0, both gone from `package.json` |
| Grep | `grep -n "fluent-ffmpeg\\|require('slash')" main.js` | no matches |

## Scope

**In scope**:
- `main.js` (remove fluent-ffmpeg and slash; keep spawn + `@ffmpeg-installer/ffmpeg`)
- `package.json` / `package-lock.json` via `npm uninstall`

**Out of scope**:
- Replacing the ffmpeg **binary** package (plan 026)
- asar unpack (plan 016)
- Rebuilding filter graph in fluent-ffmpeg `.run()` — spawn stays the encoder

## Git workflow

- Branch: `advisor/008-remove-fluent-ffmpeg-slash`
- Message: `Drop unused fluent-ffmpeg and slash dependencies.`
- Do not push unless asked.

## Steps

### Step 1: Confirm duration no longer uses `ffmpeg.ffprobe`

If `grep -n "ffmpeg.ffprobe" main.js` still matches, stop — plan 002 must land first (option A) or you must replace remaining `ffprobe` calls with the spawn helper from 002 in this PR (allowed, same behavior).

**Verify**: `grep -n "ffmpeg.ffprobe" main.js` → no matches before uninstall

### Step 2: Delete requires and unused builder

Remove `require('fluent-ffmpeg')`, `require('slash')`, `ffmpeg.setFfmpegPath`, `ffmpeg.setFfprobePath`, and any leftover `let command = ffmpeg()`. Keep `const ffmpegPath = require('@ffmpeg-installer/ffmpeg')` and `spawn(ffmpegPath.path, args)`.

If `ffmpegPath.path` is the only use, that is correct.

**Verify**: `node -e "require('fs').readFileSync('main.js','utf8').includes('fluent-ffmpeg') && process.exit(1)"` → exit 0

### Step 3: Uninstall

Run `npm uninstall fluent-ffmpeg slash` (updates lockfile). Do not hand-edit lockfile.

**Verify**: `node -e "const p=require('./package.json'); if(p.dependencies['fluent-ffmpeg']||p.dependencies.slash) process.exit(1)"` → exit 0

### Step 4: Tests

`npm test` still passes. No new tests required beyond existing mosaic argv tests (still spawn-shaped).

**Verify**: `npm test` → exit 0

## Test plan

- Existing `test/mosaic.test.js` still describes argv, not fluent API.

## Done criteria

- [ ] `fluent-ffmpeg` and `slash` absent from `package.json` dependencies
- [ ] `main.js` does not require them
- [ ] `@ffmpeg-installer/ffmpeg` still required
- [ ] `npm test` exits 0
- [ ] `plans/README.md` 008 DONE

## STOP conditions

- Packaged duration check at end of convert still calls `ffmpeg.ffprobe(filePath, …)` (`main.js:527`) — replace with the spawn duration helper or delete the debug-only probe; do not keep fluent-ffmpeg solely for that debug `ffprobe`.
- Uninstall fails due to lockfile conflict — stop and report.

## Maintenance notes

- `slash` was never used; do not re-add `slash@3` “to be safe.”
- Reviewer: convert still uses `spawn` + `-filter_complex`.
