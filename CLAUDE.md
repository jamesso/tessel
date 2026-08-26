# CLAUDE.md — Tessel

Guidance for Claude/AI agents working in this repo.

Pass every rule in this file to any subagent you spawn.

## No agent bylines

Never add AI-agent bylines / co-author trailers / "Generated with" footers (Cursor, Claude, Copilot, Codex, etc.) to commit messages. Real human co-authors are fine.

A `commit-msg` hook in `.git/hooks` (source: `scripts/githooks/commit-msg`) strips those trailers if a tool injects them anyway. Do not disable or bypass that hook.

`AGENTS.md` carries the same rule for Cursor/Codex.
