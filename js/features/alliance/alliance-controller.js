(function initAllianceController(global) {
    function createController(deps) {
        const dependencies = deps && typeof deps === 'object' ? deps : {};

        return {
            renderPanel: function renderPanel() {
                if (typeof dependencies.renderPanel === 'function') {
                    dependencies.renderPanel();
                }
            },
            createAlliance: function createAlliance() {
                if (typeof dependencies.createAlliance === 'function') {
                    dependencies.createAlliance();
                }
            },
            sendInvitation: function sendInvitation() {
                if (typeof dependencies.sendInvitation === 'function') {
                    dependencies.sendInvitation();
                }
            },
            leaveAlliance: function leaveAlliance() {
                if (typeof dependencies.leaveAlliance === 'function') {
                    dependencies.leaveAlliance();
                }
            },
            acceptInvitation: function acceptInvitation(invitationId, statusElementId) {
                if (typeof dependencies.acceptInvitation === 'function') {
                    dependencies.acceptInvitation(invitationId, statusElementId);
                }
            },
            rejectInvitation: function rejectInvitation(invitationId, statusElementId) {
                if (typeof dependencies.rejectInvitation === 'function') {
                    dependencies.rejectInvitation(invitationId, statusElementId);
                }
            },
            resendInvitation: function resendInvitation(invitationId, statusElementId) {
                if (typeof dependencies.resendInvitation === 'function') {
                    dependencies.resendInvitation(invitationId, statusElementId);
                }
            },
            revokeInvitation: function revokeInvitation(invitationId, statusElementId) {
                if (typeof dependencies.revokeInvitation === 'function') {
                    dependencies.revokeInvitation(invitationId, statusElementId);
                }
            },
            openPanel: function openPanel() {
                if (typeof dependencies.openPanel === 'function') {
                    dependencies.openPanel();
                }
            },
            closePanel: function closePanel() {
                if (typeof dependencies.closePanel === 'function') {
                    dependencies.closePanel();
                }
            },
        };
    }

    global.DSFeatureAllianceController = {
        createController: createController,
    };
})(window);
