# Plan 067: Pin Linux/Windows FFmpeg to a durable BtbN build; re-check the binary when the pin changes

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat f14caf4..HEAD -- scripts/ffmpeg-hashes.json scripts/install-ffmpeg.js plans/051-ffmpeg-version-notes.md NOTICE`
> Compare excerpts against live code; on a mismatch, treat it as a STOP condition.
> Do **not** parallel 069 (same hash/install files). Prefer **before** 069.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: migration
- **Planned at**: commit `f14caf4`, 2026-08-27

## Why this matters

`scripts/ffmpeg-hashes.json` pins Linux and Windows to BtbN GitHub release `autobuild-2026-08-16-13-00`. BtbN keeps the last **14 daily** autobuilds and the last build of each month for two years (`https://github.com/BtbN/FFmpeg-Builds` retention + `util/prunetags.sh` `KEEP_LATEST=14`). That tag is not month-end. `vendor/ffmpeg/` is gitignored; every CI `npm ci` re-downloads. When GitHub deletes the tag, Ubuntu tests and Linux/Windows packager jobs fail with `Download failed (404)` while Mac (Martin Riedl) still works.

Separately, `installPlatform` returns immediately if `vendor/ffmpeg/ffmpeg` (or `.exe`) exists — **no digest**. After you change the pin, a developer machine keeps the old binary.

## Current state

`scripts/ffmpeg-hashes.json` linux-x64 / win32-x64 `archiveUrl` contain `autobuild-2026-08-16-13-00` and `ffmpeg-n7.1.5-16-g9a4bb2c579-…-gpl-7.1`.

`scripts/install-ffmpeg.js`:

```javascript
    if (fs.existsSync(binDest)) {
        console.log(`ffmpeg already installed at ${binDest}`);
        return;
    }
```

`package.json` `"postinstall": "node scripts/install-ffmpeg.js"`. Stay on **FFmpeg 7.1.x GPL static** (libx264). Do **not** use BtbN `latest` (floating, unsigned for our hash pin). Do **not** jump to 8.1/9.0 unless no 7.1.x monthly asset exists — then STOP.

Darwin-arm64 stays on Martin Riedl unless 069 says otherwise.

**Conventions**: hash-pin archives (SHA-256 of the zip/tar, not the inner binary only). Mosaic argv unchanged unless a spike fails (`-fps_mode cfr`, tpad, xstack, overlay, `split`). Pattern: `plans/051-ffmpeg-version-notes.md`. Short imperative commits. No AI co-author trailers.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 (includes lavfi integration if binary present) |
| Version | `vendor/ffmpeg/ffmpeg -version` (after reinstall) | first line is FFmpeg 7.1.x |

## Scope

**In scope**:

- `scripts/ffmpeg-hashes.json` — linux-x64 and win32-x64 URLs, SHA-256, `binaryInArchive`, `licenseInArchive`, `versionLine`
- `scripts/install-ffmpeg.js` — skip-if-exists must not keep a binary that does not match the current pin (stamp file next to the binary, or hash the installed file against a new `binarySha256` field — pick one and document it in 051 notes)
- `plans/051-ffmpeg-version-notes.md` — new URLs and hashes
- README / NOTICE version string **only if** 7.1.x patch line changes in a user-visible way (still “FFmpeg 7.1” is OK)

**Out of scope**:

- Darwin license file (069)
- Electron 45
- Hardware encode
- Intel Mac
- `latest` BtbN URL

## Git workflow

- Branch: `advisor/067-repin-btbn-ffmpeg`
- Message: `Pin Linux and Windows FFmpeg to a month-end BtbN 7.1 build.`
- Do not push unless asked.

## Steps

### Step 1: Choose a durable 7.1 GPL pin

List BtbN releases. Prefer a tag dated the **last calendar day of a month** (monthly keep). Confirm assets:

- `ffmpeg-n7.1.*-linux64-gpl-7.1.tar.xz`
- `ffmpeg-n7.1.*-win64-gpl-7.1.zip`

Download both, `sha256sum`, set `archiveSha256`, `binaryInArchive`, `licenseInArchive` (BtbN trees include `LICENSE.txt` — keep copying it). Stay on 7.1.x, not master `N-` builds.

If no monthly tag still has 7.1.x GPL linux64+win64: **STOP** and report (do not pin 8.1/9.0 in this plan).

**Verify**: both URLs return HTTP 200; recorded SHA-256 matches your downloads.

### Step 2: Stamp / re-verify installed binary

Change `install-ffmpeg.js` so an existing `binDest` is reused only if it matches this pin (for example write `vendor/ffmpeg/pin.json` with `archiveSha256` + platform key after a successful install; if the file is missing or the hash differs, delete `binDest` and re-download). Do not skip the archive SHA-256 check on download.

**Verify**: with a stale stamp, install re-downloads (you can simulate by editing the stamp). With a matching stamp, install no-ops.

### Step 3: Notes + tests

Update `plans/051-ffmpeg-version-notes.md` table. Remove `vendor/ffmpeg` locally, run `node scripts/install-ffmpeg.js`, then `npm test`.

**Verify**: `npm test` → exit 0; `ffmpeg -version` is 7.1.x

## Test plan

- Integration suite still encodes lavfi mosaics (`test/ffmpeg-integration.test.js`).
- No new unit tests required unless you extract stamp comparison to a tiny pure function — then test that.

## Done criteria

- [ ] linux-x64 and win32-x64 pins are not 14-day-only daily tags
- [ ] Archives are SHA-256 verified; skip-if-exists honors the current pin
- [ ] FFmpeg remains 7.1.x GPL static with libx264
- [ ] `npm test` exits 0
- [ ] `plans/051-ffmpeg-version-notes.md` updated
- [ ] `plans/README.md` 067 DONE
- [ ] No files outside the in-scope list (plus notes) are modified

## STOP conditions

- No remaining BtbN 7.1.x monthly assets.
- tpad / xstack / overlay / `-fps_mode cfr` fail vs current goldens — revert the pin.
- You would use `latest` or unhashed URLs.

## Maintenance notes

- Reviewer: do not treat Mac Riedl 7.1.1 vs Linux 7.1.x patch skew as in-scope unless you also change darwin (069/optional).
- Next pin bump: change hashes **and** the stamp so local `vendor/ffmpeg` refreshes.
