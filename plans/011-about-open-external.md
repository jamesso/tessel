# Plan 011: Open the About GitHub link in the system browser

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat b558cb8..HEAD -- main.js app/about.html`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `b558cb8`, 2026-08-26

## Why this matters

About’s “Visit Website” is a normal `<a href="https://github.com/Jamesso/tessel">` (`app/about.html:36`). The About `BrowserWindow` has no `will-navigate` / `setWindowOpenHandler` (`main.js:146-159`). Clicking loads GitHub **inside** Electron (shared session with the app). `shell` is already imported in `main.js:4` and unused. The main window also has no navigation allowlist; it has a preload (`electronAPI`). Deny in-app navigation on **both** windows.

This is not a plan to treat the renderer as a networked attacker for local file paths (see `plans/README.md` considered and rejected). It is navigation hygiene.

## Current state

```javascript
const { app, BrowserWindow, Menu, ipcMain, shell, dialog } = require('electron')
// createAboutWindow: webPreferences nodeIntegration false, contextIsolation true, no preload
aboutWindow.loadFile(path.join(__dirname, 'app/about.html'))
```

Main window: `preload: path.join(__dirname, 'preload.js')` (`main.js:122-135`).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| shell used | `grep -n "openExternal" main.js` | match |
| Tests | `npm test` | exit 0 if present |

## Scope

**In scope**:
- `main.js` (navigation handlers on main + about windows)
- `app/about.html` only if you change the link to `target` / `prevent` — prefer handling in main so the URL can stay

**Out of scope**:
- Giving About a preload
- Validating `video:convert` paths
- CSP overhaul
- macOS notarization

## Git workflow

- Branch: `advisor/011-about-open-external`
- Message: `Open the About website link in the default browser.`
- Do not push unless asked.

## Steps

### Step 1: Shared navigation guard

Add `function attachNavigationGuard(win)` that:

- `win.webContents.setWindowOpenHandler` — for `https:` URLs whose host is `github.com` or `www.github.com`, `shell.openExternal(url)` and `{ action: 'deny' }`. Deny everything else.
- `win.webContents.on('will-navigate', (event, url) => { ... })` — allow `file:` URLs under the app directory (the loaded HTML). For `http:`/`https:` same GitHub allowlist: `event.preventDefault(); shell.openExternal(url)`. Prevent all other navigations.

Call it from `createMainWindow` and `createAboutWindow` after creating the window, before or after `loadFile`.

**Verify**: `grep -n "will-navigate" main.js` and `grep -n "openExternal" main.js` → matches

### Step 2: Do not add a preload to About

Keep About without `electronAPI`.

**Verify**: `grep -n "preload" main.js` still only on the main window

## Test plan

- No Spectron. Manual: About → Visit Website opens the system browser, About window stays on `about.html`.

## Done criteria

- [ ] `shell.openExternal` used for the GitHub link
- [ ] In-window navigation away from local HTML is denied
- [ ] About still has no preload
- [ ] `plans/README.md` 011 DONE

## STOP conditions

- `shell.openExternal` requires a privilege check in this Electron major that you cannot satisfy — report rather than `loadURL` in-app.
- You are tempted to allow all https — do not; allowlist GitHub only. If you need another host, STOP and report.

## Maintenance notes

- If the About URL changes, update the allowlist.
- Reviewer: main window must not be able to navigate to https while keeping preload.
