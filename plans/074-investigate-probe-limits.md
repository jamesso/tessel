# Plan 074: Investigate capping duration-probe demux (`-probesize` / `-analyzeduration`)

> **Executor instructions**: This is an **investigate** plan. Fill
> `## Investigation result` before changing probe argv. If conservative caps
> make real camera files fail `Duration:`, document that and **do not ship**.
> When done, update `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat f14caf4..HEAD -- lib/ffmpeg-session.js test/ffmpeg-session.test.js lib/timecode.js`
> On excerpt mismatch, STOP.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: MED
- **Depends on**: none (do not parallel 064 if you also edit session argv tests)
- **Category**: perf
- **Planned at**: commit `f14caf4`, 2026-08-27

## Why this matters

Duration probe argv is `-nostdin -protocol_whitelist file,pipe -hide_banner -i <path>` with no `-probesize` / `-analyzeduration` (`lib/ffmpeg-session.js` `getVideoDurationWithFFmpeg`). FFmpeg then uses default demux limits (typically 5MB / 5s) until `Duration:` is printed, then the process is killed. Convert’s “Analyzing n/m” phase (up to 3 workers) can read a lot of a 4K/MPEG-TS/moov-at-end file before encode. This is **not** the old full-decode path (002). Caps that are too small yield `Could not read video duration`.

## Current state

```javascript
const args = ['-nostdin', '-protocol_whitelist', FFMPEG_PROTOCOL_WHITELIST, '-hide_banner', '-i', videoPath];
```

Tests treat probes as argv that include `-hide_banner` (`createSpawnFake`). No golden for probesize.

Bundled binary: `vendor/ffmpeg/ffmpeg` (7.1). Do not add ffprobe (002).

**Conventions**: investigate first (022–025, 056–058). Short imperative commits. No AI co-author trailers.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 |
| Probe | `"$FFMPEG" -nostdin -hide_banner -probesize 32k -analyzeduration 500k -i <sample>` | record whether Duration appears |

## Scope

**In scope**:

- This file’s `## Investigation result`
- If **and only if** caps still find Duration on MP4/MOV/WebM/MKV samples you actually run: `lib/ffmpeg-session.js` argv + a session test that the probe spawn includes those flags
- Modest values only (document the numbers you picked)

**Out of scope**:

- Using Chromium `HTMLMediaElement.duration` instead of ffmpeg (HIGH risk for `-t` / tpad)
- Restoring `-f null -`
- Cover-art first Duration (056)
- Hardware encode

## Git workflow

- Branch: `advisor/074-investigate-probe-limits`
- Message: either `Cap FFmpeg duration-probe demux size.` **or** `Document that probe demux caps miss Duration on real files.`
- Do not push unless asked.

## Steps

### Step 1: Measure

With bundled ffmpeg, time and banner-compare:

1. Default probe (today’s argv, kill conceptually after Duration — or run `-t 0` is **not** required; use `-i` and Ctrl+C after Duration, or a tiny Node spawn like the app).
2. `-probesize 32768 -analyzeduration 500000` (and one looser pair, e.g. 5M / 5s which is ~default).

Samples: a small lavfi MP4 (integration tests already make these), plus **at least one** real camera MP4 or MOV if you have one. Do not commit copyrighted footage. If you have no camera file, say so and use lavfi + a generated moov-at-end if you can (`ffmpeg -movflags +faststart` vs without).

Fill the table under Investigation result: file, flags, Duration found Y/N, wall time.

**Verify**: table has at least lavfi default vs capped

### Step 2: Ship or not

- If lavfi **and** any real/odd container you tried still print a finite Duration with the cap: add flags before `-i`, golden in `test/ffmpeg-session.test.js` (probe argv includes `-probesize`). Keep kill-on-first-Duration.
- If any realistic sample loses Duration: **do not ship**; DONE with result.

**Verify**: `npm test` → exit 0

## Test plan

- If shipping: fake spawn records probe args include the two flags.
- Pattern: `test/ffmpeg-session.test.js` `createSpawnFake`.

## Done criteria

- [ ] `## Investigation result` filled
- [ ] Either argv caps shipped with a test **or** explicit no-ship
- [ ] Default still does not decode the whole file (`-f null` stays gone)
- [ ] `npm test` exits 0
- [ ] `plans/README.md` 074 DONE

## STOP conditions

- You would skip ffmpeg probe and trust HTML5 duration for encode.
- Caps fail Duration and you ship them anyway.

## Investigation result

_(executor fills)_

## Maintenance notes

- Reviewer: MPEG-TS and MKV often need larger probesize; if you only tested MP4, say so.
- 064 may land try/catch in the same function; rebase argv next to it.
