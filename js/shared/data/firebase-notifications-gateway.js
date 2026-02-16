(function initFirebaseNotificationsGateway(global) {
    function createGateway(utils) {
        const gatewayUtils = utils || global.DSSharedFirebaseGatewayUtils.createUtils(global);
        return {
            checkInvitations: async function checkInvitations() {
                return gatewayUtils.withManager((svc) => svc.checkInvitations(), []);
            },
            acceptInvitation: async function acceptInvitation(invitationId) {
                return gatewayUtils.withManager((svc) => svc.acceptInvitation(invitationId), gatewayUtils.notLoadedResult());
            },
            rejectInvitation: async function rejectInvitation(invitationId) {
                return gatewayUtils.withManager((svc) => svc.rejectInvitation(invitationId), gatewayUtils.notLoadedResult());
            },
            revokeInvitation: async function revokeInvitation(invitationId) {
                return gatewayUtils.withManager((svc) => svc.revokeInvitation(invitationId), gatewayUtils.notLoadedResult());
            },
            resendInvitation: async function resendInvitation(invitationId) {
                return gatewayUtils.withManager((svc) => svc.resendInvitation(invitationId), gatewayUtils.notLoadedResult());
            },
            getInvitationNotifications: function getInvitationNotifications() {
                return gatewayUtils.withManager((svc) => svc.getInvitationNotifications(), []);
            },
        };
    }

    global.DSSharedFirebaseNotificationsGateway = {
        createGateway: createGateway,
    };
})(window);
