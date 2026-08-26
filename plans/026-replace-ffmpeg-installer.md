# Plan 026: Replace abandoned `@ffmpeg-installer/ffmpeg` (FFmpeg 4.4)

> **Executor instructions**: This is a **high-blast-radius migration**, listed as investigate-first. Do not start until plans 001 and 002 are DONE. Spike a replacement binary, re-run mosaic tests and one real encode, then swap the dependency. If `tpad` / `-vsync` / overlay behavior changes, STOP.
>
> **Drift check (run first)**: `git diff --stat b558cb8..HEAD -- package.json package-lock.json main.js lib/mosaic.js`

## Status

- **Priority**: P3
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: plans/001-add-node-test-runner.md, plans/002-fix-duration-probing.md, plans/016-asar-unpack-ffmpeg.md
- **Category**: migration
- **Planned at**: commit `b558cb8`, 2026-08-26

## Why this matters

`@ffmpeg-installer/ffmpeg@^1.1.0` last published **2021**; platform packages ship **FFmpeg 4.4**. Current FFmpeg is 7/8.x. Users feed arbitrary local videos into this encoder. The installer walks `__dirname` for binaries (fragile with asar — plan 016). Replacing it without characterization tests and a working duration probe is how mosaics go silent or hang.

## Current state

```javascript
const ffmpegPath = require('@ffmpeg-installer/ffmpeg')
ffmpeg.setFfmpegPath(ffmpegPath.path) // removed after 008
spawn(ffmpegPath.path, args)
```

`package.json` dependency `@ffmpeg-installer/ffmpeg`. Packager unpack glob after 016 targets this package.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 |
| Version | bundled `ffmpeg -version` | record 4.4 vs new |

## Scope

**In scope**:
- Choose a **maintained** ffmpeg distribution (e.g. `ffmpeg-static`, or platform optionalDependencies you pin). Record the choice in `plans/026-ffmpeg-migration-notes.md`.
- `package.json` / lockfile
- `main.js` path to binary
- Packager unpack glob (plan 016) updated for the new package’s binary path
- `test/` only if spawn path is injected for tests

**Out of scope**:
- GPU encoders
- Shipping two ffmpeg versions
- Changing mosaic semantics (letterbox, 25fps) except where the new binary **requires** flag renames (`-vsync` → `-fps_mode` on new ffmpeg — if so, update argv **and** tests)

## Git workflow

- Branch: `advisor/026-replace-ffmpeg-installer`
- Message: `Replace @ffmpeg-installer/ffmpeg with a maintained ffmpeg binary.`
- Do not push unless asked.

## Steps

### Step 1: Notes + spike

Create `plans/026-ffmpeg-migration-notes.md`: candidate package, license, platforms (darwin-arm64, win32-x64, linux-x64 — same as packager), binary size, asar unpack path.

Install the candidate in a **throwaway** way first (`npm install` on the branch is OK). Run `ffmpeg -version`. Run **one** 2×2 convert with the app or argv from `buildFfmpegArgs` on lavfi color clips.

If `tpad` or `overlay` fails, STOP and revert the dep.

**Verify**: notes file exists; spike convert exit 0

### Step 2: Swap dependency

Remove `@ffmpeg-installer/ffmpeg`. Point `spawn` at the new `.path` or `path.join(process.resourcesPath, ...)`. Update 016 unpack glob. Grep the repo for `@ffmpeg-installer`.

**Verify**: `grep -n "@ffmpeg-installer/ffmpeg" package.json main.js` → no matches

### Step 3: Tests + packaged smoke

`npm test`. Package **this OS** (plan 016 layout) and confirm the new binary executes.

**Verify**: packaged binary `--version` works; `npm test` exit 0

### Step 4: README

Technical Details still say “FFmpeg”; add the major version if you document it.

## Test plan

- Existing mosaic argv tests; add a single optional integration test that spawns ffmpeg `-f lavfi -i color=...` **only** if CI Ubuntu can run it quickly. Skip on missing binary with `test.skip`. Do not download random ffmpeg in CI.

## Done criteria

- [ ] Notes file names the replacement and platforms
- [ ] `@ffmpeg-installer/ffmpeg` gone
- [ ] Unpack glob finds the new binary
- [ ] 2×2 convert works on the executor’s OS
- [ ] `npm test` exits 0
- [ ] `plans/README.md` 026 DONE or BLOCKED

## STOP conditions

- New ffmpeg 7+ rejects `-vsync cfr` — you may replace with the documented equivalent **after** a passing encode; if behavior of tpad/duration changes vs goldens, STOP.
- Windows path or `.exe` suffix unknown — do not ship a mac-only path.
- Plan 016 not done — asar will break spawn; do 016 first or keep `--no-asar` temporarily and document (worse); prefer 016 first as Depends-on states.

## Maintenance notes

- Reviewer: licenses of static builds; size of release artifacts.
- Dependabot may not understand optional platform packages — pin carefully.
