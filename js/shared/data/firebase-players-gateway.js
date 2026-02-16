(function initFirebasePlayersGateway(global) {
    function createGateway(utils) {
        const gatewayUtils = utils || global.DSSharedFirebaseGatewayUtils.createUtils(global);
        return {
            uploadPlayerDatabase: async function uploadPlayerDatabase(file) {
                return gatewayUtils.withManager((svc) => svc.uploadPlayerDatabase(file), () => Promise.reject(gatewayUtils.notLoadedResult()));
            },
            uploadAlliancePlayerDatabase: async function uploadAlliancePlayerDatabase(file) {
                return gatewayUtils.withManager((svc) => svc.uploadAlliancePlayerDatabase(file), () => Promise.reject(gatewayUtils.notLoadedResult()));
            },
            getPlayerDatabase: function getPlayerDatabase() {
                return gatewayUtils.withManager((svc) => svc.getPlayerDatabase(), {});
            },
            getAlliancePlayerDatabase: function getAlliancePlayerDatabase() {
                return gatewayUtils.withManager((svc) => svc.getAlliancePlayerDatabase(), {});
            },
            getActivePlayerDatabase: function getActivePlayerDatabase() {
                return gatewayUtils.withManager((svc) => svc.getActivePlayerDatabase(), {});
            },
            upsertPlayerEntry: async function upsertPlayerEntry(source, originalName, nextPlayer) {
                return gatewayUtils.withManager((svc) => svc.upsertPlayerEntry(source, originalName, nextPlayer), gatewayUtils.notLoadedResult());
            },
            removePlayerEntry: async function removePlayerEntry(source, playerName) {
                return gatewayUtils.withManager((svc) => svc.removePlayerEntry(source, playerName), gatewayUtils.notLoadedResult());
            },
            getPlayerSource: function getPlayerSource() {
                return gatewayUtils.withManager((svc) => svc.getPlayerSource(), 'personal');
            },
            setPlayerSource: async function setPlayerSource(source) {
                return gatewayUtils.withManager((svc) => svc.setPlayerSource(source), gatewayUtils.notLoadedResult());
            },
            getAllianceMembers: function getAllianceMembers() {
                return gatewayUtils.withManager((svc) => svc.getAllianceMembers(), {});
            },
        };
    }

    global.DSSharedFirebasePlayersGateway = {
        createGateway: createGateway,
    };
})(window);
