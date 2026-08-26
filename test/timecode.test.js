const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
    parseFfmpegClock,
    matchDurationInStderr,
    matchProgressTimeInStderr,
    progressPercent,
} = require('../lib/timecode');

test('parseFfmpegClock parses H:M:S', () => {
    assert.equal(parseFfmpegClock('01:02:03.5'), 3723.5);
});

test('parseFfmpegClock returns 0 for empty or N/A', () => {
    assert.equal(parseFfmpegClock(''), 0);
    assert.equal(parseFfmpegClock('N/A'), 0);
});

test('matchDurationInStderr extracts duration', () => {
    assert.equal(matchDurationInStderr('Duration: 00:01:00.00'), 60);
});

test('matchDurationInStderr returns null when no match', () => {
    assert.equal(matchDurationInStderr('no duration here'), null);
});

test('matchDurationInStderr returns null for Duration N/A banner', () => {
    assert.equal(matchDurationInStderr('Duration: N/A'), null);
});

test('matchProgressTimeInStderr extracts progress time', () => {
    assert.equal(matchProgressTimeInStderr('time=00:00:05.00'), 5);
});

test('matchProgressTimeInStderr parses bundled ffmpeg stderr snippet', () => {
    const stderr =
        'frame=   25 fps=0.0 q=-1.0 Lsize=       3kB time=00:00:00.88 bitrate=  27.2kbits/s speed=  29x';
    assert.equal(matchProgressTimeInStderr(stderr), 0.88);
});

test('matchProgressTimeInStderr returns null for time=N/A', () => {
    assert.equal(matchProgressTimeInStderr('frame=    0 fps=0.0 q=0.0 size=       0kB time=N/A bitrate=N/A speed=N/A'), null);
});

test('progressPercent scales in-progress samples; caps at 99 (100 sent on encode done)', () => {
    assert.equal(progressPercent(50, 100), 50);
    assert.equal(progressPercent(100, 100), 99);
});
