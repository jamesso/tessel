'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ICONS_DIR = path.join(ROOT, 'node_modules', '@hugeicons', 'core-free-icons', 'dist', 'cjs');

const ICONS = {
    'add-01': 'Add01Icon',
    'tick-02': 'Tick02Icon',
    'cancel-01': 'Cancel01Icon',
    'sliders-horizontal': 'SlidersHorizontalIcon',
    'arrow-down-01': 'ArrowDown01Icon',
    'grid-2x2': 'Grid2X2Icon',
    'grid-3x3': 'Grid3X3Icon',
};

function toKebab(key) {
    return key.replace(/[A-Z]/g, (ch) => `-${ch.toLowerCase()}`);
}

function escapeAttr(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;');
}

function attrsToString(attrs) {
    return Object.entries(attrs)
        .filter(([key]) => key !== 'key')
        .map(([key, value]) => `${toKebab(key)}="${escapeAttr(value)}"`)
        .join(' ');
}

function iconToInner(nodes) {
    return nodes
        .map(([tag, attrs]) => `<${tag} ${attrsToString(attrs)} />`)
        .join('');
}

function loadIcon(exportName) {
    const filePath = path.join(ICONS_DIR, `${exportName}.js`);
    if (!fs.existsSync(filePath)) {
        throw new Error(`Missing Hugeicons file: ${exportName}`);
    }
    const source = fs.readFileSync(filePath, 'utf8');
    const match = source.match(/=\s*(\[[\s\S]*?\]);/);
    if (!match) {
        throw new Error(`Could not parse Hugeicons export: ${exportName}`);
    }
    return Function(`"use strict"; return (${match[1]});`)();
}

function buildSprite() {
    const symbols = Object.entries(ICONS)
        .map(([id, exportName]) => {
            const inner = iconToInner(loadIcon(exportName));
            return `<symbol id="hi-${id}" viewBox="0 0 24 24" fill="none">${inner}</symbol>`;
        })
        .join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" class="hi-sprite" width="0" height="0" aria-hidden="true" focusable="false">${symbols}</svg>`;
}

function replaceBetweenMarkers(source, startMarker, endMarker, replacement) {
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker);
    if (start === -1 || end === -1 || end <= start) {
        throw new Error(`Missing ${startMarker} / ${endMarker} markers`);
    }
    return (
        source.slice(0, start + startMarker.length) +
        '\n' +
        replacement +
        '\n        ' +
        source.slice(end)
    );
}

const sprite = buildSprite();
const spritePath = path.join(ROOT, 'app', 'icons', 'sprite.svg');
fs.mkdirSync(path.dirname(spritePath), { recursive: true });
fs.writeFileSync(spritePath, `${sprite}\n`);

const htmlPath = path.join(ROOT, 'app', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
fs.writeFileSync(
    htmlPath,
    replaceBetweenMarkers(html, '<!-- hugeicons-sprite -->', '<!-- /hugeicons-sprite -->', `        ${sprite}`),
);

console.log('Vendored Hugeicons sprite for', Object.keys(ICONS).join(', '));
