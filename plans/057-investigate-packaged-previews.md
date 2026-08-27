# Plan 057: Investigate packaged `file://` cell previews

> **Executor instructions**: This is an **investigate** plan. Plan 043 shipped
> posters in an **unpackaged** window. Fill `## Investigation result`. Ship a
> fix only if packaged Chromium hides previews. When done, update
> `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat a7bd825..HEAD -- app/js/cell-preview.js main.js app/index.html`
> On excerpt mismatch, STOP.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: MED
- **Depends on**: none (052 must keep `GrantFileProtocolExtraPrivileges` on until this says otherwise)
- **Category**: tests
- **Planned at**: commit `a7bd825`, 2026-08-27

## Why this matters

`showCellPreview` sets `<video src>` to `file://...` (`app/js/cell-preview.js:47-57`). `error` hides the element (`:105-107`). Production loads `app/index.html` via `loadFile` with `webSecurity: true` (`main.js:159-174`). Unpackaged origin is a real filesystem path; packaged origin is inside `app.asar`. Chromium may treat `file://` video URLs as a different origin and fail silently — encode would still work; cells would look empty except the filename. 043 never packaged.

## Current state

- UMD `pathToPreviewSrc` encodes path segments; Windows `C:` preserved (`cell-preview.js:1-25`).
- `bindCellPreview` on error: `videoEl.classList.add('hidden')`.
- CSP in `app/index.html:6`: `script-src 'self' 'unsafe-inline'` only (no `media-src` restriction).
- ffmpeg protocol whitelist is `file,pipe` for **encode**, unrelated to Chromium media.

**Conventions**: do not turn off `webSecurity`. Do not use a live `buildFilterComplex` preview. Short imperative commits. No AI co-author trailers.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 |
| Package this OS | `npm run package-mac` (or win/linux) | app in `release-builds/` |
| Unpackaged control | `npm start` | posters still work (043) |

## Scope

**In scope**:

- This file’s `## Investigation result`
- If packaged previews fail: the **smallest** Chromium-legal fix — typically a `protocol.registerFileProtocol` / `registerFileProtocol` custom scheme registered in `main.js` **or** `webUtils.getPathForFile` already used at drop time plus `protocol.handle` — **not** `webSecurity: false`
- `app/js/cell-preview.js` only if src must become `tessel-media://...`
- Tests for `pathToPreviewSrc` if the URL shape changes

**Out of scope**:

- Disabling fuses `GrantFileProtocolExtraPrivileges` (052 keeps it true)
- JPEG ffmpeg extract (043 rejected it when HTML5 worked unpackaged)
- Making the window resizable
- Signed macOS

## Git workflow

- Branch: `advisor/057-investigate-packaged-previews`
- Message: either `Load cell previews over a privileged custom protocol when packaged.` **or** `Document that packaged cell previews already load file URLs.`
- Do not push unless asked.

## Steps

### Step 1: Packaged smoke

Package this OS. Open the **packaged** app (not `npm start`). Drop one local mp4. Observe:

- Poster visible vs hidden (filename-only).
- DevTools if you can enable them in packager (you may not); otherwise visual only.

Repeat after restore-from-prefs if you have a previous session.

**Verify**: investigation result says packaged posters **work** or **fail**

### Step 2: If they work

No production change. DONE. Note Electron version (44) and OS.

### Step 3: If they fail

Do **not** set `webSecurity: false`. Register a custom scheme in main (privileged, `bypassCSP` only if required, `supportFetchAPI` as needed) that maps to user-chosen paths already in the session. Renderer uses that scheme in `pathToPreviewSrc` when `!isDev` / `app.isPackaged`.

STOP and report if the fix needs a broad `file://` allowlist of the whole disk from the asar origin without going through paths the user already dropped.

Keep encode path unchanged.

**Verify**: packaged drop shows a poster; `npm test` still passes

## Test plan

- Unit tests if URL helper changes (`test/cell-preview.test.js`).
- Manual packaged smoke is the product test (no Playwright).
- Pattern: 043 spike result style (one paragraph).

Verification: `npm test` → exit 0.

## Done criteria

- [x] `## Investigation result` filled (packaged work / fail + OS)
- [x] Either no code change **or** a custom protocol that does not disable `webSecurity`
- [x] Unpackaged posters still work
- [x] `npm test` exits 0
- [x] `plans/README.md` 057 DONE

## STOP conditions

- You would set `webSecurity: false` or `allowRunningInsecureContent`.
- You would `protocol.registerFileProtocol('file', ...)` to intercept all file URLs.
- 052 already turned off `GrantFileProtocolExtraPrivileges` — revert that fuse first or this spike is invalid.

## Investigation result

**Packaged posters work.** Electron **44.0.0**, macOS Darwin 25.5.0 arm64. `npm run package-mac` wrote `release-builds/Tessel-darwin-arm64`; the window origin was `file://…/app.asar/app/index.html` with `webSecurity: true`. Restore-from-prefs of a 1s lavfi `testsrc` MP4 set `<video src=file:///tmp/tessel-057-preview.mp4>`: `readyState` 4, 320×240, `error` null, CSS `display:block`. Filling a second cell through `setSlotOccupied` (same path as a drop after `webUtils.getPathForFile`) with `/Users/james/Downloads/mesa/test-060124-video1.mp4` decoded 1920×1080 and painted a frame. A CDP screenshot showed the color-bar poster plus filename overlay, not filename-only. No production change. Plan 052 is unmerged (fuses at Electron defaults); keep `GrantFileProtocolExtraPrivileges` on — this spike did not prove posters survive if that fuse is flipped.

## Maintenance notes

- Reviewer: encode does not use Chromium; a broken poster is UI-only.
- If 052 is not merged, packaged fuses are defaults; still test asar origin, not fuse state.
