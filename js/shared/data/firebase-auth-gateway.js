(function initFirebaseAuthGateway(global) {
    function createGateway(utils) {
        const gatewayUtils = utils || global.DSSharedFirebaseGatewayUtils.createUtils(global);
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

    global.DSSharedFirebaseAuthGateway = {
        createGateway: createGateway,
    };
})(window);
