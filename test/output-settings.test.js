const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
    gridMetrics,
    buildVideoInfo,
    buildFilterComplex,
    buildFfmpegArgs,
    resolveEncodeDuration,
} = require('../lib/mosaic');

const output1080 = { width: 1920, height: 1080 };

function sparseTwoByTwo(options = {}) {
    const longestDuration = 10;
    const slotPaths = ['/only.mp4', null, null, null];
    const { blockWidth, blockHeight } = gridMetrics('2x2', options.output);
    const videoInfo = buildVideoInfo(slotPaths, { '/only.mp4': 10 }, longestDuration, options.output);
    const filterComplex = buildFilterComplex(
        videoInfo,
        longestDuration,
        blockWidth,
        blockHeight,
        { fit: options.fit, output: options.output },
    );
    const args = buildFfmpegArgs(
        videoInfo,
        filterComplex,
        longestDuration,
        '/out.mp4',
        { audio: options.audio, output: options.output },
    );
    return { videoInfo, filterComplex, args, blockWidth, blockHeight };
}

test('1080p 3x3 column widths are 640/640/640', () => {
    const { columnWidths, blockWidth, blockHeight } = gridMetrics('3x3', output1080);
    assert.deepEqual(columnWidths, [640, 640, 640]);
    assert.equal(columnWidths.reduce((sum, w) => sum + w, 0), 1920);
    assert.equal(blockWidth, 640);
    assert.equal(blockHeight, 360);
});

test('1080p 2x2 cells are 960x540', () => {
    const { columnWidths, blockWidth, blockHeight } = gridMetrics('2x2', output1080);
    assert.deepEqual(columnWidths, [960, 960]);
    assert.equal(blockWidth, 960);
    assert.equal(blockHeight, 540);
});

test('1080p 3x3 videoInfo last column fills 1920', () => {
    const ninePaths = [
        '/a.mp4', '/b.mp4', '/c.mp4', '/d.mp4',
        '/e.mp4', '/f.mp4', '/g.mp4', '/h.mp4', '/i.mp4',
    ];
    const videoDurations = Object.fromEntries(ninePaths.map((p) => [p, 10]));
    const videoInfo = buildVideoInfo(ninePaths, videoDurations, 10, output1080);
    assert.equal(videoInfo[0].cellWidth, 640);
    assert.equal(videoInfo[2].cellWidth, 640);
    assert.equal(videoInfo[8].coord.x + videoInfo[8].cellWidth, 1920);
    assert.equal(videoInfo[8].cellHeight, 360);
});

test('crop fit uses increase and crop, not pad', () => {
    const { filterComplex, blockWidth, blockHeight } = sparseTwoByTwo({ fit: 'crop' });
    assert.match(filterComplex, /force_original_aspect_ratio=increase/);
    assert.match(filterComplex, new RegExp(`crop=${blockWidth}:${blockHeight}`));
    assert.doesNotMatch(filterComplex, /force_original_aspect_ratio=decrease/);
    assert.doesNotMatch(filterComplex, /pad=/);
});

test('letterbox default still uses decrease and pad', () => {
    const { filterComplex, blockWidth, blockHeight } = sparseTwoByTwo();
    assert.match(filterComplex, /force_original_aspect_ratio=decrease/);
    assert.match(filterComplex, new RegExp(`pad=${blockWidth}:${blockHeight}`));
    assert.doesNotMatch(filterComplex, /force_original_aspect_ratio=increase/);
    assert.doesNotMatch(filterComplex, /crop=/);
    assert.doesNotMatch(filterComplex, /xstack/);
    assert.match(filterComplex, /\[canvas\]\[block0\]overlay=x=0:y=0\[final\]/);
});

function argsForSlots(slotPaths, audio) {
    const longestDuration = 10;
    const videoDurations = Object.fromEntries(slotPaths.filter(Boolean).map((p) => [p, 10]));
    const gridType = slotPaths.length === 9 ? '3x3' : '2x2';
    const { blockWidth, blockHeight } = gridMetrics(gridType);
    const videoInfo = buildVideoInfo(slotPaths, videoDurations, longestDuration);
    const filterComplex = buildFilterComplex(videoInfo, longestDuration, blockWidth, blockHeight);
    const args = buildFfmpegArgs(videoInfo, filterComplex, longestDuration, '/out.mp4', { audio });
    return { videoInfo, args };
}

