# Plan 050: Do not let prefs restore overwrite a drop that happened during launch

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat a7bd825..HEAD -- app/js/index.js lib/prefs.js test/prefs.test.js`
> Compare excerpts against live code; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `a7bd825`, 2026-08-27

## Why this matters

Drop/click handlers bind at script parse (`app/js/index.js` the `for` over `.dropzone`). `restorePrefs()` runs later on `DOMContentLoaded` and `await`s `electronAPI.loadPrefs()` (main-process `existsSync` per stored path). A drop in that window calls `setSlotOccupied` then `persistPrefs()`, which **returns immediately** while `applyingPrefs` is true. When the await finishes, `applyPrefs` writes disk paths onto the grid and wipes the drop. Slow `existsSync` (NAS paths) makes the race easy; even a fast disk can lose a drop during first paint.

## Current state

```javascript
var applyingPrefs = false

function persistPrefs() {
    if (applyingPrefs) {
        return
    }
    // savePrefs(collectPrefs())
}

async function restorePrefs() {
    applyingPrefs = true
    try {
        const prefs = await electronAPI.loadPrefs()
        applyPrefs(prefs)
    } finally {
        applyingPrefs = false
    }
}

function applyPrefs(prefs) {
    // sets selects, lastSaveDir, switchGrid, then setSlotOccupied/clearSlot per path
}

// dropzone ondrop / onclick → setSlotOccupied (at parse time)
document.addEventListener('DOMContentLoaded', () => {
    // bind previews, close buttons, setting change → persistPrefs
    restorePrefs()
})
```

`applyPrefs` always applies grid + paths. `switchGrid` calls `persistPrefs` (no-op during apply). There is no `userTouchedGrid` flag.

Renderer is a classic script (not `type="module"`). Testable logic lives in `lib/prefs.js` (`test/prefs.test.js`).

**Conventions**: keep `applyingPrefs` so restore does not save a half-applied snapshot. Match `normalizePrefs` style. Short imperative commits. No AI co-author trailers.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 |
| Prefs | `node --test test/prefs.test.js` | exit 0 |

## Scope

**In scope**:

- `lib/prefs.js` + `test/prefs.test.js` — small helper for “restore grid/paths or not”
- `app/js/index.js` — flag + applyPrefs / restorePrefs / persistPrefs behavior

**Out of scope**:

- Import/export files (061)
- Changing `filterMissingPaths` / `existsSync` in main
- Disabling the whole window until restore completes (NAS would freeze first interaction)
- `type="module"`

## Git workflow

- Branch: `advisor/050-prefs-restore-drop-race`
- Message: `Keep drops made during launch instead of overwriting them with saved prefs.`
- Do not push unless asked.

## Steps

### Step 1: Helper

In `lib/prefs.js`:

```javascript
function shouldRestoreGridAndPaths(userTouchedGrid) {
    return !userTouchedGrid;
}
```

Export it. Tests:

- `shouldRestoreGridAndPaths(false) === true`
- `shouldRestoreGridAndPaths(true) === false`
- `shouldRestoreGridAndPaths(undefined) === true`

**Verify**: `node --test test/prefs.test.js` → exit 0 after you add the tests (helper must exist)

### Step 2: Renderer flag

In `app/js/index.js`:

1. `let userTouchedGrid = false`
2. Set `userTouchedGrid = true` at the start of `setSlotOccupied`, `clearSlot`, and the in-app swap branch of `ondrop` (swap uses `applyVisiblePaths` → `setSlotOccupied`/`clearSlot`, so the flag in those two is enough if **every** path mutation goes through them). `switchGrid` clearing hidden slots 5–9 also calls `clearSlot` — that would mark touched during `applyPrefs`. **Do not** set the flag inside `clearSlot`/`setSlotOccupied` when `applyingPrefs` is true.
3. Recommended: `function markGridTouched() { if (!applyingPrefs) userTouchedGrid = true }` and call it from `setSlotOccupied` / `clearSlot`.
4. `applyPrefs`: always apply resolution/audio/fit/duration/`lastSaveDir`. Apply `switchGrid` + slot paths **only** if `shouldRestoreGridAndPaths(userTouchedGrid)`. If the user already touched the grid, do **not** call `switchGrid` (it would clear hidden slots / change layout under a drop).
5. `restorePrefs` `finally`: `applyingPrefs = false`, then if `userTouchedGrid` call `persistPrefs()` so the drop is saved (the in-flight persist was skipped).

Do not register drop handlers only after restore — that is a worse UX than a flag.

**Verify**: `grep -n "userTouchedGrid\\|shouldRestoreGridAndPaths" app/js/index.js lib/prefs.js` → both files

## Test plan

- Unit: helper true/false as above.
- No Playwright. Optional: a tiny exported `decideRestore(userTouchedGrid, prefs)` is unnecessary if the helper is enough.
- Pattern: `test/prefs.test.js`.

Verification: `npm test` → exit 0.

## Done criteria

- [ ] `npm test` exits 0
- [ ] `shouldRestoreGridAndPaths` exists and is tested
- [ ] `applyPrefs` skips grid/paths when the user already filled/cleared a cell during restore
- [ ] A drop during `applyingPrefs` is persisted after restore finishes
- [ ] `setSlotOccupied` during `applyPrefs` does not set `userTouchedGrid`
- [ ] No files outside the in-scope list are modified
- [ ] `plans/README.md` status row for 050 set to DONE

## STOP conditions

- Excerpts drifted.
- You would `await restorePrefs()` before binding `ondrop` (leaves a dead grid until NAS `existsSync` finishes).
- You would skip restoring **output settings** because the user dropped a file (settings from disk should still apply).

## Maintenance notes

- Reviewer: `switchGrid` → `clearSlot` on hidden 2×2 cells must not count as user touch when it runs from `applyPrefs`.
- Convert during the race is out of scope; overlay still requires at least one `vidPath`.
