const path = require('node:path')

/**
 * Path to the packaged Electron executable inside a packager output directory
 * (e.g. release-builds/Tessel-darwin-arm64).
 */
function getPackagedElectronExecutablePath({ buildPath, platform, executableBaseName }) {
    switch (platform) {
        case 'darwin':
            return path.join(
                buildPath,
                `${executableBaseName}.app`,
                'Contents',
                'MacOS',
                executableBaseName,
            )
        case 'linux':
            return path.join(buildPath, executableBaseName)
        case 'win32':
            return path.join(buildPath, `${executableBaseName}.exe`)
        default:
            throw new Error(`Unsupported platform: ${platform}`)
    }
}

module.exports = { getPackagedElectronExecutablePath }
