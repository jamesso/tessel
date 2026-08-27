# Plan 054: One allowlist for duration, resolution, fit, and audio

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat a7bd825..HEAD -- lib/mosaic.js lib/prefs.js app/js/index.js app/index.html test/mosaic.test.js test/prefs.test.js`
> Compare excerpts against live code; on a mismatch, treat it as a STOP condition.
> Land **before** 059 (audio cell) so new audio values go through this module.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (059 depends on this)
- **Category**: tech-debt
- **Planned at**: commit `a7bd825`, 2026-08-27

## Why this matters

Allowlisted output values are copied in four places. A new `<option>` in HTML can be saved to prefs and ignored at encode time (silent fallback to 720p / mute / letterbox / longest). That is how a “60 fps” or “12 seconds” option would ship looking wired while `resolveEncodeDuration` / `normalizePrefs` drop it.

## Current state

`lib/mosaic.js`:

```javascript
const OUTPUT = { width: 1280, height: 720, fps: 25 };
const ENCODE_SECONDS = new Set([5, 15, 30, 60]);
function resolveOutput(output) { /* 1920x1080 or 720p */ }
function resolveFit(fit) { return fit === 'crop' ? 'crop' : 'letterbox'; }
function resolveAudio(audio) { return audio === 'first' ? 'first' : 'none'; }
function resolveEncodeDuration(durationsMap, policy) { /* seconds only if ENCODE_SECONDS.has(n) */ }
```

`lib/prefs.js` `resolveDurationPrefs` / `normalizePrefs`: `n === 5 || n === 15 || n === 30 || n === 60`; `width === 1920 && height === 1080`; `audio === 'first'`; `fit === 'crop'`.

`app/js/index.js` `getDurationSettings`: `value === '5' || '15' || '30' || '60'`.

`app/index.html:103-130`: `<option>` values `1280x720`, `1920x1080`, `none`, `first`, `letterbox`, `crop`, `longest`, `5`, `15`, `30`, `60`.

Renderer cannot `require('lib/...')` (classic scripts). Main **can** require `lib/`. Do **not** dual-copy a UMD allowlist (053 is deleting that pattern). Source of truth is **lib + tests that parse HTML**.

**Conventions**: `resolve*` stay total functions (invalid → default), same as today. Short imperative commits. No AI co-author trailers.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 |
| New tests | `node --test test/output-allowlist.test.js test/prefs.test.js test/mosaic.test.js` | exit 0 |

## Scope

**In scope**:

- New `lib/output-allowlist.js` (constants + optionally the `resolve*` functions moved from mosaic/prefs)
- `lib/mosaic.js`, `lib/prefs.js` — import the shared sets; do not leave a second `Set([5,15,30,60])`
- `test/output-allowlist.test.js` (create) — HTML `<option>` values ⊆ allowlist
- `app/js/index.js` only if you replace the duration `if` with a one-liner that still cannot `require` lib: **prefer leaving the renderer literals** and gating encode/prefs in lib; the HTML test is the renderer contract

**Out of scope**:

- New output modes (059/062)
- Changing defaults (720p, mute, letterbox, longest)
- Generating HTML from JS

## Git workflow

- Branch: `advisor/054-output-allowlist`
- Message: `Share one allowlist for mosaic output settings and prefs.`
- Do not push unless asked.

## Steps

### Step 1: Extract `lib/output-allowlist.js`

Export (names can match this shape):

```javascript
const FPS = 25;
const DEFAULT_SIZE = { width: 1280, height: 720 };
const SIZES = [
    { width: 1280, height: 720 },
    { width: 1920, height: 1080 },
];
const ENCODE_SECONDS = [5, 15, 30, 60];
const AUDIO = ['none', 'first'];
const FIT = ['letterbox', 'crop'];
const DURATION_MODES = ['longest', 'seconds'];
```

Move `resolveOutput` / `resolveFit` / `resolveAudio` here **or** keep them in `mosaic.js` but import `ENCODE_SECONDS` / size table. Prefs must use the same `ENCODE_SECONDS` array (not a retyped `n === 5 || ...`). `mosaic.js` `OUTPUT` can become `{ ...DEFAULT_SIZE, fps: FPS }`.

Re-export from `mosaic.js` whatever tests already import (`OUTPUT`, `resolveOutput`, `resolveEncodeDuration`).

**Verify**: `node -e "const a=require('./lib/output-allowlist'); if(!a.ENCODE_SECONDS.includes(60)) process.exit(1)"` → exit 0

### Step 2: Prefs + mosaic use it

`resolveDurationPrefs` uses `ENCODE_SECONDS.includes(n)` (or a `Set` built once from that array). `normalizePrefs` 1080p check: `SIZES` some width/height pair, not a one-off `1920`.

**Verify**: `node --test test/prefs.test.js test/mosaic.test.js` → exit 0

### Step 3: HTML contract test

`test/output-allowlist.test.js`: read `app/index.html`, collect `option value="..."` under `#output-resolution`, `#output-audio`, `#output-fit`, `#output-duration`.

Assert:

- resolution values are exactly `1280x720` and `1920x1080` (or `SIZES` mapped to `${w}x${h}`)
- audio values exactly `AUDIO`
- fit values exactly `FIT`
- duration values are `longest` plus `String(n)` for each `ENCODE_SECONDS`

If HTML adds `12` without the allowlist, this test fails.

**Verify**: `node --test test/output-allowlist.test.js` → exit 0

## Test plan

- Existing prefs invalid-value fallbacks still default.
- Existing mosaic `resolveEncodeDuration` invalid `seconds: 7` still longest.
- New HTML ⊆ allowlist test.
- Pattern: `test/prefs.test.js` normalize cases.

Verification: `npm test` → exit 0.

## Done criteria

- [ ] `grep -n "5, 15, 30, 60" lib/` only hits `output-allowlist.js` (or one `Set` built from it)
- [ ] `npm test` exits 0 including `test/output-allowlist.test.js`
- [ ] HTML options match the allowlist
- [ ] Defaults unchanged (720p mute letterbox longest)
- [ ] No files outside the in-scope list are modified
- [ ] `plans/README.md` status row for 054 set to DONE

## STOP conditions

- Excerpts drifted.
- You would add a bundler so the renderer can import `lib/`.
- You would change fps away from 25 (021 freeze).

## Maintenance notes

- Reviewer: renderer `getDurationSettings` may still list 5/15/30/60; that is OK if HTML test + lib gate agree. Optional follow-up: UMD allowlist after 053 — not required here.
- Plan 059 adds audio values: extend `AUDIO` (or a new field) in this module first, then HTML, then the test.
