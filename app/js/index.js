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
    persistPrefs()
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
var lastSaveDir = null
let converting = false
let applyingPrefs = false
let userTouchedGrid = false

function shouldRestoreGridAndPaths(userTouchedGrid) {
    return !userTouchedGrid
}

function markGridTouched() {
    if (!applyingPrefs) {
        userTouchedGrid = true
    }
}

function getDurationSettings() {
    const value = document.getElementById('output-duration').value
    if (value === '5' || value === '15' || value === '30' || value === '60') {
        return { durationMode: 'seconds', seconds: Number(value) }
    }
    return { durationMode: 'longest' }
}

function audioFromSelectValue(value) {
    if (value === 'first') {
        return 'first'
    }
    const match = /^slot:([0-8])$/.exec(String(value || ''))
    if (match) {
        return { slot: Number(match[1]) }
    }
    return 'none'
}

function audioToSelectValue(audio) {
    if (audio === 'first') {
        return 'first'
    }
    if (audio && typeof audio === 'object') {
        const slot = Number(audio.slot)
        if (Number.isInteger(slot) && slot >= 0 && slot <= 8) {
            return 'slot:' + slot
        }
    }
    return 'none'
}

function addAudioOption(select, value, label) {
    const option = document.createElement('option')
    option.value = value
    option.textContent = label
    select.appendChild(option)
}

function applyAudioSelection(audio) {
    const select = document.getElementById('output-audio')
    const preferred = audioToSelectValue(audio)
    const values = Array.from(select.options).map(function (opt) {
        return opt.value
    })
    if (values.indexOf(preferred) !== -1) {
        select.value = preferred
    } else if (values.indexOf('first') !== -1) {
        select.value = 'first'
    } else {
        select.value = 'none'
    }
    if (typeof window.syncSelectFace === 'function') {
        window.syncSelectFace(select)
    }
}

function refreshAudioOptions() {
    const select = document.getElementById('output-audio')
    if (!select) {
        return
    }
    const previous = audioFromSelectValue(select.value)
    const paths = collectSlotPaths()
    const visible = visibleSlotCount()
    const occupied = []
    for (let i = 0; i < visible; i++) {
        if (paths[i]) {
            occupied.push(i)
        }
    }

    select.innerHTML = ''
    addAudioOption(select, 'none', 'Mute')
    if (occupied.length > 0) {
        addAudioOption(select, 'first', 'First clip')
        occupied.forEach(function (slot) {
            addAudioOption(select, 'slot:' + slot, fileBasename(paths[slot]))
        })
    }
    applyAudioSelection(previous)
}

function getOutputSettings() {
    const resolution = document.getElementById('output-resolution').value.split('x')
    return {
        width: Number(resolution[0]),
        height: Number(resolution[1]),
        audio: audioFromSelectValue(document.getElementById('output-audio').value),
        fit: document.getElementById('output-fit').value,
        padMode: document.getElementById('output-pad').value,
        ...getDurationSettings(),
    }
}

function fileBasename(filePath) {
    if (!filePath) {
        return ''
    }
    const parts = String(filePath).split(/[/\\]/)
    return parts[parts.length - 1] || String(filePath)
}

function fileDirname(filePath) {
    if (!filePath) {
        return null
    }
    const s = String(filePath)
    const idx = Math.max(s.lastIndexOf('/'), s.lastIndexOf('\\'))
    if (idx <= 0) {
        return null
    }
    return s.slice(0, idx)
}

function collectSlotPaths() {
    const paths = []
    for (let i = 1; i <= 9; i++) {
        paths.push(window['vidPath' + i] || null)
    }
    return paths
}

function collectPrefs() {
    const settings = getOutputSettings()
    return {
        version: 1,
        gridType: currentGrid,
        width: settings.width,
        height: settings.height,
        audio: settings.audio,
        fit: settings.fit,
        durationMode: settings.durationMode,
        seconds: settings.seconds,
        lastSaveDir: lastSaveDir,
        paths: collectSlotPaths(),
    }
}

function persistPrefs() {
    if (applyingPrefs) {
        return
    }
    if (!window.electronAPI || typeof electronAPI.savePrefs !== 'function') {
        return
    }
    electronAPI.savePrefs(collectPrefs()).catch((err) => {
        console.error('prefs:save failed:', err)
    })
}

function advancedSettingsDialog() {
    return document.getElementById('advanced-settings')
}

function closeAdvancedSettings() {
    if (typeof window.closeOutputSelects === 'function') {
        window.closeOutputSelects()
    }
    const dialog = advancedSettingsDialog()
    if (dialog && dialog.open) {
        dialog.close()
    }
}

function openAdvancedSettings() {
    if (converting) {
        return
    }
    const dialog = advancedSettingsDialog()
    if (dialog && typeof dialog.showModal === 'function') {
        dialog.showModal()
    }
}

