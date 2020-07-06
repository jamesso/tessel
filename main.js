const path = require('path')
const os = require('os')
const { app, BrowserWindow, Menu, ipcMain, shell } = require('electron')
const ffmpegPath = require('@ffmpeg-installer/ffmpeg')
const ffmpeg = require('fluent-ffmpeg')
const slash = require('slash')

// Set environment
process.env.NODE_ENV = 'production'

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath.path);
console.log(ffmpegPath.path, ffmpegPath.version);

const isDev = process.env.NODE_ENV !== 'production' ? true : false
const isMac = process.platform === 'darwin' ? true : false

let mainWindow
let aboutWindow

function createMainWindow() {
    mainWindow = new BrowserWindow({
        title: 'Tessel',
        width: isDev ? 800 : 450,
        height: 600,
        icon: `${__dirname}/assets/icons/icon-256.png`,
        resizable: isDev ? true : false,
        webPreferences: {
            nodeIntegration: true,
            enableRemoteModule: true,
        }
    })

    if (isDev) {
        mainWindow.webContents.openDevTools()
    }

    mainWindow.loadFile('./app/index.html')
}

function createAboutWindow() {
    aboutWindow = new BrowserWindow({
        title: 'About Tessel',
        width: 300,
        height: 300,
        icon: `${__dirname}/assets/icons/icon-256.png`,
        resizable: false,
    })

    aboutWindow.loadFile('./app/about.html')
}

app.on('ready', () => {
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

ipcMain.on('video:convert', (e, options) => {
    console.log(options)
    convertVideo(options)
})

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
                    console.log('Processing: ' + progress.percent + '% done')
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