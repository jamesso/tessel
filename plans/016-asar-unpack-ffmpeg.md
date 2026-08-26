# Plan 016: Package as asar and unpack only the FFmpeg binary

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat b558cb8..HEAD -- package.json main.js`

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/002-fix-duration-probing.md, plans/008-remove-fluent-ffmpeg-slash.md
- **Category**: migration
- **Planned at**: commit `b558cb8`, 2026-08-26

## Why this matters

All three packager scripts pass `--no-asar` (`package.json:10-12`), added so `spawn(ffmpegPath.path)` can exec a real file (`@ffmpeg-installer/ffmpeg` resolves via `__dirname`). The flag unpacks the **entire** app (JS + node_modules), larger archives and easy post-install edits. Intent is valid; packager can asar the app and unpack only the ffmpeg binary.

## Current state

```
"package-mac": "npx @electron/packager . --overwrite --no-asar --platform=darwin --arch=arm64 ..."
"package-win": "... --no-asar ..."
"package-linux": "... --no-asar ..."
```

`main.js` uses `require('@ffmpeg-installer/ffmpeg').path` for spawn.

`@electron/packager` ^20 is in devDependencies. Commit `ab353f0` message in history: keep ffmpeg on disk with `--no-asar`.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Packager help | `npx @electron/packager --help` | shows asar / unpack flags |
| Tests | `npm test` | exit 0 |
| Platform package | `npm run package-mac` OR `package-linux` OR `package-win` matching the machine | exit 0; ffmpeg binary is a real file outside asar |

## Scope

**In scope**:
- `package.json` three `package-*` scripts
- `main.js` only if `ffmpegPath.path` must use `process.resourcesPath` / `asarUnpack` layout — prefer installer path still working with unpack glob

**Out of scope**:
- Replacing `@ffmpeg-installer/ffmpeg` (plan 026)
- Code signing
- Ignoring `fluent-ffmpeg/coverage` if fluent is already uninstalled (008)

## Git workflow

- Branch: `advisor/016-asar-unpack-ffmpeg`
- Message: `Package the app as asar and unpack the ffmpeg binary.`
- Do not push unless asked.

## Steps

### Step 1: Confirm packager 20 unpack flag

Read `npx @electron/packager --help` and packager 20 docs. Typical form is `--asar.unpack "**/node_modules/@ffmpeg-installer/**"` or `--asar unpack="{*.node,@ffmpeg-installer/**}"`. Use the flag shape **this installed packager version actually accepts**.

Remove `--no-asar` from all three scripts. Enable asar (default true on packager — if default is already asar, only add unpack).

**Verify**: `grep -n "no-asar" package.json` → no matches; unpack glob present on all three scripts

### Step 2: Packaged smoke on this OS

Run the matching `npm run package-*`. After pack:

- macOS: `Tessel.app/Contents/Resources/` should contain `app.asar` **and** an unpacked ffmpeg binary (often `app.asar.unpacked/node_modules/@ffmpeg-installer/...`).
- Confirm `ffmpegPath.path` after a one-line debug **or** run the packaged app once and convert a tiny file.

If `ffmpegPath.path` still points inside `app.asar/` (not `app.asar.unpacked`), STOP — do not ship.

**Verify**: after package, `find release-builds -name ffmpeg -o -name ffmpeg.exe` shows a binary **not** only inside a `.asar` file (asar is a single file; `find` should hit `app.asar.unpacked`)

### Step 3: README

If README mentions `--no-asar` or unpacked trees, update. Optional one line under Building Releases.

**Verify**: `grep -n "no-asar" README.md` → no matches (unless explaining history)

## Test plan

- `npm test` for JS.
- Must run packager on at least the current OS. Do not claim Windows works if you only packed macOS — note in the plan status which OS was smoked.

## Done criteria

- [ ] `--no-asar` removed from all package scripts
- [ ] Unpack glob covers `@ffmpeg-installer`
- [ ] Packaged ffmpeg is a filesystem executable (`app.asar.unpacked` or `Resources`)
- [ ] `npm test` exits 0
- [ ] `plans/README.md` 016 DONE (note OS smoked)

## STOP conditions

- Unpack glob works on darwin but you cannot verify win/linux — land darwin/linux you can test and **report** other platforms unverified; do not copy an unverified glob that differs per OS if help text says one glob works for all.
- `ffmpegPath.path` inside asar after unpack — stop.

## Maintenance notes

- Plan 026 must extend the unpack glob to the new binary location.
- Reviewer: `--prune=true` still present; do not drop icons.
