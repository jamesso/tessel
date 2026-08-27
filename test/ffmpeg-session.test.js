const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createFfmpegSession } = require('../lib/ffmpeg-session');

function createFakeProcess() {
    const proc = new EventEmitter();
    proc.stderr = new EventEmitter();
    proc.stdout = new EventEmitter();
    proc.kill = function () {
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

const fakeFs = {
    existsSync: () => false,
    unlinkSync: () => {},
};

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

test('encode failure sends Conversion failed without video:done', async () => {
    const { spawn, probes, encodes } = createSpawnFake();
    const { session, sent } = createSession(spawn);

    session.convertVideo(defaultConvertPayload());

    await waitUntil(() => probes.length === 1);
    probes[0].stderr.emit('data', 'Duration: 00:00:01.00\n');

    await waitUntil(() => encodes.length === 1);
    encodes[0].emit('close', 1);

    await waitUntil(() => sent.some((s) => s.channel === 'video:error' && s.args[0] === 'Conversion failed'));

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
