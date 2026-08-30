# Plan 068: Open About from a Help menu on Windows and Linux

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat f14caf4..HEAD -- main.js test/convert-session.test.js app/about.html`
> Compare excerpts against live code; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `f14caf4`, 2026-08-27

## Why this matters

`createAboutWindow` and `app/about.html` show `app.getVersion()` (013). The only menu item that opens it is the macOS app-menu **About**. Packaged Windows and Linux replace the default menu with File (+ Developer in unpackaged). Those users cannot see the version or the GitHub link without reading the release page.

## Current state

`main.js`:

```javascript
const menu = [
    ...(isMac 
        ? [
            { 
                label: app.name,
                submenu: [
                    {
                        label: 'About',
                        click: createAboutWindow,
                    },
                ],
            },
        ]
    : []),
    {
        label: 'File',
        submenu: [
            // Export / Import / close-or-quit
        ],
    },
    ...(isDev ? [ { label: 'Developer', submenu: [ /* reload */ ] } ] : []),
]
```

`createAboutWindow` does not reuse an existing window if About is already open (optional polish: show existing if not destroyed).

**Conventions**: Electron Menu template. About window already has navigation guard + `preload-about.js`. Grep tests in `test/convert-session.test.js` / add a small `test/` grep for Help/About. Short imperative commits. No AI co-author trailers.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 |

## Scope

**In scope**:

- `main.js` — on non-Mac, add a **Help** menu with **About Tessel** (wording flexible) that calls `createAboutWindow`. Keep the macOS app-menu About (do not duplicate About on Mac Help unless you use `role: 'about'` incorrectly — **do not** replace the Mac About with a Help-only item).
- A source test that Help+About exists in `main.js` for the non-Mac branch (grep `Help` and `createAboutWindow` outside the `isMac` spread, or grep that `createAboutWindow` appears twice / Help submenu exists).

**Out of scope**:

- Signed macOS (`plans/DEFERRED.md`)
- FFmpeg NOTICE inside the About page (069)
- Changing About size, GitHub URL, or `webSecurity`

## Git workflow

- Branch: `advisor/068-about-windows-linux`
- Message: `Show About from a Help menu on Windows and Linux.`
- Do not push unless asked.

## Steps

### Step 1: Menu

After the File menu (before Developer), if `!isMac`, append:

```javascript
{
    label: 'Help',
    submenu: [
        { label: 'About Tessel', click: createAboutWindow },
    ],
}
```

Keep Mac About where it is.

Optional: if `aboutWindow` exists and is not destroyed, `show()` / `focus()` instead of creating a second window.

**Verify**: `grep -n "Help\\|About Tessel\\|createAboutWindow" main.js`

### Step 2: Test

Grep: `main.js` contains `label: 'Help'` and `createAboutWindow`. Pattern: `test/prefs.test.js` File menu greps.

**Verify**: `npm test` → exit 0

## Test plan

- Source grep only. No Spectron.

## Done criteria

- [ ] Windows/Linux menu template includes Help → About opening `createAboutWindow`
- [ ] macOS still has About on the app menu
- [ ] `npm test` exits 0
- [ ] No files outside the in-scope list are modified
- [ ] `plans/README.md` 068 DONE

## STOP conditions

- Excerpts drifted.
- You would remove the Mac About item.
- You would enable `nodeIntegration` on the About window.

## Maintenance notes

- Reviewer: unpackaged `isDev` Developer menu stays last.
- Linux may show “Help” in the bar; that is intended.
