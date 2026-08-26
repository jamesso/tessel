# AGENTS.md — Tessel

Instructions for Cursor / Codex / Copilot and any other AI coding agents.

## Commit bylines — do NOT add agent attribution

Never add AI-agent bylines, co-author trailers, or marketing footers to commit messages. This includes, but is not limited to:

- `Co-authored-by: Cursor <cursoragent@cursor.com>`
- `Co-authored-by: Claude ... <noreply@anthropic.com>`
- `Co-authored-by: Copilot ...`
- `🤖 Generated with [Claude Code]...` and similar "Generated with" lines.

Real human co-authors are fine. A `commit-msg` hook (tracked at `scripts/githooks/commit-msg`, installed to `.git/hooks/commit-msg`) strips those trailers if a tool injects them; do not disable it. Agents must not rely on the hook — write clean messages.

Pass this rule to any sub-agents you spawn.

## How to work in this repo

- **Node**: `>=22.12.0` (see `engines` in `package.json`; `.nvmrc` pins major `22`).
- **Install**: `npm ci` (or `npm install` after clone).
- **Test**: `npm test` (`node --test test/`).
- **Dev**: `npm run dev` (nodemon + unpackaged Electron) or `npm start` (unpackaged Electron once).
- **Packaging**: `npm run package-mac`, `package-win`, or `package-linux` produce distributable binaries in `release-builds/`. These are **not** what `npm start` runs.
- **GitHub Release**: bump `"version"` in `package.json` and **push** to `master` or `main`. CI publishes releases on version bump (see plan 005); PRs do not release.
- **Git hooks**: `npm install` runs `prepare`, which sets `git config core.hooksPath scripts/githooks` (local to the repo). You can also run that `git config` command manually. The `commit-msg` hook requires **`python3`** on your PATH. Do **not** disable or bypass the hook (`--no-verify`, removing `core.hooksPath`, etc.).
