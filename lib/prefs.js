const path = require('path');

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
        lastSaveDir: null,
        paths: emptyPaths(),
    };
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
    const is1080 = src.width === 1920 && src.height === 1080;
    return {
        version: 1,
        gridType,
        width: is1080 ? 1920 : 1280,
        height: is1080 ? 1080 : 720,
        audio: src.audio === 'first' ? 'first' : 'none',
        fit: src.fit === 'crop' ? 'crop' : 'letterbox',
        lastSaveDir: asNonEmptyString(src.lastSaveDir),
        paths: normalizePaths(src.paths, gridType),
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
    return {
        ...normalized,
        paths: normalized.paths.map((p) => (p && existsFn(p) ? p : null)),
    };
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

module.exports = {
    defaultPrefs,
    normalizePrefs,
    parsePrefsJson,
    filterMissingPaths,
    serializePrefs,
    resolveSaveDefaultPath,
    prefsFileName,
};
