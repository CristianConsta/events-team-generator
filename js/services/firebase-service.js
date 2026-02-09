(function initFirebaseService(global) {
    function manager() {
        return typeof global.FirebaseManager !== 'undefined' ? global.FirebaseManager : null;
    }

    function withManager(fn, fallback) {
        const svc = manager();
        if (!svc) {
            return fallback;
        }
        return fn(svc);
    }

    function notLoadedResult() {
        return { success: false, error: 'Firebase not loaded' };
    }

    const FirebaseService = {
        isAvailable: function isAvailable() {
            return manager() !== null;
        },
        init: function init() {
            return withManager((svc) => svc.init(), false);
        },
        setAuthCallback: function setAuthCallback(callback) {
            return withManager((svc) => svc.setAuthCallback(callback), null);
        },
        setDataLoadCallback: function setDataLoadCallback(callback) {
            return withManager((svc) => svc.setDataLoadCallback(callback), null);
        },
        signInWithGoogle: async function signInWithGoogle() {
            return withManager((svc) => svc.signInWithGoogle(), notLoadedResult());
        },
        signInWithEmail: async function signInWithEmail(email, password) {
            return withManager((svc) => svc.signInWithEmail(email, password), notLoadedResult());
        },
        signUpWithEmail: async function signUpWithEmail(email, password) {
            return withManager((svc) => svc.signUpWithEmail(email, password), notLoadedResult());
        },
        resetPassword: async function resetPassword(email) {
            return withManager((svc) => svc.resetPassword(email), notLoadedResult());
        },
        signOut: async function signOut() {
            return withManager((svc) => svc.signOut(), notLoadedResult());
        },
        isSignedIn: function isSignedIn() {
            return withManager((svc) => svc.isSignedIn(), false);
        },
        saveUserData: async function saveUserData() {
            return withManager((svc) => svc.saveUserData(), notLoadedResult());
        },
        uploadPlayerDatabase: async function uploadPlayerDatabase(file) {
            return withManager((svc) => svc.uploadPlayerDatabase(file), Promise.reject(notLoadedResult()));
        },
        getPlayerDatabase: function getPlayerDatabase() {
            return withManager((svc) => svc.getPlayerDatabase(), {});
        },
        getActivePlayerDatabase: function getActivePlayerDatabase() {
            return withManager((svc) => svc.getActivePlayerDatabase(), {});
        },
        getUserProfile: function getUserProfile() {
            return withManager((svc) => svc.getUserProfile(), { displayName: '', nickname: '', avatarDataUrl: '' });
        },
        setUserProfile: function setUserProfile(profile) {
            return withManager((svc) => svc.setUserProfile(profile), { displayName: '', nickname: '', avatarDataUrl: '' });
        },
        getPlayerSource: function getPlayerSource() {
            return withManager((svc) => svc.getPlayerSource(), 'personal');
        },
        getBuildingConfig: function getBuildingConfig(eventId) {
            return withManager((svc) => svc.getBuildingConfig(eventId), null);
        },
        setBuildingConfig: function setBuildingConfig(eventId, config) {
            return withManager((svc) => svc.setBuildingConfig(eventId, config), null);
        },
        getBuildingPositions: function getBuildingPositions(eventId) {
            return withManager((svc) => svc.getBuildingPositions(eventId), null);
        },
        setBuildingPositions: function setBuildingPositions(eventId, positions) {
            return withManager((svc) => svc.setBuildingPositions(eventId, positions), null);
        },
        getBuildingPositionsVersion: function getBuildingPositionsVersion(eventId) {
            return withManager((svc) => svc.getBuildingPositionsVersion(eventId), 0);
        },
        setBuildingPositionsVersion: function setBuildingPositionsVersion(eventId, version) {
            return withManager((svc) => svc.setBuildingPositionsVersion(eventId, version), null);
        },
        createAlliance: async function createAlliance(name) {
            return withManager((svc) => svc.createAlliance(name), notLoadedResult());
        },
        leaveAlliance: async function leaveAlliance() {
            return withManager((svc) => svc.leaveAlliance(), notLoadedResult());
        },
        loadAllianceData: async function loadAllianceData() {
            return withManager((svc) => svc.loadAllianceData(), notLoadedResult());
        },
        sendInvitation: async function sendInvitation(email) {
            return withManager((svc) => svc.sendInvitation(email), notLoadedResult());
        },
        checkInvitations: async function checkInvitations() {
            return withManager((svc) => svc.checkInvitations(), []);
        },
        acceptInvitation: async function acceptInvitation(invitationId) {
            return withManager((svc) => svc.acceptInvitation(invitationId), notLoadedResult());
        },
        rejectInvitation: async function rejectInvitation(invitationId) {
            return withManager((svc) => svc.rejectInvitation(invitationId), notLoadedResult());
        },
        uploadAlliancePlayerDatabase: async function uploadAlliancePlayerDatabase(file) {
            return withManager((svc) => svc.uploadAlliancePlayerDatabase(file), Promise.reject(notLoadedResult()));
        },
        setPlayerSource: async function setPlayerSource(source) {
            return withManager((svc) => svc.setPlayerSource(source), notLoadedResult());
        },
        getAllianceId: function getAllianceId() {
            return withManager((svc) => svc.getAllianceId(), null);
        },
        getAllianceName: function getAllianceName() {
            return withManager((svc) => svc.getAllianceName(), null);
        },
        getAllianceData: function getAllianceData() {
            return withManager((svc) => svc.getAllianceData(), null);
        },
        getPendingInvitations: function getPendingInvitations() {
            return withManager((svc) => svc.getPendingInvitations(), []);
        },
        getAllianceMembers: function getAllianceMembers() {
            return withManager((svc) => svc.getAllianceMembers(), {});
        },
    };

    global.FirebaseService = FirebaseService;
})(window);
