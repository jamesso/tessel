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

test('matchProgressTimeInStderr extracts progress time', () => {
    assert.equal(matchProgressTimeInStderr('time=00:00:05.00'), 5);
});

test('progressPercent scales and caps at 99', () => {
    assert.equal(progressPercent(50, 100), 50);
    assert.equal(progressPercent(100, 100), 99);
});
