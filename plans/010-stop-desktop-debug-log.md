# Plan 010: Stop writing debug logs to the Desktop

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat b558cb8..HEAD -- main.js app/js/index.js app/index.html`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `b558cb8`, 2026-08-26

## Why this matters

Unpackaged runs (`npm start` / `npm run dev`) set `isDev` and write/clear `~/Desktop/tessel-debug.log` with input/output paths and full ffmpeg argv (`main.js:8-37`, `260-264`, `486-487`). `ipcMain.on('video:convert')` always `console.log(options)` (`main.js:117`), including packaged builds. Renderer and `app/index.html` contain leftover electronAPI probe `console.log`s.

## Current state

```javascript
const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged
if (isDev) {
    debugLogPath = path.join(os.homedir(), 'Desktop', 'tessel-debug.log')
    fs.writeFileSync(debugLogPath, '')
}

ipcMain.on('video:convert', (e, options) => {
    console.log(options)
    convertVideo(options)
})
```

Inline probe script `app/index.html:91-103`. `app/js/index.js:1-9` similar logs.

**Conventions**: Existing `debugLog` helper. Electron `app.getPath('logs')` is the right directory if logging stays.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| No Desktop path | `grep -n "Desktop" main.js` | no `tessel-debug.log` on Desktop |
| Tests | `npm test` | exit 0 if present |

## Scope

**In scope**:
- `main.js` (`debugLog`, convert `console.log`, uncaught handlers remain useful)
- `app/js/index.js` (remove boot probe logs; keep real `alert`s)
- `app/index.html` (remove inline electronAPI test script)

**Out of scope**:
- CSP `'unsafe-inline'` removal beyond deleting the inline script (deleting it is required for a later CSP tighten; do not change the meta CSP in this plan unless the inline script is gone — you **may** leave the meta tag as-is)
- Full log redaction library

## Git workflow

- Branch: `advisor/010-stop-desktop-debug-log`
- Message: `Do not write conversion debug logs to the Desktop.`
- Do not push unless asked.

## Steps

### Step 1: Default debug file off Desktop

- Do **not** write to `os.homedir()/Desktop/tessel-debug.log`.
- If you keep file logging: only when `process.env.TESSEL_DEBUG === '1'`, write under `app.getPath('logs')` (call this after `app` is ready, or skip file logging entirely and use `console.error` in `isDev` only).
- Simplest acceptable implementation: delete the Desktop file writer; keep `debugLog` as `if (isDev) console.log(...)`.

**Verify**: `grep -n "tessel-debug.log" main.js` → no matches

### Step 2: Gate convert options logging

Remove `console.log(options)` on `video:convert`. If needed, `debugLog('video:convert', { gridType: options.gridType })` without full paths, `isDev`-only.

**Verify**: `grep -n "console.log(options)" main.js` → no matches

### Step 3: Strip renderer probes

Delete `app/index.html` inline script (lines 91–103). Remove `app/js/index.js` lines 1–9 boot logs and noisy `console.log(dz)` / file-path dumps on drop. Keep `console.error` for actual API failure.

**Verify**: `grep -n "electronAPI is NOT available" app/js/index.js app/index.html` → no matches (or only a single `console.error` if you keep a real guard)

## Test plan

- No automated test. Grep is the gate.
- Manual: `npm start` does not create `~/Desktop/tessel-debug.log`.

## Done criteria

- [ ] No Desktop debug log path in `main.js`
- [ ] Convert IPC does not print full options in production
- [ ] Inline electronAPI test script removed from `app/index.html`
- [ ] `plans/README.md` 010 DONE

## STOP conditions

- `app.getPath('logs')` called before `app` ready throws — only use it inside `app.on('ready')` or drop file logs.

## Maintenance notes

- Reviewer: packaged users must not get a surprise Desktop file from leftover `isDev` false positives (`app.isPackaged` is the source of truth).
