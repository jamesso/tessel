const STDERR_TAIL_CHARS = 1000;
const STDERR_LINE_MAX_CHARS = 120;
const PROGRESS_LINE_RE = /frame=|size=/;

function pickFfmpegErrorLine(stderr, destPath) {
    const tail = typeof stderr === 'string' ? stderr.slice(-STDERR_TAIL_CHARS) : '';
    const lines = tail.split(/\r?\n/).filter(Boolean);

    for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim();
        if (!line || PROGRESS_LINE_RE.test(line)) {
            continue;
        }
        if (destPath && line.includes(destPath)) {
            continue;
        }
        return line.length > STDERR_LINE_MAX_CHARS
            ? line.slice(0, STDERR_LINE_MAX_CHARS)
            : line;
    }

    return null;
}

function formatConversionFailedMessage(code, stderr, destPath) {
    const exitPart = code == null ? 'exit unknown' : `exit ${code}`;
    let message = `Conversion failed (${exitPart})`;
    const line = pickFfmpegErrorLine(stderr, destPath);
    if (line) {
        message += `: ${line}`;
    }
    return message;
}

module.exports = {
    formatConversionFailedMessage,
    pickFfmpegErrorLine,
};
