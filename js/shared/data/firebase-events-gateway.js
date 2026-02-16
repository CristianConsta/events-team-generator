(function initFirebaseEventsGateway(global) {
    function createGateway(utils) {
        const gatewayUtils = utils || global.DSSharedFirebaseGatewayUtils.createUtils(global);
        return {
            getAllEventData: function getAllEventData() {
                return gatewayUtils.withManager((svc) => svc.getAllEventData(), {});
            },
            getEventIds: function getEventIds() {
                return gatewayUtils.withManager((svc) => svc.getEventIds(), []);
            },
            getEventMeta: function getEventMeta(eventId) {
                return gatewayUtils.withManager((svc) => svc.getEventMeta(eventId), null);
            },
            upsertEvent: function upsertEvent(eventId, payload) {
                return gatewayUtils.withManager((svc) => svc.upsertEvent(eventId, payload), null);
            },
            removeEvent: function removeEvent(eventId) {
                return gatewayUtils.withManager((svc) => svc.removeEvent(eventId), false);
            },
            setEventMetadata: function setEventMetadata(eventId, metadata) {
                return gatewayUtils.withManager((svc) => svc.setEventMetadata(eventId, metadata), null);
            },
            getBuildingConfig: function getBuildingConfig(eventId) {
                return gatewayUtils.withManager((svc) => svc.getBuildingConfig(eventId), null);
            },
            setBuildingConfig: function setBuildingConfig(eventId, config) {
                return gatewayUtils.withManager((svc) => svc.setBuildingConfig(eventId, config), null);
            },
            getBuildingConfigVersion: function getBuildingConfigVersion(eventId) {
                return gatewayUtils.withManager((svc) => svc.getBuildingConfigVersion(eventId), 0);
            },
            setBuildingConfigVersion: function setBuildingConfigVersion(eventId, version) {
                return gatewayUtils.withManager((svc) => svc.setBuildingConfigVersion(eventId, version), null);
            },
            getBuildingPositions: function getBuildingPositions(eventId) {
                return gatewayUtils.withManager((svc) => svc.getBuildingPositions(eventId), null);
            },
            setBuildingPositions: function setBuildingPositions(eventId, positions) {
                return gatewayUtils.withManager((svc) => svc.setBuildingPositions(eventId, positions), null);
            },
            getBuildingPositionsVersion: function getBuildingPositionsVersion(eventId) {
                return gatewayUtils.withManager((svc) => svc.getBuildingPositionsVersion(eventId), 0);
            },
            setBuildingPositionsVersion: function setBuildingPositionsVersion(eventId, version) {
                return gatewayUtils.withManager((svc) => svc.setBuildingPositionsVersion(eventId, version), null);
            },
            getGlobalDefaultBuildingConfig: function getGlobalDefaultBuildingConfig(eventId) {
                return gatewayUtils.withManager((svc) => svc.getGlobalDefaultBuildingConfig(eventId), null);
            },
            getGlobalDefaultBuildingConfigVersion: function getGlobalDefaultBuildingConfigVersion() {
                return gatewayUtils.withManager((svc) => svc.getGlobalDefaultBuildingConfigVersion(), 0);
            },
            getGlobalDefaultBuildingPositions: function getGlobalDefaultBuildingPositions(eventId) {
                return gatewayUtils.withManager((svc) => svc.getGlobalDefaultBuildingPositions(eventId), {});
            },
            getGlobalDefaultBuildingPositionsVersion: function getGlobalDefaultBuildingPositionsVersion() {
                return gatewayUtils.withManager((svc) => svc.getGlobalDefaultBuildingPositionsVersion(), 0);
            },
        };
    }

    global.DSSharedFirebaseEventsGateway = {
        createGateway: createGateway,
    };
})(window);
