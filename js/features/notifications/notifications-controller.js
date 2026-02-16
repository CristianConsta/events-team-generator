(function initNotificationsController(global) {
    function createController(deps) {
        const dependencies = deps && typeof deps === 'object' ? deps : {};

        return {
            checkAndDisplay: function checkAndDisplay() {
                if (typeof dependencies.checkAndDisplay === 'function') {
                    return dependencies.checkAndDisplay();
                }
                return Promise.resolve();
            },
            render: function render() {
                if (typeof dependencies.render === 'function') {
                    dependencies.render();
                }
            },
            togglePanel: function togglePanel() {
                if (typeof dependencies.togglePanel === 'function') {
                    return dependencies.togglePanel();
                }
                return Promise.resolve();
            },
            closePanel: function closePanel() {
                if (typeof dependencies.closePanel === 'function') {
                    dependencies.closePanel();
                }
            },
            startPolling: function startPolling() {
                if (typeof dependencies.startPolling === 'function') {
                    dependencies.startPolling();
                }
            },
            stopPolling: function stopPolling() {
                if (typeof dependencies.stopPolling === 'function') {
                    dependencies.stopPolling();
                }
            },
            openAllianceInvite: function openAllianceInvite(invitationId) {
                if (typeof dependencies.openAllianceInvite === 'function') {
                    dependencies.openAllianceInvite(invitationId);
                }
            },
        };
    }

    global.DSFeatureNotificationsController = {
        createController: createController,
    };
})(window);
