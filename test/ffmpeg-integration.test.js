const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ffmpegBinary = require('ffmpeg-static');

test('bundled ffmpeg encodes 1s lavfi color clip', (t) => {
    if (!ffmpegBinary) {
        t.skip('ffmpeg-static binary not available on this platform');
        return;
    }

    const outPath = path.join(os.tmpdir(), `tessel-ffmpeg-integration-${Date.now()}.mp4`);
    const result = spawnSync(
        ffmpegBinary,
        [
            '-nostdin',
            '-f', 'lavfi',
            '-i', 'color=c=green:s=64x64:d=1',
            '-y',
            '-vcodec', 'libx264',
            '-preset', 'veryfast',
            '-crf', '23',
            '-pix_fmt', 'yuv420p',
            '-r', '25',
            '-an',
            outPath,
        ],
        { encoding: 'utf8' },
    );

    try {
        assert.equal(result.status, 0, result.stderr);
        assert.ok(fs.statSync(outPath).size > 0);
    } finally {
        fs.unlink(outPath, () => {});
    }
});
