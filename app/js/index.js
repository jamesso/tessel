// Test if electronAPI is available
console.log('Script loading...')
console.log('electronAPI available:', typeof window.electronAPI)

if (window.electronAPI) {
    console.log('electronAPI methods available:', Object.keys(window.electronAPI))
} else {
    console.error('electronAPI is NOT available!')
}

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
        
        if (!window.electronAPI) {
            console.error('electronAPI is not available!')
            return
        }

        const defaultPath = await electronAPI.getDefaultPath('desktop')
        const options = {
            defaultPath: defaultPath,
            filters :[
            {name: 'Movies', extensions: ['mp4']}
            ]
        }
        
        try {
            const { filePaths } = await electronAPI.showOpenDialog(options)
            if (!Array.isArray(filePaths) || !filePaths.length) { 
                return;
            } else { 
                window['vidPath' + vidNum] = filePaths.toString()
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

    const defaultPath = await electronAPI.getDefaultPath('saveFile')
    const options = {
        defaultPath: defaultPath,
        filters :[
        {name: 'Movies', extensions: ['mp4']}
        ]
    }
    try {
        if (!vidPath1 || !vidPath2 || !vidPath3 || !vidPath4) {
            console.log("missing files")
            return;
        } else { 
            const { filePath } = await electronAPI.showSaveDialog(options)
            if (!filePath) { 
                return;
            } else {
                electronAPI.send('video:convert', {
                    vidPath1,
                    vidPath2,
                    vidPath3,
                    vidPath4,
                    filePath,
                })
                document.getElementById("overlay").style.display = "block";
            }
        }
    } catch (err) {
        console.log('Save failed:', err)
    }
})

// On progress
electronAPI.receive('video:progress', (data) => {
    const progressText = document.getElementById('progress-text')
    if (progressText) {
        const percent = data.percent
        if (typeof percent === 'number') {
            progressText.textContent = `${percent}%`
        } else {
            progressText.textContent = '0%'
        }
    }
})

// On error
electronAPI.receive('video:error', (error) => {
    document.getElementById("overlay").style.display = "none";
    alert('Video conversion error: ' + error);
    // Reset progress text
    const progressText = document.getElementById('progress-text')
    if (progressText) {
        progressText.textContent = '0%'
    }
})

// On done
electronAPI.receive('video:done', () => {
    //add toast for coversion complete
    document.getElementById("overlay").style.display = "none";
    // Reset progress text
    const progressText = document.getElementById('progress-text')
    if (progressText) {
        progressText.textContent = '0%'
    }
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