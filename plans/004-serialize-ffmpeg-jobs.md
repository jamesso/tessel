# Plan 004: Run one FFmpeg job at a time and kill it on close

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat b558cb8..HEAD -- main.js preload.js app/js/index.js app/index.html app/css/style.css`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/002-fix-duration-probing.md, plans/003-always-signal-convert-errors.md
- **Category**: bug
- **Planned at**: commit `b558cb8`, 2026-08-26

## Why this matters

`ipcMain.on('video:convert')` always calls `convertVideo` with no mutex (`main.js:116-119`). Spawned ffmpeg processes are local variables (`main.js:222`, `489`) and are never `.kill()`’d. Convert is an `async` click handler with no `converting` flag (`app/js/index.js:179-215`); overlay appears only after the save dialog and is not inert (`app/css/style.css:209-221`). Double Convert, Enter on the still-focused button, or closing the window on macOS (`window-all-closed` does not quit, `main.js:578-581`) leaves overlapping encodes or orphan ffmpeg. A dedicated Cancel button and “keep grid / toast” are plan 019; this plan is the **safety lock and process lifetime**.

## Current state

```javascript
ipcMain.on('video:convert', (e, options) => {
    console.log(options)
    convertVideo(options)
})
```

Overlay CSS: `position: fixed; … z-index: 100; cursor: pointer;` with no click handler in `app/js/index.js`. Convert control is `<button class="button" id="convert">` in `app/index.html:82`.

**Conventions**: Preload channel whitelist in `preload.js` (`send` / `receive` arrays). Match that pattern for any new channel. Use `sendToRenderer` from plan 003.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 |
| Mutex present | `grep -n "converting\|currentFfmpeg\|activeJob" main.js` | a job flag or child handle exists |

## Scope

**In scope**:
- `main.js` (mutex, store/kill child + probe set from 002, reject second convert, kill on `before-quit` / window close)
- `preload.js` (optional `video:busy` or reuse `video:error` for “already converting”)
- `app/js/index.js` (disable Convert while overlay is shown; ignore second clicks)
- `app/index.html` / `app/css/style.css` only to set overlay `pointer-events` / `cursor: default` so it blocks clicks (no Cancel control yet)

**Out of scope**:
- Cancel button, toast, keeping slots after success — plan 019
- `video:cancel` IPC — plan 019 (you may add a `killActiveFfmpeg()` function 019 will call)
- xstack / encoder preset — plans 014+

## Git workflow

- Branch: `advisor/004-serialize-ffmpeg-jobs`
- Message: `Serialize converts and kill ffmpeg when the window closes.`
- Do not push unless asked.

## Steps

### Step 1: Main-process single-flight

Add module-level `let activeEncode = null` (and keep probe children from 002 in a `Set`). At the start of `convertVideo`:

- If `activeEncode` is non-null, `sendToRenderer('video:error', 'A conversion is already running')` and return.
- After spawn of the encode process, set `activeEncode = ffmpegProcess`.
- On encode `close` or `error`, `activeEncode = null`.

If a second IPC arrives, do **not** kill the first job (that is cancel, plan 019).

**Verify**: `grep -n "already running" main.js` → match

### Step 2: Kill on window close and quit

On `mainWindow` `'closed'` and `app` `'before-quit'`:

- Kill `activeEncode` with `SIGTERM` (on Windows, `kill()` without signal is OK).
- Kill probe children in the Set.
- Set `activeEncode = null`.
- Do not send `video:done`. If you send anything, send `video:error` with `'Cancelled'` only if the renderer might still exist (usually it does not).

Ignore `close` after kill so a killed process does not emit `video:done`. Use a `killedByUs` flag.

**Verify**: `grep -n "before-quit" main.js` → match; `grep -n ".kill(" main.js` → match

### Step 3: Renderer: one Convert at a time

In `app/js/index.js` Convert handler:

- If overlay `display === 'block'`, return immediately.
- Set a `converting` flag `true` before `showSaveDialog`; if the user cancels the dialog, set it `false`.
- Set overlay visible as today after a path is chosen.
- On `video:done` and `video:error`, set `converting = false`.

Set `#overlay` CSS `cursor: default` (remove `pointer: pointer` until 019 adds cancel). Optional: `document.getElementById('convert').disabled = true` while converting.

**Verify**: `grep -n "converting" app/js/index.js` → match

### Step 4: Tests

If you extract `function shouldRejectSecondJob(active) { return Boolean(active) }` test it. Do not try to unit-test `child_process` kill.

**Verify**: `npm test` → exit 0

## Test plan

- Unit: second job rejected when flag set.
- Manual smoke: start convert, click Convert again — one dialog/job; close window during convert — no leftover `ffmpeg` in Activity Monitor / Task Manager.

## Done criteria

- [ ] Second `video:convert` while encode is running does not spawn another ffmpeg
- [ ] Window close / `before-quit` kills encode and probes
- [ ] Killed jobs do not send `video:done`
- [ ] Overlay no longer uses `cursor: pointer` (019 will add cancel)
- [ ] `npm test` exits 0
- [ ] `plans/README.md` 004 DONE

## STOP conditions

- Killing ffmpeg on Windows throws and you cannot find a portable `process.kill` — report; do not ship mac-only kill.
- You need to delete partial output files to make close safe — you **may** `fs.unlink` the `filePath` if the process was killed before code 0; if unlink races, stop and report rather than deleting unrelated files.

## Maintenance notes

- Plan 019 should call the same `killActiveFfmpeg()` from a `video:cancel` channel.
- Reviewer: confirm `killedByUs` prevents false `video:done`.
