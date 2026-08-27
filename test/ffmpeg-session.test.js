const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createFfmpegSession } = require('../lib/ffmpeg-session');

function createFakeProcess() {
    const proc = new EventEmitter();
    proc.stderr = new EventEmitter();
    proc.stdout = new EventEmitter();
    proc.killCalls = 0;
    proc.kill = function () {
        proc.killCalls++;
        setImmediate(() => proc.emit('close', 0));
    };
    return proc;
}

function createSpawnFake() {
    const probes = [];
    const encodes = [];

    function spawn(_binary, args) {
        const proc = createFakeProcess();
        if (args.includes('-hide_banner')) {
            probes.push(proc);
        } else {
            encodes.push(proc);
        }
        return proc;
    }

    return { spawn, probes, encodes };
}

function createConcurrencySpawnFake() {
    const probes = [];
    const encodes = [];
    let liveProbes = 0;
    let maxLiveProbes = 0;

    function spawn(_binary, args) {
        const proc = createFakeProcess();
        if (args.includes('-hide_banner')) {
            probes.push(proc);
            liveProbes++;
            maxLiveProbes = Math.max(maxLiveProbes, liveProbes);
            proc.once('close', () => {
                liveProbes--;
            });
        } else {
            encodes.push(proc);
        }
        return proc;
    }

    return {
        spawn,
        probes,
        encodes,
        getMaxLiveProbes: () => maxLiveProbes,
    };
}

const fakeFs = {
    existsSync: () => false,
    unlinkSync: () => {},
    renameSync: () => {},
};

function createTrackingFs(existsFor = []) {
    const calls = { exists: [], unlinks: [], renames: [] };
    const fs = {
        existsSync(p) {
            calls.exists.push(p);
            return existsFor.includes(p);
        },
        unlinkSync(p) {
            calls.unlinks.push(p);
        },
        renameSync(from, to) {
            calls.renames.push([from, to]);
        },
    };
    return { fs, calls };
}

function defaultConvertPayload(overrides = {}) {
    return {
        vidPath1: '/a.mp4',
        vidPath2: undefined,
        vidPath3: undefined,
        vidPath4: undefined,
        vidPath5: undefined,
        vidPath6: undefined,
        vidPath7: undefined,
        vidPath8: undefined,
        vidPath9: undefined,
        gridType: '2x2',
        filePath: '/tmp/out.mp4',
        width: 1280,
        height: 720,
        audio: 'none',
        fit: 'letterbox',
        ...overrides,
    };
}

async function waitUntil(predicate, timeoutMs = 1000) {
    const start = Date.now();
    while (!predicate()) {
        if (Date.now() - start > timeoutMs) {
            throw new Error('timeout waiting for condition');
        }
        await new Promise((r) => setImmediate(r));
    }
}

function createSession(spawn, overrides = {}) {
    const sent = [];
    const session = createFfmpegSession({
        spawn,
        ffmpegBinary: '/ffmpeg',
        fs: fakeFs,
        send: (channel, ...args) => sent.push({ channel, args }),
        ...overrides,
    });
    return { session, sent };
}

test('no videos sends video:error and is not busy afterwards', () => {
    const { spawn } = createSpawnFake();
    const { session, sent } = createSession(spawn);

    session.convertVideo({});

    assert.ok(sent.some((s) => s.channel === 'video:error' && s.args[0] === 'No videos provided'));
    assert.equal(session.isBusy(), false);
});

test('missing binary sends FFmpeg binary not found', () => {
    const { spawn } = createSpawnFake();
    const { session, sent } = createSession(spawn, { ffmpegBinary: null });

    session.convertVideo(defaultConvertPayload({ vidPath1: '/a.mp4' }));

    assert.ok(sent.some((s) => s.channel === 'video:error' && s.args[0] === 'FFmpeg binary not found for this platform'));
});

test('reject second job while probe is in flight', async () => {
    const { spawn, probes } = createSpawnFake();
    const { session, sent } = createSession(spawn);

    session.convertVideo(defaultConvertPayload());
    await waitUntil(() => probes.length === 1);

    session.convertVideo(defaultConvertPayload());

    assert.ok(sent.some((s) => s.channel === 'video:error' && s.args[0] === 'A conversion is already running'));
});

