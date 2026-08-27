const { FFMPEG_PROTOCOL_WHITELIST } = require('./ffmpeg-path');
const {
    DEFAULT_SIZE,
    FPS,
    resolveOutput,
    resolveFit,
    resolveAudio,
    resolveEncodeDuration,
} = require('./output-allowlist');

const OUTPUT = { ...DEFAULT_SIZE, fps: FPS };

function columnWidthsForGrid(gridSize, output) {
    const { width } = resolveOutput(output);
    const w = Math.floor(width / gridSize);
    if (gridSize === 3) {
        return [w, w, width - 2 * w];
    }
    return [w, w];
}

function gridMetrics(gridType, output) {
    const resolved = resolveOutput(output);
    const gridSize = gridType === '3x3' ? 3 : 2;
    const blockWidth = Math.floor(resolved.width / gridSize);
    const blockHeight = Math.floor(resolved.height / gridSize);
    const columnWidths = columnWidthsForGrid(gridSize, resolved);
    return { gridSize, blockWidth, blockHeight, columnWidths };
}

function selectSlotPaths(originalPaths, gridType) {
    return gridType === '3x3' ? originalPaths : originalPaths.slice(0, 4);
}

function buildVideoInfo(slotPaths, videoDurations, longestDuration, output) {
    const resolved = resolveOutput(output);
    const gridSize = slotPaths.length === 9 ? 3 : 2;
    const columnWidths = columnWidthsForGrid(gridSize, resolved);
    const blockHeight = Math.floor(resolved.height / gridSize);

    const videoInfo = [];
    const pathToInputIndex = new Map();
    let nextInputIndex = 0;

    slotPaths.forEach(function (val) {
        if (val) {
            if (!pathToInputIndex.has(val)) {
                pathToInputIndex.set(val, nextInputIndex);
                nextInputIndex++;
            }
            videoInfo.push({
                filename: val,
                inputIndex: pathToInputIndex.get(val),
                isBlack: false,
                duration: videoDurations[val] || longestDuration,
            });
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
        let x = 0;
        for (let c = 0; c < col; c++) {
            x += columnWidths[c];
        }
        videoInfo[i].coord = {
            x,
            y: row * blockHeight,
        };
        videoInfo[i].cellWidth = columnWidths[col];
        videoInfo[i].cellHeight = blockHeight;
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

function buildFilterComplex(videoInfo, longestDuration, blockWidth, blockHeight, options = {}) {
    const resolved = resolveOutput(options.output);
    const fit = resolveFit(options.fit);
    const x = resolved.width;
    const y = resolved.height;
    const complexFilter = [];
    const slotsByInputIndex = new Map();

    videoInfo.forEach(function (val, index) {
        if (val.isBlack) {
            return;
        }
        if (!slotsByInputIndex.has(val.inputIndex)) {
            slotsByInputIndex.set(val.inputIndex, []);
        }
        slotsByInputIndex.get(val.inputIndex).push(index);
    });

    for (const [inputIndex, slotIndices] of slotsByInputIndex) {
        if (slotIndices.length === 1) {
            complexFilter.push({
                filter: 'setpts',
                options: 'PTS-STARTPTS',
                inputs: inputIndex + ':v',
                outputs: 'reset' + slotIndices[0],
            });
        } else {
            const outputs = slotIndices.map(function (slotIndex) {
                return 'reset' + slotIndex;
            }).join('][');
            complexFilter.push(
                `[${inputIndex}:v]setpts=PTS-STARTPTS,split=${slotIndices.length}[${outputs}]`,
            );
        }
    }

    videoInfo.forEach(function (val, index) {
        if (val.isBlack) {
            return;
        }

        const cellWidth = val.cellWidth ?? blockWidth;
        const cellHeight = val.cellHeight ?? blockHeight;

        if (fit === 'crop') {
            complexFilter.push({
                filter: 'scale',
                options: [cellWidth, cellHeight, 'force_original_aspect_ratio=increase'],
                inputs: 'reset' + index,
                outputs: 'fitted' + index,
            });

            complexFilter.push({
                filter: 'crop',
                options: `${cellWidth}:${cellHeight}`,
                inputs: 'fitted' + index,
                outputs: 'scaled' + index,
            });
        } else {
            complexFilter.push({
                filter: 'scale',
                options: [cellWidth, cellHeight, 'force_original_aspect_ratio=decrease'],
                inputs: 'reset' + index,
                outputs: 'fitted' + index,
            });

            complexFilter.push({
                filter: 'pad',
                options: `${cellWidth}:${cellHeight}:(ow-iw)/2:(oh-ih)/2:black`,
                inputs: 'fitted' + index,
                outputs: 'scaled' + index,
            });
        }

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
    });

    complexFilter.push(`color=black:size=${x}x${y}:duration=${longestDuration}:rate=${resolved.fps} [canvas]`);

    const occupiedIndices = videoInfo
        .map(function (val, index) {
            return val.isBlack ? -1 : index;
        })
        .filter(function (index) {
            return index >= 0;
        });

    if (occupiedIndices.length === 1) {
        const index = occupiedIndices[0];
        const val = videoInfo[index];
        complexFilter.push({
            filter: 'overlay',
            options: { x: val.coord.x, y: val.coord.y },
            inputs: ['canvas', 'block' + index],
            outputs: 'final',
        });
    } else if (occupiedIndices.length >= 2) {
        const layout = occupiedIndices
            .map(function (index) {
                const val = videoInfo[index];
                return `${val.coord.x}_${val.coord.y}`;
            })
            .join('|');

        complexFilter.push({
            filter: 'xstack',
            options: `inputs=${occupiedIndices.length}:fill=black:layout=${layout}`,
            inputs: occupiedIndices.map(function (index) {
                return 'block' + index;
            }),
            outputs: 'stacked',
        });

        complexFilter.push({
            filter: 'overlay',
            options: { x: 0, y: 0 },
            inputs: ['canvas', 'stacked'],
            outputs: 'final',
        });
    }

    return complexFilter.map(filterEntryToString).join(';');
}

function buildFfmpegArgs(videoInfo, filterComplex, longestDuration, filePath, options = {}) {
    const firstReal = videoInfo.find(v => !v.isBlack);
    if (!firstReal) {
        throw new Error('No video inputs');
    }

    const resolved = resolveOutput(options.output);
    const audio = resolveAudio(options.audio);
    const audioArgs = audio === 'first'
        ? ['-map', `${firstReal.inputIndex}:a?`, '-af', 'asetpts=PTS-STARTPTS,apad']
        : ['-an'];

    const uniqueFilenames = [];
    const seenFilenames = new Set();
    for (const entry of videoInfo) {
        if (!entry.isBlack && !seenFilenames.has(entry.filename)) {
            seenFilenames.add(entry.filename);
            uniqueFilenames.push(entry.filename);
        }
    }

    return [
        '-nostdin',
        '-protocol_whitelist', FFMPEG_PROTOCOL_WHITELIST,
        ...uniqueFilenames.flatMap(function (filename) {
            return ['-i', filename];
        }),
        '-y',
        '-filter_complex', filterComplex,
        '-map', '[final]',
        ...audioArgs,
        '-vcodec', 'libx264',
        '-preset', 'veryfast',
        '-crf', '23',
        '-pix_fmt', 'yuv420p',
        '-r', String(resolved.fps),
        '-t', longestDuration.toString(),
        '-avoid_negative_ts', 'make_zero',
        '-fps_mode', 'cfr',
        filePath,
    ];
}

module.exports = {
    OUTPUT,
    resolveOutput,
    gridMetrics,
    selectSlotPaths,
    buildVideoInfo,
    buildFilterComplex,
    buildFfmpegArgs,
    resolveEncodeDuration,
};
