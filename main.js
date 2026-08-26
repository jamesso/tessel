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
const {
    matchDurationInStderr,
    matchProgressTimeInStderr,
    progressPercent,
    maxDurationFromMap,
    assertAllFiniteDurations,
} = require('./lib/timecode')
const {
    gridMetrics,
    selectSlotPaths,
    buildVideoInfo,
    buildFilterComplex,
    buildFfmpegArgs,
} = require('./lib/mosaic')
const { canSend } = require('./lib/ipc-send')
const { attachNavigationGuard } = require('./lib/navigation-guard')
const { shouldRejectSecondJob } = require('./lib/job-lock')

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
const liveProbeProcesses = new Set()
let activeEncode = null
let activeOutputPath = null
let killedByUs = false

function sendToRenderer(channel, ...args) {
    if (canSend(mainWindow)) {
        mainWindow.webContents.send(channel, ...args)
    }
}

function killChildProcess(child) {
    if (!child || !child.kill) return
    try {
        if (process.platform === 'win32') {
            child.kill()
        } else {
            child.kill('SIGTERM')
        }
    } catch (err) {
        debugLog('Failed to kill child process:', err.message)
    }
}

function killActiveFfmpeg() {
    if (!activeEncode && liveProbeProcesses.size === 0) return

    killedByUs = true

    killChildProcess(activeEncode)

    for (const probe of liveProbeProcesses) {
        killChildProcess(probe)
    }
    liveProbeProcesses.clear()

    if (activeOutputPath) {
        try {
            fs.unlinkSync(activeOutputPath)
        } catch (err) {
            if (err.code !== 'ENOENT') {
                debugLog('Failed to unlink partial output:', { path: activeOutputPath, message: err.message })
            }
        }
        activeOutputPath = null
    }

    activeEncode = null

    if (canSend(mainWindow)) {
        sendToRenderer('video:error', 'Cancelled')
    }
}

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
        convertVideo(options)
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
        killActiveFfmpeg()
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

// Probe duration from ffmpeg stderr headers without decoding the file
function getVideoDurationWithFFmpeg(videoPath) {
    return new Promise((resolve, reject) => {
        if (!ffmpegBinary) {
            reject(new Error('FFmpeg binary not found for this platform'))
            return
        }

        debugLog('Getting duration with ffmpeg for:', videoPath)

        const args = ['-nostdin', '-hide_banner', '-i', videoPath]
        const ffmpegProcess = spawn(ffmpegBinary, args)
        liveProbeProcesses.add(ffmpegProcess)

        let output = ''
        let duration = null
        let settled = false

        const finish = (fn) => {
            if (settled) return
            settled = true
            liveProbeProcesses.delete(ffmpegProcess)
            fn()
        }

        const tryResolveWithDuration = () => {
            if (duration !== null && Number.isFinite(duration) && duration > 0) {
                ffmpegProcess.kill()
                finish(() => resolve(duration))
            }
        }

        ffmpegProcess.stderr.on('data', (data) => {
            output += data.toString()
            const parsed = matchDurationInStderr(output)
            if (parsed !== null && Number.isFinite(parsed) && parsed > 0) {
                duration = parsed
                debugLog('Found duration via ffmpeg:', { videoPath, duration })
                tryResolveWithDuration()
            }
        })

        ffmpegProcess.on('close', () => {
            if (settled) return
            if (duration !== null && Number.isFinite(duration) && duration > 0) {
                finish(() => resolve(duration))
            } else {
                debugLog('Could not extract duration from ffmpeg output for:', videoPath)
                finish(() => reject(new Error('Could not extract duration')))
            }
        })

        ffmpegProcess.on('error', (err) => {
            debugLog('FFmpeg duration check failed:', err.message)
            finish(() => reject(err))
        })
    })
}

