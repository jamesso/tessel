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
