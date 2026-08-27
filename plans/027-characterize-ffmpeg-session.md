# Plan 027: Extract the FFmpeg convert session and characterize it with a fake spawn

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat c2b112f..HEAD -- main.js lib/convert-session.js lib/job-lock.js lib/mosaic.js lib/timecode.js lib/ipc-send.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `c2b112f`, 2026-08-26

## Why this matters

Convert is the product: probe each clip’s duration, build a mosaic argv, spawn bundled ffmpeg, stream progress, cancel, unlink a partial output, then `video:done` or `video:error`. All of that lives in an unexported `convertVideo` in `main.js` (~200 lines). Existing tests only grep source text (`test/convert-session.test.js`) or unit-test tiny predicates (`lib/job-lock.js`). Plans 028 and 029 change output-file and cancel/re-convert behavior; without a fake-`spawn` harness those plans will land untested. This plan **moves code and locks current behavior**. Do not fix races, temp-files, MIME types, or ffmpeg flags here.

## Current state

- `main.js` — Electron main. After `sendToRenderer` (lines 70–74), helpers `killChildProcess` (76–87), `discardPartialOutput` (89–104), `killActiveFfmpeg` (106–132). Module state (lines 62–68):

```javascript
let mainWindow
let aboutWindow
const liveProbeProcesses = new Set()
let activeEncode = null
let activeOutputPath = null
let outputCreatedByThisJob = false
let killedByUs = false
```

- Probe (lines 275–331): `spawn(ffmpegBinary, ['-nostdin', '-hide_banner', '-i', videoPath])`, parse stderr with `matchDurationInStderr`, `kill()` on first finite duration, reject on `close` without a duration. Tracks the child in `liveProbeProcesses`.
- Convert (lines 333–531): `shouldRejectSecondJob(activeEncode)` then **`activeEncode = true`** (boolean) during probe, later `activeEncode = ffmpegProcess`. Sequential `await getVideoDurationWithFFmpeg` per occupied path. Encode `spawn(ffmpegBinary, args)` with `args` from `buildFfmpegArgs`. Progress: `matchProgressTimeInStderr` on **the current stderr chunk only**. `close` code 0 → `video:progress` 100 then `video:done`; nonzero → `video:error` `'Conversion failed'`. Cancel sets `killedByUs` and does not send `video:done`.
- `lib/convert-session.js` — only `shouldUnlinkPartialOutput({ encodeStarted, createdByThisJob })`. Do not overload this file with the session factory.
- `lib/job-lock.js` — `shouldRejectSecondJob(active)` is `Boolean(active)`.
- `lib/mosaic.js` / `lib/timecode.js` — keep using these; do not inline them back into `main.js`.
- `test/convert-session.test.js` — source greps for cancel strings. Leave those greps working (they read `main.js` / preload / renderer). After the move, greps that look for `function killActiveFfmpeg` **inside `main.js`** will fail — update those greps to `lib/ffmpeg-session.js` (step 4).
- `test/index.js` — unused aggregator. **Do not** add new files there. `npm test` is `node --test test/` and discovers `*.test.js` itself.

**Conventions**: CommonJS (`require` / `module.exports`). Vanilla JS, no TypeScript, no extra test runner. Tests use `node:test` + `node:assert/strict` like `test/job-lock.test.js` and `test/mosaic.test.js`. Commit messages are short imperative sentences (example: `Serialize FFmpeg jobs and kill them on window close.`). Never add AI co-author trailers.

**Behavior to preserve** (do not “improve” in this plan):

- `activeEncode = true` during probe, then the ChildProcess during encode.
- Sequential duration probes (not parallel).
- `outputCreatedByThisJob = !fs.existsSync(filePath)` then encode onto `filePath` with `-y`.
- Progress matcher on the current chunk (plan 028/029 must not depend on you fixing this).
- Packaged `uncaughtException` handlers stay in `main.js`.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0, all tests pass (70 existing plus the new ones) |
| Tests (direct) | `node --test test/` | exit 0 |
| Confirm factory export | `node -e "const m=require('./lib/ffmpeg-session'); if (typeof m.createFfmpegSession !== 'function') process.exit(1)"` | exit 0 |

There is no lint or typecheck script. Do not add one.

## Scope

**In scope**:

- `lib/ffmpeg-session.js` (create)
- `main.js` (delete moved functions; construct one session; IPC / `closed` / `before-quit` call the session)
- `test/ffmpeg-session.test.js` (create)
- `test/convert-session.test.js` (point greps at `lib/ffmpeg-session.js` where the function bodies moved)

**Out of scope**:

