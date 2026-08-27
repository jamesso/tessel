# Plan 056: Investigate cover-art `Duration:` winning the probe

> **Executor instructions**: This is an **investigate** plan. Fill
> `## Investigation result` before changing production parser behavior. If you
> cannot reproduce with a real tagged file, document that and stop — do not
> “fix” the first-match parser on theory. When done, update `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat a7bd825..HEAD -- lib/timecode.js lib/ffmpeg-session.js test/timecode.test.js`
> On excerpt mismatch, STOP.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: MED
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `a7bd825`, 2026-08-27

## Why this matters

`matchDurationInStderr` takes the **first** `Duration: HH:MM:SS.cc` (`lib/timecode.js:13-18`). The probe **kills ffmpeg immediately** on that match (`lib/ffmpeg-session.js:150-164`). MP4s with a cover-art/mjpeg attached picture often print a tiny `Duration:` for that stream **before** the real H.264 duration. Convert then uses a flash-length mosaic (or tpad almost the whole output). Last audit listed this as LOW without a sample; it is still unproven in this repo.

## Current state

```javascript
function matchDurationInStderr(text) {
    const durationMatch = text.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})/);
    if (!durationMatch) return null;
    // first match only
}
```

`test/timecode.test.js:19-25` only checks a single Duration line. Probe tests in `test/ffmpeg-session.test.js` emit one `Duration: 00:00:01.00`.

FFmpeg 6 `-i` banner typically lists Input #0 then streams; attached pics show as `Video: mjpeg` / `Attached pic`.

**Conventions**: do not add ffprobe as a dependency (002). Goldens stay first-match until investigation proves otherwise. Short imperative commits. No AI co-author trailers.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 |
| Probe banner | `"$FFMPEG" -nostdin -hide_banner -i <sample>` | stderr contains Duration lines; record them in this file |

## Scope

**In scope**:

- This plan file’s `## Investigation result`
- If **and only if** a sample proves first Duration is wrong: `lib/timecode.js` + `test/timecode.test.js` + probe still using that helper (session kill-on-match may need to wait for a “chosen” duration — see steps)
- A **fixture is optional**. Prefer a tiny committed sample **without** copyrighted movie stills (generate with ffmpeg: video + attached jpg) if you can

**Out of scope**:

- Replacing duration probe with full-file decode
- Hash-pinning ffmpeg (051)
- Progress `time=` parser (034)

## Git workflow

- Branch: `advisor/056-investigate-cover-art-duration`
- Message: either `Prefer the last FFmpeg Duration line when probing clips.` **or** `Document that cover-art Duration was not reproducible.`
- Do not push unless asked.

## Steps

### Step 1: Build or obtain a sample

Using bundled ffmpeg, create an MP4 with an attached picture, e.g. 2s color + a small jpeg as cover (`-map` attached pic). Exact flags may vary; if you cannot create an attached pic, STOP and write that in the result (do not scrape a commercial file into the repo).

Run the **same argv as production probe**: `-nostdin -protocol_whitelist file,pipe -hide_banner -i <file>` (see `getVideoDurationWithFFmpeg`).

Record every `Duration:` line in order and which stream they belong to.

**Verify**: investigation result quotes those lines (redact paths)

### Step 2: Decide

If the first `Duration:` is the real video length: **no code change**. DONE with result “first match is correct on this sample; leave parser.”

If the first line is the cover (e.g. `00:00:00.04`) and a later line is the video (e.g. `00:00:02.00`):

Do **not** blindly switch to last match without a test: some banners repeat Duration. Prefer one of these, in order:

1. Last `Duration:` that is not followed only by an attached-pic / mjpeg stream (fragile regex).
2. Last `Duration:` in the banner **if** the sample shows that is always the container duration.
3. Ignore Duration values below **0.5s** when a later Duration exists (heuristic; must be tested).

Whatever you pick, add `test/timecode.test.js` strings copied from the **recorded** stderr (not a made-up novel format).

If the probe kills on first match, a last-match parser **never sees** later lines unless you **stop killing until stderr quiets** or wait for `close` without `-t` decode (002 forbade full decode). Options:

- Do not `kill()` on first match; wait until `close` or until 300ms with no extra Duration (keep `-i` only, no output file — ffmpeg still exits after banner+error on no output). Production already relies on ffmpeg exiting after the banner when used as probe... actually it **kills** on match to avoid decode. Attached-pic case: first match is wrong **because** of kill.

