const FPS = 25;
const DEFAULT_SIZE = { width: 1280, height: 720 };
const SIZES = [
    { width: 1280, height: 720 },
    { width: 1920, height: 1080 },
];
const ENCODE_SECONDS = [5, 15, 30, 60];
const AUDIO = ['none', 'first'];
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

function resolveAudio(audio) {
    return audio === 'first' ? 'first' : 'none';
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
    FIT,
    DURATION_MODES,
    resolveOutput,
    resolveFit,
    resolveAudio,
    resolveEncodeDuration,
    sizeValue,
};
