(function initFirebaseAllianceGateway(global) {
    function createGateway(utils) {
        const gatewayUtils = utils || global.DSSharedFirebaseGatewayUtils.createUtils(global);
        return {
            createAlliance: async function createAlliance(name) {
                return gatewayUtils.withManager((svc) => svc.createAlliance(name), gatewayUtils.notLoadedResult());
            },
            leaveAlliance: async function leaveAlliance() {
                return gatewayUtils.withManager((svc) => svc.leaveAlliance(), gatewayUtils.notLoadedResult());
            },
            loadAllianceData: async function loadAllianceData() {
                return gatewayUtils.withManager((svc) => svc.loadAllianceData(), gatewayUtils.notLoadedResult());
            },
            sendInvitation: async function sendInvitation(email) {
                return gatewayUtils.withManager((svc) => svc.sendInvitation(email), gatewayUtils.notLoadedResult());
            },
            getAllianceId: function getAllianceId() {
                return gatewayUtils.withManager((svc) => svc.getAllianceId(), null);
            },
            getAllianceName: function getAllianceName() {
                return gatewayUtils.withManager((svc) => svc.getAllianceName(), null);
            },
            getAllianceData: function getAllianceData() {
                return gatewayUtils.withManager((svc) => svc.getAllianceData(), null);
            },
            getPendingInvitations: function getPendingInvitations() {
                return gatewayUtils.withManager((svc) => svc.getPendingInvitations(), []);
            },
            getSentInvitations: function getSentInvitations() {
                return gatewayUtils.withManager((svc) => svc.getSentInvitations(), []);
            },
        };
    }

    global.DSSharedFirebaseAllianceGateway = {
        createGateway: createGateway,
    };
})(window);
