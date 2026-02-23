(function initFirebasePlayerUpdatesGateway(global) {
    function createGateway(utils) {
        const gatewayUtils = utils || global.DSSharedFirebaseGatewayUtils.createUtils(global);
        return {
            createUpdateToken: async function createUpdateToken(allianceId, playerName, options) {
                return gatewayUtils.withManager(
                    (svc) => svc.createUpdateToken(allianceId, playerName, options),
                    gatewayUtils.notLoadedResult()
                );
            },
            saveTokenBatch: async function saveTokenBatch(allianceId, tokenDocs) {
                return gatewayUtils.withManager(
                    (svc) => svc.saveTokenBatch(allianceId, tokenDocs),
                    gatewayUtils.notLoadedResult()
                );
            },
            loadPendingUpdates: async function loadPendingUpdates(allianceId, status) {
                return gatewayUtils.withManager(
                    (svc) => svc.loadPendingUpdates(allianceId, status),
                    []
                );
            },
            updatePendingUpdateStatus: async function updatePendingUpdateStatus(allianceId, updateId, decision) {
                return gatewayUtils.withManager(
                    (svc) => svc.updatePendingUpdateStatus(allianceId, updateId, decision),
                    gatewayUtils.notLoadedResult()
                );
            },
            revokeToken: async function revokeToken(allianceId, tokenId) {
                return gatewayUtils.withManager(
                    (svc) => svc.revokeToken(allianceId, tokenId),
                    gatewayUtils.notLoadedResult()
                );
            },
            loadActiveTokens: async function loadActiveTokens(allianceId) {
                return gatewayUtils.withManager(
                    (svc) => svc.loadActiveTokens(allianceId),
                    []
                );
            },
            subscribePendingUpdatesCount: function subscribePendingUpdatesCount(allianceId, callback) {
                return gatewayUtils.withManager(
                    (svc) => svc.subscribePendingUpdatesCount(allianceId, callback),
                    function noop() {}
                );
            },
            createPersonalUpdateToken: async function createPersonalUpdateToken(uid, playerName, options) {
                return gatewayUtils.withManager(
                    (svc) => svc.createPersonalUpdateToken(uid, playerName, options),
                    gatewayUtils.notLoadedResult()
                );
            },
            createPersonalPendingUpdate: async function createPersonalPendingUpdate(uid, pendingUpdateDoc) {
                return gatewayUtils.withManager(
                    (svc) => svc.createPersonalPendingUpdate(uid, pendingUpdateDoc),
                    gatewayUtils.notLoadedResult()
                );
            },
            loadPersonalPendingUpdates: async function loadPersonalPendingUpdates(uid, status) {
                return gatewayUtils.withManager(
                    (svc) => svc.loadPersonalPendingUpdates(uid, status),
                    []
                );
            },
            updatePersonalPendingUpdateStatus: async function updatePersonalPendingUpdateStatus(uid, updateId, decision) {
                return gatewayUtils.withManager(
                    (svc) => svc.updatePersonalPendingUpdateStatus(uid, updateId, decision),
                    gatewayUtils.notLoadedResult()
                );
            },
        };
    }

    global.DSSharedFirebasePlayerUpdatesGateway = {
        createGateway: createGateway,
    };
})(window);
