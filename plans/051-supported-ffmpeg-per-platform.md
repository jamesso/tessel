# Plan 051: Ship one supported FFmpeg version on every packager platform

> **Executor instructions**: This is a **spike-then-migrate** plan. Fill
> `plans/051-ffmpeg-version-notes.md` before swapping dependencies. If tpad /
> xstack / overlay / `-fps_mode cfr` behavior changes versus current goldens,
> STOP and revert. When done, update `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat a7bd825..HEAD -- package.json package-lock.json lib/mosaic.js lib/ffmpeg-path.js NOTICE plans/026-ffmpeg-migration-notes.md`
> On excerpt mismatch, STOP.
> Do **not** start until plan 044 is DONE. Prefer after 049 so unique-`split` graphs are tested on the new binary.

## Status

- **Priority**: P3
- **Effort**: L
- **Risk**: MED
- **Depends on**: plans/044-xstack-single-cell.md (049 recommended first)
- **Category**: migration
- **Planned at**: commit `a7bd825`, 2026-08-27

## Why this matters

Plan 026 replaced `@ffmpeg-installer/ffmpeg` 4.4 with `ffmpeg-static@5.3.0` (binary release tag `b6.1.1`). On darwin-arm64 that binary is **FFmpeg 6.0** (EOL 2024-07-11). The same npm tag can install a **different** FFmpeg on linux-x64 (7.0.2 has been observed in CI). Encode bugs can pass Ubuntu `npm test` and fail in the Mac GitHub Release. `node_modules/ffmpeg-static/install.js` downloads GitHub/S3 assets **without a content hash**. Previously skipped as L; the **platform version split** is new evidence ([ffmpeg-static#151](https://github.com/eugeneware/ffmpeg-static/issues/151)).

## Current state

- `package.json` dependency `"ffmpeg-static": "^5.3.0"`
- Packager: `--asar.unpackDir=node_modules/ffmpeg-static` (`package-mac` / `package-win` / `package-linux`)
- `require('ffmpeg-static')` returns a path string (`lib` / `main.js` via session)
- `NOTICE` + README: MIT app, GPL FFmpeg from `ffmpeg-static`
- `plans/026-ffmpeg-migration-notes.md`: darwin-arm64 spike recorded **6.0**, `-fps_mode cfr`
- Install: `node_modules/ffmpeg-static/package.json` `"binary-release-tag": "b6.1.1"`; `install.js` uses `@derhuerst/http-basic` + cache, no SHA-256 verify

Packager targets: darwin-arm64, linux-x64, win32-x64 only.

**Conventions**: keep spawn + `-filter_complex` (not fluent-ffmpeg). GPL notice stays. Short imperative commits. No AI co-author trailers.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 |
| Local version | `"$(node -e "console.log(require('ffmpeg-static'))")" -version` | print version; record in notes |
| Integration | `node --test test/ffmpeg-integration.test.js` | exit 0 (or skip if no binary) |

## Scope

**In scope**:

- Spike notes: `plans/051-ffmpeg-version-notes.md`
- `package.json` / `package-lock.json` and/or a small download script with **pinned hashes**
- `lib/ffmpeg-path.js` unpack rewrite if the on-disk layout changes
- Packager `--asar.unpackDir` (or equivalent) for the new binary location
- `NOTICE` / README FFmpeg version sentence if the major version changes
- Tests only if argv flags must change (`-fps_mode` / filter names)

**Out of scope**:

- GPU / videotoolbox / nvenc
- Intel Mac packager target
- Shipping two ffmpeg versions in one app
- Signed macOS (`plans/DEFERRED.md`)
- Replacing Electron

## Git workflow

- Branch: `advisor/051-supported-ffmpeg-per-platform`
- Message: `Ship the same supported FFmpeg version on macOS, Linux, and Windows.`
- Do not push unless asked.

## Steps

### Step 1: Characterize current binaries

On this machine record `ffmpeg -version` (first line). In notes, also record what Linux CI prints if you can (`npm test` log or a one-line workflow). Table: platform, arch, npm tag, FFmpeg version.

**Verify**: `plans/051-ffmpeg-version-notes.md` exists with that table

### Step 2: Pick a vendor and pin it

Requirements (all must hold):

1. **Same FFmpeg major.minor** on darwin-arm64, linux-x64, win32-x64 (the three packager scripts).
2. That version is still receiving security fixes, or you document why a specific 7.x/8.x static build is acceptable.
3. Install is **hash-pinned** (SHA-256 of each platform blob in-repo). A floating GitHub “latest asset” is not enough.
4. License remains GPL-compatible with `NOTICE` (static ffmpeg is still GPL).

Candidates to evaluate (pick one, do not invent a fourth without writing why):

- Keep `ffmpeg-static` but pin `FFMPEG_BINARY_RELEASE` / exact asset URLs **if** one tag is version-identical on all three platforms (prove with `-version`, not the tag name).
- Scripted download of a known-good static build set (e.g. BtbN / gyan.dev / evermeet) with hashes in `scripts/ffmpeg-hashes.json`.
- Another maintained npm wrapper **only** if it satisfies (1)–(3).

Spike: one 2×2 mosaic argv (`buildFilterComplex` + `buildFfmpegArgs`) with unequal durations (tpad) and, if 044/049 landed, N=1 overlay and a `split=2` graph. Bundled/new binary exit 0.

If filters fail, STOP and revert.

**Verify**: notes name the vendor, three URLs or package versions, three SHA-256s, three `ffmpeg -version` strings (linux may be CI)

### Step 3: Swap and unpack

Point `require('ffmpeg-static')` or a new `lib` helper at the pinned binary. Update asar unpack glob. Grep old paths.

Do not commit 40MB binaries into git unless the notes say the hash-pin download is impossible in `npm ci` (CI has network today).

**Verify**: `npm test` exit 0; `grep -n "ffmpeg-static" package.json` matches the chosen approach; packaged unpack path still avoids asar for the executable (plan 030)

### Step 4: Docs

README Technical Details “Bundled FFmpeg 6.x” → the version you actually ship. `NOTICE` unchanged in spirit (GPL binary). 026 notes: add a pointer “superseded by 051” — do not rewrite 026 history.

**Verify**: `grep -n "FFmpeg" README.md NOTICE` reflects the new major

## Test plan

- Existing mosaic goldens stay the contract; change argv **only** if the new binary requires a documented flag rename, then update goldens in the same commit.
- `test/ffmpeg-integration.test.js` must pass on the executor’s OS.
- Pattern: plan 026 notes + integration lavfi encode.

Verification: `npm test` → exit 0.

## Done criteria

- [ ] `plans/051-ffmpeg-version-notes.md` filled (versions + hashes + spike encodes)
- [ ] darwin-arm64, linux-x64, and win32-x64 binaries are the same FFmpeg version line (or notes prove install cannot run on one OS and CI recorded it)
- [ ] Downloads are SHA-256 pinned
- [ ] `npm test` exits 0
- [ ] Packager still unpacks the ffmpeg executable from asar
- [ ] No files outside the in-scope list are modified
- [ ] `plans/README.md` status row for 051 set to DONE

## STOP conditions

- 044 not DONE.
- New binary rejects current `tpad` / `xstack` / `overlay` / `-fps_mode cfr` and a flag rename would change mosaic timing or pixels — revert.
- You would pin only darwin and leave Linux/Windows floating.
- You would drop `NOTICE` / claim the binary is MIT.

## Maintenance notes

- Reviewer: CI linux `-version` vs macOS release `-version` was the bug; the notes table is the artifact.
- Hash pins will rot when you next bump; do not use `latest`.
- Plan 030 protocol whitelist and asar rewrite stay required.
