// Grid toggle functionality
document.getElementById('grid-2x2').addEventListener('click', function() {
    switchGrid('2x2')
})

document.getElementById('grid-3x3').addEventListener('click', function() {
    switchGrid('3x3')
})

function switchGrid(gridType) {
    currentGrid = gridType
    const videoGrid = document.getElementById('video-grid')
    const gridButtons = document.querySelectorAll('.grid-btn')
    
    // Update active button
    gridButtons.forEach(btn => btn.classList.remove('active'))
    document.getElementById('grid-' + gridType).classList.add('active')
    
    // Update grid class
    videoGrid.className = 'main-block container grid-' + gridType
    
    // Show/hide dropzones based on grid type
    const allDropzones = document.querySelectorAll('.dropzone')
    allDropzones.forEach((dz, index) => {
        if (gridType === '2x2') {
            // Show first 4, hide rest
            if (index < 4) {
                dz.classList.remove('hidden')
            } else {
                dz.classList.add('hidden')
                // Clear hidden dropzones
                const vidNum = index + 1
                window['vidPath' + vidNum] = undefined
                dz.classList.remove('file')
                dz.classList.add('empty')
            }
        } else if (gridType === '3x3') {
            // Show all 9
            dz.classList.remove('hidden')
        }
    })
}

var vidPath1 = undefined
var vidPath2 = undefined
var vidPath3 = undefined
var vidPath4 = undefined
var vidPath5 = undefined
var vidPath6 = undefined
var vidPath7 = undefined
var vidPath8 = undefined
var vidPath9 = undefined
var currentGrid = '2x2' // Default grid type
let converting = false

// File drop handling is now done directly in the ondrop event handlers

//On select
let dz = document.querySelectorAll('.dropzone');
for (let i = 0; i < dz.length; i++){
    let options = dz[i].getAttribute("id").split('-');
    let vidNum = options[1];
    let maxFiles = parseInt(options[2]);

    // Add drag and drop handlers
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

    dz[i].ondrop = async (e) => {
        e.preventDefault();
        dz[i].classList.remove("hover");
        dz[i].classList.remove("copy");
        
        const files = e.dataTransfer.files;
        
        if (files.length > 0) {
            const file = files[0]; // Only use the first file
            
            // Check if it's a video file (MIME type or extension fallback)
            if (!window.electronAPI.isProbablyVideoFile({ type: file.type, name: file.name })) {
                console.warn('File is not a video:', file.type, file.name);
                alert('Please drop a video file (MP4, MOV, etc.)');
                return false;
            }
            
            // Get file path using webUtils API
            const filePath = window.electronAPI.getPathForFile(file);
            
            if (filePath) {
                window['vidPath' + vidNum] = filePath;
                dz[i].classList.remove("empty");
                dz[i].classList.add("file");
                
                // Update dropzone icons and close button
                const emptyIcon = dz[i].querySelector('.empty-icon');
                const fileIcon = dz[i].querySelector('.file-icon');
                const closeBtn = dz[i].querySelector('.close-btn');
                if (emptyIcon) emptyIcon.classList.add('hidden');
                if (fileIcon) fileIcon.classList.remove('hidden');
                if (closeBtn) closeBtn.classList.remove('hidden');
            } else {
                console.error('Failed to get file path via webUtils');
                alert('Could not access the dropped file. Please use click-to-select instead.');
            }
        }
        
        return false;
    };

    // Click handler
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
            {name: 'Movies', extensions: window.electronAPI.VIDEO_EXTENSIONS}
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
                
                // Update dropzone icons and close button
                const emptyIcon = dz[i].querySelector('.empty-icon');
                const fileIcon = dz[i].querySelector('.file-icon');
                const closeBtn = dz[i].querySelector('.close-btn');
                if (emptyIcon) emptyIcon.classList.add('hidden');
                if (fileIcon) fileIcon.classList.remove('hidden');
                if (closeBtn) closeBtn.classList.remove('hidden');
            } 
        } catch (err) {
            console.error('Open failed:', err)
        }
    };
};