- Encode-to-temp / atomic replace — plan 028
- Job generation ids / ignore stale `close` — plan 029
- `app.asar` path rewrite and `-protocol_whitelist` — plan 030
- Drop MIME / richer error strings — plan 031
- Parallel probes, xstack, Electron fuses, renderer `vidPath1..9` array
- Playwright / Spectron / launching Electron in tests
- Deleting `test/index.js`

## Git workflow

- Branch: `advisor/027-characterize-ffmpeg-session`
- Message: `Extract the FFmpeg convert session and test it with a fake spawn.`
- Do not push unless asked.

## Steps

### Step 1: Add `lib/ffmpeg-session.js` by moving code, not rewriting it

Create `lib/ffmpeg-session.js` that exports **one** factory:

```javascript
function createFfmpegSession(deps) {
    const spawn = deps.spawn
    const ffmpegBinary = deps.ffmpegBinary
    const fs = deps.fs
    const send = deps.send
    const log = typeof deps.log === 'function' ? deps.log : function () {}

    const liveProbeProcesses = new Set()
    let activeEncode = null
    let activeOutputPath = null
    let outputCreatedByThisJob = false
    let killedByUs = false

    function sendToRenderer(channel, ...args) {
        send(channel, ...args)
    }

    // move killChildProcess, discardPartialOutput, killActiveFfmpeg,
    // getVideoDurationWithFFmpeg, convertVideo here.
    // Replace debugLog(...) with log(...).
    // Keep require() of ./timecode, ./mosaic, ./job-lock, ./convert-session.

    return {
        convertVideo,
        killActiveFfmpeg,
        isBusy() {
            return Boolean(activeEncode)
        },
    }
}

module.exports = { createFfmpegSession }
```

Rules for the move:

- Copy `convertVideo` and `getVideoDurationWithFFmpeg` **verbatim** except `debugLog` → `log` and `sendToRenderer` using `deps.send`.
- `discardPartialOutput` still calls `shouldUnlinkPartialOutput` from `lib/convert-session.js` and `fs.unlinkSync`.
- `killChildProcess` still uses `process.platform === 'win32'` vs `SIGTERM`.
- Do not change argv, filter construction, or IPC event names.

**Verify**: `node -e "require('./lib/ffmpeg-session')"` → prints nothing, exit 0

### Step 2: Wire `main.js`

Keep `sendToRenderer` in `main.js` (it still needs `canSend(mainWindow)`). After that function exists, construct **one** session:

```javascript
const { spawn } = require('child_process')
const { createFfmpegSession } = require('./lib/ffmpeg-session')

const ffmpegSession = createFfmpegSession({
    spawn,
    ffmpegBinary,
    fs,
    send: sendToRenderer,
    log: debugLog,
})
```

`ffmpegBinary` remains `require('ffmpeg-static')` in `main.js` (plan 030 may wrap it later).

Replace:

- `convertVideo(options)` → `ffmpegSession.convertVideo(options)`
- `killActiveFfmpeg(...)` at IPC cancel, `mainWindow.on('closed')`, and `app.on('before-quit')` → `ffmpegSession.killActiveFfmpeg(...)`

Delete the moved function **bodies** and the moved `let`/`const` job state from `main.js`. Leave window/menu/uncaughtException/`setupIPC` dialog handlers in `main.js`.

`require('child_process')` should only be needed in `main.js` if you still pass `spawn` in; do not spawn ffmpeg from `main.js` after the move.

**Verify**: `grep -n "function convertVideo\\|function getVideoDurationWithFFmpeg\\|function killActiveFfmpeg" main.js` → no matches

**Verify**: `grep -n "ffmpegSession.convertVideo\\|ffmpegSession.killActiveFfmpeg" main.js` → matches at IPC + closed + before-quit

### Step 3: Fake-spawn tests in `test/ffmpeg-session.test.js`

Model structure after `test/job-lock.test.js` (`node:test`, `node:assert/strict`). Use `node:events` `EventEmitter` for fake children.

Fake process requirements (real `ChildProcess.kill` emits `close` **later**, not inside `kill()`):

```javascript
const { EventEmitter } = require('node:events')

function createFakeProcess() {
    const proc = new EventEmitter()
    proc.stderr = new EventEmitter()
    proc.stdout = new EventEmitter()
    proc.kill = function () {
        setImmediate(() => proc.emit('close', 0))
    }
    return proc
}
```

If you emit `close` synchronously inside `kill()`, the probe’s `close` handler can run before `settled = true` and flake. If tests flake twice on that, STOP and switch to `setImmediate` as above — do not add random `setTimeout(…, 50)`.

