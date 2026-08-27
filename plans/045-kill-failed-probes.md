# Plan 045: Kill leftover duration probes when one probe fails

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat a7bd825..HEAD -- lib/ffmpeg-session.js lib/job-lock.js test/ffmpeg-session.test.js`
> Compare excerpts against live code; on a mismatch, treat it as a STOP condition.
> Do **not** start this in parallel with plan 046 or 055 (same file).

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (do not parallel 046 / 055)
- **Category**: bug
- **Planned at**: commit `a7bd825`, 2026-08-27

## Why this matters

Duration probes run up to three workers (`Promise.all`). If one `getVideoDurationWithFFmpeg` rejects, the `catch` sends `video:error` and sets `activeEncode = null` but **does not** kill `liveProbeProcesses`. Sibling workers keep calling `ffmpeg -i`, can still send `video:progress` `{ phase: 'Analyzing n/m' }` after the overlay is hidden, and `shouldRejectSecondJob` only looks at `activeEncode`, so a new Convert can overlap those orphans. Cancel-during-probe already drains the Set; probe **failure** does not. The only failure test uses a single path.

## Current state

`lib/ffmpeg-session.js` `processDurations` catch:

```javascript
} catch (err) {
    if (myId !== currentJobId) return;
    log('Duration probe failed:', err.message);
    activeEncode = null;
    if (!killedByUs) {
        sendToRenderer('video:error', 'Could not read video duration');
    }
}
```

`killActiveFfmpeg` already does:

```javascript
killChildProcess(activeEncode);
for (const probe of liveProbeProcesses) {
    killChildProcess(probe);
}
liveProbeProcesses.clear();
```

Workers exit only when `myId !== currentJobId || killedByUs` **before** the next probe. An in-flight `await getVideoDurationWithFFmpeg` continues until that child settles.

`lib/job-lock.js`: `shouldRejectSecondJob(active) { return Boolean(active) }`.

`test/ffmpeg-session.test.js:215-225` — one path, `probes[0].emit('close', 1)`, asserts the error string. Fake spawn: probes are argv with `-hide_banner` (`createSpawnFake`).

**Do not** call `killActiveFfmpeg()` from the catch and then skip the error: `killActiveFfmpeg` sets `killedByUs = true`, which would suppress `video:error`.

**Conventions**: fake-spawn + `waitUntil` in `test/ffmpeg-session.test.js`. Count `kill` on fake processes. Short imperative commits. No AI co-author trailers.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 |
| Session tests | `node --test test/ffmpeg-session.test.js` | exit 0 |

No lint/typecheck script.

## Scope

**In scope**:

- `lib/ffmpeg-session.js` — drain live probes on probe failure; stop workers
- `test/ffmpeg-session.test.js` — new case below

**Out of scope**:

- Rename/temp dest handling (046)
- Stderr buffer cap (055)
- Changing probe concurrency (033 already cap 3)
- Sending `video:cancelled` on probe failure
- `lib/job-lock.js` API change unless you must (prefer keeping `Boolean(activeEncode)`)

## Git workflow

- Branch: `advisor/045-kill-failed-probes`
- Message: `Kill leftover duration probes when one probe fails.`
- Do not push unless asked.

## Steps

### Step 1: Drain probes without suppressing the error

Add a helper used by both `killActiveFfmpeg` and the probe `catch`, for example:

```javascript
function killLiveProbes() {
    for (const probe of liveProbeProcesses) {
        killChildProcess(probe);
    }
    liveProbeProcesses.clear();
}
```

`killActiveFfmpeg` calls `killLiveProbes()` instead of duplicating the loop.

In the `processDurations` `catch`, when `myId === currentJobId`:

1. Send `video:error` `'Could not read video duration'` if `!killedByUs` (same string as today).
2. Call `killLiveProbes()` (does **not** set `killedByUs`, does **not** send `video:cancelled`).
3. Set `activeEncode = null`.

Also set a flag workers already honor (`killedByUs` **or** a dedicated `probeFailed`) **before** killing, so a worker that returns from `await` does not start another probe or send progress. If you set `killedByUs` in this catch, send the error **first**, and do **not** call the full `killActiveFfmpeg({ notify: 'cancelled' })`.

**Verify**: `grep -n "Duration probe failed" -A 20 lib/ffmpeg-session.js` shows a kill of `liveProbeProcesses` in that catch, and no `video:cancelled` on that path.

### Step 2: Characterization test

In `test/ffmpeg-session.test.js`, model after `createConcurrencySpawnFake` / `probe failure sends Could not read video duration`.

New test: **four unique paths** so three workers start. Wait until `probes.length >= 2`. Emit `close` **without** a `Duration:` line on `probes[0]`. Then:

- `video:error` with `'Could not read video duration'`
- no `video:cancelled`, no `video:done`
- every probe except the one that already closed has `kill` invoked (track `killCalls` on `createFakeProcess`)
- `session.isBusy() === false`
- a second `convertVideo` with one path is **not** rejected as already running (wait until a new probe appears)

Keep the existing single-path probe-failure test.

**Verify**: `node --test test/ffmpeg-session.test.js` → exit 0

## Test plan

- Existing: one-path probe failure still errors.
- New: multi-path, first probe fails, siblings killed, not busy, no cancelled.
- Pattern: `test/ffmpeg-session.test.js` `createFakeProcess` / `waitUntil`.

Verification: `npm test` → exit 0.

## Done criteria

- [ ] `npm test` exits 0
- [ ] Probe-failure catch kills `liveProbeProcesses` without `video:cancelled`
- [ ] Multi-path test exists and passes
- [ ] No files outside the in-scope list are modified
- [ ] `plans/README.md` status row for 045 set to DONE

## STOP conditions

- Current state excerpts drifted.
- Fix seems to require sending `video:cancelled` on probe failure (users would see cancel UI, not an error).
- You would change `killActiveFfmpeg` so cancel no longer kills probes.
- Need to edit `lib/mosaic.js`.

## Maintenance notes

- Reviewer: error must still fire when the user did not cancel.
- Plan 046 will edit `renameOutputFile` / `signalError` in this file — rebase if 046 landed first.
- Plan 033 maintenance (“cancel during analyze must not leave orphan ffmpeg”) now also applies to **failure**.
