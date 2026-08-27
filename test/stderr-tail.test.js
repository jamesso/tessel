const test = require('node:test');
const assert = require('node:assert/strict');
const { appendStderrTail } = require('../lib/stderr-tail');
const { matchProgressTimeInStderr } = require('../lib/timecode');

test('appendStderrTail keeps short append unchanged', () => {
    assert.equal(appendStderrTail('hello', ' world', 100), 'hello world');
});

test('appendStderrTail overflow keeps the last maxChars characters', () => {
    assert.equal(appendStderrTail('a'.repeat(10), 'bcd', 5), 'aabcd');
});

test('appendStderrTail time= at end of 8KB buffer is still in the last 4096', () => {
    const tail = 'frame=  42 fps= 25 size=    1024kB time=00:00:05.00 bitrate=4987.6kbits/s\n';
    const padding = 'x'.repeat(8192 - tail.length);
    const buffer = appendStderrTail(padding, tail, 8192);
    assert.equal(buffer.length, 8192);

    const progressText = buffer.length > 4096 ? buffer.slice(-4096) : buffer;
    assert.equal(matchProgressTimeInStderr(progressText), 5);
});