test('audio first omits -an and maps 0:a? with apad', () => {
    const { args } = sparseTwoByTwo({ audio: 'first' });
    assert.equal(args[0], '-nostdin');
    assert.equal(args[1], '-protocol_whitelist');
    assert.equal(args[2], 'file,pipe');
    assert.equal(args.includes('-an'), false);
    assert.ok(args.includes('[final]'));
    const mapFlags = args.filter((a, i) => a === '-map');
    assert.ok(mapFlags.length >= 2);
    assert.ok(args.includes('0:a?'));
    assert.ok(args.some((a) => String(a).includes('apad')));
    const tIndex = args.indexOf('-t');
    assert.equal(args[tIndex + 1], '10');
});

test('audio from slot 1 maps 1:a? when that cell inputIndex is 1', () => {
    const { videoInfo, args } = argsForSlots(['/left.mp4', '/right.mp4', null, null], { slot: 1 });
    assert.equal(videoInfo[1].inputIndex, 1);
    assert.ok(args.includes('1:a?'));
    assert.equal(args.includes('0:a?'), false);
    assert.ok(args.some((a) => String(a).includes('apad')));
    assert.equal(args[args.indexOf('-t') + 1], '10');
});

test('chosen occupied slot maps that cell inputIndex not slot number', () => {
    const { videoInfo, args } = argsForSlots([null, '/b.mp4', '/a.mp4', null], { slot: 2 });
    assert.equal(videoInfo[2].inputIndex, 1);
    assert.ok(args.includes(`${videoInfo[2].inputIndex}:a?`));
    assert.equal(args.includes('0:a?'), false);
});

test('unoccupied chosen slot falls back to first occupied inputIndex', () => {
    const { videoInfo, args } = argsForSlots([null, '/b.mp4', '/a.mp4', null], { slot: 0 });
    assert.equal(videoInfo[1].inputIndex, 0);
    assert.ok(args.includes('0:a?'));
    assert.equal(args.includes('1:a?'), false);
});

test('slot 3 in a filled 2x2 maps that cell inputIndex', () => {
    const { videoInfo, args } = argsForSlots(['/a.mp4', '/b.mp4', '/c.mp4', '/d.mp4'], { slot: 3 });
    assert.equal(videoInfo[3].inputIndex, 3);
    assert.ok(args.includes('3:a?'));
});

test('audio none keeps -an and does not map audio', () => {
    const { args } = sparseTwoByTwo({ audio: 'none' });
    assert.equal(args[0], '-nostdin');
    assert.equal(args[1], '-protocol_whitelist');
    assert.equal(args[2], 'file,pipe');
    assert.ok(args.includes('-an'));
    assert.equal(args.includes('0:a?'), false);
    assert.equal(args.some((a) => String(a).includes('apad')), false);
});

test('N-seconds policy sets -t to the cap without changing audio mapping', () => {
    const durations = { '/only.mp4': 10 };
    const encodeDuration = resolveEncodeDuration(durations, { mode: 'seconds', seconds: 5 });
    const slotPaths = ['/only.mp4', null, null, null];
    const { blockWidth, blockHeight } = gridMetrics('2x2');
    const videoInfo = buildVideoInfo(slotPaths, durations, encodeDuration);
    const filterComplex = buildFilterComplex(videoInfo, encodeDuration, blockWidth, blockHeight);
    const args = buildFfmpegArgs(videoInfo, filterComplex, encodeDuration, '/out.mp4', { audio: 'first' });

    assert.equal(encodeDuration, 5);
    assert.equal(args[args.indexOf('-t') + 1], '5');
    assert.ok(args.includes('0:a?'));
    assert.ok(args.some((a) => String(a).includes('apad')));
    assert.doesNotMatch(filterComplex, /tpad/);
});
