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

function swapOrMove(paths, fromIndex, toIndex) {
    const next = paths.slice();
    if (fromIndex === toIndex) {
        return next;
    }
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= next.length || toIndex >= next.length) {
        return next;
    }
    if (!next[fromIndex]) {
        return next;
    }
    const fromVal = next[fromIndex];
    next[fromIndex] = next[toIndex];
    next[toIndex] = fromVal;
    return next;
}

module.exports = {
    nextEmptySlots,
    assignDrops,
    swapOrMove,
};
