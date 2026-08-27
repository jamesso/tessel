# Plan 031: Accept octet-stream drops and show ffmpeg’s exit in convert errors

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat c2b112f..HEAD -- lib/media-accept.js app/js/media-accept.js test/media-accept.test.js main.js lib/ffmpeg-session.js app/js/index.js`
> Compare excerpts against live code; on a mismatch, treat it as a STOP condition.
> If `lib/ffmpeg-session.js` exists (plan 027), change encode error strings **there**, not in a copy of `convertVideo` inside `main.js`.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (can run in parallel with 027–030)
- **Category**: bug
- **Planned at**: commit `c2b112f`, 2026-08-26

## Why this matters

Two user-facing Convert/drop issues:

1. **Drop MIME**: `isProbablyVideoFile` returns true for `video/*`, then **any other non-empty `type` is false**, and the extension regex only runs when `type` is empty. A `.mp4` with `application/octet-stream` (common on Windows, downloads, some NAS volumes) is rejected with “Please drop a video file” even though click-to-open uses `VIDEO_EXTENSIONS` and would accept it.
2. **Errors**: encode `close` with nonzero code always sends `'Conversion failed'`. The last 1000 characters of ffmpeg stderr are only `debugLog`’d, and `debugLog` is a no-op when packaged. Users and GitHub issues cannot tell a codec error from a permission error. Duration probe already sends `'Could not read video duration'`. Keep alerts as they are (`alert('Video conversion error: ' + error)`); put a short reason in the string.

Do not log full paths to the UI. Do not restore the Desktop debug file (plan 010).

## Current state

```javascript
// lib/media-accept.js and app/js/media-accept.js (keep both in sync)
function isProbablyVideoFile({ type, name } = {}) {
    const mime = typeof type === 'string' ? type : '';
    if (mime.startsWith('video/')) {
        return true;
    }
    if (mime) {
        return false;
    }
    return typeof name === 'string' && VIDEO_NAME_RE.test(name);
}
```

`test/media-accept.test.js` already requires **both** copies for a subset of cases. It rejects `image/jpeg` even when the name is `foo.mp4` — **keep that**.

```javascript
// encode close in main.js / ffmpeg-session (after 027)
if (code === 0) {
    // ...
} else {
    signalError('Conversion failed');
}
```

Renderer (`app/js/index.js`): drop uses `window.isProbablyVideoFile`; click uses dialog filters only. Do not merge click and drop in this plan.

**Conventions**: duplicate renderer copy of media-accept is **required** (sandboxed preload must not `require` `lib/`). Comment at top of `app/js/media-accept.js`: keep in sync. Tests: `test/media-accept.test.js`. Short imperative commits. No AI co-author trailers.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 |
| Media tests | `node --test test/media-accept.test.js` | exit 0 |

No lint/typecheck script.

## Scope

**In scope**:

- `lib/media-accept.js`
- `app/js/media-accept.js` (same logic)
- `test/media-accept.test.js`
- Encode failure message in `lib/ffmpeg-session.js` **or** `main.js` if 027 has not landed
- `test/ffmpeg-session.test.js` only if 027 exists and you assert the new error string on `close` 1
- Optional tiny helper `formatConvertFailure(code, stderrTail)` in `lib/convert-session.js` if that keeps the session thinner — allowed

**Out of scope**:

- Click-to-open calling `isProbablyVideoFile` (nice follow-up; not required)
- Replacing `alert()` with a toast
- Per-chunk progress parser accumulation
- `uncaughtException` handlers
- Changing duration-probe error copy
- `application/x-iso9660-image` or other exotic MIMEs unless they are `octet-stream`

## Git workflow

- Branch: `advisor/031-drop-mime-and-convert-errors`
- Message: `Accept octet-stream video drops and include ffmpeg’s exit code in errors.`
- Do not push unless asked.

## Steps

### Step 1: Treat empty and octet-stream MIME as unknown

In **both** `lib/media-accept.js` and `app/js/media-accept.js`:

```javascript
function isProbablyVideoFile({ type, name } = {}) {
    const mime = typeof type === 'string' ? type : '';
    if (mime.startsWith('video/')) {
        return true;
    }
    const unknownMime = mime === '' || mime === 'application/octet-stream';
    if (!unknownMime) {
        return false;
    }
    return typeof name === 'string' && VIDEO_NAME_RE.test(name);
}
```

Keep `VIDEO_EXTENSIONS` / `VIDEO_NAME_RE` as they are.

Tests to add in `test/media-accept.test.js`:

- `{ type: 'application/octet-stream', name: 'clip.mp4' }` → `true`
- `{ type: 'application/octet-stream', name: 'clip.MOV' }` → `true`
- `{ type: 'application/octet-stream', name: 'notes.txt' }` → `false`
- existing `{ type: 'image/jpeg', name: 'foo.mp4' }` → still `false`
- existing empty MIME + `.mov` → still `true`

Also assert the renderer module matches lib for the new octet-stream case (same style as the existing `require('../app/js/media-accept')` test).

**Verify**: `node --test test/media-accept.test.js` → exit 0

### Step 2: Encode errors include exit code and one stderr line

Replace `signalError('Conversion failed')` on nonzero encode `close` with a short string:

- Always include the exit code: `Conversion failed (exit 1)` (use the actual `code`; if `code` is `null`, say `exit unknown`).
- Optionally append a single extra sentence from stderr: take `ffmpegOutput.slice(-1000)`, split lines, pick the last non-empty line that is **not** a `frame=` / `size=` progress line. Truncate that line to 120 characters.
- If that line contains the destination path (or temp path), omit the stderr snippet and send only `Conversion failed (exit N)` so the alert does not dump filesystem paths.

Do **not** send the full 1000-char buffer. Do **not** send `err.stack`.

Spawn `error` handler currently sends `err.message`. Change packaged/user-facing spawn failures to `'Could not start FFmpeg'` (keep `log(err.message)`). If you cannot tell packaged vs not inside the session, always send `'Could not start FFmpeg'` for spawn errors — that is acceptable.

If 027 tests look for exactly `'Conversion failed'`, update them to match `/Conversion failed/` or the new `exit` form.

**Verify**: `npm test` → exit 0

### Step 3: Mark the plan

`plans/README.md` row 031 → DONE.

## Test plan

- Media-accept cases in step 1 (lib + renderer parity).
- If `test/ffmpeg-session.test.js` exists: encode `close` 1 expects `Conversion failed (exit 1)` (or regex).
- Pattern: `test/media-accept.test.js`.
- No Electron drop E2E.

## Done criteria

- [ ] `isProbablyVideoFile` accepts `application/octet-stream` + a listed video extension in **both** lib and `app/js` copies
- [ ] `image/jpeg` + `.mp4` still rejected
- [ ] Nonzero encode close IPC matches `/Conversion failed \(exit /`
- [ ] `npm test` exits 0
- [ ] No files outside the in-scope list are modified
- [ ] `plans/README.md` 031 DONE

## STOP conditions

- You start generating `app/js/media-accept.js` from a bundler — not allowed; keep the duplicated IIFE.
- Accepting **all** non-empty MIMEs as long as the extension matches (would accept `image/jpeg` named `.mp4`) — forbidden.
- Putting full ffmpeg stderr or absolute paths into `video:error`.
- Rewriting the renderer overlay/alert UI.

## Maintenance notes

- Reviewer: both media-accept files must stay byte-for-byte the same logic. The existing parity test should cover octet-stream after this plan.
- Click-to-open still trusts the OS dialog; out of scope.
- Richer ffmpeg errors help support (`README.md` asks for details). If stderr has nothing useful, exit code alone is enough.
