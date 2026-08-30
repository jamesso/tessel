'use strict';

/**
 * @param {unknown} stamp Parsed pin.json contents.
 * @param {{ archiveSha256: string, platform: string }} expected
 * @returns {boolean}
 */
function pinMatches(stamp, expected) {
    if (!stamp || typeof stamp !== 'object') return false;
    return stamp.archiveSha256 === expected.archiveSha256
        && stamp.platform === expected.platform;
}

module.exports = { pinMatches };
