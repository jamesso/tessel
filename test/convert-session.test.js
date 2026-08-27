const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { shouldUnlinkPartialOutput, tempOutputPath } = require('../lib/convert-session');

const root = path.join(__dirname, '..');

function read(rel) {
    return fs.readFileSync(path.join(root, rel), 'utf8');
}

function handlerAfter(source, marker) {
    const start = source.indexOf(marker);
    assert.ok(start !== -1, `missing ${marker}`);
    const rest = source.slice(start + marker.length);
    const next = rest.search(/\nelectronAPI\.receive\(|\nfunction |\ndocument\./);
    return next === -1 ? rest : rest.slice(0, next);
}

test('shouldUnlinkPartialOutput only when this job created the file after encode started', () => {
    assert.equal(shouldUnlinkPartialOutput({ encodeStarted: true, createdByThisJob: true }), true);
    assert.equal(shouldUnlinkPartialOutput({ encodeStarted: true, createdByThisJob: false }), false);
    assert.equal(shouldUnlinkPartialOutput({ encodeStarted: false, createdByThisJob: true }), false);
    assert.equal(shouldUnlinkPartialOutput({ encodeStarted: false, createdByThisJob: false }), false);
});

test('tempOutputPath appends .tessel-partial sibling suffix', () => {
    assert.equal(tempOutputPath('/tmp/a.mp4'), '/tmp/a.mp4.tessel-partial');
});

test('preload send whitelist includes video:cancel', () => {
    const src = read('preload.js');
    assert.match(src, /validChannels = \['video:convert', 'video:cancel'\]/);
});

test('sandboxed preload does not require relative CommonJS modules', () => {
    const src = read('preload.js');
    assert.doesNotMatch(src, /require\s*\(\s*['"]\./);
});

test('preload receive whitelist includes video:cancelled', () => {
    const src = read('preload.js');
    assert.match(src, /'video:cancelled'/);
    assert.match(src, /'video:progress'/);
    assert.match(src, /'video:done'/);
    assert.match(src, /'video:error'/);
});

test('main registers video:cancel and kill notifies video:cancelled not video:done', () => {
    const mainSrc = read('main.js');
    assert.match(mainSrc, /ipcMain\.on\('video:cancel'/);
    assert.match(mainSrc, /ffmpegSession\.killActiveFfmpeg\(/);
    const sessionSrc = read('lib/ffmpeg-session.js');
    assert.match(sessionSrc, /sendToRenderer\('video:cancelled'\)/);
    const killFn = sessionSrc.match(/function killActiveFfmpeg[\s\S]*?\n    }\n/);
    assert.ok(killFn, 'killActiveFfmpeg function');
    assert.doesNotMatch(killFn[0], /video:done/);
    assert.doesNotMatch(killFn[0], /video:error/);
});

test('overlay cancel control exists and sends video:cancel without alerting', () => {
    assert.match(read('app/index.html'), /id="cancel-convert"/);
    const js = read('app/js/index.js');
    assert.match(js, /cancel-convert/);
    assert.match(js, /send\('video:cancel'/);
    const cancelled = handlerAfter(js, "electronAPI.receive('video:cancelled'");
    assert.doesNotMatch(cancelled, /alert\s*\(/);
});

test('video:done keeps slots and shows toast without leftover comment', () => {
    const js = read('app/js/index.js');
    const html = read('app/index.html');
    const css = read('app/css/style.css');
    const done = handlerAfter(js, "electronAPI.receive('video:done'");
    assert.doesNotMatch(done, /clearAllVideos\s*\(/);
    assert.doesNotMatch(js, /add toast for coversion complete/);
    assert.match(html, /id="toast"/);
    assert.match(js, /getElementById\(['"]toast['"]\)/);
    assert.match(css, /#toast/);
    assert.match(js, /function clearAllVideos\s*\(/);
});
