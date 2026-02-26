(function initFirebaseEventHistoryGateway(global) {
    function createGateway(utils) {
        const gatewayUtils = utils || global.DSSharedFirebaseGatewayUtils.createUtils(global);
        return {
            saveHistoryRecord: async function saveHistoryRecord(allianceId, record) {
                return gatewayUtils.withManager(
                    (svc) => svc.saveEventHistoryRecord(allianceId, record),
                    gatewayUtils.notLoadedResult()
                );
            },
            saveAttendanceBatch: async function saveAttendanceBatch(allianceId, historyId, attendanceDocs) {
                return gatewayUtils.withManager(
                    (svc) => svc.saveAttendanceBatch(allianceId, historyId, attendanceDocs),
                    gatewayUtils.notLoadedResult()
                );
            },
            loadHistoryRecords: async function loadHistoryRecords(allianceId, filters) {
                return gatewayUtils.withManager(
                    (svc) => svc.loadEventHistoryRecords(allianceId, filters),
                    []
                );
            },
            loadAttendance: async function loadAttendance(allianceId, historyId) {
                return gatewayUtils.withManager(
                    (svc) => svc.loadEventAttendance(allianceId, historyId),
                    []
                );
            },
            updateAttendanceStatus: async function updateAttendanceStatus(allianceId, historyId, docId, status, markedBy) {
                return gatewayUtils.withManager(
                    (svc) => svc.updateAttendanceStatus(allianceId, historyId, docId, status, markedBy),
                    gatewayUtils.notLoadedResult()
                );
            },
            enforceEventHistoryLimit: async function enforceEventHistoryLimit(allianceId, eventTypeId, limit) {
                return gatewayUtils.withManager(
                    (svc) => svc.enforceEventHistoryLimit(allianceId, eventTypeId, limit),
                    gatewayUtils.notLoadedResult()
                );
            },
            finalizeHistory: async function finalizeHistory(allianceId, historyId, playerStatsUpdates) {
                return gatewayUtils.withManager(
                    (svc) => svc.finalizeEventHistory(allianceId, historyId, playerStatsUpdates),
                    gatewayUtils.notLoadedResult()
                );
            },
            loadPlayerStats: async function loadPlayerStats(allianceId, playerDocIds) {
                return gatewayUtils.withManager(
                    (svc) => svc.loadPlayerStats(allianceId, playerDocIds),
                    {}
                );
            },
            upsertPlayerStats: async function upsertPlayerStats(allianceId, docId, stats) {
                return gatewayUtils.withManager(
                    (svc) => svc.upsertPlayerStats(allianceId, docId, stats),
                    gatewayUtils.notLoadedResult()
                );
            },
            subscribePendingFinalizationCount: function subscribePendingFinalizationCount(allianceId, callback) {
                return gatewayUtils.withManager(
                    (svc) => svc.subscribePendingFinalizationCount(allianceId, callback),
                    function noop() {}
                );
            },
        };
    }

    global.DSSharedFirebaseEventHistoryGateway = {
        createGateway: createGateway,
    };
})(window);
