# Plan 033: Probe each unique clip once, with a small concurrency cap

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat c2b112f..HEAD -- main.js lib/ffmpeg-session.js lib/mosaic.js test/ffmpeg-session.test.js`
> If `lib/ffmpeg-session.js` exists (plan 027), edit **that** `processDurations` loop, not a copy in `main.js`. If 029 job ids exist, honor `myId === currentJobId` / `killedByUs` inside the pool. On excerpt mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/027-characterize-ffmpeg-session.md (prefer; if 027 is not merged, edit `processDurations` in `main.js`)
- **Category**: perf
- **Planned at**: commit `c2b112f`, 2026-08-26

## Why this matters

Duration probe is `for (const videoPath of allVideoPaths) { await getVideoDurationWithFFmpeg(videoPath) }`. Occupied slots are not uniqued, so the same file in three cells is three ffmpeg startups. Paths are also not passed through `selectSlotPaths` first, so a 2×2 grid still probes leftover `vidPath5–9` if they were somehow set (switchGrid usually clears them). Nine distinct 3×3 files wait in a waterfall before libx264 starts. Probe unique selected paths with a cap of **3** concurrent `spawn`s. Keep header-only argv (no `-f null`).

## Current state

```javascript
// main.js:357-397 (027 moves this into the session)
const allVideoPaths = [vidPath1, vidPath2, /* ... */ vidPath9].filter(path => path);
// ...
for (const videoPath of allVideoPaths) {
    durations[videoPath] = await getVideoDurationWithFFmpeg(videoPath)
    done++
    sendToRenderer('video:progress', {
        percent: Math.round((done / total) * 10),
        phase: `Analyzing ${done}/${total}`,
    })
}
```

`selectSlotPaths` is only used later in `startConversion`. `getVideoDurationWithFFmpeg` already adds children to `liveProbeProcesses`; `killActiveFfmpeg` kills the whole Set.

**Conventions**: `lib/mosaic.js` `selectSlotPaths(originalPaths, gridType)`. Job mutex stays one encode at a time (plan 004). Short imperative commits. No AI co-author trailers.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 |
| Session tests | `node --test test/ffmpeg-session.test.js` | exit 0 if 027 exists |

No lint/typecheck script.

## Scope

**In scope**:

- `processDurations` in `lib/ffmpeg-session.js` or `main.js`
- `test/ffmpeg-session.test.js` if present (assert spawn count)
- Optional `lib/probe-paths.js` with `uniqueSelectedPaths(originalPaths, gridType)` plus `test/probe-paths.test.js`

**Out of scope**:

- Parallel **encodes** (004 mutex stays)
- Dropping probes / xstack `duration=longest` (changes pad-to-black look)
- `-f null` / decoding the whole file
- Memoizing durations across converts by mtime (optional later)
- Changing overlay/xstack (036/037)

## Git workflow

- Branch: `advisor/033-parallel-unique-probes`
- Message: `Probe unique mosaic clips concurrently instead of one at a time.`
- Do not push unless asked.

## Steps

### Step 1: Unique selected paths

Build `originalPaths` as the nine-slot array (unchanged). Then:

```javascript
const slotPaths = selectSlotPaths(originalPaths, gridType)
const uniquePaths = [...new Set(slotPaths.filter(Boolean))]
```

If `uniquePaths.length === 0`, keep today’s `'No videos provided'` behavior (that check may already run earlier).

Probe **only** `uniquePaths`. `videoDurations[path]` still keys the map so two slots sharing a file share one duration.

**Verify**: a unit test or session test: nine slots all `/a.mp4` → `getVideoDuration` / fake spawn probe count is **1**, not 9

### Step 2: Concurrency cap 3

Implement a pool (simple loop with `Promise` workers, or chunks of 3). Cap **must** be 3 (not unbounded `Promise.all` of 9). Each worker calls existing `getVideoDurationWithFFmpeg`. After each successful probe, increment `done` and send `video:progress` `{ percent: Math.round((done / uniquePaths.length) * 10), phase: \`Analyzing ${done}/${uniquePaths.length}\` }`.

If 029 is present: before each probe and after each await, if `killedByUs` or `myId !== currentJobId`, stop scheduling and do not call `startConversion`.

Cancel must still kill every member of `liveProbeProcesses` (already true).

**Verify**: session test with 4 unique paths and fake probes that do not finish until you emit Duration: at most 3 probe spawns exist at once (track `live` count in fake `spawn`)

### Step 3: Keep header-only argv

Do not add `-f`, `null`, or `-`. Probe args stay `-nostdin` … `-i` `videoPath` (plus 030 whitelist if already present).

**Verify**: `grep -n "f', 'null\\|'-f', \"null\"" lib/ffmpeg-session.js main.js` → no matches on the probe helper

### Step 4: Mark the plan

`plans/README.md` row 033 → DONE.

## Test plan

- Unique path → one probe (step 1).
- Four paths → never more than 3 concurrent probe spawns (step 2).
- Pattern: `test/ffmpeg-session.test.js` fakes from 027. If 027 is missing, add `test/probe-paths.test.js` for uniquing only and grep the pool cap `3` in source — then still implement the pool.

## Done criteria

- [ ] Probes use `selectSlotPaths` then unique strings
- [ ] Concurrent probes ≤ 3
- [ ] Duplicate slot paths spawn one probe
- [ ] `npm test` exits 0
- [ ] No files outside the in-scope list are modified
- [ ] `plans/README.md` 033 DONE

## STOP conditions

- You would `Promise.all` nine probes with no cap.
- You would skip probes by using xstack `duration=longest` (visual change; not this plan).
- Fake-spawn tests cannot count concurrency without Electron — use the 027 EventEmitter harness; do not launch the app.

## Maintenance notes

- Reviewer: 2×2 must not probe hidden slots 5–9. Cancel during analyze must not leave orphan ffmpeg.
- After 028, probes still run before the temp encode; no change to output paths.
