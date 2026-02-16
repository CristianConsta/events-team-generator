(function initDataGatewayContract(global) {
    const DATA_GATEWAY_METHODS = {
        auth: ['isAvailable', 'isSignedIn', 'getCurrentUser', 'setAuthCallback'],
        players: ['getPlayerSource', 'setPlayerSource', 'getActivePlayerDatabase', 'upsertPlayerEntry', 'removePlayerEntry'],
        events: ['getAllEventData', 'upsertEvent', 'removeEvent', 'getBuildingConfig', 'setBuildingConfig', 'getBuildingPositions', 'setBuildingPositions'],
        alliance: ['loadAllianceData', 'createAlliance', 'leaveAlliance', 'sendInvitation'],
        notifications: ['checkInvitations', 'acceptInvitation', 'rejectInvitation', 'getInvitationNotifications'],
    };

    function validateDataGatewayShape(gateway) {
        const source = gateway && typeof gateway === 'object' ? gateway : {};
        const missing = [];

        Object.keys(DATA_GATEWAY_METHODS).forEach(function eachDomain(domain) {
            DATA_GATEWAY_METHODS[domain].forEach(function eachMethod(methodName) {
                if (typeof source[methodName] !== 'function') {
                    missing.push(domain + '.' + methodName);
                }
            });
        });

        return {
            ok: missing.length === 0,
            missing: missing,
        };
    }

    global.DSDataGatewayContract = {
        DATA_GATEWAY_METHODS: DATA_GATEWAY_METHODS,
        validateDataGatewayShape: validateDataGatewayShape,
    };
})(window);
