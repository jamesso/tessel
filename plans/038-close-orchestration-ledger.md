# Plan 038: Close the stale 001–026 orchestration ledger

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat c2b112f..HEAD -- plans/ORCHESTRATION.md plans/README.md`
> On excerpt mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs
- **Planned at**: commit `c2b112f`, 2026-08-26

## Why this matters

`plans/ORCHESTRATION.md` still says plan 001 is IN PROGRESS and 002–026 are TODO, with an empty merge log. `plans/README.md` marks 001–026 **DONE**. A later agent that trusts the ledger will re-dispatch finished work. Stale operational docs are worse than missing ones.

## Current state

```markdown
# plans/ORCHESTRATION.md:21-26
| Plan | Status | Worktree | Session | Branch | Notes |
| 001 | IN PROGRESS | | | | Wave 0 |
| 002–026 | TODO | | | | |
```

Nothing in `README.md` / `AGENTS.md` points at `ORCHESTRATION.md`.

**Conventions**: `plans/README.md` is the status source of truth. Short imperative commits. No AI co-author trailers.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 |
| Ledger | `grep -n "IN PROGRESS\\|002–026 | TODO" plans/ORCHESTRATION.md` | no live TODO/IN PROGRESS for 001–026 (or file deleted) |

## Scope

**In scope**:

- `plans/ORCHESTRATION.md` (rewrite banner + status, or delete)

**Out of scope**:

- Changing 001–026 plan bodies
- Re-running old waves
- Signed macOS (`plans/DEFERRED.md`)

## Git workflow

- Branch: `advisor/038-close-orchestration-ledger`
- Message: `Mark the 001–026 orchestration ledger as completed.`
- Do not push unless asked.

## Steps

### Step 1: Rewrite or delete

**Preferred:** keep the file as history. Put this at the top:

```markdown
# Historical — waves 0–5 complete

**Do not dispatch these plans.** Status lives in `plans/README.md`.
Plans 001–026 are DONE. This ledger is not the execution queue.
```

Set the status table to 001–026 DONE (or a single row “001–026 DONE”). Do not leave IN PROGRESS/TODO.

**Alternative:** delete `plans/ORCHESTRATION.md` if you prefer less docs. Then add one line under `plans/README.md` “How executors should work” that the old Jean wave ledger was removed.

**Verify**: `grep -n "IN PROGRESS" plans/ORCHESTRATION.md` → no matches (or file gone)

### Step 2: Mark the plan

`plans/README.md` row 038 → DONE.

## Test plan

- Docs only. `npm test` unchanged.

## Done criteria

- [ ] `ORCHESTRATION.md` cannot be read as an active TODO queue for 001–026
- [ ] `npm test` exits 0
- [ ] No files outside the in-scope list are modified (README status row 038 is in scope for the index update)
- [ ] `plans/README.md` 038 DONE

## STOP conditions

- Re-opening 001–026 as TODO “to be safe.”

## Maintenance notes

- Reviewer: `plans/README.md` remains the only queue for 027+.
