import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { packager } from '@electron/packager'
import { flipFuses, FuseVersion, FuseV1Options } from '@electron/fuses'

const require = createRequire(import.meta.url)
const { getPackagedElectronExecutablePath } = require('../lib/package-executable-path.js')

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '..')
const pkg = JSON.parse(readFileSync(path.join(rootDir, 'package.json'), 'utf8'))

const PLATFORM_CONFIG = {
    darwin: {
        platform: 'darwin',
        arch: 'arm64',
        icon: 'assets/icons/mac/icon.icns',
    },
    win32: {
        platform: 'win32',
        arch: 'x64',
        icon: 'assets/icons/win/icon.ico',
        win32metadata: {
            CompanyName: 'Tessel',
            FileDescription: 'Tessel',
            ProductName: 'Tessel',
        },
    },
    linux: {
        platform: 'linux',
        arch: 'x64',
        icon: 'assets/icons/linux/icon.png',
    },
}

function usage() {
    console.error('Usage: node scripts/package.mjs <darwin|win32|linux>')
    process.exit(1)
}

const targetKey = process.argv[2]
const target = PLATFORM_CONFIG[targetKey]
if (!target) {
    usage()
}

const appName = pkg.productName || pkg.name
const executableBaseName = appName

const packagerOptions = {
    dir: rootDir,
    name: appName,
    overwrite: true,
    asar: {
        unpackDir: 'vendor/ffmpeg',
    },
    platform: target.platform,
    arch: target.arch,
    icon: path.join(rootDir, target.icon),
    prune: true,
    out: path.join(rootDir, 'release-builds'),
    afterComplete: [
        async ({ buildPath, platform, arch }) => {
            const electronPath = getPackagedElectronExecutablePath({
                buildPath,
                platform,
                executableBaseName,
            })
            await flipFuses(electronPath, {
                version: FuseVersion.V1,
                resetAdHocDarwinSignature: platform === 'darwin' && arch === 'arm64',
                [FuseV1Options.RunAsNode]: false,
                [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
                [FuseV1Options.EnableNodeCliInspectArguments]: false,
                [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
                [FuseV1Options.OnlyLoadAppFromAsar]: true,
                [FuseV1Options.GrantFileProtocolExtraPrivileges]: true,
            })
        },
    ],
}

if (target.win32metadata) {
    packagerOptions.win32metadata = target.win32metadata
}

const appPaths = await packager(packagerOptions)
console.log(`Packaged ${appPaths.join(', ')}`)
