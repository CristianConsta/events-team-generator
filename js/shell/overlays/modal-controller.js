(function initShellModalController(global) {
    function open(options) {
        const settings = options && typeof options === 'object' ? options : {};
        const overlay = settings.overlay;
        if (!overlay || !overlay.classList) {
            return null;
        }

        if (typeof settings.onBeforeOpen === 'function') {
            settings.onBeforeOpen(overlay);
        }

        overlay.classList.remove('hidden');

        if (typeof settings.onAfterOpen === 'function') {
            settings.onAfterOpen(overlay);
        }

        return overlay;
    }

    function close(options) {
        const settings = options && typeof options === 'object' ? options : {};
        const overlay = settings.overlay;
        if (!overlay || !overlay.classList || overlay.classList.contains('hidden')) {
            return false;
        }

        if (typeof settings.onBeforeClose === 'function') {
            settings.onBeforeClose(overlay);
        }

        overlay.classList.add('hidden');

        if (typeof settings.onAfterClose === 'function') {
            settings.onAfterClose(overlay);
        }

        return true;
    }

    global.DSShellModalController = {
        open: open,
        close: close,
    };
})(window);
