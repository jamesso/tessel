const path = require('path')
const { fileURLToPath } = require('url')

const GITHUB_HOSTS = new Set(['github.com', 'www.github.com'])

function isAllowedExternalUrl(url) {
    try {
        const parsed = new URL(url)
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return false
        }
        return GITHUB_HOSTS.has(parsed.hostname.toLowerCase())
    } catch {
        return false
    }
}

function shouldAllowFileNavigation(url, appRoot) {
    try {
        const parsed = new URL(url)
        if (parsed.protocol !== 'file:') {
            return false
        }
        const filePath = path.resolve(fileURLToPath(parsed))
        const resolvedRoot = path.resolve(appRoot)
        return filePath === resolvedRoot || filePath.startsWith(resolvedRoot + path.sep)
    } catch {
        return false
    }
}

function attachNavigationGuard(win, appRoot, shell) {
    win.webContents.setWindowOpenHandler(({ url }) => {
        if (isAllowedExternalUrl(url)) {
            shell.openExternal(url)
        }
        return { action: 'deny' }
    })

    win.webContents.on('will-navigate', (event, url) => {
        if (shouldAllowFileNavigation(url, appRoot)) {
            return
        }
        if (isAllowedExternalUrl(url)) {
            event.preventDefault()
            shell.openExternal(url)
            return
        }
        event.preventDefault()
    })
}

module.exports = {
    isAllowedExternalUrl,
    shouldAllowFileNavigation,
    attachNavigationGuard,
}
