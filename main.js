const path = require('path')
const os = require('os')
const fs = require('fs')
const { app, BrowserWindow, Menu, ipcMain, shell, dialog } = require('electron')

const isMac = process.platform === 'darwin' ? true : false

// Setup debug logging for development mode only
let debugLogPath = null
const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged

if (isDev) {
    debugLogPath = path.join(os.homedir(), 'Desktop', 'tessel-debug.log')
    // Clear previous log
    try {
        fs.writeFileSync(debugLogPath, '')
    } catch (err) {
        console.error('Failed to create debug log file:', err)
    }
}

function debugLog(message, data = null) {
    // Only log in development mode
    if (!isDev) return
    
    const timestamp = new Date().toISOString()
    const logMessage = `[${timestamp}] ${message}${data ? '\n' + JSON.stringify(data, null, 2) : ''}\n`
    
    console.log(logMessage)
    
    if (debugLogPath) {
        try {
            fs.appendFileSync(debugLogPath, logMessage)
        } catch (err) {
            console.error('Failed to write to debug log:', err)
        }
    }
}

// Global error handling
process.on('uncaughtException', (error) => {
    debugLog('Uncaught Exception:', error.stack)
})

process.on('unhandledRejection', (reason, promise) => {
    debugLog('Unhandled Rejection:', { reason: reason.toString(), promise: promise.toString() })
})

// Set environment - force production for packaged apps
if (app.isPackaged) {
    process.env.NODE_ENV = 'production'
    debugLog('App is packaged, setting NODE_ENV to production')
} else {
    debugLog('App is not packaged, keeping development mode')
}

// Load dependencies
const ffmpegPath = require('@ffmpeg-installer/ffmpeg')
const ffmpeg = require('fluent-ffmpeg')
const slash = require('slash')
const { spawn } = require('child_process')

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath.path);

// Try to set ffprobe path - it might not be available in packaged apps
try {
    const ffprobePath = require('@ffmpeg-installer/ffprobe')
    ffmpeg.setFfprobePath(ffprobePath.path);
    debugLog('FFprobe setup:', { path: ffprobePath.path, version: ffprobePath.version })
} catch (err) {
    debugLog('FFprobe not available, will use alternative method:', err.message)
}

debugLog('FFmpeg setup:', { path: ffmpegPath.path, version: ffmpegPath.version })

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





    ipcMain.on('video:convert', (e, options) => {
        console.log(options)
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
            enableRemoteModule: false,
            webSecurity: true,
            preload: path.join(__dirname, 'preload.js')
        }
    })

    // Open dev tools only in development mode
    if (isDev) {
        mainWindow.webContents.openDevTools()
    }

    mainWindow.loadFile(path.join(__dirname, 'app/index.html'))
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
            contextIsolation: true
        }
    })

    aboutWindow.loadFile(path.join(__dirname, 'app/about.html'))
}

app.on('ready', () => {
    setupIPC()
    createMainWindow()

    const mainMenu = Menu.buildFromTemplate(menu)
    Menu.setApplicationMenu(mainMenu)

    mainWindow.on('closed', () => mainWindow = null)
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

function parseTimeToSeconds(timemark) {
    if (!timemark) return 0;
    const parts = timemark.split(':');
    if (parts.length === 3) {
        const hours = parseInt(parts[0]) || 0;
        const minutes = parseInt(parts[1]) || 0;
        const seconds = parseFloat(parts[2]) || 0;
        return hours * 3600 + minutes * 60 + seconds;
    }
    return 0;
}

// Alternative method to get video duration using ffmpeg when ffprobe is not available
function getVideoDurationWithFFmpeg(videoPath) {
    return new Promise((resolve, reject) => {
        debugLog('Getting duration with ffmpeg for:', videoPath)
        
        const args = ['-i', videoPath, '-f', 'null', '-'];
        const ffmpegProcess = spawn(ffmpegPath.path, args);
        
        let output = '';
        let duration = null;
        
        ffmpegProcess.stderr.on('data', (data) => {
            output += data.toString();
            
            // Look for duration in the format "Duration: HH:MM:SS.ss"
            const durationMatch = output.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})/);
            if (durationMatch) {
                const hours = parseInt(durationMatch[1]);
                const minutes = parseInt(durationMatch[2]);
                const seconds = parseFloat(durationMatch[3]);
                duration = hours * 3600 + minutes * 60 + seconds;
                debugLog('Found duration via ffmpeg:', { videoPath, duration })
            }
        });
        
        ffmpegProcess.on('close', (code) => {
            if (duration !== null) {
                resolve(duration);
            } else {
                debugLog('Could not extract duration from ffmpeg output for:', videoPath)
                reject(new Error('Could not extract duration'));
            }
        });
        
        ffmpegProcess.on('error', (err) => {
            debugLog('FFmpeg duration check failed:', err.message)
            reject(err);
        });
    });
}

