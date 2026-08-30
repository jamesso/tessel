# Plan 085: Reveal the saved mosaic in the file manager after Convert succeeds

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat f14caf4..HEAD -- main.js lib/ffmpeg-session.js app/js/index.js app/index.html lib/navigation-guard.js`
> Compare excerpts against live code; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `f14caf4`, 2026-08-27

## Why this matters

Success is a toast “Conversion complete” (`app/index.html` / `showToast`) with no action. Users hunt for `tesselate*.mp4`. Cell `<video>` stays paused at first frame (043 STOP: no nine looping videos). `PRODUCT.md`: not an NLE — do not auto-play the mosaic in-app. `shell.showItemInFolder` is the familiar desktop reveal. Navigation guard already uses `shell.openExternal` for About GitHub only.

## Current state

On encode `code === 0` and successful rename, session `send('video:done')` with **no path**. Renderer does not know `filePath` unless it closed over the save dialog variable (it does in the click handler, but `video:done` is a separate listener that only toasts).

`shell` is already required in `main.js`.

**Conventions**: do not `openPath` / launch a player (breaks the tweak loop; also OS default app). Reveal folder. Short imperative commits. No AI co-author trailers.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 |

## Scope

**In scope**:

- After successful rename, `shell.showItemInFolder(destPath)` from **main** (session callback or `main.js` wrapper). Inject `showItemInFolder` in `createFfmpegSession` deps if you want tests to assert it was called with dest (not temp).
- Optional: toast remains; do not require a click
- Tests: fake `showItemInFolder` on happy-path encode in `test/ffmpeg-session.test.js`; **not** called on error/cancel/rename failure
- README one clause

**Out of scope**:

- In-cell playback
- Opening the file in a movie player
- Signed macOS
- Changing toast copy except you may say “Saved” 

## Git workflow

- Branch: `advisor/085-reveal-output-on-done`
- Message: `Show the saved mosaic in the file manager when convert succeeds.`
- Do not push unless asked.

## Steps

### Step 1: Session hook

On `video:done` path (after rename ok), call `deps.showItemInFolder(destPath)` if it is a function. Main: `showItemInFolder: (p) => shell.showItemInFolder(p)`. Do not reveal the `.tessel-partial` path.

**Verify**: `grep -n "showItemInFolder" main.js lib/ffmpeg-session.js`

### Step 2: Tests

Happy path encode: `showItemInFolder` called once with dest. Failure/cancel: not called. Pattern: `test/ffmpeg-session.test.js` `createSession`.

**Verify**: `npm test` → exit 0

## Test plan

- Injected spy. No Playwright.

## Done criteria

- [ ] Successful convert reveals the **dest** file, not the temp
- [ ] Cancel/error/rename-keep-temp do not reveal
- [ ] Cell previews stay paused stills
- [ ] `npm test` exits 0
- [ ] `plans/README.md` 085 DONE

## STOP conditions

- You would `shell.openPath` the MP4 by default.
- You would un-pause nine cell videos.

## Maintenance notes

- Reviewer: `showItemInFolder` on Linux uses the file manager; if it no-ops in some DEs, that is acceptable.
- 066 unique temps: still reveal dest after successful rename.
