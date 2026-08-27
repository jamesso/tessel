const path = require('path');
const {
    DEFAULT_SIZE,
    SIZES,
    ENCODE_SECONDS,
    FIT,
    normalizeAudio,
} = require('./output-allowlist');

const EMPTY_PATHS = [null, null, null, null, null, null, null, null, null];

function emptyPaths() {
    return EMPTY_PATHS.slice();
}

function defaultPrefs() {
    return {
        version: 1,
        gridType: '2x2',
        width: 1280,
        height: 720,
        audio: 'none',
        fit: 'letterbox',
        durationMode: 'longest',
        lastSaveDir: null,
        paths: emptyPaths(),
    };
}

function resolveDurationPrefs(src) {
    const n = Number(src && src.seconds);
    if (src && src.durationMode === 'seconds' && ENCODE_SECONDS.includes(n)) {
        return { durationMode: 'seconds', seconds: n };
    }
    return { durationMode: 'longest' };
}

function asNonEmptyString(value) {
    return typeof value === 'string' && value.length > 0 ? value : null;
}

function normalizePaths(rawPaths, gridType) {
    const paths = emptyPaths();
    if (Array.isArray(rawPaths)) {
        const limit = Math.min(9, rawPaths.length);
        for (let i = 0; i < limit; i++) {
            paths[i] = asNonEmptyString(rawPaths[i]);
        }
    }
    if (gridType === '2x2') {
        for (let i = 4; i < 9; i++) {
            paths[i] = null;
        }
    }
    return paths;
}

function normalizePrefs(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const gridType = src.gridType === '3x3' ? '3x3' : '2x2';
    const size = SIZES.find((s) => s.width === src.width && s.height === src.height);
    const duration = resolveDurationPrefs(src);
    const paths = normalizePaths(src.paths, gridType);
    return {
        version: 1,
        gridType,
        width: size ? size.width : DEFAULT_SIZE.width,
        height: size ? size.height : DEFAULT_SIZE.height,
        audio: normalizeAudio(src.audio, paths),
        fit: FIT.includes(src.fit) ? src.fit : 'letterbox',
        durationMode: duration.durationMode,
        ...(duration.durationMode === 'seconds' ? { seconds: duration.seconds } : {}),
        lastSaveDir: asNonEmptyString(src.lastSaveDir),
        paths,
    };
}

function parsePrefsJson(text) {
    if (typeof text !== 'string' || !text.trim()) {
        return defaultPrefs();
    }
    try {
        return normalizePrefs(JSON.parse(text));
    } catch {
        return defaultPrefs();
    }
}

function filterMissingPaths(prefs, exists) {
    const normalized = normalizePrefs(prefs);
    const existsFn = typeof exists === 'function' ? exists : () => false;
    const paths = normalized.paths.map((p) => (p && existsFn(p) ? p : null));
    return normalizePrefs({ ...normalized, paths });
}

function serializePrefs(raw) {
    return JSON.stringify(normalizePrefs(raw), null, 2);
}

function resolveSaveDefaultPath(lastSaveDir, desktopDir, now, exists) {
    const existsFn = typeof exists === 'function' ? exists : () => false;
    const dir =
        asNonEmptyString(lastSaveDir) && existsFn(lastSaveDir) ? lastSaveDir : desktopDir;
    return path.join(dir, `tesselate${now}.mp4`);
}

function prefsFileName() {
    return 'tessel-prefs.json';
}

function shouldRestoreGridAndPaths(userTouchedGrid) {
    return !userTouchedGrid;
}

module.exports = {
    defaultPrefs,
    normalizePrefs,
    parsePrefsJson,
    filterMissingPaths,
    serializePrefs,
    resolveSaveDefaultPath,
    prefsFileName,
    shouldRestoreGridAndPaths,
};
