const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
    pathToPreviewSrc,
    showCellPreview,
    hideCellPreview,
    pausePreviewAtFirstFrame,
} = require('../app/js/cell-preview');

const root = path.join(__dirname, '..');

function read(rel) {
    return fs.readFileSync(path.join(root, rel), 'utf8');
}

function fakeVideo() {
    const classes = new Set(['hidden']);
    return {
        src: '',
        currentTime: 0,
        duration: 1,
        muted: false,
        loadCalls: 0,
        pauseCalls: 0,
        classList: {
            add(name) {
                classes.add(name);
            },
            remove(name) {
                classes.delete(name);
            },
            contains(name) {
                return classes.has(name);
            },
        },
        removeAttribute(name) {
            if (name === 'src') {
                this.src = '';
            }
        },
        load() {
            this.loadCalls += 1;
        },
        pause() {
            this.pauseCalls += 1;
        },
    };
}

test('pathToPreviewSrc builds a file URL from an absolute unix path', () => {
    assert.equal(pathToPreviewSrc('/Users/me/clip.mp4'), 'file:///Users/me/clip.mp4');
});

test('pathToPreviewSrc encodes spaces in the basename', () => {
    assert.equal(pathToPreviewSrc('/tmp/my clip.mp4'), 'file:///tmp/my%20clip.mp4');
});

test('pathToPreviewSrc returns empty for missing paths', () => {
    assert.equal(pathToPreviewSrc(''), '');
    assert.equal(pathToPreviewSrc(null), '');
    assert.equal(pathToPreviewSrc(undefined), '');
});

test('pathToPreviewSrc leaves existing file URLs alone', () => {
    assert.equal(pathToPreviewSrc('file:///tmp/a.mp4'), 'file:///tmp/a.mp4');
});

test('showCellPreview sets src and unhides the video', () => {
    const video = fakeVideo();
    showCellPreview(video, '/tmp/a.mp4');
    assert.equal(video.src, 'file:///tmp/a.mp4');
    assert.equal(video.classList.contains('hidden'), false);
});

test('hideCellPreview clears src, hides, pauses, and reloads to drop the decoder', () => {
    const video = fakeVideo();
    showCellPreview(video, '/tmp/a.mp4');
    hideCellPreview(video);
    assert.equal(video.src, '');
    assert.equal(video.classList.contains('hidden'), true);
    assert.equal(video.pauseCalls, 1);
    assert.equal(video.loadCalls, 1);
});

test('showCellPreview with an empty path hides instead of pointing at a blank src', () => {
    const video = fakeVideo();
    showCellPreview(video, '/tmp/a.mp4');
    showCellPreview(video, '');
    assert.equal(video.src, '');
    assert.equal(video.classList.contains('hidden'), true);
});

test('pausePreviewAtFirstFrame pauses and seeks off a possible black first frame', () => {
    const video = fakeVideo();
    pausePreviewAtFirstFrame(video);
    assert.equal(video.muted, true);
    assert.equal(video.pauseCalls, 1);
    assert.ok(video.currentTime > 0);
    assert.ok(video.currentTime < 0.2);
});

test('index page loads cell-preview and each dropzone has a muted metadata-only video', () => {
    const html = read('app/index.html');
    assert.match(html, /js\/cell-preview\.js/);
    assert.equal((html.match(/class="cell-preview hidden"/g) || []).length, 9);
    assert.match(html, /preload="metadata"/);
    assert.match(html, /\bmuted\b/);
    assert.match(html, /\bplaysinline\b/);
    assert.doesNotMatch(html, /\sautoplay\b/i);
    assert.doesNotMatch(html, /\sloop\b/i);
});

test('setSlotOccupied shows the preview and clearSlot hides it', () => {
    const src = read('app/js/index.js');
    assert.match(src, /showCellPreview\(/);
    assert.match(src, /hideCellPreview\(/);
    const occupy = src.indexOf('function setSlotOccupied');
    const clear = src.indexOf('function clearSlot');
    const occupyBlock = src.slice(occupy, clear);
    const clearBlock = src.slice(clear, src.indexOf('function visibleSlotCount'));
    assert.match(occupyBlock, /showCellPreview\(/);
    assert.match(clearBlock, /hideCellPreview\(/);
});

test('cell preview CSS letterboxes without stealing clicks from replace and close', () => {
    const css = read('app/css/style.css');
    assert.match(css, /\.cell-preview[\s\S]*object-fit:\s*contain/);
    assert.match(css, /\.cell-preview[\s\S]*pointer-events:\s*none/);
});
