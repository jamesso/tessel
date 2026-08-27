const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { resolvePackagedFfmpegPath, FFMPEG_PROTOCOL_WHITELIST } = require('../lib/ffmpeg-path');

test('FFMPEG_PROTOCOL_WHITELIST is file,pipe', () => {
    assert.equal(FFMPEG_PROTOCOL_WHITELIST, 'file,pipe');
});

test('resolvePackagedFfmpegPath rewrites app.asar to app.asar.unpacked', () => {
    const asarPath = `/App/Contents/Resources/app.asar/node_modules/ffmpeg-static/ffmpeg`;
    const expected = `/App/Contents/Resources/app.asar.unpacked/node_modules/ffmpeg-static/ffmpeg`;
    assert.equal(resolvePackagedFfmpegPath(asarPath), expected);
});

test('resolvePackagedFfmpegPath leaves app.asar.unpacked paths unchanged', () => {
    const unpackedPath = `/App/Contents/Resources/app.asar.unpacked/node_modules/ffmpeg-static/ffmpeg`;
    assert.equal(resolvePackagedFfmpegPath(unpackedPath), unpackedPath);
});

test('resolvePackagedFfmpegPath leaves unpackaged dev paths unchanged', () => {
    const devPath = `/Users/me/tessel/node_modules/ffmpeg-static/ffmpeg`;
    assert.equal(resolvePackagedFfmpegPath(devPath), devPath);
});

test('resolvePackagedFfmpegPath rewrites Windows-style app.asar segments', () => {
    const asarPath = `C:\\Program Files\\Tessel\\resources\\app.asar\\node_modules\\ffmpeg-static\\ffmpeg.exe`;
    const expected = `C:\\Program Files\\Tessel\\resources\\app.asar.unpacked\\node_modules\\ffmpeg-static\\ffmpeg.exe`;
    assert.equal(resolvePackagedFfmpegPath(asarPath), expected);
});

test('resolvePackagedFfmpegPath returns null and undefined as-is', () => {
    assert.equal(resolvePackagedFfmpegPath(null), null);
    assert.equal(resolvePackagedFfmpegPath(undefined), undefined);
});

test('resolvePackagedFfmpegPath returns empty string as-is', () => {
    assert.equal(resolvePackagedFfmpegPath(''), '');
});
