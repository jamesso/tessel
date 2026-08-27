const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ffmpegBinary = require('ffmpeg-static');
const {
    gridMetrics,
    buildVideoInfo,
    buildFilterComplex,
    buildFfmpegArgs,
} = require('../lib/mosaic');

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

test('duplicate-path mosaic graph encodes with bundled ffmpeg', (t) => {
    if (!ffmpegBinary) {
        t.skip('ffmpeg-static binary not available on this platform');
        return;
    }

    const stamp = Date.now();
    const inputPath = path.join(os.tmpdir(), `tessel-dup-in-${stamp}.mp4`);
    const outPath = path.join(os.tmpdir(), `tessel-dup-out-${stamp}.mp4`);

    const setup = spawnSync(
        ffmpegBinary,
        [
            '-nostdin',
            '-f', 'lavfi',
            '-i', 'color=c=red:s=320x240:d=0.2',
            '-y',
            '-vcodec', 'libx264',
            '-pix_fmt', 'yuv420p',
            '-r', '25',
            '-an',
            inputPath,
        ],
        { encoding: 'utf8' },
    );

    try {
        assert.equal(setup.status, 0, setup.stderr);

        const longestDuration = 0.2;
        const slotPaths = [inputPath, null, null, inputPath];
        const { blockWidth, blockHeight } = gridMetrics('2x2');
        const videoInfo = buildVideoInfo(slotPaths, { [inputPath]: longestDuration }, longestDuration);
        const filterComplex = buildFilterComplex(videoInfo, longestDuration, blockWidth, blockHeight);
        const args = buildFfmpegArgs(videoInfo, filterComplex, longestDuration, outPath);

        assert.equal(args.filter(a => a === '-i').length, 1);
        assert.match(filterComplex, /split=2/);

        const result = spawnSync(ffmpegBinary, args, { encoding: 'utf8' });
        assert.equal(result.status, 0, result.stderr);
        assert.ok(fs.statSync(outPath).size > 0);
    } finally {
        fs.unlink(inputPath, () => {});
        fs.unlink(outPath, () => {});
    }
});

test('one-cell mosaic graph encodes with bundled ffmpeg', (t) => {
    if (!ffmpegBinary) {
        t.skip('ffmpeg-static binary not available on this platform');
        return;
    }

    const stamp = Date.now();
    const inputPath = path.join(os.tmpdir(), `tessel-one-cell-in-${stamp}.mp4`);
    const outPath = path.join(os.tmpdir(), `tessel-one-cell-out-${stamp}.mp4`);

    const setup = spawnSync(
        ffmpegBinary,
        [
            '-nostdin',
            '-f', 'lavfi',
            '-i', 'color=c=blue:s=320x240:d=0.2',
            '-y',
            '-vcodec', 'libx264',
            '-pix_fmt', 'yuv420p',
            '-r', '25',
            '-an',
            inputPath,
        ],
        { encoding: 'utf8' },
    );

    try {
        assert.equal(setup.status, 0, setup.stderr);

        const longestDuration = 0.2;
        const slotPaths = [inputPath, null, null, null];
        const { blockWidth, blockHeight } = gridMetrics('2x2');
        const videoInfo = buildVideoInfo(slotPaths, { [inputPath]: longestDuration }, longestDuration);
        const filterComplex = buildFilterComplex(videoInfo, longestDuration, blockWidth, blockHeight);
        const args = buildFfmpegArgs(videoInfo, filterComplex, longestDuration, outPath);

        assert.doesNotMatch(filterComplex, /xstack/);
        assert.match(filterComplex, /\[final\]/);

        const result = spawnSync(ffmpegBinary, args, { encoding: 'utf8' });
        assert.equal(result.status, 0, result.stderr);
        assert.ok(fs.statSync(outPath).size > 0);
    } finally {
        fs.unlink(inputPath, () => {});
        fs.unlink(outPath, () => {});
    }
});

test('slot-1 audio mosaic maps 1:a? and keeps apad plus -t', (t) => {
    if (!ffmpegBinary) {
        t.skip('ffmpeg-static binary not available on this platform');
        return;
    }

    function makeClip(color, freq, dest) {
        return spawnSync(
            ffmpegBinary,
            [
                '-nostdin',
                '-f', 'lavfi',
                '-i', `color=c=${color}:s=64x64:d=0.4`,
                '-f', 'lavfi',
                '-i', `sine=frequency=${freq}:duration=0.4`,
                '-y',
                '-vcodec', 'libx264',
                '-pix_fmt', 'yuv420p',
                '-r', '25',
                '-shortest',
                dest,
            ],
            { encoding: 'utf8' },
        );
    }

    const stamp = Date.now();
    const leftPath = path.join(os.tmpdir(), `tessel-audio-left-${stamp}.mp4`);
    const rightPath = path.join(os.tmpdir(), `tessel-audio-right-${stamp}.mp4`);
    const outPath = path.join(os.tmpdir(), `tessel-audio-out-${stamp}.mp4`);

    try {
        const left = makeClip('red', 440, leftPath);
        assert.equal(left.status, 0, left.stderr);
        const right = makeClip('blue', 880, rightPath);
        assert.equal(right.status, 0, right.stderr);

        const longestDuration = 0.4;
        const slotPaths = [leftPath, rightPath, null, null];
        const { blockWidth, blockHeight } = gridMetrics('2x2');
        const videoInfo = buildVideoInfo(
            slotPaths,
            { [leftPath]: longestDuration, [rightPath]: longestDuration },
            longestDuration,
        );
        assert.equal(videoInfo[1].inputIndex, 1);
        const filterComplex = buildFilterComplex(videoInfo, longestDuration, blockWidth, blockHeight);
        const args = buildFfmpegArgs(videoInfo, filterComplex, longestDuration, outPath, { audio: { slot: 1 } });
        assert.ok(args.includes('1:a?'));
        assert.equal(args.includes('0:a?'), false);
        assert.ok(args.some((a) => String(a).includes('apad')));
        assert.equal(args[args.indexOf('-t') + 1], '0.4');

        const result = spawnSync(ffmpegBinary, args, { encoding: 'utf8' });
        assert.equal(result.status, 0, result.stderr);
        assert.ok(fs.statSync(outPath).size > 0);

        const probe = spawnSync(ffmpegBinary, ['-nostdin', '-i', outPath], { encoding: 'utf8' });
        const info = `${probe.stdout}\n${probe.stderr}`;
        assert.match(info, /Audio:/);
        assert.match(info, /Duration: 00:00:00\./);
    } finally {
        fs.unlink(leftPath, () => {});
        fs.unlink(rightPath, () => {});
        fs.unlink(outPath, () => {});
    }
});
