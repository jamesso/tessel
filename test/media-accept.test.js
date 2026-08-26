const { test } = require('node:test');
const assert = require('node:assert/strict');
const { VIDEO_EXTENSIONS, isProbablyVideoFile } = require('../lib/media-accept');

test('VIDEO_EXTENSIONS lists movie types without leading dots', () => {
    assert.deepEqual(VIDEO_EXTENSIONS, ['mp4', 'mov', 'm4v', 'webm', 'avi', 'mkv']);
});

test('accepts clip.MOV with an empty MIME type', () => {
    assert.equal(isProbablyVideoFile({ type: '', name: 'clip.MOV' }), true);
});

test('accepts empty MIME and a .mov name', () => {
    assert.equal(isProbablyVideoFile({ type: '', name: 'clip.mov' }), true);
});

test('rejects notes.txt', () => {
    assert.equal(isProbablyVideoFile({ type: '', name: 'notes.txt' }), false);
});

test('accepts video/quicktime regardless of name', () => {
    assert.equal(isProbablyVideoFile({ type: 'video/quicktime', name: 'clip' }), true);
});

test('rejects image/jpeg even when the name looks like a video', () => {
    assert.equal(isProbablyVideoFile({ type: 'image/jpeg', name: 'foo.mp4' }), false);
});

test('accepts a missing type when the name has a video extension', () => {
    assert.equal(isProbablyVideoFile({ name: 'a.webm' }), true);
});
