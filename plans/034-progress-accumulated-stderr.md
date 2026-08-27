# Plan 034: Parse encode progress from accumulated ffmpeg stderr

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat c2b112f..HEAD -- main.js lib/ffmpeg-session.js lib/timecode.js test/timecode.test.js test/ffmpeg-session.test.js`
> If `lib/ffmpeg-session.js` exists (plan 027), fix the encode `stderr` handler **there**. Duration probe already concatenates then matches — do not change probe regex unless a test requires it. On excerpt mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (prefer after 027 so the handler lives in the session)
- **Category**: bug
- **Planned at**: commit `c2b112f`, 2026-08-26

## Why this matters

Duration probe concatenates stderr and runs `matchDurationInStderr` on the buffer. Encode progress calls `matchProgressTimeInStderr(output)` on **this `data` chunk only**, while `ffmpegOutput += output` is only used for the failure log. `lib/timecode.js` requires a contiguous `time=HH:MM:SS.cc`. If `time=` splits across pipe chunks, percent never updates (probe ~10% or `0%`) until `video:done` jumps to 100%. Plan 025 only checked whole-line samples.

## Current state

```javascript
// encode stderr (main.js:476-487; 027 moves this)
ffmpegProcess.stderr.on('data', (data) => {
    const output = data.toString();
    ffmpegOutput += output;
    const currentTime = matchProgressTimeInStderr(output);
    if (currentTime !== null) {
        const percent = progressPercent(currentTime, longestDuration);
        sendToRenderer('video:progress', { percent: percent })
    }
});
```

```javascript
// lib/timecode.js:22-26
function matchProgressTimeInStderr(text) {
    const timeMatch = text.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
    if (!timeMatch) return null;
    return parseFfmpegClock(`${timeMatch[1]}:${timeMatch[2]}:${timeMatch[3]}`);
}
```

`.match` without `/g` returns the **first** `time=` in the string. On a growing buffer that is correct if you want the earliest; for progress you want the **last** `time=` in the buffer. Use `matchAll` or a loop, or match on a rolling tail (last 4KB) so the last `time=` wins.

`time=N/A` must still yield `null` (existing test).

**Conventions**: keep `parseFfmpegClock` as the only clock parser. `progressPercent` still caps at 99 until encode `close` 0. Short imperative commits. No AI co-author trailers.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 |
| Timecode | `node --test test/timecode.test.js` | exit 0 |

No lint/typecheck script.

## Scope

**In scope**:

- Encode stderr handler in `lib/ffmpeg-session.js` or `main.js`
- `lib/timecode.js` / `test/timecode.test.js` if you add `matchLastProgressTimeInStderr` or document last-match behavior
- `test/ffmpeg-session.test.js` split-chunk case if 027 exists

**Out of scope**:

- Switching to ffmpeg `-progress pipe:1` (025 said STOP for a second parser)
- Changing the Duration: regex / cover-art first-match (not this plan)
- Renderer progress text / `NaN%` guard unless you touch `progressPercent` for non-finite `currentTime` (allowed: return 0 if `!Number.isFinite(currentTime)`)

## Git workflow

- Branch: `advisor/034-progress-accumulated-stderr`
- Message: `Parse ffmpeg time= from the full stderr buffer, not one chunk.`
- Do not push unless asked.

## Steps

### Step 1: Match on accumulated stderr; use the last `time=`

In the encode `data` handler, after `ffmpegOutput += output`, call the matcher on `ffmpegOutput` (or `ffmpegOutput.slice(-4096)`).

If `String.prototype.match` on a long buffer would return the **first** `time=`, progress would stick near 0. Implement last-match, e.g.:

```javascript
function matchProgressTimeInStderr(text) {
    const re = /time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/g
    let last = null
    let m
    while ((m = re.exec(text)) !== null) {
        last = m
    }
    if (!last) return null
    return parseFfmpegClock(`${last[1]}:${last[2]}:${last[3]}`)
}
```

Keep `time=N/A` non-matching. Update `test/timecode.test.js`:

- `'frame=1\ntime=00:00:00.40 bitrate='` still parses 0.4s
- Split reconstitution: `'time=00:00:0' + '5.00'` as one string → 5s
- Two times in one string: last wins (`time=00:00:01.00` then `time=00:00:02.00` → 2)

Existing “bundled ffmpeg stderr snippet” test must still pass.

**Verify**: `node --test test/timecode.test.js` → exit 0

### Step 2: Session/main uses the buffer

Encode handler must not call the matcher on the isolated chunk alone.

If `test/ffmpeg-session.test.js` exists: emit `'time=00:00:0'` then `'1.00 bitrate=N/A\n'` on encode stderr and expect a progress percent from 1.00s (not stuck).

**Verify**: `grep -n "matchProgressTimeInStderr" lib/ffmpeg-session.js main.js` → the encode path passes `ffmpegOutput` or a tail variable, not the raw chunk name alone (probe may still use its own `output` accumulator)

### Step 3: Mark the plan

`plans/README.md` row 034 → DONE.

## Test plan

- Timecode last-match + split string (step 1).
- Optional session split-chunk (step 2).
- Pattern: `test/timecode.test.js`.

## Done criteria

- [ ] Encode progress matcher sees concatenated stderr and the **last** `time=`
- [ ] `time=N/A` still null
- [ ] `npm test` exits 0
- [ ] No files outside the in-scope list are modified
- [ ] `plans/README.md` 034 DONE

## STOP conditions

- Adding a second progress parser beside `lib/timecode.js`.
- Using `-progress pipe:1` instead of fixing the regex input.

## Maintenance notes

- Reviewer: unbounded `ffmpegOutput` growth on a 10-minute encode is fine (stderr is small). A 4KB tail is also fine if last `time=` still fits.
- 025’s sample `time=00:00:00.88` remains valid.
