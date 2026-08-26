function parseFfmpegClock(timemark) {
    if (!timemark) return 0;
    const parts = timemark.split(':');
    if (parts.length === 3) {
        const hours = parseInt(parts[0]) || 0;
        const minutes = parseInt(parts[1]) || 0;
        const seconds = parseFloat(parts[2]) || 0;
        return hours * 3600 + minutes * 60 + seconds;
    }
    return 0;
}

function matchDurationInStderr(text) {
    const durationMatch = text.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})/);
    if (!durationMatch) return null;
    const hours = parseInt(durationMatch[1]);
    const minutes = parseInt(durationMatch[2]);
    const seconds = parseFloat(durationMatch[3]);
    return hours * 3600 + minutes * 60 + seconds;
}

function matchProgressTimeInStderr(text) {
    const timeMatch = text.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
    if (!timeMatch) return null;
    const hours = parseInt(timeMatch[1]);
    const minutes = parseInt(timeMatch[2]);
    const seconds = parseFloat(timeMatch[3]);
    return hours * 3600 + minutes * 60 + seconds;
}

function progressPercent(currentTime, longestDuration) {
    if (!Number.isFinite(longestDuration) || longestDuration <= 0) return 0;
    return Math.min(Math.round((currentTime / longestDuration) * 100), 99);
}

function isFinitePositiveDuration(n) {
    return Number.isFinite(n) && n > 0;
}

function maxDurationFromMap(durations) {
    const values = Object.values(durations);
    if (values.length === 0) {
        throw new Error('Invalid duration in map');
    }
    let max = 0;
    for (const value of values) {
        if (!isFinitePositiveDuration(value)) {
            throw new Error('Invalid duration in map');
        }
        max = Math.max(max, value);
    }
    return max;
}

function assertAllFiniteDurations(durations, paths) {
    for (const path of paths) {
        if (!isFinitePositiveDuration(durations[path])) {
            throw new Error(`Invalid duration for ${path}`);
        }
    }
}

module.exports = {
    parseFfmpegClock,
    matchDurationInStderr,
    matchProgressTimeInStderr,
    progressPercent,
    isFinitePositiveDuration,
    maxDurationFromMap,
    assertAllFiniteDurations,
};