`spawn` fake: if `args` includes `'-hide_banner'` it is a **probe**; otherwise it is an **encode**. Return the next unused fake process of that kind.

`fs` fake for this plan: `existsSync: () => false`, `unlinkSync: () => {}` (so `outputCreatedByThisJob` is true; unlink behavior is plan 028).

Helper to wait for IPC:

```javascript
async function waitUntil(predicate, timeoutMs = 1000) {
    const start = Date.now()
    while (!predicate()) {
        if (Date.now() - start > timeoutMs) {
            throw new Error('timeout waiting for condition')
        }
        await new Promise((r) => setImmediate(r))
    }
}
```

Minimum cases (name them similarly):

1. **No videos** — `convertVideo({})` or all `vidPath*` omitted → `send('video:error', 'No videos provided')`. `isBusy()` false afterwards.
2. **Missing binary** — `ffmpegBinary: null` with `vidPath1: '/a.mp4'` → `'FFmpeg binary not found for this platform'`.
3. **Reject second job** — start a convert, do not finish probe; second `convertVideo` → `'A conversion is already running'`.
4. **Happy path** — probe stderr `Duration: 00:00:01.00\n`; then encode stderr `frame=  12 fps=0.0 q=0.0 size=       0kB time=00:00:00.40 bitrate=N/A\n`; encode `emit('close', 0)` → some `video:progress`, then `video:done`. Must **not** send `video:error`.
5. **Encode failure** — same probe, encode `emit('close', 1)` → `'Conversion failed'`, no `video:done`.
6. **Probe failure** — probe `emit('close', 1)` with no Duration line → `'Could not read video duration'`.
7. **Cancel during encode** — after encode spawn, `killActiveFfmpeg({ notify: 'cancelled' })` then encode `close` (non-zero is fine) → `video:cancelled`, and **no** `video:done` / `video:error` from that close.

Convert payload for tests (matches renderer spread):

```javascript
{
    vidPath1: '/a.mp4',
    vidPath2: undefined,
    vidPath3: undefined,
    vidPath4: undefined,
    vidPath5: undefined,
    vidPath6: undefined,
    vidPath7: undefined,
    vidPath8: undefined,
    vidPath9: undefined,
    gridType: '2x2',
    filePath: '/tmp/out.mp4',
    width: 1280,
    height: 720,
    audio: 'none',
    fit: 'letterbox',
}
```

**Verify**: `node --test test/ffmpeg-session.test.js` → exit 0, at least the 7 tests above pass

### Step 4: Fix convert-session greps

`test/convert-session.test.js` currently reads `main.js` for `function killActiveFfmpeg` and `video:cancelled`. After the move, update **those** greps to `lib/ffmpeg-session.js`. Keep preload / renderer greps as they are.

**Verify**: `npm test` → exit 0

### Step 5: Mark the plan

Set this plan’s Status to DONE in `plans/README.md` (027 row).

## Test plan

- New file `test/ffmpeg-session.test.js` with the 7 cases in step 3.
- Pattern: `test/job-lock.test.js` (small, no Electron). Do **not** spawn real ffmpeg here (`test/ffmpeg-integration.test.js` already does a lavfi encode).
- `npm test` must stay green including mosaic goldens.

## Done criteria

- [ ] `lib/ffmpeg-session.js` exports `createFfmpegSession`
- [ ] `main.js` has no `function convertVideo` / `function getVideoDurationWithFFmpeg` / `function killActiveFfmpeg`
- [ ] `grep -n "spawn(ffmpegBinary" main.js` → no matches
- [ ] `node --test test/ffmpeg-session.test.js` exits 0
- [ ] `npm test` exits 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` 027 status is DONE

## STOP conditions

- `convertVideo` already lives outside `main.js` (027 partially done) — report and do not create a second session module.
- Fake-spawn tests require launching Electron to pass — you went the wrong way; delete that approach and use `EventEmitter` children.
- You think you should fix the cancel/re-convert race or temp-file overwrite while you are here — those are 028/029; do not mix them in.
- Moving the code changes mosaic argv or IPC channel names (goldens fail for reasons other than grep path updates) — revert behavior and report.

## Maintenance notes

- Reviewer: diff `lib/ffmpeg-session.js` against the old `main.js` functions; it should be a move, not a rewrite. Any intentional behavior change belongs in 028/029.
- Plans 028 and 029 assume this factory exists and that `test/ffmpeg-session.test.js` can inject `fs` and `spawn`.
- `debugLog` gated on `isDev` stays in `main.js`; the session should not read `NODE_ENV` itself.
