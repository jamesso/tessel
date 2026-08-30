# Plan 069: Put FFmpeg license text next to the macOS binary and tell NOTICE the truth

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat f14caf4..HEAD -- scripts/ffmpeg-hashes.json scripts/install-ffmpeg.js NOTICE README.md`
> Compare excerpts against live code; on a mismatch, treat it as a STOP condition.
> Sequence **after** 067 if both are TODO.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/067-repin-btbn-ffmpeg.md (soft — rebase hashes if 067 lands first)
- **Category**: docs
- **Planned at**: commit `f14caf4`, 2026-08-27

## Why this matters

Plan 035 / `NOTICE` say that after `npm install`, FFmpeg’s license is at `vendor/ffmpeg/LICENSE`. Darwin pin has `"licenseInArchive": null`; `install-ffmpeg.js` only copies a license when that field is set. Linux/Windows BtbN pins copy `LICENSE.txt`. A Mac install (and thus the macOS GitHub Release unpack dir) never creates the documented path. This plan is documentation + shipping the text Tessel already claims exists — not legal advice and not a relicensing.

## Current state

`scripts/ffmpeg-hashes.json` darwin-arm64 `"licenseInArchive": null`. `NOTICE:18-20` points at `vendor/ffmpeg/LICENSE`. `scripts/install-ffmpeg.js:106-110` copies `licenseInArchive` when set.

Martin Riedl zip is typically the `ffmpeg` binary only (that is why the field is null). BtbN linux/win already copy LICENSE.

**Conventions**: keep the app MIT (`LICENSE`). Do not paste the full GPL into `LICENSE`. Short imperative commits. No AI co-author trailers.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 |
| NOTICE | `grep -i "ffmpeg\\|LICENSE\\|legal.html" NOTICE` | all present |

## Scope

**In scope**:

- Ensure a Mac `npm install` leaves license text at a path NOTICE names (set `licenseInArchive` if the zip contains it; **or** vendor a `scripts/ffmpeg-license/COPYING` / FFmpeg license file in-repo and copy it to `vendor/ffmpeg/LICENSE` on darwin when the archive has none)
- `NOTICE` (and README License sentence if it only defers to NOTICE) must match reality on all three packager platforms
- `scripts/install-ffmpeg.js` only if copy logic must run when `licenseInArchive` is null

**Out of scope**:

- Relicensing Tessel to GPL
- Signed macOS
- Changing FFmpeg version (067)

## Git workflow

- Branch: `advisor/069-darwin-ffmpeg-license`
- Message: `Ship FFmpeg license text beside the macOS binary.`
- Do not push unless asked.

## Steps

### Step 1: Obtain the text

List the darwin zip (`licenseInArchive` candidate). If a license file exists, set the pin field. If not, add a **small** in-repo file (e.g. `scripts/ffmpeg-license/README` pointing at https://ffmpeg.org/legal.html plus the GPL text from FFmpeg’s `COPYING.GPLv3` **only if** you can copy it from a BtbN `LICENSE.txt` you already download on linux — do not invent license terms). Copy that file to `vendor/ffmpeg/LICENSE` on darwin in `installPlatform`.

**Verify**: after `node scripts/install-ffmpeg.js` on darwin, `test -f vendor/ffmpeg/LICENSE`

On Linux/Windows, keep existing BtbN copy behavior so `vendor/ffmpeg/LICENSE` still exists.

### Step 2: NOTICE

Keep the `vendor/ffmpeg/LICENSE` path if step 1 makes it true on darwin. Still mention https://ffmpeg.org/legal.html.

**Verify**: `grep vendor/ffmpeg/LICENSE NOTICE`

### Step 3: Tests

Optional grep: darwin pin is no longer `"licenseInArchive": null` **or** install script copies a fallback. `npm test` unchanged.

**Verify**: `npm test` → exit 0

## Test plan

- No lavfi change. Optional: `test/` grep that `install-ffmpeg.js` writes LICENSE when `licenseInArchive` is missing.

## Done criteria

- [ ] Documented license path exists after install on darwin (and still on linux/win)
- [ ] NOTICE is not lying about that path
- [ ] App `LICENSE` remains MIT
- [ ] `npm test` exits 0
- [ ] `plans/README.md` 069 DONE

## STOP conditions

- You would relicense the Electron app.
- You would paste a license you cannot attribute.
- 067 changed hash JSON and you cannot tell whose pin is whose — rebase first.

## Maintenance notes

- Reviewer: packager already unpacks `vendor/ffmpeg`; LICENSE will ship in the asar.unpacked tree if it sits next to the binary.
- This is not legal advice (`NOTICE` disclaimer stays).
