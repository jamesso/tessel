# Plan 022: Investigate whether ffmpeg hangs without `-nostdin`

> **Executor instructions**: This is an **investigate** plan, not a feature rewrite. Run the experiments, write the result into this file, and only then make the one-line argv change if the hang is confirmed. Do not invent other ffmpeg flags. Update `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat b558cb8..HEAD -- main.js lib/mosaic.js`

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/002-fix-duration-probing.md
- **Category**: bug
- **Planned at**: commit `b558cb8`, 2026-08-26
- **Completed**: 2026-08-26 — no hang on darwin-arm64; encode argv hardened with `-nostdin`

## Why this matters

`spawn(ffmpegPath.path, args)` at `main.js:222` and `main.js:489` leaves stdin as a pipe. FFmpeg historically treats stdin as interactive unless `-nostdin` is passed, which can stall a child waiting on a pipe Electron never writes. Plan 002 already **allows** `-nostdin` on the duration probe; encode spawn may still omit it. Confidence was **LOW** at audit time.

## Current state

Duration helper (pre-002): `const args = ['-i', videoPath, '-f', 'null', '-'];` Encode args in `buildFfmpegArgs` / `main.js:471-483` start at `-i` without `-nostdin`.

Bundled binary: `@ffmpeg-installer/ffmpeg` (FFmpeg 4.4).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Binary | `node -e "console.log(require('@ffmpeg-installer/ffmpeg').path)"` | prints a path |
| Tests | `npm test` | exit 0 after any argv change |

## Scope

**In scope**: experiment notes in this file (`## Investigation result`); optionally prepend `'-nostdin'` to probe and encode argv in `main.js` / `lib/mosaic.js` + tests

**Out of scope**: new ffmpeg builds, replacing installer (plan 026), changing filter graph

## Git workflow

- Branch: `advisor/022-investigate-ffmpeg-nostdin`
- Message: `Document ffmpeg stdin behavior and add -nostdin if needed.`
- Do not push unless asked.

## Steps

### Step 1: Reproduce with the bundled binary

Using `ffmpegPath` from `@ffmpeg-installer/ffmpeg`, run two spawns from a short Node script (do not commit the script unless useful):

1. Encode or probe **without** `-nostdin`, stdin ignored (`stdio: ['ignore', 'pipe', 'pipe']` vs default `'pipe'`).
2. Same with `-nostdin` first.

Use a tiny generated clip if needed: `ffmpeg -f lavfi -i color=c=black:s=64x64:d=1 -y /tmp/tessel-probe.mp4` then run the **app’s** duration command.

Record: does default stdin hang (>5s) on this OS?

**Verify**: you wrote timings under `## Investigation result` below

### Step 2: If hang confirmed, add `-nostdin`

Prepend `'-nostdin'` to every `spawn(ffmpegPath.path, …)` argv (probe + encode). Update `test/mosaic.test.js` if argv goldens exist.

If **no hang**, still adding `-nostdin` is allowed as hardening; say so in the result. Do not add unrelated flags.

**Verify**: `grep -n nostdin main.js lib/mosaic.js` matches if you chose to add it; `npm test` passes

### Step 3: Mark the plan

Set status DONE. If you could not run ffmpeg (missing binary), mark BLOCKED with the reason.

## Test plan

- Observation + optional argv test.

## Done criteria

- [ ] `## Investigation result` filled (OS, hang yes/no, action taken)
- [ ] If argv changed, `npm test` exits 0
- [ ] `plans/README.md` 022 DONE or BLOCKED

## STOP conditions

- You cannot execute the bundled ffmpeg — BLOCKED, do not copy flags from the internet without a run.

## Maintenance notes

- Reviewer: `-nostdin` must be before `-i`.

## Investigation result

- **OS / arch**: macOS (darwin 25.5.0), arm64 (Apple Silicon)
- **Bundled binary**: `@ffmpeg-installer/ffmpeg` 4.4 (`node_modules/@ffmpeg-installer/darwin-arm64/ffmpeg`)
- **Hang without `-nostdin`**: **no** — all cases completed in 10–14 ms (6 s timeout); default stdin pipe did not stall probe or encode
- **Timings** (6 s kill threshold):

| Case | ms | exit | hung |
|------|-----|------|------|
| probe, default pipe, no `-nostdin` | 13 | 1 | no |
| probe, stdin ignore, no `-nostdin` | 11 | 1 | no |
| probe, default pipe, with `-nostdin` | 10 | 1 | no |
| encode (libx264 veryfast/crf 23/yuv420p), default pipe, no `-nostdin` | 13 | 0 | no |
| encode, stdin ignore, no `-nostdin` | 14 | 0 | no |
| encode, default pipe, with `-nostdin` | 13 | 0 | no |

- **Change landed**: **yes** — `-nostdin` prepended to encode argv in `buildFfmpegArgs` (`lib/mosaic.js`); probe spawn in `main.js` already had `-nostdin` (plan 002). Hardening only; no hang reproduced on this OS/binary.
