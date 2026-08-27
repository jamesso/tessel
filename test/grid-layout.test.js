const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '..', 'app/css/style.css'), 'utf8');

function declarationBlock(selector) {
    const needle = `${selector} {`;
    const start = css.indexOf(needle);
    assert.ok(start !== -1, `missing ${selector}`);
    const open = css.indexOf('{', start);
    const close = css.indexOf('}', open);
    return css.slice(open + 1, close);
}

test('mosaic canvas owns 16:9 so 2x2 and 3x3 share one height', () => {
    const main = declarationBlock('.main-block');
    assert.match(main, /aspect-ratio:\s*16\/9/);

    const twoByTwo = declarationBlock('.main-block.grid-2x2');
    assert.match(twoByTwo, /grid-template-rows:\s*(repeat\(2,\s*)?minmax\(0,\s*1fr\)/);

    const threeByThree = declarationBlock('.main-block.grid-3x3');
    assert.match(threeByThree, /grid-template-rows:\s*(repeat\(3,\s*)?minmax\(0,\s*1fr\)/);

    const dropzone = declarationBlock('.dropzone');
    assert.doesNotMatch(dropzone, /aspect-ratio/);
    assert.match(dropzone, /min-height:\s*0/);
    assert.match(dropzone, /box-sizing:\s*border-box/);

    assert.doesNotMatch(css, /\.grid-3x3 \.dropzone\s*\{[^}]*min-height:/);
});
