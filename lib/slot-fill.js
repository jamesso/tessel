function nextEmptySlots(occupied, visibleCount) {
    const empties = [];
    for (let i = 0; i < visibleCount; i++) {
        if (!occupied[i]) {
            empties.push(i);
        }
    }
    return empties;
}

function assignDrops(emptyIndices, startIndex, fileCount) {
    if (!emptyIndices.length || fileCount <= 0) {
        return [];
    }
    let startPos = emptyIndices.findIndex(function (index) {
        return index >= startIndex;
    });
    if (startPos === -1) {
        startPos = 0;
    }
    const assigned = [];
    const n = Math.min(fileCount, emptyIndices.length);
    for (let k = 0; k < n; k++) {
        assigned.push(emptyIndices[(startPos + k) % emptyIndices.length]);
    }
    return assigned;
}

module.exports = {
    nextEmptySlots,
    assignDrops,
};
