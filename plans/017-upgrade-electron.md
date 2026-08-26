# Plan 017: Upgrade Electron from EOL 39 to a supported major

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat b558cb8..HEAD -- package.json package-lock.json main.js README.md .github/workflows/release.yml`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/001-add-node-test-runner.md
- **Category**: migration
- **Planned at**: commit `b558cb8`, 2026-08-26

## Why this matters

`electron` is `^39.8.10`. Electron 39 reached end-of-support on **2026-05-05**; 39.8.10 is the last 39.x. The desktop app ships that Chromium line with no further security backports. `npm audit` reports 2 **high** issues on `electron` → `extract-zip` (symlink path traversal). That advisory is on Electron’s **install-time** unzip of its own official zip, not a Tessel upload sink — still, the supported fix is upgrading Electron. Do **not** treat extract-zip as a Tessel runtime vulnerability (see `plans/README.md` considered and rejected).

Target a **currently supported** major. As of 2026-08-26, 44.x is current; 42.x EOL is 2026-10-20. Prefer `electron@^44.0.0` unless 44 requires OS versions this project cannot ship (Electron 44 dropped macOS 12). If the operator must support macOS 12, STOP and report rather than silently staying on 39.

## Current state

```json
"devDependencies": {
  "electron": "^39.8.10",
  "@electron/packager": "^20.0.4",
  "nodemon": "^3.1.14"
}
```

`main.js:132` `enableRemoteModule: false` (no-op since Electron 14). `webUtils.getPathForFile` in `preload.js:39-41`. `contextIsolation: true`, `nodeIntegration: false`. README Technical Details: “Built with: Electron 39.8.10”. CI `node-version: '22'`. `engines.node`: `>=22.12.0` (packager).

App Electron APIs: `BrowserWindow`, `Menu`, `ipcMain`, `dialog`, `shell`, `app`. Renderer: `window.electronAPI` only.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Bump | `npm install --save-dev electron@^44.0.0` | lockfile updated, `npm ls electron` shows 44.x |
| Tests | `npm test` | exit 0 |
| Audit | `npm audit` | extract-zip/electron highs gone or only unrelated |

## Scope

**In scope**:
- `package.json` / `package-lock.json`
- `main.js` (delete `enableRemoteModule`; fix API breaks)
- `preload.js` only if `webUtils.getPathForFile` moved
- `README.md` Electron version string
- `.github/workflows/release.yml` if 42+ no longer downloads the Electron binary at `npm ci` — add a step that ensures the binary exists before packager (`npx electron --version` or documented install script)

**Out of scope**:
- ffmpeg installer migration (plan 026)
- asar (plan 016) — can be combined only if 016 already landed
- Feature work

## Git workflow

- Branch: `advisor/017-upgrade-electron`
- Message: `Upgrade Electron from 39 to a supported 44.x release.`
- Do not push unless asked.

## Steps

### Step 1: Install Electron 44

`npm install --save-dev electron@^44.0.0`. If peer/engine conflicts with `@electron/packager` 20, upgrade packager within v20 first (`npm install --save-dev @electron/packager@^20`). Do not jump packager majors unless required.

**Verify**: `node -e "const v=require('./package.json').devDependencies.electron; if(!String(v).includes('44')) process.exit(1)"` → exit 0

### Step 2: Code adjustments

- Remove `enableRemoteModule` from `webPreferences`.
- Run `npm start` long enough to open the window (DevTools in unpackaged). Confirm dropzones render.
- If `webUtils.getPathForFile` throws, stop and report (do not re-enable `file.path`).

**Verify**: `grep -n "enableRemoteModule" main.js` → no matches

### Step 3: CI Electron binary

If packager fails on CI with a missing electron zip, add after `npm ci`:

```yaml
- name: Ensure Electron binary
  run: npx electron --version
```

Keep Node 22 for the runner (packager engines). Electron 44 embeds Node 24 in the **app** runtime; that is expected.

**Verify**: workflow still `npm ci` then package

### Step 4: README

Update “Built with: Electron …” to the resolved 44.x version.

**Verify**: `grep -n "Electron 39" README.md` → no matches

### Step 5: Tests

`npm test`. Smoke convert if ffmpeg still works under the new Electron (it should; ffmpeg is a separate binary).

**Verify**: `npm test` → exit 0

## Test plan

- Unit tests unchanged.
- Manual: open app, 2×2 convert of two tiny clips if available.
- `npm audit` for remaining electron highs.

## Done criteria

- [ ] `devDependencies.electron` is 44.x (or the supported major you STOP-documented)
- [ ] `enableRemoteModule` gone
- [ ] README version string matches
- [ ] `npm test` exits 0
- [ ] `plans/README.md` 017 DONE

## STOP conditions

- Electron 44 requires macOS newer than the project intends to support — report; do not ship 39 as “done.”
- `contextIsolation` / `webUtils` API removed or renamed — report.
- Packager 20 cannot package Electron 44 — report before inventing electron-forge.

## Maintenance notes

- Dependabot will keep nagging majors; consider plan 018-adjacent dependabot.yml only if you add it in 018.
- Reviewer: this does not fix extract-zip as a Tessel feature; it just moves off EOL Electron.
