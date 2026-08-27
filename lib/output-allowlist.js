const FPS = 25;
const DEFAULT_SIZE = { width: 1280, height: 720 };
const SIZES = [
    { width: 1280, height: 720 },
    { width: 1920, height: 1080 },
];
const ENCODE_SECONDS = [5, 15, 30, 60];
const AUDIO = ['none', 'first'];
const AUDIO_SLOT_MAX = 8;
const FIT = ['letterbox', 'crop'];
const DURATION_MODES = ['longest', 'seconds'];

const ENCODE_SECONDS_SET = new Set(ENCODE_SECONDS);

const { maxDurationFromMap } = require('./timecode');

function resolveOutput(output) {
    if (output) {
        const w = Number(output.width);
        const h = Number(output.height);
        const match = SIZES.find((s) => s.width === w && s.height === h);
        if (match) {
            return { ...match, fps: FPS };
        }
    }
    return { ...DEFAULT_SIZE, fps: FPS };
}

function resolveFit(fit) {
    return fit === 'crop' ? 'crop' : 'letterbox';
}

function parseAudioSlot(audio) {
    if (typeof audio === 'string') {
        const match = /^slot:([0-8])$/.exec(audio);
        return match ? Number(match[1]) : null;
    }
    if (audio && typeof audio === 'object' && !Array.isArray(audio)) {
        const slot = Number(audio.slot);
        if (Number.isInteger(slot) && slot >= 0 && slot <= AUDIO_SLOT_MAX) {
            return slot;
        }
    }
    return null;
}

function resolveAudio(audio) {
    if (audio === 'first') {
        return 'first';
    }
    const slot = parseAudioSlot(audio);
    if (slot !== null) {
        return { slot };
    }
    if (audio && typeof audio === 'object' && !Array.isArray(audio)) {
        return 'first';
    }
    return 'none';
}

function normalizeAudio(audio, paths) {
    const occupied = Array.isArray(paths) ? paths : [];
    const hasOccupied = occupied.some(Boolean);
    const resolved = resolveAudio(audio);
    if (resolved === 'none') {
        return 'none';
    }
    if (resolved === 'first') {
        return 'first';
    }
    if (!hasOccupied) {
        return 'none';
    }
    if (occupied[resolved.slot]) {
        return { slot: resolved.slot };
    }
    return 'first';
}

function resolveEncodeDuration(durationsMap, policy) {
    const max = maxDurationFromMap(durationsMap);
    if (!policy || policy.mode !== 'seconds') {
        return max;
    }
    const n = Number(policy.seconds);
    if (!ENCODE_SECONDS_SET.has(n)) {
        return max;
    }
    return Math.min(max, n);
}

function sizeValue(size) {
    return `${size.width}x${size.height}`;
}

module.exports = {
    FPS,
    DEFAULT_SIZE,
    SIZES,
    ENCODE_SECONDS,
    AUDIO,
    AUDIO_SLOT_MAX,
    FIT,
    DURATION_MODES,
    resolveOutput,
    resolveFit,
    resolveAudio,
    normalizeAudio,
    resolveEncodeDuration,
    sizeValue,
};
