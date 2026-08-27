# Plan 051: FFmpeg version notes

## Why we left ffmpeg-static

`ffmpeg-static@5.3.0` (binary release tag `b6.1.1`) ships **different FFmpeg
versions per platform** from the same npm tag — darwin-arm64 was FFmpeg 6.0
(EOL 2024-07-11) while linux-x64 has been observed at 7.0.2. Install has no
SHA-256 verification ([ffmpeg-static#151](https://github.com/eugeneware/ffmpeg-static/issues/151)).

## Vendor choice

| Platform | Arch | Vendor | FFmpeg line |
|----------|------|--------|-------------|
| darwin | arm64 | [Martin Riedl FFmpeg Build Server](https://ffmpeg.martin-riedl.de/) | 7.1.1 |
| linux | x64 | [BtbN/FFmpeg-Builds](https://github.com/BtbN/FFmpeg-Builds) | 7.1.5 |
| win32 | x64 | [BtbN/FFmpeg-Builds](https://github.com/BtbN/FFmpeg-Builds) | 7.1.5 |

All three targets ship **FFmpeg 7.1** (same major.minor). FFmpeg 7.1 is an
active release branch receiving security fixes. BtbN does not publish macOS
binaries; Martin Riedl's arm64 7.1.1 build is the usual complement for Apple
Silicon.

Pins live in `scripts/ffmpeg-hashes.json`. `npm install` runs
`scripts/install-ffmpeg.js`, which verifies archive SHA-256 before extracting
to `vendor/ffmpeg/`.

## Download URLs and SHA-256 (archives)

| Platform | URL | SHA-256 |
|----------|-----|---------|
| darwin-arm64 | https://ffmpeg.martin-riedl.de/download/macos/arm64/1741000090_7.1.1/ffmpeg.zip | `e18c39a330ad783c33d6d7b47784e82a42f8acdbb497a1f73550f1bc0e830d44` |
| linux-x64 | https://github.com/BtbN/FFmpeg-Builds/releases/download/autobuild-2026-08-16-13-00/ffmpeg-n7.1.5-16-g9a4bb2c579-linux64-gpl-7.1.tar.xz | `21a55e0ad14423572523c04425fd2f7a03bee0436d25a36e629362b99e45fb00` |
| win32-x64 | https://github.com/BtbN/FFmpeg-Builds/releases/download/autobuild-2026-08-16-13-00/ffmpeg-n7.1.5-16-g9a4bb2c579-win64-gpl-7.1.zip | `907ae59ae94d39561b9e03f6d5b0ec4a2778df1e75c763c9a0ddbae266415860` |

## `ffmpeg -version` (first line)

| Platform | Version string |
|----------|----------------|
| darwin-arm64 | `ffmpeg version 7.1.1-https://www.martin-riedl.de Copyright (c) 2000-2025 the FFmpeg developers` |
| linux-x64 | `ffmpeg version 7.1.5 Copyright (c) 2000-2025 the FFmpeg developers` (from BtbN 7.1 branch tag; not run on executor OS) |
| win32-x64 | `ffmpeg version 7.1.5 Copyright (c) 2000-2025 the FFmpeg developers` (from BtbN 7.1 branch tag; not run on executor OS) |

## Previous binary (pre-051, darwin-arm64)

| Field | Value |
|-------|-------|
| Package | `ffmpeg-static@5.3.0` |
| npm tag | `b6.1.1` |
| `ffmpeg -version` | `ffmpeg version 6.0 Copyright (c) 2000-2023 the FFmpeg developers` |

## Install layout

| Platform | Path under `vendor/ffmpeg/` |
|----------|----------------------------|
| darwin | `ffmpeg` |
| linux | `ffmpeg` |
| win32 | `ffmpeg.exe` |

Packager: `asar.unpackDir: 'vendor/ffmpeg'` (`scripts/package.mjs`).

App resolves: `resolvePackagedFfmpegPath(require('./lib/ffmpeg-binary'))`.

## Spike results (darwin-arm64, FFmpeg 7.1.1)

All encodes exited 0 with current mosaic argv (`-fps_mode cfr`, tpad, overlay,
xstack, `split=2`):

- 2×2 grid, unequal input durations (1s + 2s lavfi clips, tpad on shorter)
- N=1 occupied cell (overlay path, no xstack)
- 049 duplicate-path graph (`split=2`, single `-i`)

No argv or golden changes required.

## Binary size (darwin-arm64)

~48 MB (`vendor/ffmpeg/ffmpeg`).
