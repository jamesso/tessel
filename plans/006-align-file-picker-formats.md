# Plan 006: Accept README video formats in the click-to-open picker

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat b558cb8..HEAD -- app/js/index.js README.md`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `b558cb8`, 2026-08-26

## Why this matters

README Usage and “Supported Video Formats” list MP4, MOV, AVI, and other FFmpeg formats. Drag-and-drop accepts any `file.type.startsWith('video/')`, but the click-to-open dialog filters **`mp4` only**. Users who click a square cannot pick the formats the docs advertise. Drops with an empty MIME type are also rejected even when the file is a valid video.

## Current state

```javascript
// app/js/index.js:148-152 — click picker
const options = {
    defaultPath: defaultPath,
    filters :[
    {name: 'Movies', extensions: ['mp4']}
    ]
}

// app/js/index.js:106-109 — drop
if (!file.type.startsWith('video/')) {
    console.warn('File is not a video:', file.type);
    alert('Please drop a video file (MP4, MOV, etc.)');
```

README (`README.md:76-81`): MP4, MOV, AVI, and other FFmpeg formats.

Save dialog (`app/js/index.js:185-187`) may stay `mp4` — output is always MP4. Do not widen the **save** filter.

**Conventions**: Dialog options objects as already built in `app/js/index.js`. No bundler.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Open filter | `grep -A3 "showOpenDialog" app/js/index.js` | extensions include `mp4`, `mov`, `avi` at least |
| Tests | `npm test` | exit 0 if present |

## Scope

**In scope**:
- `app/js/index.js` (open-dialog `filters`; drop MIME/extension fallback)
- `lib/media-accept.js` + `test/media-accept.test.js` if you extract `isProbablyVideoFile({ type, name })` for tests
- `README.md` only if you add `m4v`/`webm`/`mkv` to the list to match the picker (keep lists in sync)

**Out of scope**:
- Thumbnails / multi-file drop (plan 020)
- Main-process dialog option hardening
- Changing FFmpeg input handling

## Git workflow

- Branch: `advisor/006-align-file-picker-formats`
- Message: `Accept MOV and AVI in the open-file picker.`
- Do not push unless asked.

## Steps

### Step 1: Widen open-dialog extensions

Use a single shared list, e.g. `['mp4', 'mov', 'm4v', 'webm', 'avi', 'mkv']`. Click handler `filters: [{ name: 'Movies', extensions: thatList }]`. Keep save dialog `['mp4']`.

**Verify**: `grep -n "extensions: \['mp4'\]" app/js/index.js` → only the save-dialog options (or zero if you wrote `['mp4']` with different spacing — must not appear on the open-dialog path)

### Step 2: Drop: empty MIME allowed by extension

If `file.type` is empty or not `video/*`, accept when `file.name` matches `/\.(mp4|mov|m4v|webm|avi|mkv)$/i`. Still reject clearly non-video types (`image/*`, etc.).

**Verify**: helper test or grep for the extension regex in `app/js/index.js` or `lib/media-accept.js`

### Step 3: Tests

If extracted: names `clip.MOV` with `type: ''` → true; `notes.txt` → false; `type: video/quicktime` → true.

**Verify**: `npm test` → exit 0

## Test plan

- `test/media-accept.test.js` if extracted; otherwise no automated UI test (do not add Playwright).

## Done criteria

- [ ] Open dialog extensions include at least mp4, mov, avi
- [ ] Save dialog still mp4-only
- [ ] Empty MIME + `.mov` name is accepted on drop
- [ ] `plans/README.md` 006 DONE

## STOP conditions

- Electron dialog `extensions` on Windows require no leading dots — use `mp4` not `.mp4` (already the repo style).

## Maintenance notes

- Plan 020 should reuse the same extension list for multi-drop.
- Reviewer: do not loosen save format; output is MP4.
