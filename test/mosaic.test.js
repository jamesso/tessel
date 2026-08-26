const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
    gridMetrics,
    selectSlotPaths,
    buildVideoInfo,
    buildFilterComplex,
    buildFfmpegArgs,
} = require('../lib/mosaic');

const ninePaths = [
    '/a.mp4', '/b.mp4', '/c.mp4', '/d.mp4',
    '/e.mp4', '/f.mp4', '/g.mp4', '/h.mp4', '/i.mp4',
];

test('selectSlotPaths uses four slots for 2x2 and nine for 3x3', () => {
    const twoByTwo = selectSlotPaths(ninePaths, '2x2');
    assert.equal(twoByTwo.length, 4);
    assert.deepEqual(twoByTwo, ninePaths.slice(0, 4));

    const threeByThree = selectSlotPaths(ninePaths, '3x3');
    assert.equal(threeByThree.length, 9);
    assert.deepEqual(threeByThree, ninePaths);
});

test('sparse 2x2 filter and args contract', () => {
    const originalPaths = ['/only.mp4', null, null, null, null, null, null, null, null];
    const slotPaths = selectSlotPaths(originalPaths, '2x2');
    const { blockWidth, blockHeight } = gridMetrics('2x2');
    const longestDuration = 10;
    const videoDurations = { '/only.mp4': 10 };
    const videoInfo = buildVideoInfo(slotPaths, videoDurations, longestDuration);
    const filterComplex = buildFilterComplex(videoInfo, longestDuration, blockWidth, blockHeight);
    const args = buildFfmpegArgs(videoInfo, filterComplex, longestDuration, '/out.mp4');

    assert.match(filterComplex, /color=black/);
    assert.match(filterComplex, /force_original_aspect_ratio=decrease/);
    assert.match(filterComplex, /pad=/);
    assert.match(filterComplex, /\[final\]/);
    assert.ok(args.includes('-map'));
    assert.ok(args.includes('[final]'));
    assert.ok(args.includes('-an'));
    assert.ok(args.includes('-r'));
    assert.ok(args.includes('25'));
    assert.ok(args.includes('-vcodec'));
    assert.ok(args.includes('libx264'));
});

test('full 2x2 occupied cells letterbox each video', () => {
    const { blockWidth, blockHeight } = gridMetrics('2x2');
    const longestDuration = 10;
    const slotPaths = ['/a.mp4', '/b.mp4', '/c.mp4', '/d.mp4'];
    const videoDurations = {
        '/a.mp4': 10,
        '/b.mp4': 10,
        '/c.mp4': 10,
        '/d.mp4': 10,
    };
    const videoInfo = buildVideoInfo(slotPaths, videoDurations, longestDuration);
    const filterComplex = buildFilterComplex(videoInfo, longestDuration, blockWidth, blockHeight);

    assert.match(filterComplex, /force_original_aspect_ratio=decrease/);
    assert.match(filterComplex, new RegExp(`pad=${blockWidth}:${blockHeight}:\\(ow-iw\\)/2:\\(oh-ih\\)/2:black`));
    const scaleMatches = filterComplex.match(/force_original_aspect_ratio=decrease/g);
    assert.equal(scaleMatches.length, 4);
    const padMatches = filterComplex.match(/pad=/g);
    assert.equal(padMatches.length, 4);
});

test('unequal durations: tpad for shorter clip, copy when within 0.1s of max', () => {
    const { blockWidth, blockHeight } = gridMetrics('2x2');
    const longestDuration = 10;
    const shortPath = '/short.mp4';
    const longPath = '/long.mp4';
    const slotPaths = [shortPath, longPath, null, null];
    const videoDurations = { [shortPath]: 5, [longPath]: 10 };
    const videoInfo = buildVideoInfo(slotPaths, videoDurations, longestDuration);

    const filterShortFirst = buildFilterComplex(videoInfo, longestDuration, blockWidth, blockHeight);
    assert.match(filterShortFirst, /tpad/);

    const equalSlotPaths = [longPath, longPath, null, null];
    const equalDurations = { [longPath]: 9.95 };
    const equalVideoInfo = buildVideoInfo(equalSlotPaths, equalDurations, longestDuration);
    const filterEqual = buildFilterComplex(equalVideoInfo, longestDuration, blockWidth, blockHeight);
    assert.match(filterEqual, /copy/);
    assert.doesNotMatch(filterEqual, /tpad/);
});

test('args include -t equal to String(longestDuration)', () => {
    const longestDuration = 12.5;
    const slotPaths = ['/a.mp4', null, null, null];
    const videoInfo = buildVideoInfo(slotPaths, { '/a.mp4': 12.5 }, longestDuration);
    const { blockWidth, blockHeight } = gridMetrics('2x2');
    const filterComplex = buildFilterComplex(videoInfo, longestDuration, blockWidth, blockHeight);
    const args = buildFfmpegArgs(videoInfo, filterComplex, longestDuration, '/out.mp4');

    const tIndex = args.indexOf('-t');
    assert.equal(args[tIndex + 1], String(longestDuration));
});

test('buildFfmpegArgs throws when all slots are black', () => {
    const slotPaths = [null, null, null, null];
    const videoInfo = buildVideoInfo(slotPaths, {}, 10);
    const { blockWidth, blockHeight } = gridMetrics('2x2');
    const filterComplex = buildFilterComplex(videoInfo, 10, blockWidth, blockHeight);

    assert.throws(
        () => buildFfmpegArgs(videoInfo, filterComplex, 10, '/out.mp4'),
        /No video inputs/,
    );
});
