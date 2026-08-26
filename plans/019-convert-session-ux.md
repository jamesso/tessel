# Plan 019: Finish the convert session (cancel, keep the grid, toast)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat b558cb8..HEAD -- main.js preload.js app/js/index.js app/index.html app/css/style.css`
> Plan 004 should have `killActiveFfmpeg()` / `activeEncode`. Reuse them.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/004-serialize-ffmpeg-jobs.md
- **Category**: direction
- **Planned at**: commit `b558cb8`, 2026-08-26

This is a **product** plan (bounded UX), not an unbounded rewrite. Do not add settings, thumbnails, or audio mixing.

## Why this matters

The converting overlay (`app/index.html:85-89`) has `cursor: pointer` (until 004 may set default) and **no click handler**. Preload allowlists `video:convert` out and `progress/done/error` in — no cancel. Success runs `clearAllVideos()` (`app/js/index.js:246-256`) after a comment `//add toast for coversion complete`. Users cannot stop a long 3×3 encode except by quitting, and a successful run throws away the layout so “tweak one cell and re-export” means re-picking every file.

## Current state

```javascript
electronAPI.receive('video:done', () => {
    //add toast for coversion complete
    document.getElementById("overlay").style.display = "none";
    ...
    clearAllVideos()
})
```

`preload.js` valid send channels: `['video:convert']`. Receive: `['video:progress', 'video:done', 'video:error']`.

Logo click already `clearAllVideos()` (`app/js/index.js:325-329`). Per-cell × uses `clearVideo`.

**Conventions**: Classic renderer script; preload whitelist. CSS in `app/css/style.css`. Match existing overlay/loader styling; do not add a CSS framework.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 |
| Cancel channel | `grep -n "video:cancel" preload.js main.js app/js/index.js` | matches in all three |

## Scope

**In scope**:
- `preload.js` (add `video:cancel` to send whitelist)
- `main.js` (handle cancel → `killActiveFfmpeg`, `killedByUs`, do not `video:done`; `unlink` incomplete `filePath` if encode had started)
- `app/index.html` (Cancel button on overlay)
- `app/css/style.css` (button on overlay)
- `app/js/index.js` (cancel click; toast; **do not** `clearAllVideos` on success)

**Out of scope**:
- Thumbnails / multi-drop (plan 020)
- Output resolution/audio (plan 021)
- Replacing `alert` on error (you may use the same toast for error if small)

## Git workflow

- Branch: `advisor/019-convert-session-ux`
- Message: `Allow cancelling convert and keep the grid after success.`
- Do not push unless asked.

## Steps

### Step 1: Cancel IPC

Preload `send` whitelist: `['video:convert', 'video:cancel']`.

`ipcMain.on('video:cancel', () => { killActiveFfmpeg(); /* unlink partial output if path known */ sendToRenderer('video:error', 'Cancelled') })` — or a dedicated `video:cancelled` that **does not** `alert`. Prefer `video:cancelled` plus renderer handling without a scary alert. If you add a receive channel, whitelist it.

On cancel during **probe** (before encode spawn), also kill probe children (plan 002 Set).

If `filePath` was already opened by ffmpeg, `fs.unlink(filePath, () => {})` only when `killedByUs` and encode did not exit 0. Do not unlink if the file existed before convert (save dialog usually new name `tesselate${Date.now()}.mp4`).

**Verify**: `grep -n "video:cancel" preload.js main.js` → matches

### Step 2: Overlay Cancel control

In `#overlay`, add `<button type="button" id="cancel-convert">Cancel</button>`. Style with existing `.button` or a text button on the dark overlay. Click: `electronAPI.send('video:cancel')`.

Restore overlay `cursor` as appropriate; the button is the cancel target.

**Verify**: `grep -n "cancel-convert" app/index.html app/js/index.js` → matches

### Step 3: Success: toast, keep slots

Remove `clearAllVideos()` from `video:done`. Show a brief non-modal message (e.g. a `div#toast` fixed bottom, text “Conversion complete”, hide after 3s via `setTimeout`). Do not add a dependency.

Keep logo-click clear and per-cell ×.

**Verify**: `grep -A15 "video:done" app/js/index.js` does not call `clearAllVideos`

### Step 4: Tests

No Electron E2E. Optional: extract `shouldClearGridOnSuccess = false` is not needed. Grep is the gate.

**Verify**: `npm test` → exit 0

## Test plan

- Manual: start convert, Cancel — overlay hides, no `alert('Cancelled')` if you used a quiet channel; no complete MP4 (or file deleted). Complete convert — cells still filled; toast appears; logo still clears all.

## Done criteria

- [ ] Cancel kills ffmpeg/probes and does not send `video:done`
- [ ] Success does not clear the grid
- [ ] Toast on success (no leftover `//add toast` comment)
- [ ] `npm test` exits 0
- [ ] `plans/README.md` 019 DONE

## STOP conditions

- `unlink` might delete a file the user saved over an existing video — only unlink if this process created/truncated the path in this job; if unsure, **leave the partial file** and report.
- Plan 004 has no kill helper — implement kill here but do not skip the mutex.

## Maintenance notes

- Reviewer: partial files and `killedByUs` vs `video:done`.
- Follow-up: error `alert` could become toast; not required here.
