(function initStateStoreContract(global) {
    function createStateStoreContract(store) {
        const source = store && typeof store === 'object' ? store : {};
        return {
            getState: typeof source.getState === 'function' ? source.getState : function getState() { return {}; },
            setState: typeof source.setState === 'function' ? source.setState : function setState() {},
            subscribe: typeof source.subscribe === 'function' ? source.subscribe : function subscribe() { return function unsubscribe() {}; },
        };
    }

    global.DSStateStoreContract = {
        createStateStoreContract: createStateStoreContract,
    };
})(window);
