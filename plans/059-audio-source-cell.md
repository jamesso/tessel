# Plan 059: Let the user pick which occupied cell supplies audio

> **Executor instructions**: This is a **direction** plan (spike then one UI).
> Mix-all remains wont-ship (021). Default stays **mute**. Fill
> `## Spike result` if you change the audio graph. When done, update
> `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat a7bd825..HEAD -- lib/mosaic.js lib/prefs.js app/index.html app/js/index.js test/output-settings.test.js`
> On excerpt mismatch, STOP.
> Prefer plan **054 DONE** so new allowlist values live in `lib/output-allowlist.js`.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/054-output-allowlist.md (soft — if 054 is TODO, extend mosaic/prefs the same way 054 will)
- **Category**: direction
- **Planned at**: commit `a7bd825`, 2026-08-27

## Why this matters

The footer label is **First clip** (`app/index.html:111-112`). Encode maps audio from the **first occupied slot** in grid order (`lib/mosaic.js` `firstReal` + `${firstReal.inputIndex}:a?`). After 042, users swap cells; soundtrack follows whoever sits in the earliest occupied slot, not “the clip I think of as first.” 021 already rejected mix-all. This plan adds **which one cell** is the soundtrack.

## Current state

```javascript
function resolveAudio(audio) {
    return audio === 'first' ? 'first' : 'none';
}
const firstReal = videoInfo.find(v => !v.isBlack);
const audioArgs = audio === 'first'
    ? ['-map', `${firstReal.inputIndex}:a?`, '-af', 'asetpts=PTS-STARTPTS,apad']
    : ['-an'];
```

`test/output-settings.test.js` “audio first omits -an and maps `0:a?`” uses sparse slot 0 filled.

Prefs: `audio: src.audio === 'first' ? 'first' : 'none'`.

IPC already sends `audio` from `getOutputSettings()`.

**Conventions**: `apad` + `-t` keep A/V aligned (021 notes). Invalid audio → mute. Short imperative commits. No AI co-author trailers.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 |
| Mosaic | `node --test test/output-settings.test.js test/mosaic.test.js test/prefs.test.js` | exit 0 |

## Scope

**In scope**:

- Spike: two clips, audio from slot 0 vs slot 1 — confirm `-map 1:a?` (or unique input index after 049) plays the second file’s audio
- `resolveAudio` / prefs / HTML: keep `none` | `first` **or** replace `first` with an explicit slot picker; do not keep a misleading label
- `buildFfmpegArgs` maps the chosen occupied cell’s `inputIndex` audio
- Tests for mapping `1:a?` when slot 0 is empty and slot 1 is the source, and when the user picks slot 3 in a 2×2
- Footer or cell affordance **one** mechanism (dropdown of occupied names **or** a speaker toggle on a cell — pick one in the spike result)

**Out of scope**:

- Mix-all, ducking, per-cell volume (021)
- Changing mute default
- 4×4 / custom sample rates

## Git workflow

- Branch: `advisor/059-audio-source-cell`
- Message: `Let users choose which mosaic cell provides audio.`
- Do not push unless asked.

## Steps

### Step 1: Spike mapping

Using bundled ffmpeg and `buildFfmpegArgs`, two lavfi clips (or real files) in slots 0 and 1, `audio: 'first'` vs a prototype `audioSlot: 1`. Listen or `ffprobe` the output’s audio stream origin if you can; at minimum assert argv contains `1:a?` not `0:a?` when the chosen cell’s `inputIndex` is 1.

If 049 uniqued inputs, use `inputIndex` not slot number in `-map`.

If A/V breaks (audio longer/shorter than video), STOP — keep `apad` + `-t`.

**Verify**: spike result names the UI (dropdown vs cell icon) and the IPC field

### Step 2: Allowlist and argv

Keep `none` default. `first` may remain as “lowest occupied slot” for prefs v1 compatibility **or** migrate saved `first` to slot index of current first occupied at save time. Prefer: persist `audio: 'none' | 'first' | { slot: 0-8 }` and coerce invalid/unoccupied slot to `first` (then mute if that slot is empty at convert — same as today if nothing has audio).

`buildFfmpegArgs`: find the videoInfo entry for the chosen slot if occupied and not black; else fall back to `firstReal`; else `-an`.

**Verify**: test with slots `[null, '/b.mp4', '/a.mp4', null]` choosing slot 2 → `-map ${that inputIndex}:a?`

### Step 3: UI

450×600 footer must still work. If a `<select>` of nine slots is cramped, speaker button on occupied cells is OK. Mute still in the existing Audio select.

When the chosen cell is cleared, fall back to first occupied or mute — define in spike result; test prefs normalize.

**Verify**: `grep -n "output-audio\\|audioSlot" app/index.html app/js/index.js lib/mosaic.js`

### Step 4: Persist

`lib/prefs.js` + restore in `applyPrefs`. HTML test in 054’s allowlist file if 054 landed.

**Verify**: `npm test` → exit 0

## Test plan

- `none` → `-an`
- `first` / default occupied → same as today’s `0:a?` when slot 0 filled
- Explicit other slot → that cell’s `inputIndex`
- Unoccupied chosen slot → fallback documented in spike
- Pattern: `test/output-settings.test.js` audio first test.

Verification: `npm test` → exit 0.

## Done criteria

- [ ] `## Spike result` names UI + IPC
- [ ] Mute remains default
- [ ] User can encode using a non-first occupied cell’s audio
- [ ] Mix-all not implemented
- [ ] `npm test` exits 0
- [ ] `plans/README.md` 059 DONE

## STOP conditions

- Mix-all “just for a minute.”
- Audio graph needs `amix` to stay in sync.
- 054 allowlist test would fail and you expand HTML without updating the allowlist.

## Spike result

_(executor fills)_

## Maintenance notes

- Reviewer: after 049, `-map 1:a?` is unique-input 1, not “second `-i` on a duplicated path.”
- README “first clip” sentence (048) should say “audio source cell” if this ships.