function convertVideo({ vidPath1, vidPath2, vidPath3, vidPath4, vidPath5, vidPath6, vidPath7, vidPath8, vidPath9, gridType, filePath }) {
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
            
            if (allVideoPaths.length === 0) {
                debugLog('ERROR: No videos provided')
                return;
            }

            debugLog('Valid video paths:', allVideoPaths)

            // Create a clean mapping of paths to positions
            const originalPaths = [vidPath1, vidPath2, vidPath3, vidPath4, vidPath5, vidPath6, vidPath7, vidPath8, vidPath9]
            
            debugLog('Path mapping:', originalPaths)

            // Get duration of all videos to find the longest one
            let videoDurations = {};
            let maxDuration = 0;
            let processedCount = 0;
            
            const processDurations = () => {
                debugLog('Starting duration analysis...')
                allVideoPaths.forEach((videoPath, index) => {
                    // Try ffprobe first, fallback to ffmpeg
                    ffmpeg.ffprobe(videoPath, (err, metadata) => {
                        if (!err && metadata && metadata.format && metadata.format.duration) {
                            const duration = parseFloat(metadata.format.duration);
                            videoDurations[videoPath] = duration;
                            maxDuration = Math.max(maxDuration, duration);
                            debugLog(`Video ${index} duration (ffprobe):`, { path: videoPath, duration: duration })
                            
                            processedCount++;
                            if (processedCount === allVideoPaths.length) {
                                debugLog('Duration analysis complete:', { maxDuration, videoDurations })
                                startConversion(maxDuration);
                            }
                        } else {
                            debugLog(`FFprobe failed for video ${index}, trying ffmpeg fallback:`, { path: videoPath, error: err?.message })
                            
                            // Fallback to ffmpeg method
                            getVideoDurationWithFFmpeg(videoPath)
                                .then(duration => {
                                    videoDurations[videoPath] = duration;
                                    maxDuration = Math.max(maxDuration, duration);
                                    debugLog(`Video ${index} duration (ffmpeg):`, { path: videoPath, duration: duration })
                                })
                                .catch(ffmpegErr => {
                                    debugLog(`WARNING: Both ffprobe and ffmpeg failed for video ${index}:`, { path: videoPath, ffprobeError: err?.message, ffmpegError: ffmpegErr.message })
                                    videoDurations[videoPath] = 10;
                                    maxDuration = Math.max(maxDuration, 10);
                                })
                                .finally(() => {
                                    processedCount++;
                                    if (processedCount === allVideoPaths.length) {
                                        debugLog('Duration analysis complete:', { maxDuration, videoDurations })
                                        startConversion(maxDuration);
                                    }
                                });
                        }
                    });
                });
            };

            const startConversion = (longestDuration) => {
                debugLog('=== STARTING FFMPEG CONVERSION ===')
                debugLog('Longest duration determined:', longestDuration)
                
                let command = ffmpeg()
                
                // Change this to the desired output resolution  
                let x=1280, y=720;
                const isGrid3x3 = gridType === '3x3';
                const gridSize = isGrid3x3 ? 3 : 2;
                const blockWidth = Math.floor(x / gridSize);
                const blockHeight = Math.floor(y / gridSize);

                debugLog('Grid configuration:', { gridType, isGrid3x3, gridSize, blockWidth, blockHeight })

                let videoInfo = [];
                let inputIndex = 0;

                // Parse arguments and add inputs (videos or black)
                let videoPaths = isGrid3x3 ? originalPaths : originalPaths.slice(0, 4);
                    
                videoPaths.forEach(function (val, index, array) {
                    if (val) {
                        // Real video file
                        debugLog(`Position ${index}: Input File`, val)
                        videoInfo.push({			
                            filename: val,
                            inputIndex: inputIndex,
                            isBlack: false,
                            duration: videoDurations[val] || longestDuration
                        });
                        command = command.addInput(val);
                        inputIndex++;
                    } else {
                        // Black video placeholder
                        debugLog(`Position ${index}: Using black placeholder`)
                        videoInfo.push({			
                            filename: null,
                            inputIndex: -1, // Will use color source
                            isBlack: true,
                            duration: longestDuration
                        });
                    }
                });	

                debugLog('Video info array:', videoInfo)
            
                // Set coordinates for each position based on grid type
                for (let i = 0; i < videoInfo.length; i++) {
                    const row = Math.floor(i / gridSize);
                    const col = i % gridSize;
                    videoInfo[i].coord = { 
                        x: col * blockWidth, 
                        y: row * blockHeight 
                    };
                }
                
                debugLog('Video info with coordinates:', videoInfo)
                
                let complexFilter = [];
                
                // Step 1: Create all video blocks with proper scaling and padding
                videoInfo.forEach(function (val, index, array) {
                    if (val.isBlack) {
                        // Create black video block for the full duration
                        complexFilter.push(`color=black:size=${blockWidth}x${blockHeight}:duration=${longestDuration}:rate=25 [block${index}]`);
                    } else {
                        // Reset PTS, scale, and pad to exact duration
                        complexFilter.push({
                            filter: 'setpts', 
                            options: 'PTS-STARTPTS',
                            inputs: val.inputIndex + ':v', 
                            outputs: 'reset' + index
                        });
                        
                        complexFilter.push({
                            filter: 'scale', 
                            options: [blockWidth, blockHeight],
                            inputs: 'reset' + index, 
                            outputs: 'scaled' + index
                        });
                        
                        // Calculate padding needed to reach longest duration
                        const paddingDuration = longestDuration - val.duration;
                        
                        if (paddingDuration > 0.1) { // Only pad if significant difference
                            // Use tpad to add black frames after video ends
                            complexFilter.push({
                                filter: 'tpad',
                                options: `stop_mode=add:stop_duration=${paddingDuration}:color=black`,
                                inputs: 'scaled' + index,
                                outputs: 'block' + index
                            });
                        } else {
                            // Video is already close to longest duration, no padding needed
                            complexFilter.push({
                                filter: 'copy',
                                inputs: 'scaled' + index,
                                outputs: 'block' + index
                            });
                        }
                    }
                });
                
                // Step 2: Create the final canvas and build the mosaic
                complexFilter.push(`color=black:size=${x}x${y}:duration=${longestDuration}:rate=25 [canvas]`);
                
                // Build Mosaic on the canvas
                videoInfo.forEach(function (val, index, array) {
                    const baseInput = index === 0 ? 'canvas' : 'mosaic' + index;
                    const outputName = index === videoInfo.length - 1 ? 'final' : 'mosaic' + (index + 1);
                    
                    complexFilter.push({
                        filter: 'overlay', 
                        options: { x: val.coord.x, y: val.coord.y },
                        inputs: [baseInput, 'block' + index], 
                        outputs: outputName
                    });
                });

                debugLog('Complex filter array:', complexFilter)
                
                const totalFrames = Math.ceil(longestDuration * 25); // 25fps
                debugLog('Expected frame count:', totalFrames)
                
                // Convert filter array to string
                const filterComplex = complexFilter.map(filter => {
                    if (typeof filter === 'string') {
                        return filter;
                    } else {
                        const inputs = Array.isArray(filter.inputs) ? filter.inputs.join('][') : filter.inputs;
                        const options = filter.options ? 
                            (Array.isArray(filter.options) ? filter.options.join(':') : 
                             typeof filter.options === 'object' ? Object.entries(filter.options).map(([k,v]) => `${k}=${v}`).join(':') : 
                             filter.options) : '';
                        return `[${inputs}]${filter.filter}${options ? '=' + options : ''}[${filter.outputs}]`;
                    }
                }).join(';');

                debugLog('Filter complex string:', filterComplex)

                const args = [
                    '-i', videoInfo.find(v => !v.isBlack).filename,
                    ...(videoInfo.filter(v => !v.isBlack).slice(1).map(v => ['-i', v.filename]).flat()),
                    '-y',
                    '-filter_complex', filterComplex,
                    '-map', '[final]',
                    '-an',
                    '-vcodec', 'libx264',
                    '-r', '25',
                    '-t', longestDuration.toString(),
                    '-avoid_negative_ts', 'make_zero',
                    '-vsync', 'cfr',
                    filePath
                ];

                debugLog('FFmpeg command args:', args)
                debugLog('Full FFmpeg command:', ffmpegPath.path + ' ' + args.join(' '))

                const ffmpegProcess = spawn(ffmpegPath.path, args);
                
                let ffmpegOutput = '';
                
                ffmpegProcess.stderr.on('data', (data) => {
                    const output = data.toString();
                    ffmpegOutput += output;
                    debugLog('FFmpeg stderr:', output)
                    
                    // Parse progress from stderr
                    const timeMatch = output.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
                    if (timeMatch) {
                        const hours = parseInt(timeMatch[1]);
                        const minutes = parseInt(timeMatch[2]);
                        const seconds = parseFloat(timeMatch[3]);
                        const currentTime = hours * 3600 + minutes * 60 + seconds;
                        const percent = Math.min(Math.round((currentTime / longestDuration) * 100), 99);
                        
                        debugLog('Progress update:', { currentTime, percent, longestDuration })
                        if (mainWindow && mainWindow.webContents) {
                            mainWindow.webContents.send('video:progress', {
                                percent: percent
                            });
                        }
                    }
                });

                ffmpegProcess.stdout.on('data', (data) => {
                    debugLog('FFmpeg stdout:', data.toString())
                });

                ffmpegProcess.on('close', (code) => {
                    debugLog('FFmpeg process closed:', { code, outputLength: ffmpegOutput.length })
                    
                    if (code === 0) {
                        debugLog('Processing finished successfully!')
                        
                        // Check the actual duration of the output file
                        ffmpeg.ffprobe(filePath, (err, metadata) => {
                            if (!err && metadata && metadata.format && metadata.format.duration) {
                                const actualDuration = parseFloat(metadata.format.duration);
                                const match = Math.abs(actualDuration - longestDuration) < 0.5;
                                debugLog('=== FINAL DURATION CHECK ===', {
                                    expectedDuration: longestDuration,
                                    actualDuration: actualDuration,
                                    difference: Math.abs(actualDuration - longestDuration),
                                    match: match,
                                    outputFilePath: filePath
                                })
                                
                                // Also check file size
                                try {
                                    const stats = fs.statSync(filePath);
                                    debugLog('Output file stats:', { 
                                        size: stats.size,
                                        sizeKB: Math.round(stats.size / 1024),
                                        sizeMB: Math.round(stats.size / (1024 * 1024))
                                    })
                                } catch (statErr) {
                                    debugLog('Could not get file stats:', statErr.message)
                                }
                            } else {
                                debugLog('Could not check output duration:', err?.message)
                            }
                            
                            debugLog('=== CONVERSION END ===')
                        });
                        
                        mainWindow.webContents.send('video:done');
                    } else {
                        debugLog('FFmpeg failed:', { code, lastOutput: ffmpegOutput.slice(-1000) })
                        mainWindow.webContents.send('video:error', 'Conversion failed');
                    }
                });

                ffmpegProcess.on('error', (err) => {
                    debugLog('FFmpeg spawn error:', err)
                    mainWindow.webContents.send('video:error', err.message);
                });
            };

            // Start the process
            processDurations();

    } catch (err) {
        debugLog('Conversion function error:', err)
    }
}

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