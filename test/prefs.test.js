const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
    defaultPrefs,
    normalizePrefs,
    parsePrefsJson,
    filterMissingPaths,
    serializePrefs,
    resolveSaveDefaultPath,
    shouldRestoreGridAndPaths,
} = require('../lib/prefs');

function readRepo(rel) {
    return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
}

const defaults = {
    version: 1,
    gridType: '2x2',
    width: 1280,
    height: 720,
    audio: 'none',
    fit: 'letterbox',
    padMode: 'black',
    durationMode: 'longest',
    lastSaveDir: null,
    paths: [null, null, null, null, null, null, null, null, null],
};

test('defaultPrefs is 720p mute letterbox 2x2 with nine empty paths', () => {
    assert.deepEqual(defaultPrefs(), defaults);
});

test('normalizePrefs fills defaults for missing and invalid fields', () => {
    assert.deepEqual(normalizePrefs(undefined), defaults);
    assert.deepEqual(normalizePrefs(null), defaults);
    assert.deepEqual(normalizePrefs({}), defaults);
    assert.deepEqual(
        normalizePrefs({
            gridType: '4x4',
            width: 640,
            height: 480,
            audio: 'mix',
            fit: 'stretch',
            padMode: 'loop',
            durationMode: 'shortest',
            seconds: 7,
            lastSaveDir: 12,
            paths: 'nope',
        }),
        defaults,
    );
});

test('padMode freeze is preserved; invalid padMode falls back to black', () => {
    assert.equal(normalizePrefs({ padMode: 'freeze' }).padMode, 'freeze');
    assert.equal(normalizePrefs({ padMode: 'loop' }).padMode, 'black');
    assert.equal(normalizePrefs({}).padMode, 'black');
});

test('durationMode seconds with allowlisted seconds is preserved', () => {
    const got = normalizePrefs({ durationMode: 'seconds', seconds: 15 });
    assert.equal(got.durationMode, 'seconds');
    assert.equal(got.seconds, 15);
});

test('durationMode seconds without allowlisted seconds falls back to longest', () => {
    const got = normalizePrefs({ durationMode: 'seconds', seconds: 12 });
    assert.equal(got.durationMode, 'longest');
    assert.equal(got.seconds, undefined);
});

test('parsePrefsJson returns defaults for invalid JSON', () => {
    assert.deepEqual(parsePrefsJson('{'), defaults);
    assert.deepEqual(parsePrefsJson('not json'), defaults);
    assert.deepEqual(parsePrefsJson(''), defaults);
    assert.deepEqual(parsePrefsJson(null), defaults);
});

test('1080p crop first and lastSaveDir are preserved', () => {
    const raw = {
        version: 1,
        gridType: '3x3',
        width: 1920,
        height: 1080,
        audio: 'first',
        fit: 'crop',
        padMode: 'freeze',
        durationMode: 'seconds',
        seconds: 30,
        lastSaveDir: '/Users/me/Exports',
        paths: ['/a.mp4', null, '/c.mp4'],
    };
    const got = normalizePrefs(raw);
    assert.equal(got.gridType, '3x3');
    assert.equal(got.width, 1920);
    assert.equal(got.height, 1080);
    assert.equal(got.audio, 'first');
    assert.equal(got.fit, 'crop');
    assert.equal(got.padMode, 'freeze');
    assert.equal(got.durationMode, 'seconds');
    assert.equal(got.seconds, 30);
    assert.equal(got.lastSaveDir, '/Users/me/Exports');
    assert.equal(got.paths.length, 9);
    assert.equal(got.paths[0], '/a.mp4');
    assert.equal(got.paths[1], null);
    assert.equal(got.paths[2], '/c.mp4');
    assert.equal(got.paths[8], null);
});

test('paths always have length 9', () => {
    assert.equal(normalizePrefs({ paths: [] }).paths.length, 9);
    assert.equal(normalizePrefs({ gridType: '3x3', paths: ['/a.mp4'] }).paths.length, 9);
    const long = normalizePrefs({
        gridType: '3x3',
        paths: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
    });
    assert.equal(long.paths.length, 9);
    assert.equal(long.paths[8], '9');
});

test('unknown version still reads known keys', () => {
    const got = normalizePrefs({
        version: 99,
        width: 1920,
        height: 1080,
        audio: 'first',
        fit: 'crop',
        gridType: '3x3',
        lastSaveDir: '/tmp/out',
        paths: ['/keep.mp4'],
    });
    assert.equal(got.version, 1);
    assert.equal(got.width, 1920);
    assert.equal(got.height, 1080);
    assert.equal(got.audio, 'first');
    assert.equal(got.fit, 'crop');
    assert.equal(got.gridType, '3x3');
    assert.equal(got.lastSaveDir, '/tmp/out');
    assert.equal(got.paths[0], '/keep.mp4');
});

test('2x2 clears hidden slots 5-9', () => {
    const got = normalizePrefs({
        gridType: '2x2',
        paths: ['/1.mp4', '/2.mp4', '/3.mp4', '/4.mp4', '/5.mp4', '/6.mp4', '/7.mp4', '/8.mp4', '/9.mp4'],
    });
    assert.deepEqual(got.paths, ['/1.mp4', '/2.mp4', '/3.mp4', '/4.mp4', null, null, null, null, null]);
});

test('3x3 keeps slots 5-9', () => {
    const paths = ['/1.mp4', '/2.mp4', '/3.mp4', '/4.mp4', '/5.mp4', '/6.mp4', '/7.mp4', '/8.mp4', '/9.mp4'];
    const got = normalizePrefs({ gridType: '3x3', paths });
    assert.deepEqual(got.paths, paths);
});

