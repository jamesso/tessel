'use strict';

const fs = require('fs');
const path = require('path');

const PACKAGER_PLATFORMS = new Set(['darwin-arm64', 'linux-x64', 'win32-x64']);

function currentPlatformKey() {
    if (process.platform === 'darwin' && process.arch === 'arm64') return 'darwin-arm64';
    if (process.platform === 'linux' && process.arch === 'x64') return 'linux-x64';
    if (process.platform === 'win32' && (process.arch === 'x64' || process.arch === 'ia32')) {
        return 'win32-x64';
    }
    return null;
}

function resolveFfmpegBinaryPath() {
    if (process.env.FFMPEG_BIN) {
        return process.env.FFMPEG_BIN;
    }

    const platformKey = currentPlatformKey();
    if (!platformKey || !PACKAGER_PLATFORMS.has(platformKey)) {
        return null;
    }

    const executableName = platformKey === 'win32-x64' ? 'ffmpeg.exe' : 'ffmpeg';
    const binaryPath = path.join(__dirname, '..', 'vendor', 'ffmpeg', executableName);
    return fs.existsSync(binaryPath) ? binaryPath : null;
}

module.exports = resolveFfmpegBinaryPath();
