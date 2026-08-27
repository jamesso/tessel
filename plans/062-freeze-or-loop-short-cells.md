# Plan 062: Spike freeze or loop for short cells instead of black `tpad`

> **Executor instructions**: This is a **spike-then-maybe-ship** direction plan.
> Default remains **black pad to encode duration** (041). Fill
> `## Spike result`. If A/V sync breaks, do **not** ship. When done, update
> `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat a7bd825..HEAD -- lib/mosaic.js test/mosaic.test.js app/index.html`
> On excerpt mismatch, STOP.
> Do **not** parallel 044 or 049 (same `buildFilterComplex`).

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED
- **Depends on**: none (041 duration cap already shipped)
- **Category**: direction
- **Planned at**: commit `a7bd825`, 2026-08-27

## Why this matters

Shorter clips use `tpad=stop_mode=add:stop_duration=…:color=black` (`lib/mosaic.js:169-177`). Empty cells are already canvas black (036). The remaining encode-policy knob next to 021/041 is what happens **inside an occupied cell** after the clip ends: black, freeze last frame (`tpad` `stop_mode=clone`), or loop (`loop` filter). Users making a 3×3 of mixed lengths often want freeze, not a black flash. Audio is first-occupied + `apad` + `-t` (021); a video loop that outlives audio (or the reverse) is the failure mode.

## Current state

```javascript
if (paddingDuration > 0.1) {
    complexFilter.push({
        filter: 'tpad',
        options: `stop_mode=add:stop_duration=${paddingDuration}:color=black`,
        inputs: 'scaled' + index,
        outputs: 'block' + index,
    });
} else {
    complexFilter.push({
        filter: 'copy',
        inputs: 'scaled' + index,
        outputs: 'block' + index,
    });
}
```

Footer Duration is longest vs 5/15/30/60 seconds (`app/index.html:122-130`), not pad mode. Goldens in `test/mosaic.test.js` assert `tpad` / `stop_duration`.

**Conventions**: invalid policy → black tpad (today). 25 fps frozen (021). Short imperative commits. No AI co-author trailers.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 |
| Spike encode | bundled ffmpeg + two lavfi clips (2s + 5s), current graph vs clone vs loop | record durations / A-V in spike table |

## Scope

**In scope**:

- Spike notes in this file
- If shipping **one** extra pad mode: `lib/mosaic.js` tpad/loop branch, IPC field, one footer control, goldens, prefs allowlist (054 if present)
- Default path **unchanged** (black `stop_mode=add`)

**Out of scope**:

- Mix-all audio
- Per-cell pad mode (one global policy only)
- 60 fps / 4×4
- Changing 041 second caps

## Git workflow

- Branch: `advisor/062-freeze-or-loop-short-cells`
- Message: either `Add freeze-frame padding for short mosaic cells.` **or** `Document that freeze/loop padding desyncs audio; keep black tpad.`
- Do not push unless asked.

## Steps

### Step 1: Spike three graphs

Same two clips (short + long), encode duration = long (or 041 cap). Audio `first` from the **short** clip (worst case) and from the **long** clip.

| Mode | Filter idea | Video | Audio vs video | ffmpeg exit |
|------|-------------|-------|----------------|-------------|
| black (today) | `tpad stop_mode=add color=black` | | | |
| freeze | `tpad stop_mode=clone` (confirm FFmpeg 6 option name with `-h filter=tpad`) | | | |
| loop | `loop=loop=-1:size=…` or `tpad` clone + other | | | |

Use `ffprobe` on output: duration, audio duration. Watch for freeze that does not fill `-t`, or loop that drifts PTS.

Pick **at most one** extra mode that stays aligned with `apad` + `-t`. If none do, **do not ship**; DONE with result.

**Verify**: spike table filled; `ffmpeg -h filter=tpad` quoted for `stop_mode` values

### Step 2: If shipping

Allowlist e.g. `padMode: 'black' | 'freeze'` (names from spike). Default `'black'`. Prefs + HTML select next to Duration (window still 450×600).

Goldens: default tests still match `stop_mode=add` and `color=black`. New test: freeze has `clone` (or the exact option you used) and no `color=black` on that tpad.

**Verify**: `node --test test/mosaic.test.js test/output-settings.test.js` → exit 0

## Test plan

- Default black tpad unchanged.
- New mode golden.
- Optional integration lavfi if freeze is shipped.
- Pattern: `test/mosaic.test.js` unequal durations test.

Verification: `npm test` → exit 0.

## Done criteria

- [ ] `## Spike result` filled
- [ ] Either one extra pad mode shipped with tests **or** explicit no-ship
- [ ] Default still black pad-to-encode-duration
- [ ] `npm test` exits 0
- [ ] `plans/README.md` 062 DONE

## STOP conditions

- You would change the default to freeze.
- Loop requires `amix` or audio `aloop` you cannot keep in sync — no-ship.
- Parallel with 049 and you cannot tell whose filter string is whose — wait.

## Spike result

_(executor fills)_

## Maintenance notes

- Reviewer: 3×3 leftover column and xstack must stay; only the per-cell tail after `scaledN` changes.
- Cover-art duration (056) can make “short” cells wrongly tiny; freeze would then freeze a near-empty clip — not this plan’s fix.
