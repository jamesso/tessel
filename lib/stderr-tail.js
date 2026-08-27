const STDERR_BUFFER_MAX_CHARS = 8192;

function appendStderrTail(previous, chunk, maxChars) {
    const text = (previous || '') + String(chunk);
    if (text.length <= maxChars) {
        return text;
    }
    return text.slice(-maxChars);
}

module.exports = {
    STDERR_BUFFER_MAX_CHARS,
    appendStderrTail,
};
