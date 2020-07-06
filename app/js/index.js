const path = require('path')
const os = require('os')
const { ipcRenderer } = require('electron')
const { dialog } = require('electron').remote
WIN = require('electron').remote.getCurrentWindow()

var vidPath1 = undefined
var vidPath2 = undefined
var vidPath3 = undefined
var vidPath4 = undefined

//On select
let dz = document.querySelectorAll('.dropzone');
console.log(dz);
for (let i = 0; i < dz.length; i++){
    let options = dz[i].getAttribute("id").split('-');
    console.log(options);
    let vidNum = options[1];
    let maxFiles = parseInt(options[2]);

    dz[i].ondragover = () => {
        dz[i].classList.add("hover");
        dz[i].classList.add("copy");
        return false;
    };

    dz[i].ondragleave = () => {
        dz[i].classList.remove("hover");
        dz[i].classList.remove("copy");
        return false;
    };

    dz[i].ondragend = () => {
        return false;
    };

    dz[i].ondrop = (e) => {
        e.preventDefault();
        dz[i].classList.remove("hover");
        dz[i].classList.remove("copy");
        for (let f of e.dataTransfer.files) {
            console.log('File(s) you dragged here: ', f.path)
            window['vidPath' + vidNum] = f.path
        }
        dz[i].classList.remove("empty");
        dz[i].classList.add("file");
        return false;
    };
    dz[i].onclick = async (e) => {
        e.preventDefault()

        const options = {
            defaultPath : path.join(os.homedir(), 'Desktop'),
            filters :[
            {name: 'Movies', extensions: ['mp4']}
            ]
        }
        
        console.log("select")
        try {
            const { filePaths } = await dialog.showOpenDialog(WIN, options)
            console.log("choice made")
            console.log(filePaths)
            if (!Array.isArray(filePaths) || !filePaths.length) { 
                console.log("cancel")
                return;
            } else { 
                console.log("open")
                console.log(filePaths)
                console.log(vidNum)
                window['vidPath' + vidNum] = filePaths.toString()
                console.log(vidPath1)
                console.log(vidPath2)
                console.log(vidPath3)
                console.log(vidPath4)
                dz[i].classList.remove("empty");
                dz[i].classList.add("file");
            } 
        } catch (err) {
            console.log('Open failed:', err)
        }
    };
};

// On submit
document.getElementById('convert').addEventListener('click', async (e) => {
    e.preventDefault()

    const options = {
        defaultPath : path.join(os.homedir(), 'Desktop', `tesselate${ Date.now() }.mp4`),
        filters :[
        {name: 'Movies', extensions: ['mp4']}
        ]
    }
    console.log("convert")
    try {
        if (!vidPath1 || !vidPath2 || !vidPath3 || !vidPath4) {
            console.log("missing files")
            return;
        } else { 
            const { filePath } = await dialog.showSaveDialog(WIN, options)
            console.log("choice made")
            console.log(filePath)
            if (!filePath) { 
                console.log("cancel")
                return;
            } else {
                ipcRenderer.send('video:convert', {
                    vidPath1,
                    vidPath2,
                    vidPath3,
                    vidPath4,
                    filePath,
                })
                console.log("save")
                console.log(filePath)
                document.getElementById("overlay").style.display = "block";
            }
        }
    } catch (err) {
        console.log('Save failed:', err)
    }
})

// On done
ipcRenderer.on('video:done', () => {
    //add toast for coversion complete
    document.getElementById("overlay").style.display = "none";
})

// On clear
document.querySelector('.logo').addEventListener('click', (e) => {
    e.preventDefault()

    vidPath1 = undefined
    vidPath2 = undefined
    vidPath3 = undefined
    vidPath4 = undefined
    
    let clear = document.querySelectorAll('.file')
    console.log(clear);
    for (let i = 0; i < clear.length; i++){
        clear[i].classList.add("empty")
        clear[i].classList.remove("file")
    }
    console.log("clear")
})