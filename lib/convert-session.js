const path = require('path');

function shouldUnlinkPartialOutput({ encodeStarted, createdByThisJob }) {
    return Boolean(encodeStarted && createdByThisJob)
}

function defaultTempOutputPath(filePath) {
    const ext = path.extname(filePath);
    if (!ext) {
        return `${filePath}.tessel-partial.mp4`;
    }
    return `${filePath.slice(0, -ext.length)}.tessel-partial${ext}`;
}

const MAX_PARTIAL_SUFFIX = 100;

function tempOutputPath(filePath, existsSync = () => false) {
    const defaultPath = defaultTempOutputPath(filePath);
    if (!existsSync(defaultPath)) {
        return defaultPath;
    }

    const ext = path.extname(filePath);
    const stem = ext ? filePath.slice(0, -ext.length) : filePath;

    for (let n = 2; n <= MAX_PARTIAL_SUFFIX; n++) {
        const candidate = `${stem}.tessel-partial-${n}.mp4`;
        if (!existsSync(candidate)) {
            return candidate;
        }
    }

    throw new Error('No unique partial output path available');
}

module.exports = { shouldUnlinkPartialOutput, tempOutputPath }
