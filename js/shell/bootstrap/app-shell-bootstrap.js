(function initAppShellBootstrap(global) {
    const contracts = global.DSAppShellContracts;

    function createRootController() {
        const base = {
            init: function init() {
                if (typeof global.initializeApplicationUiRuntime === 'function') {
                    global.initializeApplicationUiRuntime();
                }
            },
        };
        if (contracts && typeof contracts.createFeatureController === 'function') {
            return contracts.createFeatureController(base);
        }
        return base;
    }

    function boot() {
        const rootController = createRootController();
        if (rootController && typeof rootController.init === 'function') {
            rootController.init();
        }
    }

    global.DSAppShellBootstrap = {
        boot: boot,
    };

    if (global.document) {
        if (global.document.readyState === 'loading') {
            global.document.addEventListener('DOMContentLoaded', boot);
        } else {
            // DOM already ready — defer boot so remaining modules in the
            // bundle finish initialising first (e.g. app.js exports).
            setTimeout(boot, 0);
        }
    }
})(window);
