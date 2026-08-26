function canSend(win) {
    return !!(win && !win.isDestroyed() && win.webContents)
}

module.exports = { canSend }
