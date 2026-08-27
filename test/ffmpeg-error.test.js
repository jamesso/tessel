const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { formatConversionFailedMessage } = require('../lib/ffmpeg-error');

const root = path.join(__dirname, '..');

function read(rel) {
    return fs.readFileSync(path.join(root, rel), 'utf8');
}

test('formatConversionFailedMessage includes the exit code', () => {
    assert.equal(formatConversionFailedMessage(1, '', null), 'Conversion failed (exit 1)');
});

test('formatConversionFailedMessage uses exit unknown when code is null', () => {
    assert.equal(formatConversionFailedMessage(null, '', null), 'Conversion failed (exit unknown)');
});

test('formatConversionFailedMessage appends a stderr line from the last 1000 chars', () => {
    const stderr = 'x'.repeat(2000) + '\nError while opening encoder\n';
    assert.equal(
        formatConversionFailedMessage(1, stderr, null),
        'Conversion failed (exit 1): Error while opening encoder',
    );
});

test('formatConversionFailedMessage skips ffmpeg progress lines', () => {
    const stderr = 'frame=  42 fps= 25 size=    1024kB time=00:00:01.68 bitrate=4987.6kbits/s\nInvalid data found when processing input\n';
    assert.equal(
        formatConversionFailedMessage(1, stderr, null),
        'Conversion failed (exit 1): Invalid data found when processing input',
    );
});

test('formatConversionFailedMessage truncates long stderr lines to 120 chars', () => {
    const longLine = 'E'.repeat(200);
    assert.equal(
        formatConversionFailedMessage(1, `${longLine}\n`, null),
        `Conversion failed (exit 1): ${'E'.repeat(120)}`,
    );
});

test('formatConversionFailedMessage omits stderr when it mentions the destination path', () => {
    const dest = '/tmp/output/secret-movie.mp4';
    const stderr = `Error opening output file ${dest}: Permission denied\n`;
    assert.equal(formatConversionFailedMessage(1, stderr, dest), 'Conversion failed (exit 1)');
});

test('main.js uses formatConversionFailedMessage and Could not start FFmpeg on spawn error', () => {
    const src = read('main.js');
    assert.match(src, /formatConversionFailedMessage/);
    assert.match(src, /signalError\('Could not start FFmpeg'\)/);
    const spawnError = src.match(/ffmpegProcess\.on\('error'[\s\S]*?\n\s*}\);/);
    assert.ok(spawnError, 'ffmpeg spawn error handler');
    assert.doesNotMatch(spawnError[0], /signalError\(err\.message\)/);
});