function applyPrefs(prefs, options) {
    document.getElementById('output-resolution').value = prefs.width + 'x' + prefs.height
    document.getElementById('output-fit').value = prefs.fit
    document.getElementById('output-pad').value = prefs.padMode === 'freeze' ? 'freeze' : 'black'
    const durationSelect = document.getElementById('output-duration')
    if (prefs.durationMode === 'seconds' && (prefs.seconds === 5 || prefs.seconds === 15 || prefs.seconds === 30 || prefs.seconds === 60)) {
        durationSelect.value = String(prefs.seconds)
    } else {
        durationSelect.value = 'longest'
    }
    lastSaveDir = prefs.lastSaveDir
    const applyGrid = options && options.applyGrid === true
        ? true
        : shouldRestoreGridAndPaths(userTouchedGrid)
    if (applyGrid) {
        switchGrid(prefs.gridType)
        const dropzones = document.querySelectorAll('.dropzone')
        const visibleCount = prefs.gridType === '2x2' ? 4 : 9
        for (let i = 0; i < visibleCount; i++) {
            if (prefs.paths[i]) {
                setSlotOccupied(dropzones[i], prefs.paths[i])
            } else {
                clearSlot(dropzones[i], i + 1)
            }
        }
    }
    refreshAudioOptions()
    applyAudioSelection(prefs.audio)
    if (typeof window.syncSelectFaces === 'function') {
        window.syncSelectFaces()
    }
}

async function restorePrefs() {
    if (!window.electronAPI || typeof electronAPI.loadPrefs !== 'function') {
        return
    }
    try {
        const prefs = await electronAPI.loadPrefs()
        applyingPrefs = true
        applyPrefs(prefs)
    } catch (err) {
        console.error('prefs:load failed:', err)
    } finally {
        applyingPrefs = false
        if (userTouchedGrid) {
            persistPrefs()
        }
    }
}

function setSlotOccupied(dropzone, filePath) {
    markGridTouched()
    const vidNum = dropzone.getAttribute('id').split('-')[1]
    window['vidPath' + vidNum] = filePath
    dropzone.classList.remove('empty')
    dropzone.classList.add('file')

    const emptyIcon = dropzone.querySelector('.empty-icon')
    const fileIcon = dropzone.querySelector('.file-icon')
    const closeBtn = dropzone.querySelector('.close-btn')
    const label = dropzone.querySelector('.file-label')
    const preview = dropzone.querySelector('.cell-preview')
    if (emptyIcon) emptyIcon.classList.add('hidden')
    if (fileIcon) fileIcon.classList.remove('hidden')
    if (closeBtn) closeBtn.classList.remove('hidden')
    if (label) {
        const name = fileBasename(filePath)
        label.textContent = name
        label.title = name
        label.classList.remove('hidden')
    }
    if (typeof window.showCellPreview === 'function') {
        window.showCellPreview(preview, filePath)
    }
    dropzone.draggable = true
    refreshAudioOptions()
    persistPrefs()
}

function clearSlot(dropzone, vidNum) {
    markGridTouched()
    window['vidPath' + vidNum] = undefined
    dropzone.classList.add('empty')
    dropzone.classList.remove('file')

    const emptyIcon = dropzone.querySelector('.empty-icon')
    const fileIcon = dropzone.querySelector('.file-icon')
    const closeBtn = dropzone.querySelector('.close-btn')
    const label = dropzone.querySelector('.file-label')
    const preview = dropzone.querySelector('.cell-preview')
    if (emptyIcon) emptyIcon.classList.remove('hidden')
    if (fileIcon) fileIcon.classList.add('hidden')
    if (closeBtn) closeBtn.classList.add('hidden')
    if (label) {
        label.textContent = ''
        label.removeAttribute('title')
        label.classList.add('hidden')
    }
    if (typeof window.hideCellPreview === 'function') {
        window.hideCellPreview(preview)
    }
    dropzone.draggable = false
    dropzone.classList.remove('dragging')
    refreshAudioOptions()
    persistPrefs()
}

function visibleSlotCount() {
    return currentGrid === '2x2' ? 4 : 9
}

function isOsFileDrag(dataTransfer) {
    const types = Array.from((dataTransfer && dataTransfer.types) || [])
    return types.indexOf('Files') !== -1
}

function applyVisiblePaths(previous, next) {
    const allDropzones = document.querySelectorAll('.dropzone')
    for (let s = 0; s < next.length; s++) {
        if (next[s] === previous[s]) {
            continue
        }
        if (next[s]) {
            setSlotOccupied(allDropzones[s], next[s])
        } else {
            clearSlot(allDropzones[s], s + 1)
        }
    }
}

function clearDropzoneDragStyles() {
    document.querySelectorAll('.dropzone').forEach(function (el) {
        el.classList.remove('hover', 'copy', 'drop-target', 'dragging')
    })
}

// File drop handling is now done directly in the ondrop event handlers

