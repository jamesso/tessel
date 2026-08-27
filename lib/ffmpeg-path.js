const path = require('path');

const FFMPEG_PROTOCOL_WHITELIST = 'file,pipe';

function resolvePackagedFfmpegPath(binaryPath) {
    if (typeof binaryPath !== 'string' || binaryPath.length === 0) {
        return binaryPath;
    }
    const unpackedSegs = [
        `${path.sep}app.asar.unpacked${path.sep}`,
        '/app.asar.unpacked/',
        '\\app.asar.unpacked\\',
    ];
    const asarSegs = [
        `${path.sep}app.asar${path.sep}`,
        '/app.asar/',
        '\\app.asar\\',
    ];
    for (const unpackedSeg of unpackedSegs) {
        if (binaryPath.includes(unpackedSeg)) {
            return binaryPath;
        }
    }
    for (const asarSeg of asarSegs) {
        if (binaryPath.includes(asarSeg)) {
            const unpackedSeg = asarSeg.replace('app.asar', 'app.asar.unpacked');
            return binaryPath.split(asarSeg).join(unpackedSeg);
        }
    }
    return binaryPath;
}

module.exports = { resolvePackagedFfmpegPath, FFMPEG_PROTOCOL_WHITELIST };