test('happy path probes then encodes to video:done', async () => {
    const { spawn, probes, encodes } = createSpawnFake();
    const { session, sent } = createSession(spawn);

    session.convertVideo(defaultConvertPayload());

    await waitUntil(() => probes.length === 1);
    probes[0].stderr.emit('data', 'Duration: 00:00:01.00\n');

    await waitUntil(() => encodes.length === 1);
    encodes[0].stderr.emit('data', 'frame=  12 fps=0.0 q=0.0 size=       0kB time=00:00:00.40 bitrate=N/A\n');
    encodes[0].emit('close', 0);

    await waitUntil(() => sent.some((s) => s.channel === 'video:done'));

    assert.ok(sent.some((s) => s.channel === 'video:progress'));
    assert.ok(sent.some((s) => s.channel === 'video:done'));
    assert.ok(!sent.some((s) => s.channel === 'video:error'));
    assert.equal(session.isBusy(), false);
});

test('encode progress parses time= split across stderr chunks', async () => {
    const { spawn, probes, encodes } = createSpawnFake();
    const { session, sent } = createSession(spawn);

    session.convertVideo(defaultConvertPayload());

    await waitUntil(() => probes.length === 1);
    probes[0].stderr.emit('data', 'Duration: 00:00:01.00\n');

    await waitUntil(() => encodes.length === 1);
    encodes[0].stderr.emit('data', 'time=00:00:0');
    encodes[0].stderr.emit('data', '1.00 bitrate=N/A\n');

    await waitUntil(() => sent.some((s) => s.channel === 'video:progress' && s.args[0] && s.args[0].percent >= 99));
    encodes[0].emit('close', 0);
    await waitUntil(() => sent.some((s) => s.channel === 'video:done'));
});

