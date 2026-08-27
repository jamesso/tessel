# Plan 032: Kill ffmpeg and hide the overlay on unexpected main-process errors

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat c2b112f..HEAD -- main.js lib/ffmpeg-session.js app/js/index.js`
> If `lib/ffmpeg-session.js` exists (plan 027), call `ffmpegSession.killActiveFfmpeg()` from the handlers (no `notify: 'cancelled'`). Compare excerpts; on mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (if 027 landed, wire through the session kill helper)
- **Category**: bug
- **Planned at**: commit `c2b112f`, 2026-08-26

## Why this matters

`uncaughtException` / `unhandledRejection` in packaged builds send `video:error` `'Unexpected error'` and do **not** stop ffmpeg. The renderer treats any `video:error` as end-of-job (`app/js/index.js` `resetConvertUi` + `alert`), so the overlay hides while encode or probe may still run. Unpackaged/`isDev` only `debugLog`s, so the overlay can stay up forever after a throw. Abort the job, then tell the renderer, in both modes. Do not put stacks in the alert.

## Current state

```javascript
// main.js:134-148
process.on('uncaughtException', (error) => {
    debugLog('Uncaught Exception:', error.stack)
    if (!isDev) {
        console.error(error)
        sendToRenderer('video:error', 'Unexpected error')
    }
})

process.on('unhandledRejection', (reason, promise) => {
    debugLog('Unhandled Rejection:', { reason: reason.toString(), promise: promise.toString() })
    if (!isDev) {
        console.error(reason)
        sendToRenderer('video:error', 'Unexpected error')
    }
})
```

`killActiveFfmpeg` (or `ffmpegSession.killActiveFfmpeg` after 027) already kills encode + probes and can unlink a partial. `sendToRenderer` is guarded with `canSend`.

**Conventions**: keep the generic UI string `'Unexpected error'`. `debugLog` stays `isDev`-only (plan 010). Short imperative commits. No AI co-author trailers.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 |
| Handlers call kill | `grep -n "uncaughtException\\|unhandledRejection\\|killActiveFfmpeg" main.js` | both process handlers appear; each path calls kill then `video:error` |

No lint/typecheck script.

## Scope

**In scope**:

- `main.js` process handlers only
- After 027: `main.js` may call `ffmpegSession.killActiveFfmpeg()` (default options, **not** `notify: 'cancelled'`)

**Out of scope**:

- Job generation ids (029), temp output (028), richer ffmpeg stderr (031)
- Logging libraries, crash reporters
- Sending `error.stack` to the renderer

## Git workflow

- Branch: `advisor/032-kill-ffmpeg-on-uncaught`
- Message: `Stop ffmpeg and close the convert overlay on unexpected errors.`
- Do not push unless asked.

## Steps

### Step 1: Shared handler body

Use one function called from both events:

1. `debugLog` the stack / reason (existing).
2. `console.error` in all modes (or keep packaged `console.error` plus always notify the UI).
3. Kill the active job: `killActiveFfmpeg()` / `ffmpegSession.killActiveFfmpeg()` **without** `notify: 'cancelled'` (the UI should get `video:error`, not a silent cancel).
4. `sendToRenderer('video:error', 'Unexpected error')` in **dev and packaged**.

If kill already sent `video:cancelled` because you passed the wrong options, the renderer would hide the overlay without an alert — wrong. Verify you did not pass `{ notify: 'cancelled' }`.

**Verify**: `grep -A20 "process.on('uncaughtException'" main.js` shows kill then `video:error`, and no `if (!isDev)` around the send

### Step 2: Tests

No Electron required. Optional: if `test/ffmpeg-session.test.js` exists, you may export nothing new. A grep-style assertion in `test/convert-session.test.js` that `main.js` contains `killActiveFfmpeg` (or `ffmpegSession.killActiveFfmpeg`) inside 40 lines after `uncaughtException` is enough. Do not add Playwright.

**Verify**: `npm test` → exit 0

### Step 3: Mark the plan

`plans/README.md` row 032 → DONE.

## Test plan

- Grep or a small source test that both handlers send `video:error` and call kill.
- Pattern: `test/convert-session.test.js` source reads.

## Done criteria

- [ ] Both handlers always `sendToRenderer('video:error', 'Unexpected error')`
- [ ] Both handlers kill ffmpeg/probes without `notify: 'cancelled'`
- [ ] `npm test` exits 0
- [ ] No files outside the in-scope list are modified
- [ ] `plans/README.md` 032 DONE

## STOP conditions

- Handlers already kill and always notify — mark DONE with a one-line note, do not churn.
- You would send `error.message` or a stack to the renderer.

## Maintenance notes

- Reviewer: packaged users must see an alert; ffmpeg must not keep writing after the overlay is gone.
- Cancel button remains `video:cancelled` only.
