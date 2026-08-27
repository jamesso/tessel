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
const ffmpegBinary = require('ffmpeg-static')
const { spawn } = require('child_process')
const { canSend } = require('./lib/ipc-send')
const { attachNavigationGuard } = require('./lib/navigation-guard')
const { createFfmpegSession } = require('./lib/ffmpeg-session')

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

const ffmpegSession = createFfmpegSession({
    spawn,
    ffmpegBinary,
    fs,
    send: sendToRenderer,
    log: debugLog,
})

process.on('uncaughtException', (error) => {
    debugLog('Uncaught Exception:', error.stack)
    if (!isDev) {
        console.error(error)
        sendToRenderer('video:error', 'Unexpected error')
    }
})

process.on('unhandledRejection', (reason, promise) => {
    debugLog('Unhandled Rejection:', { reason: reason.toString(), promise: promise.toString() })
    if (!isDev) {
        console.error(reason)
        sendToRenderer('video:error', 'Unexpected error')
    }
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
            return path.join(os.homedir(), 'Desktop', `tesselate${Date.now()}.mp4`)
        }
        return os.homedir()
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
        role: 'fileMenu'
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