const path = require('path')
const os = require('os')
const { app, BrowserWindow, Menu, ipcMain, shell, dialog } = require('electron')

// Global error handling
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error)
})

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason)
})

// Set environment - force production for packaged apps
if (app.isPackaged) {
    process.env.NODE_ENV = 'production'
    console.log('App is packaged, setting NODE_ENV to production')
} else {
    console.log('App is not packaged, keeping development mode')
}

// Load dependencies
const ffmpegPath = require('@ffmpeg-installer/ffmpeg')
const ffmpeg = require('fluent-ffmpeg')
const slash = require('slash')

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath.path);
console.log('FFmpeg path:', ffmpegPath.path, 'Version:', ffmpegPath.version);

const isDev = process.env.NODE_ENV !== 'production' ? true : false
const isMac = process.platform === 'darwin' ? true : false

console.log('Environment check:')
console.log('- NODE_ENV:', process.env.NODE_ENV)
console.log('- isDev:', isDev)
console.log('- isMac:', isMac)
console.log('- app.isPackaged:', app.isPackaged)

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
            preload: path.join(__dirname, 'preload.js')
        }
    })

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

function convertVideo({ vidPath1, vidPath2, vidPath3, vidPath4, filePath }) {
    try {

            let command = ffmpeg()
            
            // Change this to the desired output resolution  
            let x=1280, y=720;

            let videoInfo = [];
            console.log(videoInfo);

            // Parse arguments
            let args = [vidPath1, vidPath2, vidPath3, vidPath4];
            args.forEach(function (val, index, array) {
                let filename = val;
                console.log(index + ': Input File ... ' + filename);
                
                videoInfo.push({			
                    filename: filename
                });
                command = command.addInput(filename);
            });	
            
            videoInfo[0].coord = { x: 0, y: 0 };
            console.log(videoInfo[0]);
            videoInfo[1].coord = { x: x/2, y: 0 };
            videoInfo[2].coord = { x: 0, y: y/2 };
            videoInfo[3].coord = { x: x/2, y: y/2 };
            
            let complexFilter = [];
            complexFilter.push('nullsrc=size=' + x + 'x' + y + ' [base0]');
            // Scale each video
            videoInfo.forEach(function (val, index, array) {
                complexFilter.push({
                    filter: 'setpts=PTS-STARTPTS, scale', options: [x/2, y/2],
                    inputs: index+':v', outputs: 'block'+index
                });
            });
            // Build Mosaic, block by block
            videoInfo.forEach(function (val, index, array) {
                complexFilter.push({
                    filter: 'overlay', options: { shortest:1, x: val.coord.x, y: val.coord.y },
                    inputs: ['base'+index, 'block'+index], outputs: 'base'+(index+1)
                });
            });

            command
                .complexFilter(complexFilter, 'base4')
                .videoCodec('libx264')
                .noAudio()
                .on('error', function(err) {
                    console.log('An error occurred: ' + err.message);
                })	
                .on('progress', function (progress) {
                    console.log('Progress object:', progress)
                    let percent = progress.percent || 
                                 (progress.timemark && progress.targetSize ? 
                                  Math.round((progress.targetSize / 1000) * 0.1) : 
                                  'calculating...')
                    console.log('Processing: ' + percent + '% done')
                    
                    // Send progress to renderer
                    if (mainWindow && mainWindow.webContents) {
                        mainWindow.webContents.send('video:progress', {
                            percent: typeof percent === 'number' ? Math.round(percent) : percent
                        })
                    }
                })
                .on('end', function () {
                    console.log('Processing finished !')
                    mainWindow.webContents.send('video:done')
                })
                .save(filePath)

    } catch (err) {
        console.log(err)
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