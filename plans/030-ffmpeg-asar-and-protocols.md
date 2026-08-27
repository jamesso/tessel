# Plan 030: Spawn the unpacked ffmpeg binary and restrict ffmpeg protocols

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat c2b112f..HEAD -- main.js lib/mosaic.js package.json test/mosaic.test.js`
> If `lib/ffmpeg-session.js` exists (plan 027), include it in the drift check and put **probe** argv there instead of `main.js`.
> Compare excerpts against live code; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (can run in parallel with 027; if packaged Convert fails to start ffmpeg, do this **before** 027)
- **Category**: security
- **Planned at**: commit `c2b112f`, 2026-08-26

## Why this matters

Two independent packaging/runtime issues share the ffmpeg spawn boundary.

1. **Asar path**: Packager uses `--asar.unpackDir=node_modules/ffmpeg-static` (`package.json` scripts). `require('ffmpeg-static')` returns `path.join(__dirname, 'ffmpeg')`, which in a packaged app is `.../app.asar/node_modules/ffmpeg-static/ffmpeg`. The real file is `.../app.asar.unpacked/...`. `child_process.spawn` cannot execute a binary inside an asar. `main.js` never rewrites the path. Unpackaged `npm start` works; a GitHub Release build may fail at Convert. Plan 016’s STOP said not to ship if the path still pointed inside `app.asar`; 026 changed the package and still has no rewrite. Naive `.replace('app.asar', 'app.asar.unpacked')` is **wrong** if the path already contains `app.asar.unpacked` (it becomes `app.asar.unpacked.unpacked`).
2. **Protocols**: The bundled binary (`ffmpeg version 6.0`) enables input protocols including `http`, `https`, `ftp`, `concat`, `rtmp`. Probe and encode pass user-supplied strings as `-i` with no `-protocol_whitelist`. Spawn is already an argv array (not a shell). Restricting to `file,pipe` stops the binary from opening network/concat URLs if a non-path string ever reaches `-i`.

This plan is hardening plus a packaged-path fix. It is **not** a networked-app rewrite of IPC path validation (that was previously rejected).

## Current state

```javascript
// main.js
const ffmpegBinary = require('ffmpeg-static')
// ...
const args = ['-nostdin', '-hide_banner', '-i', videoPath]
const ffmpegProcess = spawn(ffmpegBinary, args)
```

```javascript
// lib/mosaic.js buildFfmpegArgs return array starts:
return [
    '-nostdin',
    '-i', firstReal.filename,
    // ...
    '-y',
    // ...
    filePath,
]
```

```javascript
// package.json (all three package-* scripts)
--asar.unpackDir=node_modules/ffmpeg-static
```

`node_modules/ffmpeg-static/index.js` exports the path string (or `process.env.FFMPEG_BIN` if set). Do not delete `FFMPEG_BIN` support in unpackaged runs; packaged runs should still rewrite an asar path if the env var points inside `app.asar`.

**Conventions**: extract a pure helper so tests do not need Electron, like `lib/ipc-send.js`. Mosaic argv goldens in `test/mosaic.test.js` assert `args[0] === '-nostdin'` today — updating the next flags is required. Short imperative commits. No AI co-author trailers.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 |
| Helper | `node -e "const {resolvePackagedFfmpegPath}=require('./lib/ffmpeg-path'); ..."` | prints rewritten path (see step 1) |
| Optional packaged smoke | `npm run package-mac` (or linux/win for this OS) then Convert one tiny clip in the packaged app | encode succeeds; skip if you cannot pack (do not mark the whole plan BLOCKED solely for skipping smoke — tests must still pass) |

No lint/typecheck script.

## Scope

**In scope**:

- `lib/ffmpeg-path.js` (create) — path rewrite + optional shared whitelist constant
- `main.js` — wrap `require('ffmpeg-static')` with the rewrite before spawn (if 027 landed, pass the resolved path into `createFfmpegSession`)
- Probe argv: `main.js` **or** `lib/ffmpeg-session.js` if present
- `lib/mosaic.js` — insert `-protocol_whitelist` on encode argv
- `test/ffmpeg-path.test.js` (create)
- `test/mosaic.test.js` / `test/output-settings.test.js` — argv goldens that pin `args[0]` / include `-i`

**Out of scope**:

- Replacing `ffmpeg-static` or bumping FFmpeg majors (EOL 6.0 upgrade is a separate L migration)
- Hash-pinning the GitHub download in `install.js` (upstream)
- Electron fuses, CSP, CI workflow split
- Validating renderer paths / dialog tokens (rejected as networked-app modeling)
- `FFMPEG_BIN` arbitrary-binary warnings beyond asar rewrite
- Signing / notarize

## Git workflow

- Branch: `advisor/030-ffmpeg-asar-and-protocols`
- Message: `Resolve unpacked ffmpeg paths and whitelist file and pipe protocols.`
- Do not push unless asked.

## Steps

### Step 1: `resolvePackagedFfmpegPath`

Create `lib/ffmpeg-path.js`:

```javascript
const path = require('path')

const FFMPEG_PROTOCOL_WHITELIST = 'file,pipe'

function resolvePackagedFfmpegPath(binaryPath) {
    if (typeof binaryPath !== 'string' || binaryPath.length === 0) {
        return binaryPath
    }
    const unpackedSeg = `${path.sep}app.asar.unpacked${path.sep}`
    const asarSeg = `${path.sep}app.asar${path.sep}`
    if (binaryPath.includes(unpackedSeg)) {
        return binaryPath
    }
    if (binaryPath.includes(asarSeg)) {
        return binaryPath.split(asarSeg).join(unpackedSeg)
    }
    return binaryPath
}

