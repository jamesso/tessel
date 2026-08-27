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

    const colorSources = filterComplex.match(/color=black:size=/g);
    assert.equal(colorSources.length, 1);
    assert.match(filterComplex, /color=black:size=1280x720/);
    assert.doesNotMatch(filterComplex, /color=black:size=640x360/);
    assert.match(filterComplex, /force_original_aspect_ratio=decrease/);
    assert.match(filterComplex, /pad=/);
    assert.match(filterComplex, /\[final\]/);
    assert.equal(args[0], '-nostdin');
    assert.equal(args[1], '-protocol_whitelist');
    assert.equal(args[2], 'file,pipe');
    assert.ok(args.includes('-map'));
    assert.ok(args.includes('[final]'));
    assert.ok(args.includes('-an'));
    assert.ok(args.includes('-r'));
    assert.ok(args.includes('25'));
    assert.ok(args.includes('-vcodec'));
    assert.ok(args.includes('libx264'));
    const vcodecIndex = args.indexOf('libx264');
    assert.equal(args[vcodecIndex + 1], '-preset');
    assert.equal(args[vcodecIndex + 2], 'veryfast');
    assert.equal(args[vcodecIndex + 3], '-crf');
    assert.equal(args[vcodecIndex + 4], '23');
    assert.equal(args[vcodecIndex + 5], '-pix_fmt');
    assert.equal(args[vcodecIndex + 6], 'yuv420p');
    assert.equal(args[args.indexOf('-fps_mode') + 1], 'cfr');
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

    assert.equal(args[0], '-nostdin');
    assert.equal(args[1], '-protocol_whitelist');
    assert.equal(args[2], 'file,pipe');
    const tIndex = args.indexOf('-t');
    assert.equal(args[tIndex + 1], String(longestDuration));
});

test('3x3 column widths sum to 1280 with last column 428px', () => {
    const { columnWidths } = gridMetrics('3x3');
    assert.deepEqual(columnWidths, [426, 426, 428]);
    assert.equal(columnWidths.reduce((sum, w) => sum + w, 0), 1280);
});

test('3x3 xstack layout and cell sizes fill canvas width', () => {
    const longestDuration = 10;
    const slotPaths = ninePaths;
    const videoDurations = Object.fromEntries(ninePaths.map(p => [p, 10]));
    const videoInfo = buildVideoInfo(slotPaths, videoDurations, longestDuration);
    const { blockWidth, blockHeight } = gridMetrics('3x3');
    const filterComplex = buildFilterComplex(videoInfo, longestDuration, blockWidth, blockHeight);

    assert.equal(videoInfo[0].coord.x, 0);
    assert.equal(videoInfo[1].coord.x, 426);
    assert.equal(videoInfo[2].coord.x, 852);
    assert.equal(videoInfo[0].cellWidth, 426);
    assert.equal(videoInfo[1].cellWidth, 426);
    assert.equal(videoInfo[2].cellWidth, 428);

    const lastCell = videoInfo[8];
    assert.equal(lastCell.coord.x + lastCell.cellWidth, 1280);

    assert.match(filterComplex, /scale=428:240:force_original_aspect_ratio=decrease/);
    assert.match(filterComplex, /pad=428:240:\(ow-iw\)\/2:\(oh-ih\)\/2:black/);
    assert.match(filterComplex, /xstack=inputs=9:fill=black:layout=.*852_480/);
    assert.match(filterComplex, /\[canvas\]\[stacked\]overlay=x=0:y=0\[final\]/);
    assert.doesNotMatch(filterComplex, /mosaic\d/);
    assert.doesNotMatch(filterComplex, /overlay=x=852:y=480/);
});

test('3x3 all-black slots skip per-cell color sources; last column metadata stays 428px', () => {
    const longestDuration = 10;
    const slotPaths = [null, null, null, null, null, null, null, null, null];
    const videoInfo = buildVideoInfo(slotPaths, {}, longestDuration);
    const { blockWidth, blockHeight } = gridMetrics('3x3');
    const filterComplex = buildFilterComplex(videoInfo, longestDuration, blockWidth, blockHeight);

    assert.equal(videoInfo[8].cellWidth, 428);
    const colorSources = filterComplex.match(/color=black:size=/g);
    assert.equal(colorSources.length, 1);
    assert.match(filterComplex, /color=black:size=1280x720/);
    assert.doesNotMatch(filterComplex, /color=black:size=428x240/);
    assert.doesNotMatch(filterComplex, /overlay=/);
});

test('2x2 grid metrics unchanged', () => {
    const { gridSize, blockWidth, blockHeight, columnWidths } = gridMetrics('2x2');
    assert.equal(gridSize, 2);
    assert.equal(blockWidth, 640);
    assert.equal(blockHeight, 360);
    assert.deepEqual(columnWidths, [640, 640]);
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
