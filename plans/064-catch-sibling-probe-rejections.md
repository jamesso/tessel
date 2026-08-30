# Plan 064: Swallow sibling duration-probe rejections after one probe fails

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat f14caf4..HEAD -- lib/ffmpeg-session.js test/ffmpeg-session.test.js main.js`
> Compare excerpts against live code; on a mismatch, treat it as a STOP condition.
> Do **not** start in parallel with plan 066 (same session file).

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (sequence before 066)
- **Category**: bug
- **Planned at**: commit `f14caf4`, 2026-08-27

## Why this matters

Plan 045 kills leftover `ffmpeg -i` probes when one duration probe fails, then sends `video:error` `Could not read video duration`. Sibling workers are still `await`ing `getVideoDurationWithFFmpeg`. Killing those children makes their promises reject **after** `Promise.all` has already settled. Those rejections are unhandled. `main.js` maps `unhandledRejection` to `video:error` `Unexpected error` and `killActiveFfmpeg()`. The user gets two alerts; a retry can be killed as “unexpected.”

## Current state

`lib/ffmpeg-session.js` `probeWorker` (no try/catch around the await):

```javascript
async function probeWorker() {
    while (nextIndex < uniquePaths.length) {
        if (myId !== currentJobId || killedByUs || probeFailed) return;
        const index = nextIndex++;
        const videoPath = uniquePaths[index];
        durations[videoPath] = await getVideoDurationWithFFmpeg(videoPath);
        if (myId !== currentJobId || killedByUs || probeFailed) return;
        done++;
        sendToRenderer('video:progress', {
            percent: Math.round((done / uniquePaths.length) * 10),
            phase: `Analyzing ${done}/${uniquePaths.length}`,
        });
    }
}

const workerCount = Math.min(3, uniquePaths.length);
await Promise.all(Array.from({ length: workerCount }, () => probeWorker()));
```

`getVideoDurationWithFFmpeg` `close` handler rejects when duration was never parsed. Fake spawn `kill()` emits `close` (`test/ffmpeg-session.test.js` `createFakeProcess`).

`main.js`:

```javascript
process.on('unhandledRejection', (reason, promise) => {
    // ...
    stopJobAndNotifyUnexpectedError()
})
```

Existing test `multi-path probe failure kills sibling probes and allows a new convert` (`test/ffmpeg-session.test.js`) does not wait for sibling `close` after `kill`, and does not assert a second `video:error`.

**Conventions**: fake-spawn + `waitUntil` in `test/ffmpeg-session.test.js`. Do not remove the `unhandledRejection` handler (032). Short imperative commits. No AI co-author trailers.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 |
| Session | `node --test test/ffmpeg-session.test.js` | exit 0 |

## Scope

**In scope**:

- `lib/ffmpeg-session.js` — `probeWorker` must not leave rejected promises unhandled after `probeFailed` / kill
- `test/ffmpeg-session.test.js` — after multi-path probe failure, wait for sibling closes; assert exactly one `video:error` (`Could not read video duration`); no `Unexpected error`; `isBusy() === false`; retry still allowed

**Out of scope**:

- Unique temps (066)
- Probe `-probesize` (074)
- Cover-art Duration (056)
- Removing `process.on('unhandledRejection')`

## Git workflow

- Branch: `advisor/064-catch-sibling-probe-rejections`
- Message: `Ignore leftover duration-probe failures after one probe already failed.`
- Do not push unless asked.

## Steps

### Step 1: Failing characterization

Extend `multi-path probe failure kills sibling probes and allows a new convert` (or add a sibling test):

1. Convert with at least three unique paths (worker cap is 3).
2. Fail probe 0 (`close` without Duration).
3. `await waitUntil` until every live probe has `close`d (the fake `kill` already emits `close` on `setImmediate`).
4. Assert `sent.filter(s => s.channel === 'video:error')` has length 1 and that message is `Could not read video duration`.
5. Assert no `video:error` with `Unexpected error` (session `send` will not get that string unless you also hook `process.on('unhandledRejection')` in the test — **prefer** asserting the session only sent one error, then optionally attach a one-test `unhandledRejection` listener that fails the test if it fires).

**Verify**: `node --test test/ffmpeg-session.test.js` → the new assertion **FAILS** on current code if you listen for unhandledRejection; if the fake does not surface unhandledRejection in-process, still add the try/catch in step 2 (production Node will fire it).

### Step 2: Catch in `probeWorker`

Wrap `await getVideoDurationWithFFmpeg(videoPath)`:

- If `myId !== currentJobId || killedByUs || probeFailed`, return (do not rethrow).
- Otherwise rethrow so `Promise.all` still hits the existing `catch` that sets `probeFailed`, sends `Could not read video duration`, and `killLiveProbes()`.

Do not call `killActiveFfmpeg()` from that catch (045: that sets `killedByUs` and swallows `video:error`).

**Verify**: `node --test test/ffmpeg-session.test.js` → exit 0

### Step 3: Full suite

**Verify**: `npm test` → exit 0

## Test plan

- Multi-file probe failure: one user-facing error, siblings killed, not busy, retry works.
- Pattern: existing multi-path probe failure test in `test/ffmpeg-session.test.js`.

## Done criteria

- [ ] `probeWorker` does not reject after `probeFailed` / job id change / `killedByUs`
- [ ] Multi-path probe failure still sends `Could not read video duration` once
- [ ] `npm test` exits 0
- [ ] No files outside the in-scope list are modified
- [ ] `plans/README.md` 064 DONE

## STOP conditions

- Excerpts drifted.
- You would delete `unhandledRejection` handling in `main.js`.
- You would `await Promise.allSettled` and then **not** send `video:error` on a real first failure.

## Maintenance notes

- Reviewer: first failure must still set `probeFailed` and kill the Set; only the *late* rejects are swallowed.
- Fake `kill` → `close(0)` is not identical to SIGTERM, but both reject when duration is null.
