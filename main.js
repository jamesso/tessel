const path = require('path')
const os = require('os')
const fs = require('fs')
const { app, BrowserWindow, Menu, ipcMain, shell, dialog } = require('electron')

const isMac = process.platform === 'darwin' ? true : false

const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged

function debugLog(message, data = null) {
    if (!isDev) return

    const timestamp = new Date().toISOString()
    const logMessage = `[${timestamp}] ${message}${data ? '\n' + JSON.stringify(data, null, 2) : ''}\n`
    console.log(logMessage)
}


// Set environment - force production for packaged apps
if (app.isPackaged) {
    process.env.NODE_ENV = 'production'
    debugLog('App is packaged, setting NODE_ENV to production')
} else {
    debugLog('App is not packaged, keeping development mode')
}

// Load dependencies
const { resolvePackagedFfmpegPath } = require('./lib/ffmpeg-path')
const ffmpegBinary = resolvePackagedFfmpegPath(require('ffmpeg-static'))
const { spawn } = require('child_process')
const { canSend } = require('./lib/ipc-send')
const { attachNavigationGuard } = require('./lib/navigation-guard')
const { createFfmpegSession } = require('./lib/ffmpeg-session')
const {
    defaultPrefs,
    parsePrefsJson,
    filterMissingPaths,
    serializePrefs,
    resolveSaveDefaultPath,
    prefsFileName,
} = require('./lib/prefs')

const appHtmlRoot = path.join(__dirname, 'app')

debugLog('FFmpeg setup:', { path: ffmpegBinary })

debugLog('Environment check:', {
    NODE_ENV: process.env.NODE_ENV,
    isDev: isDev,
    isMac: isMac,
    isPackaged: app.isPackaged,
    platform: process.platform,
    arch: process.arch
})

let mainWindow
let aboutWindow

function sendToRenderer(channel, ...args) {
    if (canSend(mainWindow)) {
        mainWindow.webContents.send(channel, ...args)
    }
}

function prefsFilePath() {
    return path.join(app.getPath('userData'), prefsFileName())
}

function readStoredPrefs() {
    const file = prefsFilePath()
    if (!fs.existsSync(file)) {
        return defaultPrefs()
    }
    try {
        return parsePrefsJson(fs.readFileSync(file, 'utf8'))
    } catch {
        return defaultPrefs()
    }
}

function whenRendererReady() {
    if (!canSend(mainWindow)) {
        return Promise.reject(new Error('Window unavailable'))
    }
    if (!mainWindow.webContents.isLoading()) {
        return Promise.resolve()
    }
    return new Promise((resolve) => {
        mainWindow.webContents.once('did-finish-load', resolve)
    })
}

async function exportLayout() {
    await whenRendererReady()
    mainWindow.webContents.send('prefs:collect')
}

async function importLayout() {
    if (!canSend(mainWindow)) {
        return
    }
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
        title: 'Import layout',
        filters: [{ name: 'JSON', extensions: ['json'] }],
        properties: ['openFile'],
    })
    if (canceled || !filePaths || !filePaths[0]) {
        return
    }
    let text
    try {
        text = fs.readFileSync(filePaths[0], 'utf8')
    } catch {
        dialog.showErrorBox('Import layout', 'Could not read that file.')
        return
    }
    let raw
    try {
        raw = JSON.parse(text)
    } catch {
        dialog.showErrorBox('Import layout', 'That file is not valid JSON. The current grid was not changed.')
        return
    }
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
        dialog.showErrorBox('Import layout', 'That file is not valid JSON. The current grid was not changed.')
        return
    }
    const prefs = filterMissingPaths(parsePrefsJson(text), (p) => fs.existsSync(p))
    await whenRendererReady()
    sendToRenderer('prefs:imported', prefs)
    await dialog.showMessageBox(mainWindow, {
        type: 'info',
        message: 'Clip paths are absolute. Files that are not on this computer are left empty.',
    })
}

const ffmpegSession = createFfmpegSession({
    spawn,
    ffmpegBinary,
    fs,
    send: sendToRenderer,
    log: debugLog,
})

function stopJobAndNotifyUnexpectedError() {
    ffmpegSession.killActiveFfmpeg()
    sendToRenderer('video:error', 'Unexpected error')
}

process.on('uncaughtException', (error) => {
    debugLog('Uncaught Exception:', error.stack)
    console.error(error)
    stopJobAndNotifyUnexpectedError()
})

process.on('unhandledRejection', (reason, promise) => {
    debugLog('Unhandled Rejection:', { reason: reason.toString(), promise: promise.toString() })
    console.error(reason)
    stopJobAndNotifyUnexpectedError()
})