test('filterMissingPaths nulls files the exists helper rejects', () => {
    const prefs = normalizePrefs({
        gridType: '3x3',
        paths: ['/keep.mp4', '/gone.mp4', null, '/also.mp4'],
    });
    const existing = new Set(['/keep.mp4', '/also.mp4']);
    const filtered = filterMissingPaths(prefs, (p) => existing.has(p));
    assert.deepEqual(filtered.paths, [
        '/keep.mp4',
        null,
        null,
        '/also.mp4',
        null,
        null,
        null,
        null,
        null,
    ]);
});

test('occupied audio slot is preserved', () => {
    const got = normalizePrefs({
        audio: { slot: 2 },
        paths: [null, null, '/c.mp4'],
    });
    assert.deepEqual(got.audio, { slot: 2 });
});

test('unoccupied chosen audio slot falls back to first', () => {
    const got = normalizePrefs({
        audio: { slot: 2 },
        paths: ['/a.mp4', null, null],
    });
    assert.equal(got.audio, 'first');
});

test('audio slot with no occupied paths falls back to mute', () => {
    const got = normalizePrefs({ audio: { slot: 2 } });
    assert.equal(got.audio, 'none');
});

test('invalid audio slot object falls back to first when a clip exists', () => {
    const got = normalizePrefs({
        audio: { slot: 99 },
        paths: ['/a.mp4'],
    });
    assert.equal(got.audio, 'first');
});

test('filterMissingPaths falls back audio when the chosen file is gone', () => {
    const filtered = filterMissingPaths(
        {
            audio: { slot: 1 },
            paths: ['/keep.mp4', '/gone.mp4'],
        },
        (p) => p === '/keep.mp4',
    );
    assert.equal(filtered.paths[1], null);
    assert.equal(filtered.audio, 'first');
});

test('serializePrefs writes pretty JSON of normalized prefs', () => {
    const text = serializePrefs({ audio: 'first', extra: 'drop-me' });
    assert.match(text, /\n/);
    const parsed = JSON.parse(text);
    assert.equal(parsed.audio, 'first');
    assert.equal(parsed.durationMode, 'longest');
    assert.equal(parsed.width, 1280);
    assert.equal(parsed.extra, undefined);
});

test('serializePrefs round-trips through parsePrefsJson', () => {
    const raw = {
        gridType: '3x3',
        width: 1920,
        height: 1080,
        audio: 'first',
        fit: 'crop',
        padMode: 'freeze',
        durationMode: 'seconds',
        seconds: 15,
        lastSaveDir: '/exports',
        paths: ['/a.mp4', null, '/c.mp4'],
    };
    assert.deepEqual(parsePrefsJson(serializePrefs(raw)), normalizePrefs(raw));
});

test('filterMissingPaths after parsePrefsJson nulls missing import paths', () => {
    const json = serializePrefs({
        gridType: '3x3',
        paths: ['/keep.mp4', '/gone.mp4'],
    });
    const imported = filterMissingPaths(parsePrefsJson(json), (p) => p === '/keep.mp4');
    assert.equal(imported.paths[0], '/keep.mp4');
    assert.equal(imported.paths[1], null);
});

test('File menu export collects renderer prefs and writes serializePrefs JSON', () => {
    const main = readRepo('main.js');
    const preload = readRepo('preload.js');
    assert.match(main, /Export layout/);
    assert.match(main, /prefs:collect/);
    assert.match(main, /tessel-layout\.json/);
    assert.match(main, /serializePrefs/);
    assert.match(preload, /prefs:collect/);
});

test('File menu import filters missing paths and applies prefs:imported', () => {
    const main = readRepo('main.js');
    const preload = readRepo('preload.js');
    const index = readRepo('app/js/index.js');
    assert.match(main, /Import layout/);
    assert.match(main, /prefs:imported/);
    assert.match(main, /filterMissingPaths/);
    assert.match(main, /Clip paths are absolute\. Files that are not on this computer are left empty\./);
    assert.match(preload, /prefs:imported/);
    assert.match(index, /prefs:imported/);
    assert.match(index, /applyPrefs/);
    assert.match(index, /persistPrefs/);
});

test('resolveSaveDefaultPath uses lastSaveDir when it exists', () => {
    const desktop = path.join('/Users/me', 'Desktop');
    const last = path.join('/Users/me', 'Exports');
    const got = resolveSaveDefaultPath(last, desktop, 1700000000000, () => true);
    assert.equal(got, path.join(last, 'tesselate1700000000000.mp4'));
});

test('resolveSaveDefaultPath falls back to Desktop when last dir is missing', () => {
    const desktop = path.join('/Users/me', 'Desktop');
    const last = path.join('/gone', 'Exports');
    const got = resolveSaveDefaultPath(last, desktop, 42, () => false);
    assert.equal(got, path.join(desktop, 'tesselate42.mp4'));
});

test('resolveSaveDefaultPath falls back to Desktop when lastSaveDir is null', () => {
    const desktop = path.join('/Users/me', 'Desktop');
    const got = resolveSaveDefaultPath(null, desktop, 7, () => true);
    assert.equal(got, path.join(desktop, 'tesselate7.mp4'));
});

test('shouldRestoreGridAndPaths is true when the user has not touched the grid', () => {
    assert.equal(shouldRestoreGridAndPaths(false), true);
});

test('shouldRestoreGridAndPaths is false after the user touched the grid', () => {
    assert.equal(shouldRestoreGridAndPaths(true), false);
});

test('shouldRestoreGridAndPaths is true when the flag is undefined', () => {
    assert.equal(shouldRestoreGridAndPaths(undefined), true);
});
