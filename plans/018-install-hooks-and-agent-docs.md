# Plan 018: Install the commit-msg hook on clone and document how to work in the repo

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat b558cb8..HEAD -- package.json AGENTS.md CLAUDE.md scripts/githooks/commit-msg README.md`

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/009-fix-readme-npm-start.md
- **Category**: dx
- **Planned at**: commit `b558cb8`, 2026-08-26

## Why this matters

`AGENTS.md` / `CLAUDE.md` only document “no agent bylines” and point at `scripts/githooks/commit-msg`. That hook’s own comments say **fresh clones do not get `.git/hooks`**. There is no `prepare` script and no `core.hooksPath`. Contributors and executor agents miss Node 22.12, `npm test`, packager vs `npm start`, and that GitHub Releases fire on a version bump **push**. The byline policy is unenforced for new clones.

## Current state

`scripts/githooks/commit-msg` lines 3–5:

```
# Installed copy: .git/hooks/commit-msg (shared by worktrees of this repo).
# Fresh clones do not get .git/hooks; copy this file there, or set core.hooksPath
# to scripts/githooks.
```

Hook requires `python3`. `package.json` has no `prepare`. `AGENTS.md` is 17 lines, `CLAUDE.md` 14 lines.

**Conventions**: Keep the no-bylines rule verbatim. Pass the rule to sub-agents (already stated).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 |
| Hook path | `git config --local --get core.hooksPath` after prepare | `scripts/githooks` |

## Scope

**In scope**:
- `package.json` (`prepare` script)
- `scripts/install-hooks.sh` (optional) or `prepare` inline
- `AGENTS.md`, `CLAUDE.md` (how-to-work section; CLAUDE can point at AGENTS to avoid drift)
- `README.md` one line on hook install if 009 did not include it
- `.nvmrc` or `.node-version` with `22` (optional, recommended)
- `.github/workflows/release.yml` `node-version` may read `.nvmrc` if you add it

**Out of scope**:
- Disabling or rewriting the trailer-strip logic
- Adding ESLint
- `engine-strict` if it breaks CI Node 22.x < 22.12 — if you add `engine-strict=true`, STOP if `npm ci` fails on the runner’s Node 22

## Git workflow

- Branch: `advisor/018-install-hooks-and-agent-docs`
- Message: `Install git hooks on npm install and document repo commands.`
- Do not push unless asked.

## Steps

### Step 1: `prepare` sets hooksPath

Add `"prepare": "git config core.hooksPath scripts/githooks || true"` so non-git installs (packaging) do not fail. Document that `python3` is required for commit-msg.

Do **not** `git config --global`.

**Verify**: `node -e "if(!require('./package.json').scripts.prepare) process.exit(1)"` → exit 0

### Step 2: Agent docs

Add to `AGENTS.md` (and a pointer from `CLAUDE.md`):

- Node `>=22.12.0` (`engines`)
- `npm ci`, `npm test`, `npm run dev`, `npm start` = unpackaged, `package-*` = binaries
- GitHub Release = bump `package.json` version and **push** to `master`/`main` (after plan 005)
- Do not disable the commit-msg hook
- How to install hooks: `npm install` / `prepare` / `git config core.hooksPath scripts/githooks`

Keep the existing bylines section.

**Verify**: `grep -n "npm test" AGENTS.md` → match; `grep -n "22.12" AGENTS.md` → match

### Step 3: Optional `.nvmrc`

Write `22` or `22.12`. If you add it, set CI `node-version-file: '.nvmrc'`.

**Verify**: file exists if you chose to add it

## Test plan

- `npm test` still passes.
- In a fresh clone mental model: `npm install` sets hooksPath.

## Done criteria

- [ ] `prepare` script exists
- [ ] `AGENTS.md` lists test/dev/package and Node pin
- [ ] Bylines rule still present
- [ ] `plans/README.md` 018 DONE

## STOP conditions

- `prepare` running `git config` fails in GitHub Actions checkout — use `|| true` or `test -d .git && git config ...`.
- Operator forbids mutating local git config via npm — then document a manual README command only and skip `prepare`.

## Maintenance notes

- Reviewer: never `git config --global`.
- `CLAUDE.md` should not diverge; one canonical how-to in AGENTS is enough.
