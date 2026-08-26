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
