(function (root) {
    function pathToPreviewSrc(filePath) {
        if (filePath == null) {
            return '';
        }
        const raw = String(filePath);
        if (!raw) {
            return '';
        }
        if (/^file:/i.test(raw)) {
            return raw;
        }
        const unix = raw.replace(/\\/g, '/');
        const prefixed = unix.charAt(0) === '/' ? unix : '/' + unix;
        const encoded = prefixed.split('/').map(function (seg, i) {
            if (seg === '') {
                return '';
            }
            if (i === 1 && /^[A-Za-z]:$/.test(seg)) {
                return seg;
            }
            return encodeURIComponent(seg);
        }).join('/');
        return 'file://' + encoded;
    }

    function hideCellPreview(videoEl) {
        if (!videoEl) {
            return;
        }
        try {
            videoEl.pause();
        } catch (err) {
            /* ignore */
        }
        videoEl.removeAttribute('src');
        videoEl.classList.add('hidden');
        if (typeof videoEl.load === 'function') {
            try {
                videoEl.load();
            } catch (err) {
                /* ignore */
            }
        }
    }

    function showCellPreview(videoEl, filePath) {
        if (!videoEl) {
            return;
        }
        const src = pathToPreviewSrc(filePath);
        if (!src) {
            hideCellPreview(videoEl);
            return;
        }
        videoEl.src = src;
        videoEl.classList.remove('hidden');
    }

    function pausePreviewAtFirstFrame(videoEl) {
        if (!videoEl) {
            return;
        }
        videoEl.muted = true;
        try {
            videoEl.pause();
        } catch (err) {
            /* ignore */
        }
        try {
            if (typeof videoEl.currentTime === 'number' && videoEl.currentTime < 0.05) {
                const dur = videoEl.duration;
                if (typeof dur === 'number' && isFinite(dur) && dur > 0) {
                    videoEl.currentTime = Math.min(0.08, Math.max(0.04, dur / 4));
                } else {
                    videoEl.currentTime = 0.04;
                }
            }
        } catch (err) {
            /* ignore */
        }
    }

    function bindCellPreview(videoEl) {
        if (!videoEl || videoEl.dataset.previewBound === '1') {
            return;
        }
        videoEl.dataset.previewBound = '1';
        videoEl.muted = true;
        videoEl.defaultMuted = true;
        videoEl.playsInline = true;
        videoEl.addEventListener('loadeddata', function () {
            pausePreviewAtFirstFrame(videoEl);
        });
        videoEl.addEventListener('loadedmetadata', function () {
            pausePreviewAtFirstFrame(videoEl);
        });
        videoEl.addEventListener('seeked', function () {
            try {
                videoEl.pause();
            } catch (err) {
                /* ignore */
            }
        });
        videoEl.addEventListener('error', function () {
            videoEl.classList.add('hidden');
        });
    }

    root.pathToPreviewSrc = pathToPreviewSrc;
    root.showCellPreview = showCellPreview;
    root.hideCellPreview = hideCellPreview;
    root.pausePreviewAtFirstFrame = pausePreviewAtFirstFrame;
    root.bindCellPreview = bindCellPreview;
    if (typeof module === 'object' && module.exports) {
        module.exports = {
            pathToPreviewSrc,
            showCellPreview,
            hideCellPreview,
            pausePreviewAtFirstFrame,
            bindCellPreview,
        };
    }
})(typeof window !== 'undefined' ? window : globalThis);
