(function initAppShellContracts(global) {
    function createFeatureController(definition) {
        const source = definition && typeof definition === 'object' ? definition : {};
        return {
            init: typeof source.init === 'function' ? source.init : function init() {},
            bind: typeof source.bind === 'function' ? source.bind : function bind() {},
            render: typeof source.render === 'function' ? source.render : function render() {},
            dispose: typeof source.dispose === 'function' ? source.dispose : function dispose() {},
        };
    }

    function createAppShellLifecycle(definition) {
        const source = definition && typeof definition === 'object' ? definition : {};
        return {
            boot: typeof source.boot === 'function' ? source.boot : function boot() {},
            shutdown: typeof source.shutdown === 'function' ? source.shutdown : function shutdown() {},
        };
    }

    global.DSAppShellContracts = {
        createFeatureController: createFeatureController,
        createAppShellLifecycle: createAppShellLifecycle,
    };
})(window);
