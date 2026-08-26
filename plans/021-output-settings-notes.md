# Plan 021 notes — output settings

Spike decision: **ship three toggles** (resolution, audio, fit). Defaults stay
1280×720, mute, letterbox. No 4×4, 60 fps picker, or mix-all-clips audio.

## Default

Keep **1280×720**, **mute** (`-an`), **letterbox** (`decrease` + `pad`). Existing
720p goldens stay the no-arg path. 1080p 3×3 is 2.25× the pixel count of 720p;
encoder stays `libx264 veryfast` / `crf 23` / `yuv420p` (plan 014). Slowest
supported machines will take longer; do not drop to `ultrafast`.

## Audio

**Mute** remains default. **First** maps the first occupied (non-black) clip’s
audio: drop `-an`, `-map [final]`, then `-map 0:a?` (that clip is always input
`0` because `-i` order follows occupied slots). `asetpts=PTS-STARTPTS` matches
video’s `setpts`. `apad` (unbounded) extends short audio with silence;
`-t longestDuration` stops video and audio together so they stay the same
length. If that first clip has no audio stream, `0:a?` maps nothing and the
file stays silent — no error. Do not mix all clips.

## Fit

**Letterbox** (default): `force_original_aspect_ratio=decrease` + centered
`pad` (plan 007). **Crop**: `increase` + centered `crop` to the cell size.
3×3 leftover pixels still go to the last column (720p: 428; 1080p: 640/640/640).

## Wont-ship

Mix-all-clips audio, per-cell volume/ducking, 4×4 grids, 60 fps picker,
arbitrary width/height fields, encoder preset changes, a second window.
