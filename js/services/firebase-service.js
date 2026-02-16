(function initFirebaseService(global) {
    function createUtils(runtime) {
        const host = runtime || global;
        return {
            manager: function manager() {
                return typeof host.FirebaseManager !== 'undefined' ? host.FirebaseManager : null;
            },
            withManager: function withManager(fn, fallback) {
                const svc = typeof host.FirebaseManager !== 'undefined' ? host.FirebaseManager : null;
                if (!svc) {
                    return typeof fallback === 'function' ? fallback() : fallback;
                }
                return fn(svc);
            },
            notLoadedResult: function notLoadedResult() {
                return { success: false, error: 'Firebase not loaded' };
            },
        };
    }

    const utils = (
        global.DSSharedFirebaseGatewayUtils
        && typeof global.DSSharedFirebaseGatewayUtils.createUtils === 'function'
    )
        ? global.DSSharedFirebaseGatewayUtils.createUtils(global)
        : createUtils(global);

    function fallbackAuthGateway(gatewayUtils) {
        return {
            isAvailable: function isAvailable() {
                return gatewayUtils.manager() !== null;
            },
            init: function init() {
                return gatewayUtils.withManager((svc) => svc.init(), false);
            },
            setAuthCallback: function setAuthCallback(callback) {
                return gatewayUtils.withManager((svc) => svc.setAuthCallback(callback), null);
            },
            setDataLoadCallback: function setDataLoadCallback(callback) {
                return gatewayUtils.withManager((svc) => svc.setDataLoadCallback(callback), null);
            },
            setAllianceDataCallback: function setAllianceDataCallback(callback) {
                return gatewayUtils.withManager((svc) => svc.setAllianceDataCallback(callback), null);
            },
            signInWithGoogle: async function signInWithGoogle() {
                return gatewayUtils.withManager((svc) => svc.signInWithGoogle(), gatewayUtils.notLoadedResult());
            },
            signInWithEmail: async function signInWithEmail(email, password) {
                return gatewayUtils.withManager((svc) => svc.signInWithEmail(email, password), gatewayUtils.notLoadedResult());
            },
            signUpWithEmail: async function signUpWithEmail(email, password) {
                return gatewayUtils.withManager((svc) => svc.signUpWithEmail(email, password), gatewayUtils.notLoadedResult());
            },
            resetPassword: async function resetPassword(email) {
                return gatewayUtils.withManager((svc) => svc.resetPassword(email), gatewayUtils.notLoadedResult());
            },
            signOut: async function signOut() {
                return gatewayUtils.withManager((svc) => svc.signOut(), gatewayUtils.notLoadedResult());
            },
            deleteUserAccountAndData: async function deleteUserAccountAndData() {
                return gatewayUtils.withManager((svc) => svc.deleteUserAccountAndData(), gatewayUtils.notLoadedResult());
            },
            getCurrentUser: function getCurrentUser() {
                return gatewayUtils.withManager((svc) => svc.getCurrentUser(), null);
            },
            isSignedIn: function isSignedIn() {
                return gatewayUtils.withManager((svc) => svc.isSignedIn(), false);
            },
            loadUserData: async function loadUserData(user) {
                return gatewayUtils.withManager((svc) => svc.loadUserData(user), gatewayUtils.notLoadedResult());
            },
            saveUserData: async function saveUserData(options) {
                return gatewayUtils.withManager((svc) => svc.saveUserData(options), gatewayUtils.notLoadedResult());
            },
            getUserProfile: function getUserProfile() {
                return gatewayUtils.withManager((svc) => svc.getUserProfile(), { displayName: '', nickname: '', avatarDataUrl: '', theme: 'standard' });
            },
            setUserProfile: function setUserProfile(profile) {
                return gatewayUtils.withManager((svc) => svc.setUserProfile(profile), { displayName: '', nickname: '', avatarDataUrl: '', theme: 'standard' });
            },
        };
    }

    function fallbackPlayersGateway(gatewayUtils) {
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

    function fallbackEventsGateway(gatewayUtils) {
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

    function fallbackAllianceGateway(gatewayUtils) {
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

    function fallbackNotificationsGateway(gatewayUtils) {
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

    function fromFactory(factoryName, fallbackFactory) {
        const factory = global[factoryName];
        if (factory && typeof factory.createGateway === 'function') {
            return factory.createGateway(utils);
        }
        return fallbackFactory(utils);
    }

    const authGateway = fromFactory('DSSharedFirebaseAuthGateway', fallbackAuthGateway);
    const playersGateway = fromFactory('DSSharedFirebasePlayersGateway', fallbackPlayersGateway);
    const eventsGateway = fromFactory('DSSharedFirebaseEventsGateway', fallbackEventsGateway);
    const allianceGateway = fromFactory('DSSharedFirebaseAllianceGateway', fallbackAllianceGateway);
    const notificationsGateway = fromFactory('DSSharedFirebaseNotificationsGateway', fallbackNotificationsGateway);

    const FirebaseService = {
        ...authGateway,
        ...playersGateway,
        ...eventsGateway,
        ...allianceGateway,
        ...notificationsGateway,
    };

    global.FirebaseService = FirebaseService;
})(window);
