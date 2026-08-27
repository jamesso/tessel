# Plan 055: Cap encode and probe stderr buffers

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat a7bd825..HEAD -- lib/ffmpeg-session.js lib/ffmpeg-error.js test/ffmpeg-session.test.js`
> Compare excerpts against live code; on a mismatch, treat it as a STOP condition.
> Do **not** start in parallel with 045 or 046 (same session file). Sequence **after** 046 if 046 is still TODO.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/046-rename-keep-temp.md (rebase if 045/046 already edited the session)
- **Category**: perf
- **Planned at**: commit `a7bd825`, 2026-08-27

## Why this matters

Encode does `ffmpegOutput += output` for the whole job (`lib/ffmpeg-session.js:327-354`). Progress already parses only a 4KB tail (`:357-359`). Failures use `formatConversionFailedMessage` which takes a 1000-character tail (`lib/ffmpeg-error.js` `STDERR_TAIL_CHARS`). A pad-to-longest encode of long clips can grow the concatenated string for no benefit (progress `time=` lines forever). Probe also concatenates stderr until `Duration:` (`:139-164`); a file with no duration can dump a large decode log.

## Current state

Encode:

```javascript
let ffmpegOutput = '';
ffmpegProcess.stderr.on('data', (data) => {
    const output = data.toString();
    ffmpegOutput += output;
    log('FFmpeg stderr:', output);
    const progressText = ffmpegOutput.length > 4096
        ? ffmpegOutput.slice(-4096)
        : ffmpegOutput;
    const currentTime = matchProgressTimeInStderr(progressText);
    // ...
});
// close nonzero:
signalError(formatConversionFailedMessage(code, ffmpegOutput, destPath));
```

Probe:

```javascript
let output = '';
ffmpegProcess.stderr.on('data', (data) => {
    output += data.toString();
    const parsed = matchDurationInStderr(output);
    // kill on first finite duration
});
```

`lib/ffmpeg-error.js`: `STDERR_TAIL_CHARS = 1000`. Plan 034 already matches **last** `time=` on a tail.

**Conventions**: fake-spawn session tests. Keep logging each chunk via `log('FFmpeg stderr:', output)` if that is still the per-chunk line (do not log the whole cap buffer every time). Short imperative commits. No AI co-author trailers.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 |
| Session | `node --test test/ffmpeg-session.test.js test/ffmpeg-error.test.js` | exit 0 (`ffmpeg-error` test file may already exist) |

## Scope

**In scope**:

- `lib/ffmpeg-session.js` probe + encode stderr accumulation
- Small helper: either `lib/stderr-tail.js` + `test/stderr-tail.test.js`, or a function in `lib/ffmpeg-error.js` next to the existing tail constant
- Tests for the helper; session test only if you can assert the buffer does not grow without bound via a custom `log` or by exposing nothing — **prefer unit-testing the helper**

**Out of scope**:

- Changing progress math (034)
- Changing error message format except that it still sees the last ≤1000 chars
- Probe-failure kill (045)
- Rename/temp (046)

## Git workflow

- Branch: `advisor/055-cap-ffmpeg-stderr`
- Message: `Cap FFmpeg stderr buffers used for progress and errors.`
- Do not push unless asked.

## Steps

### Step 1: `appendStderrTail`

```javascript
function appendStderrTail(previous, chunk, maxChars) {
    const text = (previous || '') + String(chunk);
    if (text.length <= maxChars) {
        return text;
    }
    return text.slice(-maxChars);
}
```

Caps:

- Encode accumulated buffer: **8192** (progress uses last 4096; errors use last 1000).
- Probe accumulated buffer: **8192** (Duration banners are early; match **before** or on the string that still contains the new chunk, then cap).

Order on probe data:

1. `output = appendStderrTail(output, data.toString(), 8192)` is OK if you match on the result and 8192 > a Duration line. Safer: `const next = output + chunk; matchDurationInStderr(next); output = next.length > 8192 ? next.slice(-8192) : next`.

Do not cap so small that `time=HH:MM:SS.xx` can split out of the progress window worse than today — 4096 progress slice stays.

**Verify**: `node --test test/stderr-tail.test.js` (or ffmpeg-error tests) → `appendStderrTail('a'.repeat(10), 'bcd', 5) === 'abcd'.slice(-5)` wait: `'aaaaaaaaaa'+'bcd'` last 5 is `'aabcd'` — assert that

Tests:

- short append unchanged
- overflow keeps the last `maxChars` characters
- a `time=00:00:05.00` sitting at the end of an 8KB string is still in the last 4096

### Step 2: Wire session

Replace encode `ffmpegOutput += output` with `ffmpegOutput = appendStderrTail(ffmpegOutput, output, 8192)`. Keep the 4096 slice for `matchProgressTimeInStderr`.

Replace probe `output +=` with the same helper (8192).

**Verify**: `node --test test/ffmpeg-session.test.js` → exit 0 (existing progress/error tests)

## Test plan

- Helper overflow cases.
- Existing session: progress still updates; conversion failed still includes an ffmpeg line from the tail (`test` files that already cover `formatConversionFailedMessage`).
- Pattern: `lib/ffmpeg-error.js` tail constants.

Verification: `npm test` → exit 0.

## Done criteria

- [ ] `npm test` exits 0
- [ ] Encode path has no unbounded `ffmpegOutput +=` without a cap
- [ ] Probe path has no unbounded `output +=` without a cap
- [ ] Progress still uses last 4096; errors still last 1000
- [ ] No files outside the in-scope list are modified
- [ ] `plans/README.md` status row for 055 set to DONE

## STOP conditions

- Current state excerpts drifted (045/046 landed — rebase, then cap).
- You would disable `log('FFmpeg stderr:', output)` for every chunk without being asked (noise vs memory are different).
- Cap < 4096 on the encode buffer (would shrink the progress window).

## Maintenance notes

- Reviewer: matching Duration **after** a cap that dropped the start of stderr is only a problem if Duration was never parsed on an earlier tick; first-match-on-each-chunk is how 002 works.
- Cover-art Duration (056) is a parser issue, not buffer size.
