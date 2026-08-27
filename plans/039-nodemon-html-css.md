# Plan 039: Restart Electron on renderer HTML/CSS in `npm run dev`

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat c2b112f..HEAD -- package.json README.md`
> On excerpt mismatch, STOP.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `c2b112f`, 2026-08-26

## Why this matters

`"dev": " nodemon --exec electron ."` has no `nodemon.json`. Nodemon 3.1 default extensions when the exec string has no `.js` file are `js,mjs,cjs,json`. Edits to `app/index.html` and `app/css/*.css` do not restart Electron (README says “restarts on file changes”). Conversely, editing `test/*.js` **does** kill the app. HTML/CSS work looks like a broken dev loop unless you know Developer → Reload (`isDev` menu).

## Current state

```json
// package.json
"dev": " nodemon --exec electron ."
```

No `nodemon.json`. README Development: “Run in development mode (nodemon + Electron; restarts on file changes).”

**Conventions**: keep `nodemon` (do not migrate to electron-vite). Short imperative commits. No AI co-author trailers.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 |
| Config | `node -e "JSON.parse(require('fs').readFileSync('nodemon.json','utf8'))"` | exit 0 |

## Scope

**In scope**:

- `nodemon.json` (create)
- `package.json` `dev` script only if you need `--config` (usually implicit)
- `README.md` one accurate sentence for what restarts

**Out of scope**:

- eslint/prettier
- `test:watch`
- Replacing nodemon with a bundler
- Electron fuses

## Git workflow

- Branch: `advisor/039-nodemon-html-css`
- Message: `Restart the Electron dev process when HTML or CSS changes.`
- Do not push unless asked.

## Steps

### Step 1: `nodemon.json`

```json
{
  "ext": "js,json,html,css",
  "ignore": ["test/**", "plans/**", "release-builds/**", "node_modules/**"]
}
```

Keep watching `main.js`, `preload.js`, `lib/`, `app/`. Ignoring `test/**` stops test edits from relaunching the app.

**Verify**: `node -e "const c=require('./nodemon.json'); if (!c.ext.includes('html') || !c.ext.includes('css')) process.exit(1)"` → exit 0

### Step 2: README

Change the `npm run dev` bullet so it says nodemon restarts on JS/JSON/HTML/CSS and ignores `test/`. Mention Developer → Reload still exists in `isDev`.

**Verify**: `grep -n "nodemon\\|HTML\\|CSS" README.md` → Development section is accurate

### Step 3: Mark the plan

`plans/README.md` row 039 → DONE.

## Test plan

- No unit tests. Optional manual: `npm run dev`, touch `app/css/style.css`, process restarts (do not require this if you cannot open a GUI).

## Done criteria

- [ ] `nodemon.json` includes `html` and `css` and ignores `test/**`
- [ ] README matches
- [ ] `npm test` exits 0
- [ ] No files outside the in-scope list are modified
- [ ] `plans/README.md` 039 DONE

## STOP conditions

- Adding electron-vite / webpack.
- Watching `node_modules` or `release-builds`.

## Maintenance notes

- Reviewer: full process restart on CSS is acceptable; live-reload without restart is out of scope.
