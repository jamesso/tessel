# Plan 009: Fix README so `npm start` is not described as a production build

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat b558cb8..HEAD -- README.md package.json`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs
- **Planned at**: commit `b558cb8`, 2026-08-26

## Why this matters

README Setup says “Build for production” then `npm start`. `package.json` `"start"` is `electron .` (unpackaged). `"dev"` is nodemon wrapping the same. Real artifacts are `package-mac` / `package-win` / `package-linux`. Following the README launches an `isDev` session (DevTools, Desktop debug log until plan 011). GitHub Releases are created by CI when `package.json` version changes (plan 005) — local `package-*` only writes gitignored `release-builds/`.

## Current state

```markdown
# Run in development mode
npm run dev

# Build for production
npm start
```

(`README.md:108-112`.) Building Releases section already lists `package-*` (`README.md:115-126`). Project tree omits `scripts/`, `.github/`, `CLAUDE.md` (`README.md:128-141`).

`package.json`: `"start": "electron ."`, `"dev": " nodemon --exec electron ."`.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| No false production | `grep -n "Build for production" README.md` | no matches, or the line no longer pairs with `npm start` |

## Scope

**In scope**: `README.md` only

**Out of scope**: Changing `package.json` scripts (do not rename `start` unless you also fix all docs; prefer documentation). Agent docs (plan 018). Desktop log (plan 011). Hook install details beyond one tree line (plan 018).

## Git workflow

- Branch: `advisor/009-fix-readme-npm-start`
- Message: `Document unpackaged start versus packager releases.`
- Do not push unless asked.

## Steps

### Step 1: Rewrite Setup commands

Replace the Setup code block so that:

- `npm run dev` — development (nodemon + Electron)
- `npm start` — run unpackaged Electron once (not a production build)
- Point “production / distributable” at `npm run package-mac` / `package-win` / `package-linux` and the Building Releases heading

**Verify**: `grep -n "npm start" README.md` is not under a “production build” heading

### Step 2: Cutting a GitHub Release

Add a short subsection: bump `"version"` in `package.json` (and About until plan 013), push to `master`/`main`; CI publishes GitHub Release assets. Local `package-*` = unsigned binaries in `release-builds/` only. After plan 005, releases are **push** not PR.

**Verify**: `grep -n "package.json" README.md` near a Release sentence

### Step 3: Project tree

Add `scripts/githooks/` (commit-msg hook) and optionally `.github/workflows/`. Describe `assets/` as icons, logos, screenshots — not “icons” only.

**Verify**: `grep -n "scripts/" README.md` → match

## Test plan

- Docs only. Read the Setup section once as a new contributor.

## Done criteria

- [ ] README does not call `npm start` a production build
- [ ] Packager scripts remain the documented way to build binaries
- [ ] Version-bump → GitHub Release is mentioned
- [ ] `plans/README.md` 009 DONE

## STOP conditions

- `package.json` `start` script is no longer `electron .` — update text to match reality, do not invent scripts.

## Maintenance notes

- Plan 018 will duplicate some of this into `AGENTS.md`; keep README as the human source.
- Reviewer: Electron version line `README.md:85` still 39.x until plan 017.