module.exports = { resolvePackagedFfmpegPath, FFMPEG_PROTOCOL_WHITELIST }
```

Also handle a path that uses `/app.asar/` on Windows if you see mixed slashes in tests — `split` on both `app.asar.unpacked` guard first, then replace `/app.asar/` and `\app.asar\`. Keep it boring: tests below define the contract.

Tests in `test/ffmpeg-path.test.js`:

1. `/App/Contents/Resources/app.asar/node_modules/ffmpeg-static/ffmpeg` → `.../app.asar.unpacked/node_modules/ffmpeg-static/ffmpeg`
2. Same path already containing `app.asar.unpacked` → **unchanged** (no `.unpacked.unpacked`)
3. Unpackaged `/Users/me/tessel/node_modules/ffmpeg-static/ffmpeg` → unchanged
4. `null` / `undefined` → returned as-is

**Verify**: `node --test test/ffmpeg-path.test.js` → exit 0

### Step 2: Use the resolved path at spawn

`main.js`:

```javascript
const ffmpegBinary = resolvePackagedFfmpegPath(require('ffmpeg-static'))
```

If 027’s session takes `ffmpegBinary` as a dep, resolve **once** in `main.js` and pass that string in. Do not resolve inside every `spawn` unless tests need it.

**Verify**: `grep -n "resolvePackagedFfmpegPath" main.js` → at least one match next to `ffmpeg-static`

### Step 3: `-protocol_whitelist` on probe and encode

Probe argv (today `main.js`; after 027, the session):

```javascript
['-nostdin', '-protocol_whitelist', FFMPEG_PROTOCOL_WHITELIST, '-hide_banner', '-i', videoPath]
```

Encode: in `buildFfmpegArgs`, immediately after `'-nostdin'`:

```javascript
'-protocol_whitelist', FFMPEG_PROTOCOL_WHITELIST,
'-i', firstReal.filename,
```

Require the constant from `lib/ffmpeg-path.js` in `lib/mosaic.js` **or** duplicate the string `'file,pipe'` in mosaic and export it from one place only — prefer **one** constant.

Do **not** add `http`, `https`, `ftp`, `concat`, `concatf`, `rtmp`, or `unix`.

`test/ffmpeg-integration.test.js` builds its **own** argv (`-f lavfi -i color=...`) and does not use `buildFfmpegArgs`. Leave it unless it starts failing for unrelated reasons.

Update `test/mosaic.test.js` sparse-args assertions: `args[0]` stays `'-nostdin'`; assert `args[1] === '-protocol_whitelist'` and `args[2] === 'file,pipe'` (or `FFMPEG_PROTOCOL_WHITELIST`). Other tests that search for `-i` still pass if you only **insert** two argv cells.

**Verify**: `npm test` → exit 0

If `npm test` fails because a **production** helper is now used with lavfi inside a new test you added, add `lavfi` **only** to that test’s argv, not to production whitelist. Production Convert never uses lavfi.

If a real probe/encode of a local file fails with `Protocol not on whitelist` for protocol `file`, STOP and report the exact stderr — do not blindly add `all`.

### Step 4: Optional packaged smoke

If you run `npm run package-mac` (or the script for this OS): after pack, `find release-builds -path '*app.asar.unpacked*ffmpeg*'` should hit a binary. Opening the app and converting is best; if CI/time cannot, say so in the README status note. Tests in steps 1–3 are enough to mark DONE.

**Verify**: `npm test` still exit 0

### Step 5: Mark the plan

`plans/README.md` row 030 → DONE (note OS if you smoked a pack).

## Test plan

- `test/ffmpeg-path.test.js` cases in step 1.
- Mosaic argv goldens include whitelist after `-nostdin`.
- Pattern: `test/mosaic.test.js` `args[0] === '-nostdin'` block.
- Do not add network URLs as test inputs.

## Done criteria

- [ ] `resolvePackagedFfmpegPath` tests pass, including the unpacked-already case
- [ ] `grep -n "protocol_whitelist" lib/mosaic.js` matches encode argv
- [ ] Probe argv includes `-protocol_whitelist` (`grep` in `main.js` or `lib/ffmpeg-session.js`)
- [ ] `npm test` exits 0
- [ ] No files outside the in-scope list are modified
- [ ] `plans/README.md` 030 DONE

## STOP conditions

- You are about to add `concat` or `http` to the whitelist “so README ‘other formats’ keep working” — those formats still come in as **files**. Do not add network protocols.
- `replace('app.asar', 'app.asar.unpacked')` without guarding `app.asar.unpacked` — forbidden; use step 1.
- FFmpeg rejects `file,pipe` on this binary for ordinary local `mp4` probe — report stderr; do not disable whitelist silently.
- Rewriting packager to `--no-asar` instead of fixing the path.

## Maintenance notes

- Reviewer: whitelist must be argv (not interpolated into `filter_complex`). Path rewrite must be idempotent.
- Plan 026 notes FFmpeg 6.0 / `ffmpeg-static` GPL; this plan does not add a NOTICE file (docs finding, not selected).
- If Electron later auto-maps asar spawn, the rewrite is still a no-op on unpackaged paths and stays correct for `app.asar/node_modules/...`.
- `FFMPEG_BIN` can still point at any executable in unpackaged runs — that is upstream ffmpeg-static behavior; do not add a new env-var parser.
