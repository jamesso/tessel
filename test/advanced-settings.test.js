const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function read(rel) {
    return fs.readFileSync(path.join(root, rel), 'utf8');
}

test('output settings live in the Advanced dialog, not the footer', () => {
    const html = read('app/index.html');
    const footer = html.match(/<footer>[\s\S]*?<\/footer>/)[0];
    const dialog = html.match(/<dialog id="advanced-settings"[\s\S]*?<\/dialog>/)[0];
    assert.match(footer, /id="advanced-settings-open"/);
    assert.match(footer, /id="convert"/);
    assert.doesNotMatch(footer, /id="output-resolution"/);
    assert.match(dialog, /id="output-resolution"/);
    assert.match(dialog, /id="output-pad"/);
    assert.match(dialog, /id="advanced-settings-done"/);
});

test('Advanced is a secondary button that sits above Convert', () => {
    const html = read('app/index.html');
    const footer = html.match(/<footer>[\s\S]*?<\/footer>/)[0];
    const advancedAt = footer.indexOf('id="advanced-settings-open"');
    const convertAt = footer.indexOf('id="convert"');
    assert.ok(advancedAt !== -1 && convertAt !== -1);
    assert.ok(advancedAt < convertAt);
    assert.match(footer, /class="button-secondary"/);
    const css = read('app/css/style.css');
    assert.match(css, /\.button-secondary[\s\S]*background:\s*transparent/);
    assert.match(css, /\.button[\s\S]*background-color:\s*#fff/);
});

test('index.js opens the Advanced dialog with showModal', () => {
    const js = read('app/js/index.js');
    assert.match(js, /showModal\(/);
    assert.match(js, /closeAdvancedSettings/);
    assert.match(js, /overlay\.style\.display = 'block'/);
    const convert = js.indexOf("document.getElementById('convert').addEventListener");
    const overlay = js.indexOf("overlay.style.display = 'block'", convert);
    const closeAfter = js.indexOf('closeAdvancedSettings()', overlay);
    assert.ok(closeAfter !== -1);
});

test('Hugeicons stroke sprite is inlined and used for UI symbols', () => {
    const html = read('app/index.html');
    const sprite = read('app/icons/sprite.svg');
    for (const id of [
        'hi-add-01',
        'hi-tick-02',
        'hi-cancel-01',
        'hi-sliders-horizontal',
        'hi-grid-2x2',
        'hi-grid-3x3',
        'hi-arrow-down-01',
    ]) {
        assert.match(html, new RegExp(`id="${id}"`));
        assert.match(sprite, new RegExp(`id="${id}"`));
    }
    assert.match(html, /href="#hi-add-01"/);
    assert.match(html, /href="#hi-sliders-horizontal"/);
    assert.match(html, /href="#hi-cancel-01"/);
    assert.doesNotMatch(html, /class="dropzone-icon empty-icon">\+/);
});

test('Advanced selects keep native options and open a custom listbox', () => {
    const html = read('app/index.html');
    const js = read('app/js/select.js');
    const css = read('app/css/style.css');
    assert.match(html, /src="js\/select\.js"/);
    assert.match(js, /role', 'combobox'/);
    assert.match(js, /role', 'listbox'/);
    assert.match(js, /aria-activedescendant/);
    assert.match(css, /\.select-list/);
    assert.match(css, /\.select-trigger \{/);
    assert.match(css, /\.select-option[\s\S]*?height:\s*28px/);
    assert.match(css, /\.select-option-check/);
    assert.match(css, /\.select-option\.is-active/);
});
