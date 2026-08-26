# Plan 013: Show About version from `app.getVersion()`

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat b558cb8..HEAD -- app/about.html main.js preload.js package.json`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `b558cb8`, 2026-08-26

## Why this matters

About hardcodes `1.4.0` (`app/about.html:30`). CI tags `v${package.json version}` (`release.yml`). The next bump ships a Release whose in-app About still says 1.4.0 unless HTML is edited. `createAboutWindow` has no preload (`main.js:146-159`).

## Current state

```html
<li class="about-item"><span>Version</span> 1.4.0</li>
```

`package.json` `"version": "1.4.0"`. Electron `app.getVersion()` reads the package version in unpackaged and packaged builds.

**Conventions**: Main window uses `preload.js` + `contextBridge.exposeInMainWorld('electronAPI', …)`. About should get a **minimal** dedicated preload, not the convert API.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| No hardcoded 1.4.0 | `grep -n "1.4.0" app/about.html` | no matches |
| Tests | `npm test` | exit 0 if present |

## Scope

**In scope**:
- `app/about.html` (placeholder element for version)
- `main.js` (`createAboutWindow` webPreferences.preload)
- `preload-about.js` (create) — expose **only** `getVersion: () => ipcRenderer.invoke('app:getVersion')` or `app.getVersion()` via a tiny ipc handle
- `preload.js` — do **not** add convert APIs to About

**Out of scope**:
- Logo SVG dedup
- Opening GitHub (plan 011)
- Bundling / webpack

## Git workflow

- Branch: `advisor/013-about-version-from-app`
- Message: `Read the About page version from app.getVersion().`
- Do not push unless asked.

## Steps

### Step 1: IPC + about preload

In `main.js` `setupIPC`:

```javascript
ipcMain.handle('app:getVersion', () => app.getVersion())
```

Create `preload-about.js`:

```javascript
const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('tesselAbout', {
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
})
```

`createAboutWindow`: `preload: path.join(__dirname, 'preload-about.js')`, keep `nodeIntegration: false`, `contextIsolation: true`. Do **not** copy `enableRemoteModule` (dead). Do not use main `preload.js`.

**Verify**: `grep -n "preload-about" main.js` → match

### Step 2: About HTML

Replace the literal version with `<span id="app-version"></span>`. Add `app/js/about.js`:

```javascript
document.addEventListener('DOMContentLoaded', async () => {
  const el = document.getElementById('app-version')
  if (!el || !window.tesselAbout) return
  el.textContent = await window.tesselAbout.getVersion()
})
```

`<script src="js/about.js"></script>` at end of `about.html`. CSP is `script-src 'self' 'unsafe-inline'` — external script is `'self'`. Do not add inline JS.

**Verify**: `grep -n "1.4.0" app/about.html` → no matches

## Test plan

- Manual: `npm start`, About shows the same version as `package.json`.
- Do not add Playwright.

## Done criteria

- [ ] About HTML has no hardcoded version string
- [ ] About preload cannot `send('video:convert')`
- [ ] `plans/README.md` 013 DONE

## STOP conditions

- You would have to enable `nodeIntegration` on About — stop; use preload + invoke.

## Maintenance notes

- Version bumps only need `package.json` after this.
- Reviewer: About preload surface is getVersion only.
