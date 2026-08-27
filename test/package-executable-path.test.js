const { test } = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const { getPackagedElectronExecutablePath } = require('../lib/package-executable-path')

test('getPackagedElectronExecutablePath resolves darwin app bundle binary', () => {
    const buildPath = path.join('/out', 'Tessel-darwin-arm64')
    assert.equal(
        getPackagedElectronExecutablePath({
            buildPath,
            platform: 'darwin',
            executableBaseName: 'Tessel',
        }),
        path.join(buildPath, 'Tessel.app', 'Contents', 'MacOS', 'Tessel'),
    )
})

test('getPackagedElectronExecutablePath resolves linux binary', () => {
    const buildPath = path.join('/out', 'Tessel-linux-x64')
    assert.equal(
        getPackagedElectronExecutablePath({
            buildPath,
            platform: 'linux',
            executableBaseName: 'Tessel',
        }),
        path.join(buildPath, 'Tessel'),
    )
})

test('getPackagedElectronExecutablePath resolves win32 binary', () => {
    const buildPath = path.join('/out', 'Tessel-win32-x64')
    assert.equal(
        getPackagedElectronExecutablePath({
            buildPath,
            platform: 'win32',
            executableBaseName: 'Tessel',
        }),
        path.join(buildPath, 'Tessel.exe'),
    )
})

test('getPackagedElectronExecutablePath rejects unknown platform', () => {
    assert.throws(
        () =>
            getPackagedElectronExecutablePath({
                buildPath: '/out/Tessel-mas-arm64',
                platform: 'mas',
                executableBaseName: 'Tessel',
            }),
        /Unsupported platform: mas/,
    )
})
