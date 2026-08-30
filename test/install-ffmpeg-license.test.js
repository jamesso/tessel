const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('install-ffmpeg.js copies fallback license when licenseInArchive is null', () => {
    const scriptPath = path.join(__dirname, '..', 'scripts', 'install-ffmpeg.js');
    const source = fs.readFileSync(scriptPath, 'utf8');
    assert.match(source, /licenseInArchive === null/);
    assert.match(source, /ffmpeg-license/);
    assert.match(source, /FALLBACK_LICENSE/);
    assert.match(source, /copyFileSync\(FALLBACK_LICENSE/);
});
