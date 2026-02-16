(function initAppShellBootstrap(global) {
    function boot() {
        if (typeof global.initializeApplicationUiRuntime === 'function') {
            global.initializeApplicationUiRuntime();
        }
    }

    global.DSAppShellBootstrap = {
        boot: boot,
    };

    if (global.document && typeof global.document.addEventListener === 'function') {
        global.document.addEventListener('DOMContentLoaded', boot);
    }
})(window);
