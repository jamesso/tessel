const { test } = require('node:test');
const assert = require('node:assert/strict');
const { nextEmptySlots, assignDrops } = require('../lib/slot-fill');

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
