const { test } = require('node:test');
const assert = require('node:assert/strict');
const { pinMatches } = require('../scripts/install-ffmpeg-pin');

test('pinMatches returns true when stamp matches expected pin', () => {
    const expected = {
        archiveSha256: 'c1e6caf48923dd8e6bc5e54d51ba70c321175b8162ae9c414c392990e72f0e79',
        platform: 'linux-x64',
    };
    assert.equal(pinMatches({ ...expected }, expected), true);
});

test('pinMatches returns false when archiveSha256 differs', () => {
    const expected = {
        archiveSha256: 'c1e6caf48923dd8e6bc5e54d51ba70c321175b8162ae9c414c392990e72f0e79',
        platform: 'linux-x64',
    };
    assert.equal(
        pinMatches({ archiveSha256: 'deadbeef', platform: 'linux-x64' }, expected),
        false,
    );
});

test('pinMatches returns false when platform differs', () => {
    const expected = {
        archiveSha256: 'c1e6caf48923dd8e6bc5e54d51ba70c321175b8162ae9c414c392990e72f0e79',
        platform: 'linux-x64',
    };
    assert.equal(
        pinMatches({ archiveSha256: expected.archiveSha256, platform: 'win32-x64' }, expected),
        false,
    );
});

test('pinMatches returns false for missing or invalid stamp', () => {
    const expected = {
        archiveSha256: 'c1e6caf48923dd8e6bc5e54d51ba70c321175b8162ae9c414c392990e72f0e79',
        platform: 'linux-x64',
    };
    assert.equal(pinMatches(null, expected), false);
    assert.equal(pinMatches(undefined, expected), false);
    assert.equal(pinMatches('stale', expected), false);
});
