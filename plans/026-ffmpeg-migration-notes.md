# Plan 026: FFmpeg migration notes

## Replacement

| Field | Value |
|-------|-------|
| **Candidate** | `ffmpeg-static@5.3.0` |
| **Previous** | `@ffmpeg-installer/ffmpeg@1.1.0` (FFmpeg 4.4, last published 2021) |
| **License** | GPL-3.0-or-later (npm package); bundled binary is GPL ffmpeg (same class of issue as the old installer) |
| **Import** | `require('ffmpeg-static')` returns the binary path string (not `{ path }`) |

## Platforms (packager targets)

| Platform | Arch | Binary path under `node_modules/ffmpeg-static/` |
|----------|------|--------------------------------------------------|
| darwin | arm64 | `ffmpeg` |
| win32 | x64 | `ffmpeg.exe` |
| linux | x64 | `ffmpeg` |

`ffmpeg-static` selects the correct filename per platform at install time; `main.js` does not hardcode a mac-only name.

## Binary size (darwin-arm64 spike)

~44 MB (`node_modules/ffmpeg-static/ffmpeg`). Previous `@ffmpeg-installer/darwin-arm64` was ~45 MB.

## FFmpeg version

`ffmpeg -version` on darwin-arm64: **6.0** (build from `ffmpeg-static` binary release tag `b6.1.1` in package metadata).

## Asar unpack

Packager `--asar.unpackDir=node_modules/ffmpeg-static` (replaces `node_modules/@ffmpeg-installer`).

Unpacked layout: `app.asar.unpacked/node_modules/ffmpeg-static/ffmpeg` (or `ffmpeg.exe` on Windows).

## `-vsync` vs `-fps_mode`

FFmpeg 6.0 **accepts** `-vsync cfr` but prints: `-vsync is deprecated. Use -fps_mode`.

Decision: **keep `-vsync cfr`** in `lib/mosaic.js` and tests. No semantic change to tpad/overlay/duration goldens; spike 2×2 lavfi encode with unequal durations (tpad + overlay) exited 0. Replace with `-fps_mode cfr` only when a future ffmpeg build rejects `-vsync`.

## Spike results (darwin-arm64)

- `ffmpeg -version`: exit 0, FFmpeg 6.0
- 1s lavfi color encode with mosaic argv flags: exit 0
- 2×2 mosaic with 1s + 2s lavfi clips (tpad on shorter): exit 0, output 4495 bytes