// Set up IPC handlers before creating windows
function setupIPC() {
    // Dialog IPC handlers
    ipcMain.handle('dialog:openFile', async (event, options) => {
        const result = await dialog.showOpenDialog(mainWindow, options)
        return result
    })

    ipcMain.handle('dialog:saveFile', async (event, options) => {
        const result = await dialog.showSaveDialog(mainWindow, options)
        return result
    })

    // Path helper
    ipcMain.handle('get-default-path', async (event, type) => {
        if (type === 'desktop') {
            return path.join(os.homedir(), 'Desktop')
        } else if (type === 'saveFile') {
            const desktop = path.join(os.homedir(), 'Desktop')
            const lastSaveDir = readStoredPrefs().lastSaveDir
            return resolveSaveDefaultPath(lastSaveDir, desktop, Date.now(), (p) => fs.existsSync(p))
        }
        return os.homedir()
    })

    ipcMain.handle('prefs:load', () => {
        return filterMissingPaths(readStoredPrefs(), (p) => fs.existsSync(p))
    })

    ipcMain.handle('prefs:save', (event, raw) => {
        fs.writeFileSync(prefsFilePath(), serializePrefs(raw), 'utf8')
        return true
    })

    ipcMain.handle('prefs:collect', async (event, payload) => {
        const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
            title: 'Export layout',
            defaultPath: 'tessel-layout.json',
            filters: [{ name: 'JSON', extensions: ['json'] }],
        })
        if (canceled || !filePath) {
            return false
        }
        try {
            fs.writeFileSync(filePath, serializePrefs(payload), 'utf8')
            return true
        } catch {
            dialog.showErrorBox('Export layout', 'Could not write that file.')
            return false
        }
    })

    ipcMain.handle('app:getVersion', () => app.getVersion())

    ipcMain.on('video:convert', (e, options) => {
        debugLog('video:convert', { gridType: options.gridType })
        ffmpegSession.convertVideo(options)
    })

    ipcMain.on('video:cancel', () => {
        ffmpegSession.killActiveFfmpeg({ notify: 'cancelled' })
    })
}

function createMainWindow() {
    mainWindow = new BrowserWindow({
        title: 'Tessel',
        width: isDev ? 800 : 450,
        height: 600,
        icon: path.join(__dirname, 'assets/icons/icon-256.png'),
        resizable: isDev ? true : false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: true,
            preload: path.join(__dirname, 'preload.js')
        }
    })

    attachNavigationGuard(mainWindow, appHtmlRoot, shell)

    // Open dev tools only in development mode
    if (isDev) {
        mainWindow.webContents.openDevTools()
    }

    mainWindow.loadFile(path.join(__dirname, 'app/index.html'))

    mainWindow.on('closed', () => {
        ffmpegSession.killActiveFfmpeg()
        mainWindow = null
    })
}

function createAboutWindow() {
    aboutWindow = new BrowserWindow({
        title: 'About Tessel',
        width: 300,
        height: 300,
        icon: path.join(__dirname, 'assets/icons/icon-256.png'),
        resizable: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload-about.js')
        }
    })

    attachNavigationGuard(aboutWindow, appHtmlRoot, shell)

    aboutWindow.loadFile(path.join(__dirname, 'app/about.html'))
}

app.on('ready', () => {
    setupIPC()
    createMainWindow()

    const mainMenu = Menu.buildFromTemplate(menu)
    Menu.setApplicationMenu(mainMenu)
})

const menu = [
    ...(isMac 
        ? [
            { 
                label: app.name,
                submenu: [
                    {
                        label: 'About',
                        click: createAboutWindow,
                    },
                ],
            },
        ]
    : []),
    {
        label: 'File',
        submenu: [
            {
                label: 'Export layout…',
                click: () => {
                    exportLayout().catch((err) => {
                        debugLog('exportLayout failed', { error: String(err) })
                        dialog.showErrorBox('Export layout', 'Could not export the layout.')
                    })
                },
            },
            {
                label: 'Import layout…',
                click: () => {
                    importLayout().catch((err) => {
                        debugLog('importLayout failed', { error: String(err) })
                        dialog.showErrorBox('Import layout', 'Could not import the layout.')
                    })
                },
            },
            { type: 'separator' },
            isMac ? { role: 'close' } : { role: 'quit' },
        ],
    },
    ...(isDev 
        ? [
            {
                label: 'Developer',
                submenu: [
                    { role: 'reload' },
                    { role: 'forcereload' },
                    { type: 'separator' },
                    { role: 'toggledevtools' },
                ],
            },
        ]
    : []),
]

app.on('before-quit', () => {
    ffmpegSession.killActiveFfmpeg()
})

app.on('window-all-closed', () => {
    if (!isMac) {
        app.quit()
    }
})

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow()
    }
})