const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { VIDEO_EXTENSIONS, isProbablyVideoFile } = require('../lib/media-accept');

const root = path.join(__dirname, '..');

function read(rel) {
    return fs.readFileSync(path.join(root, rel), 'utf8');
}

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

test('renderer media-accept script exports the same helper as lib', () => {
    const renderer = require('../app/js/media-accept');
    assert.deepEqual(renderer.VIDEO_EXTENSIONS, VIDEO_EXTENSIONS);
    assert.equal(
        renderer.isProbablyVideoFile({ type: '', name: 'clip.MOV' }),
        isProbablyVideoFile({ type: '', name: 'clip.MOV' })
    );
    assert.equal(
        renderer.isProbablyVideoFile({ type: 'image/jpeg', name: 'foo.mp4' }),
        isProbablyVideoFile({ type: 'image/jpeg', name: 'foo.mp4' })
    );
});

test('index page loads media-accept as a renderer script, not via preload', () => {
    assert.match(read('app/index.html'), /js\/media-accept\.js/);
    assert.doesNotMatch(read('preload.js'), /media-accept/);
    assert.match(read('app/js/index.js'), /window\.isProbablyVideoFile/);
    assert.match(read('app/js/index.js'), /window\.VIDEO_EXTENSIONS/);
    assert.doesNotMatch(read('app/js/index.js'), /electronAPI\.isProbablyVideoFile/);
    assert.doesNotMatch(read('app/js/index.js'), /electronAPI\.VIDEO_EXTENSIONS/);
});
