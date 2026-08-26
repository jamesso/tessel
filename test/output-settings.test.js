const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
    gridMetrics,
    buildVideoInfo,
    buildFilterComplex,
    buildFfmpegArgs,
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
});

test('audio first omits -an and maps 0:a? with apad', () => {
    const { args } = sparseTwoByTwo({ audio: 'first' });
    assert.equal(args.includes('-an'), false);
    assert.ok(args.includes('[final]'));
    const mapFlags = args.filter((a, i) => a === '-map');
    assert.ok(mapFlags.length >= 2);
    assert.ok(args.includes('0:a?'));
    assert.ok(args.some((a) => String(a).includes('apad')));
    const tIndex = args.indexOf('-t');
    assert.equal(args[tIndex + 1], '10');
});

test('audio none keeps -an and does not map audio', () => {
    const { args } = sparseTwoByTwo({ audio: 'none' });
    assert.ok(args.includes('-an'));
    assert.equal(args.includes('0:a?'), false);
    assert.equal(args.some((a) => String(a).includes('apad')), false);
});