// On submit
document.getElementById('convert').addEventListener('click', async (e) => {
    e.preventDefault()

    const overlay = document.getElementById('overlay')
    if (overlay.style.display === 'block') {
        return
    }

    const convertBtn = document.getElementById('convert')
    converting = true
    convertBtn.disabled = true

    const defaultPath = await electronAPI.getDefaultPath('saveFile')
    const options = {
        defaultPath: defaultPath,
        filters :[
        {name: 'Movies', extensions: ['mp4']}
        ]
    }
    try {
        // Check if at least one video is selected
        if (!vidPath1 && !vidPath2 && !vidPath3 && !vidPath4 && !vidPath5 && !vidPath6 && !vidPath7 && !vidPath8 && !vidPath9) {
            alert("Please select at least one video file")
            converting = false
            convertBtn.disabled = false
            return;
        }
        
        const { filePath } = await electronAPI.showSaveDialog(options)
        if (!filePath) {
            converting = false
            convertBtn.disabled = false
            return;
        }

        electronAPI.send('video:convert', {
            vidPath1,
            vidPath2,
            vidPath3,
            vidPath4,
            vidPath5,
            vidPath6,
            vidPath7,
            vidPath8,
            vidPath9,
            gridType: currentGrid,
            filePath,
        })
        overlay.style.display = 'block'
    } catch (err) {
        console.error('Save failed:', err)
        converting = false
        convertBtn.disabled = false
    }
})

// On progress
electronAPI.receive('video:progress', (data) => {
    const progressText = document.getElementById('progress-text')
    if (progressText) {
        if (data.phase) {
            progressText.textContent = data.phase
        } else if (typeof data.percent === 'number') {
            progressText.textContent = `${data.percent}%`
        } else {
            progressText.textContent = '0%'
        }
    }
})

// On error
electronAPI.receive('video:error', (error) => {
    converting = false
    document.getElementById('convert').disabled = false
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
    converting = false
    document.getElementById('convert').disabled = false
    //add toast for coversion complete
    document.getElementById("overlay").style.display = "none";
    // Reset progress text
    const progressText = document.getElementById('progress-text')
    if (progressText) {
        progressText.textContent = '0%'
    }
    
    // Clear all video positions after successful conversion
    clearAllVideos()
})

// Function to clear all video positions
function clearAllVideos() {
    vidPath1 = undefined
    vidPath2 = undefined
    vidPath3 = undefined
    vidPath4 = undefined
    vidPath5 = undefined
    vidPath6 = undefined
    vidPath7 = undefined
    vidPath8 = undefined
    vidPath9 = undefined
    
    let clear = document.querySelectorAll('.file')
    for (let i = 0; i < clear.length; i++){
        clear[i].classList.add("empty")
        clear[i].classList.remove("file")
        
        // Reset icons and close button
        const emptyIcon = clear[i].querySelector('.empty-icon');
        const fileIcon = clear[i].querySelector('.file-icon');
        const closeBtn = clear[i].querySelector('.close-btn');
        if (emptyIcon) emptyIcon.classList.remove('hidden');
        if (fileIcon) fileIcon.classList.add('hidden');
        if (closeBtn) closeBtn.classList.add('hidden');
    }
}

// Function to clear individual video position
function clearVideo(videoNum) {
    // Clear the video path variable
    window['vidPath' + videoNum] = undefined
    
    // Find the corresponding dropzone
    const dropzone = document.getElementById(`video-${videoNum}-1`)
    if (dropzone) {
        dropzone.classList.add("empty")
        dropzone.classList.remove("file")
        
        // Reset icons and close button
        const emptyIcon = dropzone.querySelector('.empty-icon');
        const fileIcon = dropzone.querySelector('.file-icon');
        const closeBtn = dropzone.querySelector('.close-btn');
        if (emptyIcon) emptyIcon.classList.remove('hidden');
        if (fileIcon) fileIcon.classList.add('hidden');
        if (closeBtn) closeBtn.classList.add('hidden');
    }
}

// Add event listeners for close buttons
document.addEventListener('DOMContentLoaded', () => {
    const closeButtons = document.querySelectorAll('.close-btn')
    closeButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault()
            e.stopPropagation() // Prevent triggering the dropzone click
            
            const videoNum = btn.getAttribute('data-video')
            clearVideo(videoNum)
        })
    })
})

// On clear (logo click)
document.querySelector('.logo').addEventListener('click', (e) => {
    e.preventDefault()
    clearAllVideos()
})