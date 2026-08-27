const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { nextEmptySlots, assignDrops, swapOrMove, copyToSlot } = require('../app/js/slot-fill');

test('4 files onto 2x2 with slot 0 filled fill the next three empties', () => {
    const empties = nextEmptySlots([true, false, false, false], 4);
    assert.deepEqual(empties, [1, 2, 3]);
    assert.deepEqual(assignDrops(empties, 0, 4), [1, 2, 3]);
});

test('wrapping from the start index fills later empties then earlier ones', () => {
    const empties = nextEmptySlots([false, true, false, false], 4);
    assert.deepEqual(empties, [0, 2, 3]);
    assert.deepEqual(assignDrops(empties, 2, 3), [2, 3, 0]);
});

test('10 files onto 3x3 fill nine slots and ignore extras', () => {
    const occupied = [false, false, false, false, false, false, false, false, false];
    const empties = nextEmptySlots(occupied, 9);
    const assigned = assignDrops(empties, 0, 10);
    assert.equal(empties.length, 9);
    assert.deepEqual(assigned, [0, 1, 2, 3, 4, 5, 6, 7, 8]);
    assert.equal(assigned.length, 9);
});

test('2x2 never returns hidden indices 4-8', () => {
    const occupied = [false, false, true, false, false, false, false, false, false];
    const empties = nextEmptySlots(occupied, 4);
    assert.deepEqual(empties, [0, 1, 3]);
    for (const index of empties) {
        assert.ok(index < 4);
    }
    const assigned = assignDrops(empties, 3, 4);
    assert.deepEqual(assigned, [3, 0, 1]);
    for (const index of assigned) {
        assert.ok(index < 4);
    }
});

test('swapOrMove is a no-op when from and to are the same slot', () => {
    const paths = ['a.mp4', 'b.mp4', '', ''];
    assert.deepEqual(swapOrMove(paths, 0, 0), ['a.mp4', 'b.mp4', '', '']);
});

test('swapOrMove is a no-op when the source slot is empty', () => {
    const paths = ['', 'b.mp4', '', ''];
    assert.deepEqual(swapOrMove(paths, 0, 1), ['', 'b.mp4', '', '']);
});

test('swapOrMove moves a clip onto an empty visible slot', () => {
    const paths = ['a.mp4', '', 'c.mp4', ''];
    assert.deepEqual(swapOrMove(paths, 0, 1), ['', 'a.mp4', 'c.mp4', '']);
});

test('swapOrMove swaps two occupied visible slots', () => {
    const paths = ['a.mp4', 'b.mp4', '', ''];
    assert.deepEqual(swapOrMove(paths, 0, 1), ['b.mp4', 'a.mp4', '', '']);
});

test('copyToSlot copies a clip onto an empty slot and keeps the source filled', () => {
    const paths = ['a.mp4', '', 'c.mp4', ''];
    assert.deepEqual(copyToSlot(paths, 0, 1), ['a.mp4', 'a.mp4', 'c.mp4', '']);
});

test('copyToSlot is a no-op when the destination slot is occupied', () => {
    const paths = ['a.mp4', 'b.mp4', '', ''];
    assert.deepEqual(copyToSlot(paths, 0, 1), ['a.mp4', 'b.mp4', '', '']);
});

test('copyToSlot is a no-op when from and to are the same slot', () => {
    const paths = ['a.mp4', 'b.mp4', '', ''];
    assert.deepEqual(copyToSlot(paths, 0, 0), ['a.mp4', 'b.mp4', '', '']);
});

test('copyToSlot is a no-op when the source slot is empty', () => {
    const paths = ['', 'b.mp4', '', ''];
    assert.deepEqual(copyToSlot(paths, 0, 2), ['', 'b.mp4', '', '']);
});

test('in-app drop copies onto an empty cell with no modifier; occupied dest still swaps', () => {
    const indexSrc = fs.readFileSync(path.join(__dirname, '../app/js/index.js'), 'utf8');
    assert.match(indexSrc, /effectAllowed = 'copyMove'/);
    assert.match(indexSrc, /copyToSlot/);
    assert.match(indexSrc, /!paths\[i\]/);
    assert.doesNotMatch(indexSrc, /\baltKey\b|\bctrlKey\b|\bmetaKey\b/);
    const emptyDest = ['a.mp4', '', 'c.mp4', ''];
    assert.deepEqual(copyToSlot(emptyDest, 0, 1), ['a.mp4', 'a.mp4', 'c.mp4', '']);
    const occupied = ['a.mp4', 'b.mp4', '', ''];
    assert.deepEqual(swapOrMove(occupied, 0, 1), ['b.mp4', 'a.mp4', '', '']);
});
