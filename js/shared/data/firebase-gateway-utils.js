(function initFirebaseGatewayUtils(global) {
    function createUtils(runtime) {
        const host = runtime || global;

        function manager() {
            return typeof host.FirebaseManager !== 'undefined' ? host.FirebaseManager : null;
        }

        function withManager(fn, fallback) {
            const svc = manager();
            if (!svc) {
                return typeof fallback === 'function' ? fallback() : fallback;
            }
            return fn(svc);
        }

        function notLoadedResult() {
            return { success: false, error: 'Firebase not loaded' };
        }

        return {
            manager: manager,
            withManager: withManager,
            notLoadedResult: notLoadedResult,
        };
    }

    global.DSSharedFirebaseGatewayUtils = {
        createUtils: createUtils,
    };
})(window);
