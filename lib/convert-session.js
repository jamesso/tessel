function shouldUnlinkPartialOutput({ encodeStarted, createdByThisJob }) {
    return Boolean(encodeStarted && createdByThisJob)
}

module.exports = { shouldUnlinkPartialOutput }
