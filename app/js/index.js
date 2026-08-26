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
                clearSlot(dz, index + 1)
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

function getOutputSettings() {
    const resolution = document.getElementById('output-resolution').value.split('x')
    return {
        width: Number(resolution[0]),
        height: Number(resolution[1]),
        audio: document.getElementById('output-audio').value,
        fit: document.getElementById('output-fit').value,
    }
}

function fileBasename(filePath) {
    if (!filePath) {
        return ''
    }
    const parts = String(filePath).split(/[/\\]/)
    return parts[parts.length - 1] || String(filePath)
}

function setSlotOccupied(dropzone, filePath) {
    const vidNum = dropzone.getAttribute('id').split('-')[1]
    window['vidPath' + vidNum] = filePath
    dropzone.classList.remove('empty')
    dropzone.classList.add('file')

    const emptyIcon = dropzone.querySelector('.empty-icon')
    const fileIcon = dropzone.querySelector('.file-icon')
    const closeBtn = dropzone.querySelector('.close-btn')
    const label = dropzone.querySelector('.file-label')
    if (emptyIcon) emptyIcon.classList.add('hidden')
    if (fileIcon) fileIcon.classList.remove('hidden')
    if (closeBtn) closeBtn.classList.remove('hidden')
    if (label) {
        const name = fileBasename(filePath)
        label.textContent = name
        label.title = name
        label.classList.remove('hidden')
    }
}

function clearSlot(dropzone, vidNum) {
    window['vidPath' + vidNum] = undefined
    dropzone.classList.add('empty')
    dropzone.classList.remove('file')

    const emptyIcon = dropzone.querySelector('.empty-icon')
    const fileIcon = dropzone.querySelector('.file-icon')
    const closeBtn = dropzone.querySelector('.close-btn')
    const label = dropzone.querySelector('.file-label')
    if (emptyIcon) emptyIcon.classList.remove('hidden')
    if (fileIcon) fileIcon.classList.add('hidden')
    if (closeBtn) closeBtn.classList.add('hidden')
    if (label) {
        label.textContent = ''
        label.removeAttribute('title')
        label.classList.add('hidden')
    }
}

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

        const files = Array.from(e.dataTransfer.files || []);
        if (files.length === 0) {
            return false;
        }

        // Single-file drop fills the targeted slot even if occupied (replace).
        if (files.length === 1) {
            const file = files[0];
            if (!window.isProbablyVideoFile({ type: file.type, name: file.name })) {
                alert('Please drop a video file (MP4, MOV, etc.)');
                return false;
            }
            const filePath = window.electronAPI.getPathForFile(file);
            if (filePath) {
                setSlotOccupied(dz[i], filePath);
            } else {
                alert('Could not access the dropped file. Please use click-to-select instead.');
            }
            return false;
        }

        const videos = files.filter(function (file) {
            return window.isProbablyVideoFile({ type: file.type, name: file.name });
        });
        if (videos.length === 0) {
            alert('Please drop a video file (MP4, MOV, etc.)');
            return false;
        }

        // Assignment: start at the drop-target slot index, then wrap through
        // currently visible empty slots only (2×2: indices 0–3; 3×3: 0–8).
        // Never assign into hidden slots 5–9 while 2×2 is active. Files beyond
        // empty slots are ignored (alert once).
        const visibleCount = currentGrid === '2x2' ? 4 : 9;
        const occupied = [];
        for (let s = 0; s < visibleCount; s++) {
            occupied[s] = Boolean(window['vidPath' + (s + 1)]);
        }
        const emptyIndices = window.nextEmptySlots(occupied, visibleCount);
        const slotIndices = window.assignDrops(emptyIndices, i, videos.length);
        const allDropzones = document.querySelectorAll('.dropzone');
        for (let k = 0; k < slotIndices.length; k++) {
            const filePath = window.electronAPI.getPathForFile(videos[k]);
            if (filePath) {
                setSlotOccupied(allDropzones[slotIndices[k]], filePath);
            }
        }
        if (videos.length > slotIndices.length) {
            alert('Some files were not added because there are no empty slots left.');
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
            {name: 'Movies', extensions: window.VIDEO_EXTENSIONS}
            ]
        }
        
        try {
            const { filePaths } = await electronAPI.showOpenDialog(options)
            if (!Array.isArray(filePaths) || !filePaths.length) { 
                return;
            } else { 
                setSlotOccupied(dz[i], filePaths[0] || filePaths.toString())
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
            ...getOutputSettings(),
        })
        overlay.style.display = 'block'
        const toast = document.getElementById('toast')
        if (toast) {
            toast.style.display = 'none'
        }
    } catch (err) {
        console.error('Save failed:', err)
        converting = false
        convertBtn.disabled = false
    }
})

function resetConvertUi() {
    converting = false
    document.getElementById('convert').disabled = false
    document.getElementById('overlay').style.display = 'none'
    const progressText = document.getElementById('progress-text')
    if (progressText) {
        progressText.textContent = '0%'
    }
}

function showToast() {
    const toast = document.getElementById('toast')
    if (!toast) {
        return
    }
    toast.style.display = 'block'
    clearTimeout(showToast.hideTimer)
    showToast.hideTimer = setTimeout(() => {
        toast.style.display = 'none'
    }, 3000)
}

document.getElementById('cancel-convert').addEventListener('click', (e) => {
    e.preventDefault()
    electronAPI.send('video:cancel')
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
    resetConvertUi()
    alert('Video conversion error: ' + error);
})

electronAPI.receive('video:cancelled', () => {
    resetConvertUi()
})

// On done
electronAPI.receive('video:done', () => {
    resetConvertUi()
    showToast()
})

// Function to clear all video positions
function clearAllVideos() {
    const dropzones = document.querySelectorAll('.dropzone')
    dropzones.forEach(function (dropzone, index) {
        clearSlot(dropzone, index + 1)
    })
}

function clearVideo(videoNum) {
    const dropzone = document.getElementById(`video-${videoNum}-1`)
    if (dropzone) {
        clearSlot(dropzone, videoNum)
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