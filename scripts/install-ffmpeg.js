#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const https = require('https');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const HASHES = JSON.parse(fs.readFileSync(path.join(__dirname, 'ffmpeg-hashes.json'), 'utf8'));
const OUT_DIR = path.join(ROOT, 'vendor', 'ffmpeg');

function platformKey() {
    if (process.platform === 'darwin' && process.arch === 'arm64') return 'darwin-arm64';
    if (process.platform === 'linux' && process.arch === 'x64') return 'linux-x64';
    if (process.platform === 'win32' && (process.arch === 'x64' || process.arch === 'ia32')) return 'win32-x64';
    return null;
}

function download(url) {
    return new Promise((resolve, reject) => {
        const lib = url.startsWith('https:') ? https : http;
        const request = (targetUrl) => {
            lib.get(targetUrl, (res) => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    request(res.headers.location);
                    return;
                }
                if (res.statusCode !== 200) {
                    reject(new Error(`Download failed (${res.statusCode}): ${targetUrl}`));
                    return;
                }
                const chunks = [];
                res.on('data', (chunk) => chunks.push(chunk));
                res.on('end', () => resolve(Buffer.concat(chunks)));
                res.on('error', reject);
            }).on('error', reject);
        };
        request(url);
    });
}

function sha256(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

function extractArchive(archivePath, destDir) {
    if (archivePath.endsWith('.tar.xz') || archivePath.endsWith('.tar.gz') || archivePath.endsWith('.tar')) {
        const result = spawnSync('tar', ['-xf', archivePath, '-C', destDir], { stdio: 'inherit' });
        if (result.status !== 0) {
            throw new Error(`tar failed extracting ${archivePath}`);
        }
        return;
    }
    if (archivePath.endsWith('.zip')) {
        const result = spawnSync('tar', ['-xf', archivePath, '-C', destDir], { stdio: 'inherit' });
        if (result.status !== 0) {
            throw new Error(`archive extract failed for ${archivePath}`);
        }
        return;
    }
    throw new Error(`Unsupported archive format: ${archivePath}`);
}

function installPlatform(key, config) {
    const binName = key === 'win32-x64' ? 'ffmpeg.exe' : 'ffmpeg';
    const binDest = path.join(OUT_DIR, binName);
    if (fs.existsSync(binDest)) {
        console.log(`ffmpeg already installed at ${binDest}`);
        return;
    }

    console.log(`Downloading FFmpeg for ${key} from ${config.vendor}...`);
    return download(config.archiveUrl).then((archiveBuffer) => {
        const digest = sha256(archiveBuffer);
        if (digest !== config.archiveSha256) {
            throw new Error(
                `SHA-256 mismatch for ${key}: expected ${config.archiveSha256}, got ${digest}`,
            );
        }

        const suffix = config.archiveUrl.endsWith('.tar.xz')
            ? '.tar.xz'
            : config.archiveUrl.endsWith('.zip')
              ? '.zip'
              : path.extname(config.archiveUrl);
        const tmpArchive = path.join(os.tmpdir(), `tessel-ffmpeg-${key}-${Date.now()}${suffix}`);
        const tmpExtract = fs.mkdtempSync(path.join(os.tmpdir(), 'tessel-ffmpeg-extract-'));

        try {
            fs.writeFileSync(tmpArchive, archiveBuffer);
            extractArchive(tmpArchive, tmpExtract);

            const binSrc = path.join(tmpExtract, config.binaryInArchive);
            if (!fs.existsSync(binSrc)) {
                throw new Error(`Binary not found in archive: ${config.binaryInArchive}`);
            }

            fs.mkdirSync(OUT_DIR, { recursive: true });
            fs.copyFileSync(binSrc, binDest);
            fs.chmodSync(binDest, 0o755);

            if (config.licenseInArchive) {
                const licenseSrc = path.join(tmpExtract, config.licenseInArchive);
                if (fs.existsSync(licenseSrc)) {
                    fs.copyFileSync(licenseSrc, path.join(OUT_DIR, 'LICENSE'));
                }
            }
        } finally {
            fs.rmSync(tmpExtract, { recursive: true, force: true });
            fs.rmSync(tmpArchive, { force: true });
        }

        console.log(`Installed FFmpeg to ${binDest}`);
    });
}

async function main() {
    const key = platformKey();
    if (!key) {
        console.warn(`install-ffmpeg: skipping unsupported platform ${process.platform}/${process.arch}`);
        return;
    }
    const config = HASHES.platforms[key];
    if (!config) {
        throw new Error(`No FFmpeg pin configured for ${key}`);
    }
    await installPlatform(key, config);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