function convertVideo({ vidPath1, vidPath2, vidPath3, vidPath4, vidPath5, vidPath6, vidPath7, vidPath8, vidPath9, gridType, filePath }) {
    if (shouldRejectSecondJob(activeEncode)) {
        sendToRenderer('video:error', 'A conversion is already running')
        return
    }

    activeEncode = true
    killedByUs = false

    try {
            debugLog('=== CONVERSION START ===')
            debugLog('Input parameters:', { 
                gridType, 
                filePath,
                videos: { vidPath1, vidPath2, vidPath3, vidPath4, vidPath5, vidPath6, vidPath7, vidPath8, vidPath9 }
            })

            // Get all video paths that exist
            const allVideoPaths = [vidPath1, vidPath2, vidPath3, vidPath4, vidPath5, vidPath6, vidPath7, vidPath8, vidPath9]
                .filter(path => path);
            
            if (!ffmpegBinary) {
                debugLog('ERROR: FFmpeg binary not found for this platform')
                activeEncode = null
                sendToRenderer('video:error', 'FFmpeg binary not found for this platform')
                return
            }

            if (allVideoPaths.length === 0) {
                debugLog('ERROR: No videos provided')
                activeEncode = null
                sendToRenderer('video:error', 'No videos provided')
                return;
            }

            debugLog('Valid video paths:', allVideoPaths)

            // Create a clean mapping of paths to positions
            const originalPaths = [vidPath1, vidPath2, vidPath3, vidPath4, vidPath5, vidPath6, vidPath7, vidPath8, vidPath9]
            
            debugLog('Path mapping:', originalPaths)

            // Get duration of all videos to find the longest one
            let videoDurations = {};
            
            const processDurations = async () => {
                debugLog('Starting duration analysis...')
                try {
                    const durations = {}
                    const total = allVideoPaths.length
                    let done = 0
                    for (const videoPath of allVideoPaths) {
                        durations[videoPath] = await getVideoDurationWithFFmpeg(videoPath)
                        done++
                        sendToRenderer('video:progress', {
                            percent: Math.round((done / total) * 10),
                            phase: `Analyzing ${done}/${total}`,
                        })
                    }
                    assertAllFiniteDurations(durations, allVideoPaths)
                    videoDurations = durations
                    const maxDuration = maxDurationFromMap(durations)
                    debugLog('Duration analysis complete:', { maxDuration, videoDurations })
                    if (killedByUs) return
                    startConversion(maxDuration)
                } catch (err) {
                    debugLog('Duration probe failed:', err.message)
                    activeEncode = null
                    if (!killedByUs) {
                        sendToRenderer('video:error', 'Could not read video duration')
                    }
                }
            };

            const startConversion = (longestDuration) => {
                if (killedByUs) return

                debugLog('=== STARTING FFMPEG CONVERSION ===')
                debugLog('Longest duration determined:', longestDuration)

                const { gridSize, blockWidth, blockHeight } = gridMetrics(gridType);
                const isGrid3x3 = gridType === '3x3';

                debugLog('Grid configuration:', { gridType, isGrid3x3, gridSize, blockWidth, blockHeight })

                const slotPaths = selectSlotPaths(originalPaths, gridType);
                slotPaths.forEach(function (val, index) {
                    if (val) {
                        debugLog(`Position ${index}: Input File`, val)
                    } else {
                        debugLog(`Position ${index}: Using black placeholder`)
                    }
                });

                const videoInfo = buildVideoInfo(slotPaths, videoDurations, longestDuration);

                debugLog('Video info array:', videoInfo)
                debugLog('Video info with coordinates:', videoInfo)

                const filterComplex = buildFilterComplex(videoInfo, longestDuration, blockWidth, blockHeight);

                debugLog('Filter complex string:', filterComplex)

                const totalFrames = Math.ceil(longestDuration * 25); // 25fps
                debugLog('Expected frame count:', totalFrames)

                const args = buildFfmpegArgs(videoInfo, filterComplex, longestDuration, filePath);

                debugLog('FFmpeg command args:', args)
                debugLog('Full FFmpeg command:', ffmpegBinary + ' ' + args.join(' '))

                const ffmpegProcess = spawn(ffmpegBinary, args);

                activeEncode = ffmpegProcess
                activeOutputPath = filePath
                
                let ffmpegOutput = '';
                let signaled = false;

                const finishEncode = () => {
                    activeEncode = null
                    activeOutputPath = null
                }

                const signalError = (message) => {
                    if (signaled) return
                    signaled = true
                    finishEncode()
                    sendToRenderer('video:error', message)
                }
                
                ffmpegProcess.stderr.on('data', (data) => {
                    const output = data.toString();
                    ffmpegOutput += output;
                    debugLog('FFmpeg stderr:', output)
                    
                    const currentTime = matchProgressTimeInStderr(output);
                    if (currentTime !== null) {
                        const percent = progressPercent(currentTime, longestDuration);
                        
                        debugLog('Progress update:', { currentTime, percent, longestDuration })
                        sendToRenderer('video:progress', { percent: percent })
                    }
                });

                ffmpegProcess.stdout.on('data', (data) => {
                    debugLog('FFmpeg stdout:', data.toString())
                });

                ffmpegProcess.on('close', (code) => {
                    debugLog('FFmpeg process closed:', { code, outputLength: ffmpegOutput.length })

                    if (killedByUs) {
                        killedByUs = false
                        finishEncode()
                        return
                    }
                    
                    if (code === 0) {
                        debugLog('Processing finished successfully!')
                        debugLog('=== CONVERSION END ===')
                        finishEncode()
                        sendToRenderer('video:progress', { percent: 100 });
                        sendToRenderer('video:done');
                    } else {
                        debugLog('FFmpeg failed:', { code, lastOutput: ffmpegOutput.slice(-1000) })
                        signalError('Conversion failed');
                    }
                });

                ffmpegProcess.on('error', (err) => {
                    debugLog('FFmpeg spawn error:', err)
                    signalError(err.message);
                });
            };

            // Start the process
            processDurations();

    } catch (err) {
        debugLog('Conversion function error:', err)
        activeEncode = null
        activeOutputPath = null
        sendToRenderer('video:error', err.message || 'Conversion failed')
    }
}

app.on('before-quit', () => {
    killActiveFfmpeg()
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