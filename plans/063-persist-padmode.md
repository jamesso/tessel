# Plan 063: Persist and export freeze pad with the rest of the session

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat f14caf4..HEAD -- app/js/index.js lib/prefs.js test/output-allowlist.test.js test/prefs.test.js`
> Compare excerpts against live code; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (do not parallel 078 — both edit `collectPrefs`)
- **Category**: bug
- **Planned at**: commit `f14caf4`, 2026-08-27

## Why this matters

Advanced **Pad** freeze works for the current Convert because `video:convert` spreads `getOutputSettings()`, which includes `padMode`. Session restore and File → Export use `collectPrefs()`, which omits `padMode`. `serializePrefs` / `normalizePrefs` then default the missing key to `'black'`. Freeze looks wired until quit, import of a just-exported layout, or the next launch.

## Current state

`app/js/index.js` `getOutputSettings` (convert payload):

```javascript
function getOutputSettings() {
    const resolution = document.getElementById('output-resolution').value.split('x')
    return {
        width: Number(resolution[0]),
        height: Number(resolution[1]),
        audio: audioFromSelectValue(document.getElementById('output-audio').value),
        fit: document.getElementById('output-fit').value,
        padMode: document.getElementById('output-pad').value,
        ...getDurationSettings(),
    }
}
```

`collectPrefs` (prefs:save and File → Export):

```javascript
function collectPrefs() {
    const settings = getOutputSettings()
    return {
        version: 1,
        gridType: currentGrid,
        width: settings.width,
        height: settings.height,
        audio: settings.audio,
        fit: settings.fit,
        durationMode: settings.durationMode,
        seconds: settings.seconds,
        lastSaveDir: lastSaveDir,
        paths: collectSlotPaths(),
    }
}
```

`applyPrefs` already sets `#output-pad` from `prefs.padMode`. `lib/prefs.js` `normalizePrefs` already keeps `'freeze'` / falls back to `'black'`.

`test/output-allowlist.test.js` test named “renderer reads and persists padMode” only greps `getOutputSettings` and `applyPrefs`, **not** `collectPrefs`.

**Conventions**: vanilla renderer script (not `type="module"`). Source-grep tests live in `test/output-allowlist.test.js` and `test/prefs.test.js`. Short imperative commits. No AI co-author trailers. Do not add a bundler.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 |
| Allowlist + prefs | `node --test test/output-allowlist.test.js test/prefs.test.js` | exit 0 |

No lint/typecheck script.

## Scope

**In scope**:

- `app/js/index.js` — `collectPrefs` must include `padMode`
- `test/output-allowlist.test.js` — the persist test must fail if `collectPrefs` omits `padMode`

**Out of scope**:

- Changing `PAD_MODES` / freeze `tpad` graph (062)
- `lastSaveName` (078)
- Import merge (083)
- Splitting `index.js`

## Git workflow

- Branch: `advisor/063-persist-padmode`
- Message: `Persist freeze pad in session prefs and layout export.`
- Do not push unless asked.

## Steps

### Step 1: Failing test

In `test/output-allowlist.test.js`, change (or add a sibling test) so “persists padMode” requires `collectPrefs` to copy `settings.padMode`. The current greps for `getOutputSettings` / `applyPrefs` may stay. Add a grep that the object literal inside `collectPrefs` includes `padMode` (for example `padMode: settings.padMode`, or a spread of `getOutputSettings()` that still results in a `padMode` key on the saved object).

**Verify**: `node --test test/output-allowlist.test.js` → **FAIL** on the new assertion before you edit `index.js`.

### Step 2: Include `padMode` in `collectPrefs`

Add `padMode: settings.padMode` next to `fit`. Do not drop `version`, `gridType`, `lastSaveDir`, or `paths`. Spreading `...getOutputSettings()` into the returned object is OK if the saved JSON still has the same keys `normalizePrefs` expects (width, height, audio, fit, padMode, durationMode, optional seconds).

**Verify**: `node --test test/output-allowlist.test.js test/prefs.test.js` → exit 0

### Step 3: Full suite

**Verify**: `npm test` → exit 0

## Test plan

- Source grep: `collectPrefs` includes `padMode` from settings.
- Pattern: `test/output-allowlist.test.js` “renderer reads and persists padMode”.
- Do not add Playwright.

## Done criteria

- [ ] `collectPrefs()` output includes `padMode` from `#output-pad`
- [ ] The allowlist persist test fails if that field is removed
- [ ] `npm test` exits 0
- [ ] No files outside the in-scope list are modified
- [ ] `plans/README.md` status row for 063 set to DONE

## STOP conditions

- Excerpts drifted.
- You would bump prefs `version` (v1 already has `padMode` in `normalizePrefs`; the renderer just forgot to write it).
- You would persist raw `#output-pad` without going through `getOutputSettings` / allowlist (`lib/prefs.js` already clamps invalid values on save).

## Maintenance notes

- Reviewer: File → Export must round-trip freeze. Convert IPC was already correct.
- Plan 078 may spread more settings into `collectPrefs`; land 063 first.
