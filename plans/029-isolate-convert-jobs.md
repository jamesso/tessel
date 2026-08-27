# Plan 029: Isolate convert jobs so a cancelled encode cannot finish the next one

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat c2b112f..HEAD -- lib/ffmpeg-session.js lib/job-lock.js test/ffmpeg-session.test.js test/job-lock.test.js`
> If `lib/ffmpeg-session.js` does not exist, **STOP** — plan 027 must land first.
> Compare excerpts against live code; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/027-characterize-ffmpeg-session.md
- **Category**: bug
- **Planned at**: commit `c2b112f`, 2026-08-26

## Why this matters

Cancel kills the ffmpeg child and immediately sets `activeEncode = null` and `killedByUs = true`, then IPC `video:cancelled`. It does **not** wait for the child’s `close`. The next Convert sets `killedByUs = false` and `activeEncode = true`. When the **old** process later emits `close`, the handler reads the **current** globals: it may send `video:error` / `video:done` for the new job, and `finishEncode()` may clear the new job’s lock while its ffmpeg is still running. The same bug exists on the probe `catch` path (`activeEncode = null` + `'Could not read video duration'`). Users who Cancel then Convert quickly can see a false error, a stuck overlay, or two encodes.

## Current state (at c2b112f; 027 moves this into `lib/ffmpeg-session.js`)

```javascript
// start of convertVideo
if (shouldRejectSecondJob(activeEncode)) {
    sendToRenderer('video:error', 'A conversion is already running')
    return
}
activeEncode = true
killedByUs = false
```

```javascript
ffmpegProcess.on('close', (code) => {
    if (killedByUs) {
        killedByUs = false
        finishEncode()
        return
    }
    if (code === 0) {
        finishEncode()
        sendToRenderer('video:progress', { percent: 100 })
        sendToRenderer('video:done')
    } else {
        signalError('Conversion failed')
    }
})
```

Probe loop: `if (killedByUs) return` after all durations; `catch` sets `activeEncode = null` and sends duration error unless `killedByUs`.

`lib/job-lock.js` stays a boolean predicate. Do not put generation ids there unless a test needs a helper; ids belong in the session.

**Conventions**: `test/ffmpeg-session.test.js` fake `EventEmitter` children with **async** `kill` → `close` (`setImmediate`). Match 027. No Electron in unit tests. Short imperative commits. No AI co-author trailers.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 |
| Session tests | `node --test test/ffmpeg-session.test.js` | exit 0 |

No lint/typecheck script.

## Scope

**In scope**:

- `lib/ffmpeg-session.js` (generation id / epoch; ignore stale probe `catch` and encode `close` / `error`)
- `test/ffmpeg-session.test.js` (new race cases)
- `lib/job-lock.js` / `test/job-lock.test.js` only if you add a tiny pure helper and tests; not required

**Out of scope**:

- Temp-file encode — plan 028 (if 028 already landed, **keep** its rename/unlink and still tag them with the job id)
- `uncaughtException` overlay / kill (related but separate; do not expand this plan)
- Parallel duration probes
- Renderer `converting` flag (write-only today)

## Git workflow

- Branch: `advisor/029-isolate-convert-jobs`
- Message: `Ignore stale ffmpeg close events after cancel and convert.`
- Do not push unless asked.

## Steps

### Step 1: Give every convert a monotonic id

Inside `createFfmpegSession` (same closure as `activeEncode`):

```javascript
let currentJobId = 0
let nextJobId = 0
```

At the start of `convertVideo`, **after** the second-job reject:

```javascript
const myId = ++nextJobId
currentJobId = myId
activeEncode = true
killedByUs = false
```

Every async continuation (probe loop iteration, probe `catch`, `startConversion`, encode `close`, encode `error`, `finishEncode`, `signalError`) must no-op unless `myId === currentJobId`, **except** `killActiveFfmpeg` which always kills live children.

Do **not** bump `currentJobId` inside `killActiveFfmpeg`. Cancel of the current job still has `myId === currentJobId` so the current close can see `killedByUs` and stay silent. The **next** convert bumps `currentJobId`, which makes the old close stale.

**Verify**: `grep -n "currentJobId" lib/ffmpeg-session.js` → matches at convert start and in close/catch/error guards

### Step 2: Stale handlers must not call `finishEncode` or send IPC

For encode `close` / `error` and probe `catch`:

```javascript
if (myId !== currentJobId) {
    return
}
```

Put this **before** `finishEncode()`, `activeEncode = null`, and any `send(...)`.

Probe `for` loop: if `myId !== currentJobId` or `killedByUs`, break/return without starting encode.

`signalError` should also no-op when `myId !== currentJobId`.

**Verify**: the test in step 3 fails if you omit the guard (write the test first or with the guard)

### Step 3: Tests for cancel-then-convert

Use two encode fakes. Sequence:

1. Start convert A (`vidPath1: '/a.mp4'`).
2. Complete A’s probe (Duration line) so encode A is spawned.
3. `killActiveFfmpeg({ notify: 'cancelled' })` — expect `video:cancelled`.
4. Start convert B (`vidPath1: '/b.mp4'`).
5. Complete B’s probe so encode B is spawned.
6. Emit encode **A** `close` with code `1` (or `0`).
7. Assert events do **not** include a `video:error` / `video:done` **after** B started that would belong to A. Specifically: no `video:error` `'Conversion failed'` from A’s close; B still `isBusy()` true until B closes.
8. Emit encode B `close` 0 → exactly one `video:done` (B).

Also:

- **Cancel during probe**: start A, do not emit Duration, `killActiveFfmpeg({ notify: 'cancelled' })`, then emit probe `close`. Must not send `'Could not read video duration'`.
- **Cancel then convert during probe**: kill A during probe, start B, then A’s probe `close` / `error` must not clear B (`isBusy()` stays true; no duration error).

Keep 027 (and 028 if present) tests green. If 028 landed, A/B dest paths should still be temps; do not revert that.

**Verify**: `node --test test/ffmpeg-session.test.js` → exit 0

### Step 4: Mark the plan

`plans/README.md` row 029 → DONE.

## Test plan

- New cases in `test/ffmpeg-session.test.js` as in step 3.
- Pattern: 027 fake spawn; `waitUntil` + `setImmediate` close.
- `npm test` for the rest of the suite.

## Done criteria

- [ ] `lib/ffmpeg-session.js` uses a job id/epoch; stale `close`/`catch` return without `finishEncode` / IPC
- [ ] Tests cover cancel-then-convert for encode `close` and probe `close`
- [ ] `npm test` exits 0
- [ ] No files outside the in-scope list are modified
- [ ] `plans/README.md` 029 DONE

## STOP conditions

- Plan 027 not merged.
- You “fix” the race by refusing a new convert until `close` (blocking the UI after Cancel) — that is a product change; this plan is ignore-stale-events. If you believe you must wait for `close`, STOP and report.
- Mixing in `uncaughtException` kill/notify, parallel probes, or 028 temp files **unless 028 already changed those lines** (then preserve 028).

## Maintenance notes

- Reviewer: a cancelled job must never send `video:done`. A new job must not inherit `killedByUs` from the previous one (today’s `killedByUs = false` at start stays, but stale close must not use it).
- Follow-up (not this plan): packaged `uncaughtException` in `main.js` sends `video:error` without `killActiveFfmpeg` — still true after 029.
- If you add `Promise.all` probes later, each probe child still belongs to `myId`; cancel still kills the `Set`.
