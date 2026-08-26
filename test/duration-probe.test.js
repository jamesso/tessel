const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
    matchDurationInStderr,
    maxDurationFromMap,
    assertAllFiniteDurations,
} = require('../lib/timecode');

test('maxDurationFromMap returns max of finite positive durations', () => {
    assert.equal(maxDurationFromMap({ a: 5, b: 12, c: 8 }), 12);
});

test('maxDurationFromMap rejects NaN or non-positive values', () => {
    assert.throws(() => maxDurationFromMap({ a: 5, b: NaN }), /Invalid duration in map/);
    assert.throws(() => maxDurationFromMap({ a: 5, b: 0 }), /Invalid duration in map/);
    assert.throws(() => maxDurationFromMap({ a: -1 }), /Invalid duration in map/);
});

test('assertAllFiniteDurations fails when a path is missing', () => {
    assert.throws(
        () => assertAllFiniteDurations({ a: 5 }, ['a', 'b']),
        /Invalid duration for b/
    );
});

test('assertAllFiniteDurations fails on NaN or non-positive', () => {
    assert.throws(() => assertAllFiniteDurations({ a: NaN }, ['a']), /Invalid duration for a/);
    assert.throws(() => assertAllFiniteDurations({ a: 0 }, ['a']), /Invalid duration for a/);
});

test('matchDurationInStderr parses realistic ffmpeg header snippet', () => {
    const snippet = `Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'clip.mp4':
  Metadata:
    major_brand     : isom
  Duration: 00:01:30.50, start: 0.000000, bitrate: 2500 kb/s`;
    assert.equal(matchDurationInStderr(snippet), 90.5);
});
