# Plan 025: Investigate progress `time=` parsing vs unused `parseTimeToSeconds`

> **Executor instructions**: This is an **investigate** plan. Capture real stderr from the bundled ffmpeg during an encode and see if `matchProgressTimeInStderr` misses variants. Wire the **production** parser to one function used by probe + progress (plan 001 extracted `parseFfmpegClock` / regex matchers). Do not add tests only for a dead `parseTimeToSeconds` in `main.js`.
>
> **Drift check (run first)**: `git diff --stat b558cb8..HEAD -- lib/timecode.js main.js test/timecode.test.js`

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/001-add-node-test-runner.md, plans/014-x264-preset-and-progress.md
- **Category**: bug
- **Planned at**: commit `b558cb8`, 2026-08-26

## Why this matters

`parseTimeToSeconds` (`main.js:204-214`) was unused at audit; live regexes required `\d{2}:\d{2}:\d{2}\.\d{2}` (`main.js:231`, `499`). Some ffmpeg builds print `time=N/A`, one decimal place, or unusual hour widths. Progress can sit at 0% through the whole encode even after plan 014. Testing the dead helper would be false confidence.

## Current state

After 001, `lib/timecode.js` should hold `matchProgressTimeInStderr` with the **old** strict regex. Encode stderr parsing in `main.js` should call it.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Sample | run bundled ffmpeg encode of 1s color | capture a `time=` line |
| Tests | `npm test` | exit 0 |

## Scope

**In scope**: `lib/timecode.js`, `test/timecode.test.js`, `main.js` call sites; this file’s result

**Out of scope**: Switching progress to ffmpeg `-progress pipe:1` unless the regex is hopeless — if you want `-progress`, STOP and report (new design)

## Git workflow

- Branch: `advisor/025-investigate-progress-parser`
- Message: `Parse ffmpeg time= with the production timecode helper.`
- Do not push unless asked.

## Steps

### Step 1: Capture a real `time=` line

Encode 1s with the same argv shape as the app (libx264, 25fps). Save one stderr chunk that contains `time=`.

**Verify**: paste the **pattern** (not a huge log) in the result, e.g. `time=00:00:00.92`

### Step 2: Check the matcher

Run `matchProgressTimeInStderr` on that snippet. If it returns `null`, loosen the regex (e.g. fractional seconds `\d{1,2}`, optional hours) **once**, with tests for:

- `time=00:00:05.00`
- `time=00:00:05.0` if observed
- `time=N/A` → null (do not throw)

Use `parseFfmpegClock` as the single conversion from `HH:MM:SS` parts so probe + progress share it. Delete any remaining unused `parseTimeToSeconds` in `main.js`.

**Verify**: `grep -n "parseTimeToSeconds" main.js` → no matches; `npm test` → exit 0

### Step 3: If matcher already works

Document the sample and add that snippet as a regression test anyway.

## Test plan

- Golden stderr snippets in `test/timecode.test.js`.

## Done criteria

- [ ] Real `time=` sample recorded
- [ ] Production code uses `lib/timecode.js` for progress
- [ ] No dead parser left in `main.js`
- [ ] `plans/README.md` 025 DONE

## STOP conditions

- You would add a second parallel parser “just in case” — one function only.
- `-progress` protocol rewrite — report, don’t implement here.

## Maintenance notes

- Reviewer: keep N/A as null, not 0%, so the UI does not jump.

## Investigation result

_(executor fills in)_

- Sample `time=` line:
- Matcher hit (yes/no):
- Regex changed (yes/no):