//On select
let suppressDropzoneClick = false
let dz = document.querySelectorAll('.dropzone');
for (let i = 0; i < dz.length; i++){
    let options = dz[i].getAttribute("id").split('-');
    let vidNum = options[1];

    // Add drag and drop handlers
    dz[i].ondragover = (e) => {
        dz[i].classList.add("hover");
        if (isOsFileDrag(e.dataTransfer)) {
            dz[i].classList.add("copy");
            dz[i].classList.remove("drop-target");
            if (e.dataTransfer) {
                e.dataTransfer.dropEffect = 'copy';
            }
        } else {
            dz[i].classList.remove("copy");
            if (!dz[i].classList.contains('dragging')) {
                dz[i].classList.add("drop-target");
            }
            if (e.dataTransfer) {
                e.dataTransfer.dropEffect = window['vidPath' + vidNum] ? 'move' : 'copy';
            }
        }
        return false;
    };

    dz[i].ondragleave = () => {
        dz[i].classList.remove("hover");
        dz[i].classList.remove("copy");
        dz[i].classList.remove("drop-target");
        return false;
    };

    dz[i].ondragstart = (e) => {
        if (e.target.closest && e.target.closest('.close-btn')) {
            e.preventDefault();
            return;
        }
        if (!dz[i].classList.contains('file') || !window['vidPath' + vidNum]) {
            e.preventDefault();
            return;
        }
        suppressDropzoneClick = true
        e.dataTransfer.setData('application/x-tessel-slot', String(vidNum));
        e.dataTransfer.setData('text/plain', String(vidNum));
        e.dataTransfer.effectAllowed = 'copyMove';
        dz[i].classList.add('dragging');
    };

    dz[i].ondragend = () => {
        clearDropzoneDragStyles();
        setTimeout(function () {
            suppressDropzoneClick = false
        }, 0)
        return false;
    };

    // In-app drop: copy onto an empty cell (source stays filled); swap/move when the dest is occupied.
    dz[i].ondrop = async (e) => {
        e.preventDefault();
        dz[i].classList.remove("hover");
        dz[i].classList.remove("copy");
        dz[i].classList.remove("drop-target");

        const files = Array.from(e.dataTransfer.files || []);
        if (files.length === 0) {
            const raw = e.dataTransfer.getData('application/x-tessel-slot') || e.dataTransfer.getData('text/plain');
            const fromVid = parseInt(raw, 10);
            const visibleCount = visibleSlotCount();
            const fromIndex = fromVid - 1;
            if (!fromVid || fromIndex < 0 || fromIndex >= visibleCount || i >= visibleCount) {
                return false;
            }
            const paths = [];
            for (let s = 0; s < visibleCount; s++) {
                paths[s] = window['vidPath' + (s + 1)];
            }
            const next = !paths[i]
                ? window.copyToSlot(paths, fromIndex, i)
                : window.swapOrMove(paths, fromIndex, i);
            applyVisiblePaths(paths, next);
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
        const visibleCount = visibleSlotCount();
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
        if (suppressDropzoneClick) {
            return
        }
        
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

        lastSaveDir = fileDirname(filePath)
        persistPrefs()

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
        closeAdvancedSettings()
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

electronAPI.receive('prefs:collect', () => {
    if (!window.electronAPI || typeof electronAPI.collectPrefs !== 'function') {
        return
    }
    electronAPI.collectPrefs(collectPrefs()).catch((err) => {
        console.error('prefs:collect failed:', err)
    })
})

electronAPI.receive('prefs:imported', (prefs) => {
    applyingPrefs = true
    try {
        applyPrefs(prefs, { applyGrid: true })
    } finally {
        applyingPrefs = false
        userTouchedGrid = true
        persistPrefs()
    }
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
    document.querySelectorAll('.cell-preview').forEach(function (video) {
        if (typeof window.bindCellPreview === 'function') {
            window.bindCellPreview(video)
        }
    })

    const closeButtons = document.querySelectorAll('.close-btn')
    closeButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault()
            e.stopPropagation() // Prevent triggering the dropzone click
            
            const videoNum = btn.getAttribute('data-video')
            clearVideo(videoNum)
        })
    })

    const settingIds = ['output-resolution', 'output-audio', 'output-fit', 'output-duration', 'output-pad']
    settingIds.forEach((id) => {
        document.getElementById(id).addEventListener('change', persistPrefs)
    })

    const advancedOpen = document.getElementById('advanced-settings-open')
    const advancedClose = document.getElementById('advanced-settings-close')
    const advancedDone = document.getElementById('advanced-settings-done')
    const advancedDialog = advancedSettingsDialog()
    if (advancedOpen) {
        advancedOpen.addEventListener('click', openAdvancedSettings)
    }
    if (advancedClose) {
        advancedClose.addEventListener('click', closeAdvancedSettings)
    }
    if (advancedDone) {
        advancedDone.addEventListener('click', closeAdvancedSettings)
    }
    if (advancedDialog) {
        advancedDialog.addEventListener('click', (event) => {
            if (event.target === advancedDialog) {
                closeAdvancedSettings()
            }
        })
        advancedDialog.addEventListener('close', () => {
            if (typeof window.closeOutputSelects === 'function') {
                window.closeOutputSelects()
            }
        })
    }

    restorePrefs()
})

// On clear (logo click)
document.querySelector('.logo').addEventListener('click', (e) => {
    e.preventDefault()
    clearAllVideos()
})