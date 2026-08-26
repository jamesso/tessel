const { test } = require('node:test');
const assert = require('node:assert/strict');
const { canSend } = require('../lib/ipc-send');

test('canSend returns false for null', () => {
    assert.equal(canSend(null), false);
});

test('canSend returns false when window is destroyed', () => {
    assert.equal(canSend({ isDestroyed: () => true, webContents: {} }), false);
});

test('canSend returns false when webContents is missing', () => {
    assert.equal(canSend({ isDestroyed: () => false }), false);
});

test('canSend returns true for a live window with webContents', () => {
    assert.equal(canSend({ isDestroyed: () => false, webContents: {} }), true);
});
