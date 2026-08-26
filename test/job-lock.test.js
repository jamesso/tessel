const { test } = require('node:test');
const assert = require('node:assert/strict');
const { shouldRejectSecondJob } = require('../lib/job-lock');

test('shouldRejectSecondJob returns false when no active job', () => {
    assert.equal(shouldRejectSecondJob(null), false);
    assert.equal(shouldRejectSecondJob(undefined), false);
    assert.equal(shouldRejectSecondJob(false), false);
});

test('shouldRejectSecondJob returns true when a job is active', () => {
    assert.equal(shouldRejectSecondJob(true), true);
    assert.equal(shouldRejectSecondJob({ pid: 123 }), true);
    assert.equal(shouldRejectSecondJob('probing'), true);
});