So a proven fix is likely: **do not resolve on the first Duration if a second Duration arrives within N ms**, or parse the full banner without decoding (ffmpeg `-i` without output exits after printing — today they kill early). Check: if you **omit** `ffmpegProcess.kill()` and wait for `close`, does probe still avoid decoding the whole movie? 002 said `-f null -` decodes; `-i` alone typically errors `Output file is not specified` after the banner. Spike that on a **long** file: wall time should stay seconds, not duration-of-file.

If waiting for `close` on `-i` only is fast: match last Duration on full stderr, then you can still kill if needed. If `-i` alone decodes: do not wait; use a heuristic on the first two stderr chunks.

**Verify**: investigation result chooses a path; if code changes, a unit test uses the captured banner

### Step 3: Tests or no-op

If no repro: `npm test` only; this plan DONE.

If fix: `matchDurationInStderr` tests + one session fake-spawn with two Duration lines if the session now waits.

**Verify**: `npm test` → exit 0

## Test plan

- Captured dual-Duration stderr.
- A long-file wall-time check if you wait for `close` (manual, record in result).
- Pattern: `test/timecode.test.js`.

Verification: `npm test` → exit 0.

## Done criteria

- [x] `## Investigation result` filled
- [x] Either parser tests for the captured banner **or** an explicit no-repro / no-ship
- [x] Probe still does not decode whole files (002)
- [x] `npm test` exits 0
- [x] `plans/README.md` status row for 056 set to DONE (or DONE — not shipped)

## STOP conditions

- You would commit copyrighted artwork as a fixture.
- You would restore `ffmpeg -i -f null -` full decode.
- First-match is unproven and you still change the parser “to be safe.”

## Investigation result

**Verdict:** Cover-art `Duration:` winning the probe is **not reproducible** with bundled **ffmpeg 6.0** (`ffmpeg-static` 5.3.0). **No parser or session change.** First-match `matchDurationInStderr` stays.

**Drift check:** `git diff --stat a7bd825..HEAD` shows only `lib/ffmpeg-session.js` changed (045 probe-kill); `lib/timecode.js` and `test/timecode.test.js` match the plan excerpt.

### Sample (generated, no copyrighted stills)

1. 2s H.264 lavfi color clip (`320×240`, 25 fps).
2. Single-frame `64×64` jpeg from lavfi (`-update 1 -frames:v 1`).
3. Muxed MP4: `-map 0:v -map 1:v -c:v:0 copy -c:v:1 mjpeg -disposition:v:1 attached_pic`.

Also tried: cover mapped first / cover as stream 0, MKV `-attach`, MOV, MP3 id3 attached pic — same pattern.

### Production probe (`-nostdin -protocol_whitelist file,pipe -hide_banner -i <file>`)

**Every `Duration:` line (in order)** on the primary MP4 sample:

```
Duration: 00:00:02.00, start: 0.000000, bitrate: 13 kb/s
```

One line only — container duration. Streams listed after it:

- `Stream #0:0`: Video: h264 … (default)
- `Stream #0:1`: Video: mjpeg … **(attached pic)**

`matchDurationInStderr` → **2** seconds. Simulated probe (accumulate stderr, first-match) wall time **~13 ms**; no decode.

### Dual-`Duration:` note

Probing **two separate `-i` inputs** (short mjpeg mov + long mp4) prints two `Duration:` lines (`00:00:00.04` then `00:00:02.00`), but Tessel probes **one file path** per job — not applicable.

### Decision

First `Duration:` is the real video length on the attached-pic MP4. **Leave parser and kill-on-first-match** (045). Do not ship last-match or sub-0.5s heuristics without a reproducing single-file banner.

**Tests:** `npm test` → 162 pass, 0 fail. No new tests (no captured dual-Duration banner to assert against).

**002 compliance:** `-i`-only probe exits after banner + “At least one output file must be specified”; no `-f null -` full decode.

## Maintenance notes

- Reviewer: kill-on-first-duration and last-match are incompatible without a banner-complete policy.
- 055 caps stderr; keep Duration matching on the chunk sequence, not only the capped tail, if you wait for multiple lines.
