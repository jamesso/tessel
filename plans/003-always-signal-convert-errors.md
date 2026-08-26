# Plan 003: Always signal convert failures and never touch a destroyed window

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat b558cb8..HEAD -- main.js app/js/index.js preload.js`
> Compare excerpts; plan 001/002 may have added `sendToRenderer` — reuse it.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (land after 001 if tests exist; 002 sends duration errors that this plan must keep working)
- **Category**: bug
- **Planned at**: commit `b558cb8`, 2026-08-26

## Why this matters

The renderer shows `#overlay` as soon as the user picks a save path (`app/js/index.js:214`) and only hides it on `video:done` or `video:error`. Main can `return` or `catch` without sending either event. `debugLog` is a no-op when packaged (`main.js:22-24`), so uncaught exceptions are silent. Progress IPC null-checks `mainWindow` (`main.js:508-511`); `done`/`error` do not (`main.js:557-566`). Closing the window during encode then throws, which is also swallowed.

## Current state

```javascript
// main.js:270-272
if (allVideoPaths.length === 0) {
    debugLog('ERROR: No videos provided')
    return;
}

// main.js:41-47 — packaged: debugLog returns immediately
process.on('uncaughtException', (error) => {
    debugLog('Uncaught Exception:', error.stack)
})

// main.js:557-566
mainWindow.webContents.send('video:done');
// ...
mainWindow.webContents.send('video:error', 'Conversion failed');

// main.js:169
mainWindow.on('closed', () => mainWindow = null)

// main.js:573-575
} catch (err) {
    debugLog('Conversion function error:', err)
}
```

Renderer already hides overlay on error (`app/js/index.js:235-242`). Preload already allows `video:error` (`preload.js:15`).

**Conventions**: `ipcMain` + `webContents.send` as elsewhere in `main.js`. Do not add a logging library.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 (after 001) |
| Guard present | `grep -n "isDestroyed" main.js` | at least one match in the send helper |

## Scope

**In scope**:
- `main.js` (send helper, all convert failure/success IPC, uncaught handlers, `closed` listener placement)
- `test/ipc-send.test.js` only if you extract a pure `canSend(win)` helper; otherwise skip new tests and rely on grep
- `app/js/index.js` only if overlay must hide on a new event name — prefer reusing `video:error`

**Out of scope**:
- Cancel button / mutex (plan 004)
- Desktop debug file location (plan 011)
- Progress 99% cap (plan 014)

## Git workflow

- Branch: `advisor/003-always-signal-convert-errors`
- Message: `Send video:error on every convert failure path.`
- Do not push unless asked.

## Steps

### Step 1: Add `sendToRenderer(channel, ...args)`

```javascript
function sendToRenderer(channel, ...args) {
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
        mainWindow.webContents.send(channel, ...args)
    }
}
```

Replace every `mainWindow.webContents.send` in `convertVideo` / ffmpeg handlers with this (progress, done, error).

**Verify**: `grep -n "mainWindow.webContents.send" main.js` → only inside `sendToRenderer` (or zero if all aliased)

### Step 2: Every convert abort sends `video:error`

- Zero inputs: `sendToRenderer('video:error', 'No videos provided')` then return.
- Outer `catch`: `sendToRenderer('video:error', err.message || 'Conversion failed')`.
- FFmpeg non-zero `close` and spawn `error`: keep sending error, but **only once** (set a local `signaled` flag so `error` + `close` cannot double-alert).
- Duration failures from plan 002 must use the same helper.

**Verify**: `grep -n "No videos provided" main.js` shows a `sendToRenderer` / `send` of `video:error` on that path, not only `debugLog`

### Step 3: Attach `closed` inside `createMainWindow`

Move `mainWindow.on('closed', () => { mainWindow = null })` from `app.on('ready')` (`main.js:169`) into `createMainWindow` so dock-reopen on macOS (`activate` → `createMainWindow` at 584–587) also clears the pointer. `createAboutWindow` does not need this unless you also store `aboutWindow` similarly (optional).

**Verify**: `grep -n "mainWindow = null" main.js` is inside `createMainWindow`

### Step 4: Packaged uncaught errors

In `uncaughtException` / `unhandledRejection`, if `!isDev`, `console.error` the error **and** `sendToRenderer('video:error', 'Unexpected error')` when a window exists. Do not write secrets; messages only.

**Verify**: `grep -A3 "uncaughtException" main.js` includes `console.error` or `sendToRenderer`

## Test plan

- If 001 landed, add a unit test for a extracted `canSend({ isDestroyed: () => false })` vs `null`. Optional S.
- Manual smoke (not a gate): Convert with no files is already blocked in renderer; force a bad output path / missing ffmpeg only if you can without destroying the machine.

## Done criteria

- [ ] `npm test` exits 0 if the script exists
- [ ] All convert IPC uses the destroyed-window guard
- [ ] Empty-input and `catch` paths send `video:error`
- [ ] `closed` listener lives in `createMainWindow`
- [ ] No files outside scope (`git status`)
- [ ] `plans/README.md` 003 DONE

## STOP conditions

- Preload whitelist no longer includes `video:error`.
- Renderer overlay hide logic was removed.

## Maintenance notes

- Plan 004 cancel should send a distinct message or reuse `video:error` with `'Cancelled'` — renderer already `alert`s; 019 may replace alert with a toast.
- Reviewer: no double `alert` on spawn failure.
