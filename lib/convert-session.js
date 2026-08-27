function shouldUnlinkPartialOutput({ encodeStarted, createdByThisJob }) {
    return Boolean(encodeStarted && createdByThisJob)
}

function tempOutputPath(filePath) {
    return filePath + '.tessel-partial'
}

module.exports = { shouldUnlinkPartialOutput, tempOutputPath }
