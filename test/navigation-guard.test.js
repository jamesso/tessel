const { test } = require('node:test')
const assert = require('node:assert/strict')
const path = require('path')
const { pathToFileURL } = require('url')
const {
    isAllowedExternalUrl,
    shouldAllowFileNavigation,
    attachNavigationGuard,
} = require('../lib/navigation-guard')

test('isAllowedExternalUrl allows github.com https', () => {
    assert.equal(isAllowedExternalUrl('https://github.com/Jamesso/tessel'), true)
})

test('isAllowedExternalUrl allows www.github.com http', () => {
    assert.equal(isAllowedExternalUrl('http://www.github.com/Jamesso/tessel'), true)
})

test('isAllowedExternalUrl is case-insensitive for host', () => {
    assert.equal(isAllowedExternalUrl('https://GitHub.COM/foo'), true)
})

test('isAllowedExternalUrl rejects other https hosts', () => {
    assert.equal(isAllowedExternalUrl('https://example.com/'), false)
    assert.equal(isAllowedExternalUrl('https://gist.github.com/foo'), false)
})

test('isAllowedExternalUrl rejects non-http(s) protocols', () => {
    assert.equal(isAllowedExternalUrl('file:///etc/passwd'), false)
    assert.equal(isAllowedExternalUrl('javascript:alert(1)'), false)
})

test('shouldAllowFileNavigation allows files under app root', () => {
    const appRoot = path.join('/project', 'app')
    const aboutUrl = pathToFileURL(path.join(appRoot, 'about.html')).href
    assert.equal(shouldAllowFileNavigation(aboutUrl, appRoot), true)
})

test('shouldAllowFileNavigation allows nested files under app root', () => {
    const appRoot = path.join('/project', 'app')
    const nestedUrl = pathToFileURL(path.join(appRoot, 'js', 'about.js')).href
    assert.equal(shouldAllowFileNavigation(nestedUrl, appRoot), true)
})

test('shouldAllowFileNavigation rejects files outside app root', () => {
    const appRoot = path.join('/project', 'app')
    const outsideUrl = pathToFileURL(path.join('/project', 'main.js')).href
    assert.equal(shouldAllowFileNavigation(outsideUrl, appRoot), false)
})

test('shouldAllowFileNavigation rejects http(s) urls', () => {
    const appRoot = path.join('/project', 'app')
    assert.equal(shouldAllowFileNavigation('https://github.com/foo', appRoot), false)
})

test('attachNavigationGuard opens allowed external urls and denies window open', () => {
    const opened = []
    const shell = { openExternal: (url) => opened.push(url) }
    const handlers = {}
    const win = {
        webContents: {
            setWindowOpenHandler(fn) {
                handlers.windowOpen = fn
            },
            on(event, fn) {
                handlers[event] = fn
            },
        },
    }

    attachNavigationGuard(win, '/project/app', shell)

    const result = handlers.windowOpen({ url: 'https://github.com/Jamesso/tessel' })
    assert.deepEqual(result, { action: 'deny' })
    assert.deepEqual(opened, ['https://github.com/Jamesso/tessel'])

    const denied = handlers.windowOpen({ url: 'https://evil.com/' })
    assert.deepEqual(denied, { action: 'deny' })
    assert.deepEqual(opened, ['https://github.com/Jamesso/tessel'])
})

test('attachNavigationGuard handles will-navigate for external and blocked urls', () => {
    const opened = []
    const prevented = []
    const shell = { openExternal: (url) => opened.push(url) }
    const handlers = {}
    const win = {
        webContents: {
            setWindowOpenHandler() {},
            on(event, fn) {
                handlers[event] = fn
            },
        },
    }
    const appRoot = path.join('/project', 'app')

    attachNavigationGuard(win, appRoot, shell)

    const allowEvent = { preventDefault() { prevented.push('allow') } }
    handlers['will-navigate'](allowEvent, pathToFileURL(path.join(appRoot, 'about.html')).href)
    assert.deepEqual(prevented, [])

    const externalEvent = { preventDefault() { prevented.push('external') } }
    handlers['will-navigate'](externalEvent, 'https://github.com/Jamesso/tessel')
    assert.deepEqual(prevented, ['external'])
    assert.deepEqual(opened, ['https://github.com/Jamesso/tessel'])

    const blockedEvent = { preventDefault() { prevented.push('blocked') } }
    handlers['will-navigate'](blockedEvent, 'https://example.com/')
    assert.deepEqual(prevented, ['external', 'blocked'])
    assert.deepEqual(opened, ['https://github.com/Jamesso/tessel'])
})
