// Tests cover lib/media-accept.js. Keep this loop in sync with that module.
(function (root) {
    const VIDEO_EXTENSIONS = ['mp4', 'mov', 'm4v', 'webm', 'avi', 'mkv'];
    const VIDEO_NAME_RE = new RegExp('\\.(' + VIDEO_EXTENSIONS.join('|') + ')$', 'i');

    function isProbablyVideoFile({ type, name } = {}) {
        const mime = typeof type === 'string' ? type : '';
        if (mime.startsWith('video/')) {
            return true;
        }
        if (mime) {
            return false;
        }
        return typeof name === 'string' && VIDEO_NAME_RE.test(name);
    }

    root.VIDEO_EXTENSIONS = VIDEO_EXTENSIONS;
    root.isProbablyVideoFile = isProbablyVideoFile;
    if (typeof module === 'object' && module.exports) {
        module.exports = { VIDEO_EXTENSIONS, isProbablyVideoFile };
    }
})(typeof window !== 'undefined' ? window : globalThis);