test('encode failure sends Conversion failed without video:done', async () => {
    const { spawn, probes, encodes } = createSpawnFake();
    const { session, sent } = createSession(spawn);

    session.convertVideo(defaultConvertPayload());

    await waitUntil(() => probes.length === 1);
    probes[0].stderr.emit('data', 'Duration: 00:00:01.00\n');

    await waitUntil(() => encodes.length === 1);
    encodes[0].emit('close', 1);

    await waitUntil(() => sent.some((s) => s.channel === 'video:error' && /Conversion failed \(exit /.test(s.args[0])));

    assert.ok(!sent.some((s) => s.channel === 'video:done'));
});

test('probe failure sends Could not read video duration', async () => {
    const { spawn, probes } = createSpawnFake();
    const { session, sent } = createSession(spawn);

    session.convertVideo(defaultConvertPayload());

    await waitUntil(() => probes.length === 1);
    probes[0].emit('close', 1);

    await waitUntil(() => sent.some((s) => s.channel === 'video:error' && s.args[0] === 'Could not read video duration'));
});

test('multi-path probe failure kills sibling probes and allows a new convert', async () => {
    const { spawn, probes } = createSpawnFake();
    const { session, sent } = createSession(spawn);

    session.convertVideo(defaultConvertPayload({
        vidPath1: '/a.mp4',
        vidPath2: '/b.mp4',
        vidPath3: '/c.mp4',
        vidPath4: '/d.mp4',
    }));

    await waitUntil(() => probes.length >= 2);
    probes[0].emit('close', 1);

    await waitUntil(() => sent.some((s) => s.channel === 'video:error' && s.args[0] === 'Could not read video duration'));

    assert.ok(!sent.some((s) => s.channel === 'video:cancelled'));
    assert.ok(!sent.some((s) => s.channel === 'video:done'));
    assert.equal(session.isBusy(), false);

    for (let i = 1; i < probes.length; i++) {
        assert.ok(probes[i].killCalls >= 1, `expected probe ${i} to be killed`);
    }

    const eventsBeforeRetry = sent.length;
    session.convertVideo(defaultConvertPayload({ vidPath1: '/retry.mp4' }));
    await waitUntil(() => probes.length >= 4);

    const retryEvents = sent.slice(eventsBeforeRetry);
    assert.ok(!retryEvents.some((s) => s.channel === 'video:error' && s.args[0] === 'A conversion is already running'));
});

test('cancel during encode sends video:cancelled without video:done or video:error', async () => {
    const { spawn, probes, encodes } = createSpawnFake();
    const { session, sent } = createSession(spawn);

    session.convertVideo(defaultConvertPayload());

    await waitUntil(() => probes.length === 1);
    probes[0].stderr.emit('data', 'Duration: 00:00:01.00\n');

    await waitUntil(() => encodes.length === 1);
    session.killActiveFfmpeg({ notify: 'cancelled' });
    encodes[0].emit('close', 1);

    await waitUntil(() => sent.some((s) => s.channel === 'video:cancelled'));

    assert.ok(!sent.some((s) => s.channel === 'video:done'));
    assert.ok(!sent.some((s) => s.channel === 'video:error'));
});

test('encode writes to temp path not destination', async () => {
    const { spawn, probes, encodes } = createSpawnFake();
    const spawnCalls = [];
    const wrappedSpawn = (...args) => {
        spawnCalls.push(args);
        return spawn(...args);
    };
    const { session } = createSession(wrappedSpawn);

    session.convertVideo(defaultConvertPayload({ filePath: '/out.mp4' }));

    await waitUntil(() => probes.length === 1);
    probes[0].stderr.emit('data', 'Duration: 00:00:01.00\n');
    await waitUntil(() => encodes.length === 1);

    const encodeArgs = spawnCalls.find((args) => !args[1].includes('-hide_banner'))[1];
    assert.equal(encodeArgs[encodeArgs.length - 1], '/out.mp4.tessel-partial');
    assert.notEqual(encodeArgs[encodeArgs.length - 1], '/out.mp4');
});

test('success renames temp to destination without unlinking destination', async () => {
    const { spawn, probes, encodes } = createSpawnFake();
    const { fs, calls } = createTrackingFs();
    const { session, sent } = createSession(spawn, { fs });

    session.convertVideo(defaultConvertPayload({ filePath: '/out.mp4' }));

    await waitUntil(() => probes.length === 1);
    probes[0].stderr.emit('data', 'Duration: 00:00:01.00\n');
    await waitUntil(() => encodes.length === 1);
    encodes[0].emit('close', 0);

    await waitUntil(() => sent.some((s) => s.channel === 'video:done'));

    assert.deepEqual(calls.renames, [['/out.mp4.tessel-partial', '/out.mp4']]);
    assert.ok(!calls.unlinks.includes('/out.mp4'));
});

test('cancel unlinks temp only not destination', async () => {
    const { spawn, probes, encodes } = createSpawnFake();
    const { fs, calls } = createTrackingFs();
    const { session, sent } = createSession(spawn, { fs });

    session.convertVideo(defaultConvertPayload({ filePath: '/out.mp4' }));

    await waitUntil(() => probes.length === 1);
    probes[0].stderr.emit('data', 'Duration: 00:00:01.00\n');
    await waitUntil(() => encodes.length === 1);
    session.killActiveFfmpeg({ notify: 'cancelled' });
    encodes[0].emit('close', 1);

    await waitUntil(() => sent.some((s) => s.channel === 'video:cancelled'));

    assert.deepEqual(calls.unlinks, ['/out.mp4.tessel-partial']);
    assert.ok(!calls.unlinks.includes('/out.mp4'));
});

test('encode failure unlinks temp only not destination', async () => {
    const { spawn, probes, encodes } = createSpawnFake();
    const { fs, calls } = createTrackingFs();
    const { session, sent } = createSession(spawn, { fs });

    session.convertVideo(defaultConvertPayload({ filePath: '/out.mp4' }));

    await waitUntil(() => probes.length === 1);
    probes[0].stderr.emit('data', 'Duration: 00:00:01.00\n');
    await waitUntil(() => encodes.length === 1);
    encodes[0].emit('close', 1);

    await waitUntil(() => sent.some((s) => s.channel === 'video:error'));

    assert.deepEqual(calls.unlinks, ['/out.mp4.tessel-partial']);
    assert.ok(!calls.unlinks.includes('/out.mp4'));
});

test('pre-existing destination still encodes to temp and renames on success', async () => {
    const { spawn, probes, encodes } = createSpawnFake();
    const { fs, calls } = createTrackingFs(['/out.mp4']);
    const { session, sent } = createSession(spawn, { fs });

    session.convertVideo(defaultConvertPayload({ filePath: '/out.mp4' }));

    await waitUntil(() => probes.length === 1);
    probes[0].stderr.emit('data', 'Duration: 00:00:01.00\n');
    await waitUntil(() => encodes.length === 1);
    encodes[0].emit('close', 0);

    await waitUntil(() => sent.some((s) => s.channel === 'video:done'));

    assert.deepEqual(calls.renames, [['/out.mp4.tessel-partial', '/out.mp4']]);
    assert.ok(!calls.unlinks.includes('/out.mp4'));
});

test('stale encode close after cancel-then-convert does not error or clear the new job', async () => {
    const { spawn, probes, encodes } = createSpawnFake();
    const { session, sent } = createSession(spawn);

    session.convertVideo(defaultConvertPayload({ vidPath1: '/a.mp4' }));
    await waitUntil(() => probes.length === 1);
    probes[0].stderr.emit('data', 'Duration: 00:00:01.00\n');
    await waitUntil(() => encodes.length === 1);

    session.killActiveFfmpeg({ notify: 'cancelled' });
    await waitUntil(() => sent.some((s) => s.channel === 'video:cancelled'));

    const eventsBeforeB = sent.length;
    session.convertVideo(defaultConvertPayload({ vidPath1: '/b.mp4' }));
    await waitUntil(() => probes.length === 2);
    probes[1].stderr.emit('data', 'Duration: 00:00:01.00\n');
    await waitUntil(() => encodes.length === 2);

    encodes[0].emit('close', 1);

    await new Promise((r) => setImmediate(r));

    const newEvents = sent.slice(eventsBeforeB);
    assert.ok(!newEvents.some((s) => s.channel === 'video:error' && /Conversion failed/.test(s.args[0])));
    assert.ok(!newEvents.some((s) => s.channel === 'video:done'));
    assert.equal(session.isBusy(), true);

    encodes[1].emit('close', 0);
    await waitUntil(() => sent.filter((s) => s.channel === 'video:done').length === 1);
    assert.equal(session.isBusy(), false);
});

test('cancel during probe does not send duration error when probe closes', async () => {
    const { spawn, probes } = createSpawnFake();
    const { session, sent } = createSession(spawn);

    session.convertVideo(defaultConvertPayload());
    await waitUntil(() => probes.length === 1);

    session.killActiveFfmpeg({ notify: 'cancelled' });
    probes[0].emit('close', 1);

    await new Promise((r) => setImmediate(r));

    assert.ok(!sent.some((s) => s.channel === 'video:error' && s.args[0] === 'Could not read video duration'));
});

test('stale probe close after cancel-then-convert does not clear the new job', async () => {
    const { spawn, probes } = createSpawnFake();
    const { session, sent } = createSession(spawn);

    session.convertVideo(defaultConvertPayload({ vidPath1: '/a.mp4' }));
    await waitUntil(() => probes.length === 1);

    session.killActiveFfmpeg({ notify: 'cancelled' });

    session.convertVideo(defaultConvertPayload({ vidPath1: '/b.mp4' }));
    await waitUntil(() => probes.length === 2);

    probes[0].emit('close', 1);

    await new Promise((r) => setImmediate(r));

    assert.ok(!sent.some((s) => s.channel === 'video:error' && s.args[0] === 'Could not read video duration'));
    assert.equal(session.isBusy(), true);
});

test('duplicate slot paths spawn one probe', async () => {
    const { spawn, probes, encodes } = createSpawnFake();
    const { session, sent } = createSession(spawn);
    const same = '/a.mp4';

    session.convertVideo(defaultConvertPayload({
        gridType: '3x3',
        vidPath1: same,
        vidPath2: same,
        vidPath3: same,
        vidPath4: same,
        vidPath5: same,
        vidPath6: same,
        vidPath7: same,
        vidPath8: same,
        vidPath9: same,
    }));

    await waitUntil(() => probes.length === 1);
    probes[0].stderr.emit('data', 'Duration: 00:00:01.00\n');
    await waitUntil(() => encodes.length === 1);
    encodes[0].emit('close', 0);

    await waitUntil(() => sent.some((s) => s.channel === 'video:done'));
    assert.equal(probes.length, 1);
});

test('2x2 probes only selected slots not hidden indices', async () => {
    const { spawn, probes, encodes } = createSpawnFake();
    const { session, sent } = createSession(spawn);

    session.convertVideo(defaultConvertPayload({
        gridType: '2x2',
        vidPath1: '/a.mp4',
        vidPath5: '/hidden.mp4',
    }));

    await waitUntil(() => probes.length === 1);
    probes[0].stderr.emit('data', 'Duration: 00:00:01.00\n');
    await waitUntil(() => encodes.length === 1);
    encodes[0].emit('close', 0);

    await waitUntil(() => sent.some((s) => s.channel === 'video:done'));
    assert.equal(probes.length, 1);
});

test('seconds duration cap sets encode -t to the allowlisted seconds', async () => {
    const { spawn, probes, encodes } = createSpawnFake();
    const spawnCalls = [];
    const wrappedSpawn = (...args) => {
        spawnCalls.push(args);
        return spawn(...args);
    };
    const { session } = createSession(wrappedSpawn);

    session.convertVideo(defaultConvertPayload({
        durationMode: 'seconds',
        seconds: 5,
    }));

    await waitUntil(() => probes.length === 1);
    probes[0].stderr.emit('data', 'Duration: 00:00:10.00\n');
    await waitUntil(() => encodes.length === 1);

    const encodeArgs = spawnCalls.find((args) => !args[1].includes('-hide_banner'))[1];
    assert.equal(encodeArgs[encodeArgs.indexOf('-t') + 1], '5');
    const filterComplex = encodeArgs[encodeArgs.indexOf('-filter_complex') + 1];
    assert.equal(String(filterComplex).includes('tpad'), false);
});

test('seconds cap does not extend past the longest clip', async () => {
    const { spawn, probes, encodes } = createSpawnFake();
    const spawnCalls = [];
    const wrappedSpawn = (...args) => {
        spawnCalls.push(args);
        return spawn(...args);
    };
    const { session } = createSession(wrappedSpawn);

    session.convertVideo(defaultConvertPayload({
        durationMode: 'seconds',
        seconds: 15,
    }));

    await waitUntil(() => probes.length === 1);
    probes[0].stderr.emit('data', 'Duration: 00:00:08.00\n');
    await waitUntil(() => encodes.length === 1);

    const encodeArgs = spawnCalls.find((args) => !args[1].includes('-hide_banner'))[1];
    assert.equal(encodeArgs[encodeArgs.indexOf('-t') + 1], '8');
});

test('invalid durationMode or seconds keeps pad-to-longest -t', async () => {
    const { spawn, probes, encodes } = createSpawnFake();
    const spawnCalls = [];
    const wrappedSpawn = (...args) => {
        spawnCalls.push(args);
        return spawn(...args);
    };
    const { session } = createSession(wrappedSpawn);

    session.convertVideo(defaultConvertPayload({
        durationMode: 'shortest',
        seconds: 7,
    }));

    await waitUntil(() => probes.length === 1);
    probes[0].stderr.emit('data', 'Duration: 00:00:10.00\n');
    await waitUntil(() => encodes.length === 1);

    const encodeArgs = spawnCalls.find((args) => !args[1].includes('-hide_banner'))[1];
    assert.equal(encodeArgs[encodeArgs.indexOf('-t') + 1], '10');
});

test('four unique paths never exceed three concurrent probes', async () => {
    const { spawn, probes, encodes, getMaxLiveProbes } = createConcurrencySpawnFake();
    const { session, sent } = createSession(spawn);

    session.convertVideo(defaultConvertPayload({
        vidPath1: '/a.mp4',
        vidPath2: '/b.mp4',
        vidPath3: '/c.mp4',
        vidPath4: '/d.mp4',
    }));

    await waitUntil(() => probes.length === 3);
    assert.equal(getMaxLiveProbes(), 3);

    probes[0].stderr.emit('data', 'Duration: 00:00:01.00\n');
    await waitUntil(() => probes.length === 4);

    for (let i = 1; i < probes.length; i++) {
        probes[i].stderr.emit('data', 'Duration: 00:00:01.00\n');
    }

    await waitUntil(() => encodes.length === 1);
    encodes[0].emit('close', 0);
    await waitUntil(() => sent.some((s) => s.channel === 'video:done'));
});
