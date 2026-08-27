const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
    SIZES,
    ENCODE_SECONDS,
    AUDIO,
    FIT,
    sizeValue,
    resolveAudio,
    normalizeAudio,
} = require('../lib/output-allowlist');

const root = path.join(__dirname, '..');

function read(rel) {
    return fs.readFileSync(path.join(root, rel), 'utf8');
}

function optionValues(html, selectId) {
    const selectRe = new RegExp(`<select[^>]*id="${selectId}"[^>]*>([\\s\\S]*?)</select>`, 'i');
    const match = html.match(selectRe);
    assert.ok(match, `missing #${selectId}`);
    const values = [];
    const optRe = /<option[^>]*value="([^"]*)"[^>]*>/gi;
    let opt;
    while ((opt = optRe.exec(match[1])) !== null) {
        values.push(opt[1]);
    }
    return values;
}

test('output-resolution options match SIZES', () => {
    const html = read('app/index.html');
    const expected = SIZES.map(sizeValue);
    assert.deepEqual(optionValues(html, 'output-resolution'), expected);
});

test('output-audio options match AUDIO', () => {
    const html = read('app/index.html');
    assert.deepEqual(optionValues(html, 'output-audio'), AUDIO);
    assert.deepEqual(AUDIO, ['none', 'first']);
});

test('resolveAudio keeps none, first, and occupied slot objects', () => {
    assert.equal(resolveAudio('none'), 'none');
    assert.equal(resolveAudio('first'), 'first');
    assert.deepEqual(resolveAudio({ slot: 2 }), { slot: 2 });
    assert.deepEqual(resolveAudio('slot:1'), { slot: 1 });
    assert.equal(resolveAudio('mix'), 'none');
    assert.equal(resolveAudio({ slot: 99 }), 'first');
});

test('normalizeAudio falls back when the chosen slot is empty', () => {
    const occupied = ['/a.mp4', null, '/c.mp4', null, null, null, null, null, null];
    assert.equal(normalizeAudio('none', occupied), 'none');
    assert.equal(normalizeAudio('first', occupied), 'first');
    assert.deepEqual(normalizeAudio({ slot: 2 }, occupied), { slot: 2 });
    assert.equal(normalizeAudio({ slot: 1 }, occupied), 'first');
    assert.equal(normalizeAudio({ slot: 2 }, [null, null, null, null, null, null, null, null, null]), 'none');
    assert.equal(normalizeAudio('first', [null, null, null, null, null, null, null, null, null]), 'first');
});

test('output-fit options match FIT', () => {
    const html = read('app/index.html');
    assert.deepEqual(optionValues(html, 'output-fit'), FIT);
});

test('output-duration options match longest plus ENCODE_SECONDS', () => {
    const html = read('app/index.html');
    const expected = ['longest', ...ENCODE_SECONDS.map(String)];
    assert.deepEqual(optionValues(html, 'output-duration'), expected);
});
