# Plan 049: One `-i` per unique path, then `split` for repeated cells

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat a7bd825..HEAD -- lib/mosaic.js test/mosaic.test.js test/output-settings.test.js test/ffmpeg-integration.test.js`
> Compare excerpts against live code; on a mismatch, treat it as a STOP condition.
> Do **not** start until plan 044 is DONE (N=1 overlay vs xstack). Do **not** parallel 062 (same file).

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/044-xstack-single-cell.md
- **Category**: perf
- **Planned at**: commit `a7bd825`, 2026-08-27

## Why this matters

Probes already unique paths (`lib/ffmpeg-session.js` `uniquePaths`). Encode still opens one `-i` per occupied slot (`buildVideoInfo` increments `inputIndex` per filled cell; `buildFfmpegArgs` maps every non-black `filename`). After swap (042), dropping the same file into several cells is easy; `test/ffmpeg-session.test.js` already fills 3×3 with nine copies of `/a.mp4` and only asserts **one probe**. Nine demux/scale chains of the same clip is wasted CPU. README-empty-slot black is unchanged (036): this is about duplicate **paths**, not empty cells.

## Current state

`lib/mosaic.js` `buildVideoInfo` (`:65-82`):

```javascript
slotPaths.forEach(function (val) {
    if (val) {
        videoInfo.push({
            filename: val,
            inputIndex: inputIndex,
            isBlack: false,
            duration: videoDurations[val] || longestDuration,
        });
        inputIndex++;
    } else {
        videoInfo.push({
            filename: null,
            inputIndex: -1,
            isBlack: true,
            duration: longestDuration,
        });
    }
});
```

`buildFilterComplex` per occupied cell (`:132-137`): `setpts` with `inputs: val.inputIndex + ':v'` → `reset${index}`, then scale/pad-or-crop, then tpad/copy → `block${index}`. Compose is xstack (N≥2) or overlay (N=1 after 044).

`buildFfmpegArgs` (`:237-241`): `-i` first occupied filename, then `-i` for every remaining non-black slot (duplicates included). Audio `first` maps `${firstReal.inputIndex}:a?`.

Nine distinct paths must still produce nine `-i`s and **no** `split`.

**Conventions**: goldens in `test/mosaic.test.js`. `filterEntryToString` only supports a single `outputs` string — for `split=N` use a **raw filter string**. Integration: `test/ffmpeg-integration.test.js`. Short imperative commits. No AI co-author trailers.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 |
| Mosaic | `node --test test/mosaic.test.js test/output-settings.test.js test/ffmpeg-integration.test.js` | exit 0 |

## Scope

**In scope**:

- `lib/mosaic.js` `buildVideoInfo`, `buildFilterComplex` setpts stage, `buildFfmpegArgs` `-i` list
- `test/mosaic.test.js` (unique vs duplicate path goldens; keep 3×3 nine-file xstack)
- `test/output-settings.test.js` if `-i` count / `0:a?` goldens break
- `test/ffmpeg-integration.test.js` — optional one encode with the **same** lavfi file in two slots

**Out of scope**:

- Changing xstack vs N=1 overlay (044)
- Freeze/loop tpad (062)
- Copy-drag (060)
- Hardware encode
- Unique-ing by inode/symlink (string path equality only, same as probes)

## Git workflow

- Branch: `advisor/049-unique-inputs-split`
- Message: `Open each mosaic file once and split streams for repeated cells.`
- Do not push unless asked.

## Steps

### Step 1: Unique `inputIndex` in `buildVideoInfo`

Assign `inputIndex` as the first-seen index among occupied paths (string equality). Empty slots stay `inputIndex: -1`, `isBlack: true`.

Example: slots `['/a.mp4', '/b.mp4', '/a.mp4', null]` → indices `0, 1, 0, -1`.

**Verify**: `node -e "const m=require('./lib/mosaic'); const vi=m.buildVideoInfo(['/a.mp4','/b.mp4','/a.mp4',null],{'/a.mp4':10,'/b.mp4':10},10); if(vi[0].inputIndex!==0||vi[1].inputIndex!==1||vi[2].inputIndex!==0||vi[3].inputIndex!==-1) process.exit(1)"` → exit 0

### Step 2: `setpts` once per unique input; `split` when reused

Group occupied cells by `inputIndex`.

- **One cell** for that input: keep today’s object `{ filter: 'setpts', options: 'PTS-STARTPTS', inputs: inputIndex + ':v', outputs: 'reset' + slotIndex }`.
- **Two or more cells**: one raw chain, then the existing per-slot scale/pad/tpad from `reset${slotIndex}`:

```
[0:v]setpts=PTS-STARTPTS,split=2[reset0][reset2]
```

(order of `reset*` labels = occupied slots with that `inputIndex`, slot order).

Do **not** split after scale: 3×3 last column is a different width (015).

N=1 occupied cell: no `split`, no `xstack` (044).

**Verify**: `node --test test/mosaic.test.js` will fail until goldens in step 3; the nine-distinct-path graph must still have **no** `split=`

### Step 3: Unique `-i` list in `buildFfmpegArgs`

Build `-i` in first-seen occupied path order (same order as `inputIndex` 0..k-1). Do not emit a second `-i` for a repeated `filename`.

Audio `first` still uses `firstReal.inputIndex` (first occupied slot). After uniquing, that is the unique input for that path — still `0` when slot 0 is filled.

**Verify**: count of `args` entries equal to `-i` is 1 for nine copies of `/a.mp4`; is 9 for `ninePaths` in `test/mosaic.test.js`

### Step 4: Goldens and optional ffmpeg smoke

In `test/mosaic.test.js`:

1. **Nine copies** of `/a.mp4`: `args.filter(a => a === '-i').length === 1`; `filterComplex` matches `/split=9/`; still `xstack=inputs=9`.
2. **Two occupied, same path** 2×2 (slots 0 and 3): one `-i`, `split=2`, `xstack=inputs=2` (or overlay if you only occupy one — use two).
3. Existing **nine distinct** `ninePaths` test: **no** `split=`; nine `-i`; `xstack=inputs=9` unchanged.
4. Existing sparse one-cell: no `split=`; one `-i` (044: no xstack).

If you add integration: two cells, same short lavfi mp4, `spawnSync` status 0.

Keep `0:a?` test in `test/output-settings.test.js`.

**Verify**: `node --test test/mosaic.test.js test/output-settings.test.js test/ffmpeg-integration.test.js` → exit 0

## Test plan

- Duplicate path: one `-i`, `split=N`, N cell chains, compose unchanged.
- Distinct paths: no `split`, N `-i`s.
- Audio first still `0:a?` when the first occupied slot is unique-input 0.
- Pattern: `test/mosaic.test.js` 3×3 xstack test.

Verification: `npm test` → exit 0.

## Done criteria

- [ ] `npm test` exits 0
- [ ] Nine copies of one path → one `-i` and `split=9`
- [ ] Nine distinct paths → nine `-i` and no `split=`
- [ ] N=1 graph still has no `xstack` (044)
- [ ] No files outside the in-scope list are modified
- [ ] `plans/README.md` status row for 049 set to DONE

## STOP conditions

- Plan 044 not DONE (N=1 still uses `xstack=inputs=1`).
- Bundled ffmpeg rejects `setpts,split=N` in one chain — then use two filters (`setpts` → `uniqN`, then `split`) rather than inventing a dummy second `-i`.
- You would unique by basename only (different folders must stay different inputs).
- Pixel sizes / leftover 428px column would change.

## Maintenance notes

- Reviewer: `-map 0:a?` is first **occupied slot’s** unique input, not “first unique path in a set iteration if slot 0 is empty.”
- Plan 060 copy-drag will make same-path 3×3 common; this plan is the CPU budget for that.
- Plan 062 may replace tpad; keep split **before** per-cell pad/tpad.
