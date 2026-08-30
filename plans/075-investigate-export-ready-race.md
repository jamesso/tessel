# Plan 075: Investigate File → Export hanging on `did-finish-load`

> **Executor instructions**: This is an **investigate** plan. Fill
> `## Investigation result`. Only then apply a small proven fix if the race
> is real. When done, update `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat f14caf4..HEAD -- main.js test/prefs.test.js lib/ipc-send.js`
> On excerpt mismatch, STOP.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `f14caf4`, 2026-08-27

## Why this matters

`exportLayout` awaits `whenRendererReady()` **before** any dialog. If `webContents.isLoading()` is true, it uses `once('did-finish-load')` with no timeout. The classic gap: the event fires between the `isLoading()` check and `once`, so Export never opens a save dialog and never hits `exportLayout`’s `.catch`. Import waits on ready only **after** the open dialog, when load is almost certainly done. Window is narrow (`app.on('ready')` + first paint + a very fast File → Export).

## Current state

`main.js`:

```javascript
function whenRendererReady() {
    if (!canSend(mainWindow)) {
        return Promise.reject(new Error('Window unavailable'))
    }
    if (!mainWindow.webContents.isLoading()) {
        return Promise.resolve()
    }
    return new Promise((resolve) => {
        mainWindow.webContents.once('did-finish-load', resolve)
    })
}

async function exportLayout() {
    await whenRendererReady()
    mainWindow.webContents.send('prefs:collect')
}
```

`canSend` is `lib/ipc-send.js`. No unit tests for `whenRendererReady` (it is not extracted).

**Conventions**: extract a tiny helper if you fix, test with a fake `webContents`. Short imperative commits. No AI co-author trailers.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 |

## Scope

**In scope**:

- This file’s `## Investigation result`
- If you fix: extract `whenRendererReady(win)` to `lib/` (or keep in main and export for tests), attach `did-finish-load` **before** re-checking `isLoading()`, and/or resolve if already not loading; optional timeout that rejects (Export catch already shows an error box)

**Out of scope**:

- Import fill-empty (083)
- Blocking import during convert (065) except do not fight its busy check
- Changing `prefs:collect` payload (063)

## Git workflow

- Branch: `advisor/075-investigate-export-ready-race`
- Message: either `Wait for the renderer without missing did-finish-load.` **or** `Document that export load-race was not reproduced.`
- Do not push unless asked.

## Steps

### Step 1: Reproduce or reason

Write a unit test with a fake `webContents`: `isLoading()` returns true once, then `did-finish-load` is emitted **synchronously** before `once` would attach if the implementation checks first. If today’s helper hangs in that harness, the race is proven.

**Verify**: test exists; either FAIL on current code or you document that Electron never emits that way and you still close the TOCTOU by attaching first.

### Step 2: Fix or no-ship

Preferred fix:

```javascript
function whenRendererReady(win) {
    if (!canSend(win)) return Promise.reject(new Error('Window unavailable'))
    const wc = win.webContents
    if (!wc.isLoading()) return Promise.resolve()
    return new Promise((resolve) => {
        const done = () => resolve()
        wc.once('did-finish-load', done)
        if (!wc.isLoading()) {
            wc.removeListener('did-finish-load', done)
            resolve()
        }
    })
}
```

Timeout is optional (e.g. 10s reject). Wire `exportLayout` to the helper.

**Verify**: `npm test` → exit 0

## Test plan

- Fake webContents: loading then immediate finish; loading then event after `once`; already not loading.
- Pattern: `test/ipc-send.test.js` / `test/navigation-guard.test.js` fakes.

## Done criteria

- [ ] `## Investigation result` filled
- [ ] Either helper is TOCTOU-safe and tested **or** explicit no-ship with reason
- [ ] `npm test` exits 0
- [ ] `plans/README.md` 075 DONE

## STOP conditions

- You would busy-wait `while (isLoading())`.
- You would skip `canSend` and send IPC to a destroyed window.

## Investigation result

_(executor fills)_

## Maintenance notes

- Reviewer: `removeListener` vs `off` — match the Electron API the project already uses (EventEmitter `once`).
- Import’s post-dialog `whenRendererReady` should use the same helper.
