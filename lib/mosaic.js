const OUTPUT = { width: 1280, height: 720, fps: 25 };

function gridMetrics(gridType) {
    const gridSize = gridType === '3x3' ? 3 : 2;
    const blockWidth = Math.floor(OUTPUT.width / gridSize);
    const blockHeight = Math.floor(OUTPUT.height / gridSize);
    return { gridSize, blockWidth, blockHeight };
}

function selectSlotPaths(originalPaths, gridType) {
    return gridType === '3x3' ? originalPaths : originalPaths.slice(0, 4);
}

function buildVideoInfo(slotPaths, videoDurations, longestDuration) {
    const gridSize = slotPaths.length === 9 ? 3 : 2;
    const blockWidth = Math.floor(OUTPUT.width / gridSize);
    const blockHeight = Math.floor(OUTPUT.height / gridSize);

    const videoInfo = [];
    let inputIndex = 0;

    slotPaths.forEach(function (val) {
        if (val) {
            videoInfo.push({
                filename: val,
                inputIndex: inputIndex,
                isBlack: false,
                duration: videoDurations[val] || longestDuration,
            });
            inputIndex++;
        } else {
            videoInfo.push({
                filename: null,
                inputIndex: -1,
                isBlack: true,
                duration: longestDuration,
            });
        }
    });

    for (let i = 0; i < videoInfo.length; i++) {
        const row = Math.floor(i / gridSize);
        const col = i % gridSize;
        videoInfo[i].coord = {
            x: col * blockWidth,
            y: row * blockHeight,
        };
    }

    return videoInfo;
}

function filterEntryToString(filter) {
    if (typeof filter === 'string') {
        return filter;
    }
    const inputs = Array.isArray(filter.inputs) ? filter.inputs.join('][') : filter.inputs;
    const options = filter.options
        ? (Array.isArray(filter.options)
            ? filter.options.join(':')
            : typeof filter.options === 'object'
                ? Object.entries(filter.options).map(([k, v]) => `${k}=${v}`).join(':')
                : filter.options)
        : '';
    return `[${inputs}]${filter.filter}${options ? '=' + options : ''}[${filter.outputs}]`;
}

function buildFilterComplex(videoInfo, longestDuration, blockWidth, blockHeight) {
    const x = OUTPUT.width;
    const y = OUTPUT.height;
    const complexFilter = [];

    videoInfo.forEach(function (val, index) {
        if (val.isBlack) {
            complexFilter.push(`color=black:size=${blockWidth}x${blockHeight}:duration=${longestDuration}:rate=${OUTPUT.fps} [block${index}]`);
        } else {
            complexFilter.push({
                filter: 'setpts',
                options: 'PTS-STARTPTS',
                inputs: val.inputIndex + ':v',
                outputs: 'reset' + index,
            });

            complexFilter.push({
                filter: 'scale',
                options: [blockWidth, blockHeight],
                inputs: 'reset' + index,
                outputs: 'scaled' + index,
            });

            const paddingDuration = longestDuration - val.duration;

            if (paddingDuration > 0.1) {
                complexFilter.push({
                    filter: 'tpad',
                    options: `stop_mode=add:stop_duration=${paddingDuration}:color=black`,
                    inputs: 'scaled' + index,
                    outputs: 'block' + index,
                });
            } else {
                complexFilter.push({
                    filter: 'copy',
                    inputs: 'scaled' + index,
                    outputs: 'block' + index,
                });
            }
        }
    });

    complexFilter.push(`color=black:size=${x}x${y}:duration=${longestDuration}:rate=${OUTPUT.fps} [canvas]`);

    videoInfo.forEach(function (val, index) {
        const baseInput = index === 0 ? 'canvas' : 'mosaic' + index;
        const outputName = index === videoInfo.length - 1 ? 'final' : 'mosaic' + (index + 1);

        complexFilter.push({
            filter: 'overlay',
            options: { x: val.coord.x, y: val.coord.y },
            inputs: [baseInput, 'block' + index],
            outputs: outputName,
        });
    });

    return complexFilter.map(filterEntryToString).join(';');
}

function buildFfmpegArgs(videoInfo, filterComplex, longestDuration, filePath) {
    const firstReal = videoInfo.find(v => !v.isBlack);
    if (!firstReal) {
        throw new Error('No video inputs');
    }

    return [
        '-i', firstReal.filename,
        ...(videoInfo.filter(v => !v.isBlack).slice(1).map(v => ['-i', v.filename]).flat()),
        '-y',
        '-filter_complex', filterComplex,
        '-map', '[final]',
        '-an',
        '-vcodec', 'libx264',
        '-r', String(OUTPUT.fps),
        '-t', longestDuration.toString(),
        '-avoid_negative_ts', 'make_zero',
        '-vsync', 'cfr',
        filePath,
    ];
}

module.exports = {
    OUTPUT,
    gridMetrics,
    selectSlotPaths,
    buildVideoInfo,
    buildFilterComplex,
    buildFfmpegArgs,
};
