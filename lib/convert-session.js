const path = require('path');

function shouldUnlinkPartialOutput({ encodeStarted, createdByThisJob }) {
    return Boolean(encodeStarted && createdByThisJob)
}

function tempOutputPath(filePath) {
    const ext = path.extname(filePath);
    if (!ext) {
        return `${filePath}.tessel-partial.mp4`;
    }
    return `${filePath.slice(0, -ext.length)}.tessel-partial${ext}`;
}

module.exports = { shouldUnlinkPartialOutput, tempOutputPath }
