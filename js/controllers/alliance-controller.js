(function initAllianceController(global) {
    global.DSAllianceController = {
        toggleAlliancePanel: global.toggleAlliancePanel,
        handleCreateAlliance: global.handleCreateAlliance,
        handleSendInvitation: global.handleSendInvitation,
        handleLeaveAlliance: global.handleLeaveAlliance,
        switchPlayerSource: global.switchPlayerSource,
        updateAllianceHeaderDisplay: global.updateAllianceHeaderDisplay,
        checkAndDisplayNotifications: global.checkAndDisplayNotifications,
        startNotificationPolling: global.startNotificationPolling,
        stopNotificationPolling: global.stopNotificationPolling,
        toggleNotificationsPanel: global.toggleNotificationsPanel,
        handleAcceptInvitation: global.handleAcceptInvitation,
        handleRejectInvitation: global.handleRejectInvitation,
    };
})(window);
