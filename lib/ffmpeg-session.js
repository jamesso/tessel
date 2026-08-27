const {
    matchDurationInStderr,
    matchProgressTimeInStderr,
    progressPercent,
    maxDurationFromMap,
    assertAllFiniteDurations,
} = require('./timecode');
const {
    gridMetrics,
    selectSlotPaths,
    buildVideoInfo,
    buildFilterComplex,
    buildFfmpegArgs,
} = require('./mosaic');
const { shouldRejectSecondJob } = require('./job-lock');
const { shouldUnlinkPartialOutput, tempOutputPath } = require('./convert-session');
const { FFMPEG_PROTOCOL_WHITELIST } = require('./ffmpeg-path');
const { formatConversionFailedMessage } = require('./ffmpeg-error');

function createFfmpegSession(deps) {
    const spawn = deps.spawn;
    const ffmpegBinary = deps.ffmpegBinary;
    const fs = deps.fs;
    const send = deps.send;
    const log = typeof deps.log === 'function' ? deps.log : function () {};

    const liveProbeProcesses = new Set();
    let activeEncode = null;
    let activeOutputPath = null;
    let outputCreatedByThisJob = false;
    let killedByUs = false;
    let currentJobId = 0;
    let nextJobId = 0;

    function sendToRenderer(channel, ...args) {
        send(channel, ...args);
    }

    function killChildProcess(child) {
        if (!child || !child.kill) return;
        try {
            if (process.platform === 'win32') {
                child.kill();
            } else {
                child.kill('SIGTERM');
            }
        } catch (err) {
            log('Failed to kill child process:', err.message);
        }
    }

    function unlinkTempFile(tempPath) {
        try {
            fs.unlinkSync(tempPath);
        } catch (err) {
            if (err.code !== 'ENOENT') {
                log('Failed to unlink partial output:', { path: tempPath, message: err.message });
            }
        }
    }

    function renameOutputFile(tempPath, destPath) {
        try {
            fs.renameSync(tempPath, destPath);
            return true;
        } catch (err) {
            if (err.code === 'EEXIST' || err.code === 'EPERM') {
                try {
                    fs.unlinkSync(destPath);
                    fs.renameSync(tempPath, destPath);
                    return true;
                } catch (err2) {
                    return false;
                }
            }
            return false;
        }
    }

    function discardPartialOutput() {
        if (shouldUnlinkPartialOutput({
            encodeStarted: Boolean(activeOutputPath),
            createdByThisJob: outputCreatedByThisJob,
        }) && activeOutputPath) {
            try {
                fs.unlinkSync(activeOutputPath);
            } catch (err) {
                if (err.code !== 'ENOENT') {
                    log('Failed to unlink partial output:', { path: activeOutputPath, message: err.message });
                }
            }
        }
        activeOutputPath = null;
        outputCreatedByThisJob = false;
    }

    function killActiveFfmpeg(options = {}) {
        const notifyCancelled = options.notify === 'cancelled';

        if (!activeEncode && liveProbeProcesses.size === 0) {
            if (notifyCancelled) {
                sendToRenderer('video:cancelled');
            }
            return;
        }

        killedByUs = true;

        killChildProcess(activeEncode);

        for (const probe of liveProbeProcesses) {
            killChildProcess(probe);
        }
        liveProbeProcesses.clear();

        discardPartialOutput();

        activeEncode = null;

        if (notifyCancelled) {
            sendToRenderer('video:cancelled');
        }
    }

    function getVideoDurationWithFFmpeg(videoPath) {
        return new Promise((resolve, reject) => {
            if (!ffmpegBinary) {
                reject(new Error('FFmpeg binary not found for this platform'));
                return;
            }

            log('Getting duration with ffmpeg for:', videoPath);

            const args = ['-nostdin', '-protocol_whitelist', FFMPEG_PROTOCOL_WHITELIST, '-hide_banner', '-i', videoPath];
            const ffmpegProcess = spawn(ffmpegBinary, args);
            liveProbeProcesses.add(ffmpegProcess);

            let output = '';
            let duration = null;
            let settled = false;

            const finish = (fn) => {
                if (settled) return;
                settled = true;
                liveProbeProcesses.delete(ffmpegProcess);
                fn();
            };

            const tryResolveWithDuration = () => {
                if (duration !== null && Number.isFinite(duration) && duration > 0) {
                    ffmpegProcess.kill();
                    finish(() => resolve(duration));
                }
            };

            ffmpegProcess.stderr.on('data', (data) => {
                output += data.toString();
                const parsed = matchDurationInStderr(output);
                if (parsed !== null && Number.isFinite(parsed) && parsed > 0) {
                    duration = parsed;
                    log('Found duration via ffmpeg:', { videoPath, duration });
                    tryResolveWithDuration();
                }
            });

            ffmpegProcess.on('close', () => {
                if (settled) return;
                if (duration !== null && Number.isFinite(duration) && duration > 0) {
                    finish(() => resolve(duration));
                } else {
                    log('Could not extract duration from ffmpeg output for:', videoPath);
                    finish(() => reject(new Error('Could not extract duration')));
                }
            });

            ffmpegProcess.on('error', (err) => {
                log('FFmpeg duration check failed:', err.message);
                finish(() => reject(err));
            });
        });
    }

    function convertVideo({ vidPath1, vidPath2, vidPath3, vidPath4, vidPath5, vidPath6, vidPath7, vidPath8, vidPath9, gridType, filePath, width, height, audio, fit }) {
        if (shouldRejectSecondJob(activeEncode)) {
            sendToRenderer('video:error', 'A conversion is already running');
            return;
        }

        const myId = ++nextJobId;
        currentJobId = myId;
        activeEncode = true;
        killedByUs = false;

        try {
            log('=== CONVERSION START ===');
            const output = { width, height };

            log('Input parameters:', {
                gridType,
                filePath,
                width,
                height,
                audio,
                fit,
                videos: { vidPath1, vidPath2, vidPath3, vidPath4, vidPath5, vidPath6, vidPath7, vidPath8, vidPath9 },
            });

            const allVideoPaths = [vidPath1, vidPath2, vidPath3, vidPath4, vidPath5, vidPath6, vidPath7, vidPath8, vidPath9]
                .filter(path => path);

            if (!ffmpegBinary) {
                log('ERROR: FFmpeg binary not found for this platform');
                activeEncode = null;
                sendToRenderer('video:error', 'FFmpeg binary not found for this platform');
                return;
            }

            if (allVideoPaths.length === 0) {
                log('ERROR: No videos provided');
                activeEncode = null;
                sendToRenderer('video:error', 'No videos provided');
                return;
            }

            log('Valid video paths:', allVideoPaths);

            const originalPaths = [vidPath1, vidPath2, vidPath3, vidPath4, vidPath5, vidPath6, vidPath7, vidPath8, vidPath9];

            log('Path mapping:', originalPaths);

            let videoDurations = {};

            const processDurations = async () => {
                log('Starting duration analysis...');
                try {
                    const durations = {};
                    const total = allVideoPaths.length;
                    let done = 0;
                    for (const videoPath of allVideoPaths) {
                        if (myId !== currentJobId || killedByUs) return;
                        durations[videoPath] = await getVideoDurationWithFFmpeg(videoPath);
                        if (myId !== currentJobId || killedByUs) return;
                        done++;
                        sendToRenderer('video:progress', {
                            percent: Math.round((done / total) * 10),
                            phase: `Analyzing ${done}/${total}`,
                        });
                    }
                    assertAllFiniteDurations(durations, allVideoPaths);
                    videoDurations = durations;
                    const maxDuration = maxDurationFromMap(durations);
                    log('Duration analysis complete:', { maxDuration, videoDurations });
                    if (myId !== currentJobId || killedByUs) return;
                    startConversion(maxDuration);
                } catch (err) {
                    if (myId !== currentJobId) return;
                    log('Duration probe failed:', err.message);
                    activeEncode = null;
                    if (!killedByUs) {
                        sendToRenderer('video:error', 'Could not read video duration');
                    }
                }
            };

            const startConversion = (longestDuration) => {
                if (myId !== currentJobId || killedByUs) return;

                log('=== STARTING FFMPEG CONVERSION ===');
                log('Longest duration determined:', longestDuration);

                const { gridSize, blockWidth, blockHeight } = gridMetrics(gridType, output);
                const isGrid3x3 = gridType === '3x3';

                log('Grid configuration:', { gridType, isGrid3x3, gridSize, blockWidth, blockHeight, output, audio, fit });

                const slotPaths = selectSlotPaths(originalPaths, gridType);
                slotPaths.forEach(function (val, index) {
                    if (val) {
                        log(`Position ${index}: Input File`, val);
                    } else {
                        log(`Position ${index}: Using black placeholder`);
                    }
                });

                const videoInfo = buildVideoInfo(slotPaths, videoDurations, longestDuration, output);

                log('Video info array:', videoInfo);
                log('Video info with coordinates:', videoInfo);

                const filterComplex = buildFilterComplex(videoInfo, longestDuration, blockWidth, blockHeight, { fit, output });

                log('Filter complex string:', filterComplex);

                const totalFrames = Math.ceil(longestDuration * 25);
                log('Expected frame count:', totalFrames);

                const destPath = filePath;
                const tempPath = tempOutputPath(destPath);

                const args = buildFfmpegArgs(videoInfo, filterComplex, longestDuration, tempPath, { audio, output });

                log('FFmpeg command args:', args);
                log('Full FFmpeg command:', ffmpegBinary + ' ' + args.join(' '));

                outputCreatedByThisJob = true;
                const ffmpegProcess = spawn(ffmpegBinary, args);

                activeEncode = ffmpegProcess;
                activeOutputPath = tempPath;

                let ffmpegOutput = '';
                let signaled = false;

                const finishEncode = () => {
                    if (myId !== currentJobId) return;
                    activeEncode = null;
                    activeOutputPath = null;
                    outputCreatedByThisJob = false;
                };

                const signalError = (message) => {
                    if (myId !== currentJobId) return;
                    if (signaled) return;
                    if (killedByUs) {
                        finishEncode();
                        return;
                    }
                    signaled = true;
                    if (activeOutputPath) {
                        unlinkTempFile(activeOutputPath);
                    }
                    finishEncode();
                    sendToRenderer('video:error', message);
                };

                ffmpegProcess.stderr.on('data', (data) => {
                    const output = data.toString();
                    ffmpegOutput += output;
                    log('FFmpeg stderr:', output);

                    const progressText = ffmpegOutput.length > 4096
                        ? ffmpegOutput.slice(-4096)
                        : ffmpegOutput;
                    const currentTime = matchProgressTimeInStderr(progressText);
                    if (currentTime !== null) {
                        const percent = progressPercent(currentTime, longestDuration);

                        log('Progress update:', { currentTime, percent, longestDuration });
                        sendToRenderer('video:progress', { percent: percent });
                    }
                });

                ffmpegProcess.stdout.on('data', (data) => {
                    log('FFmpeg stdout:', data.toString());
                });

                ffmpegProcess.on('close', (code) => {
                    log('FFmpeg process closed:', { code, outputLength: ffmpegOutput.length });

                    if (myId !== currentJobId) return;

                    if (killedByUs) {
                        killedByUs = false;
                        finishEncode();
                        return;
                    }

                    if (code === 0) {
                        log('Processing finished successfully!');
                        log('=== CONVERSION END ===');
                        if (!renameOutputFile(tempPath, destPath)) {
                            signalError('Could not save output file');
                            return;
                        }
                        finishEncode();
                        sendToRenderer('video:progress', { percent: 100 });
                        sendToRenderer('video:done');
                    } else {
                        log('FFmpeg failed:', { code, lastOutput: ffmpegOutput.slice(-1000) });
                        signalError(formatConversionFailedMessage(code, ffmpegOutput, destPath));
                    }
                });

                ffmpegProcess.on('error', (err) => {
                    log('FFmpeg spawn error:', err.message);
                    signalError('Could not start FFmpeg');
                });
            };

            processDurations();

        } catch (err) {
            log('Conversion function error:', err);
            activeEncode = null;
            activeOutputPath = null;
            outputCreatedByThisJob = false;
            sendToRenderer('video:error', err.message || 'Conversion failed');
        }
    }

    return {
        convertVideo,
        killActiveFfmpeg,
        isBusy() {
            return Boolean(activeEncode);
        },
    };
}

module.exports = { createFfmpegSession };
