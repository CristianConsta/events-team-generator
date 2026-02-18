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

    const MULTIGAME_FLAG_DEFAULTS = Object.freeze({
        MULTIGAME_ENABLED: false,
        MULTIGAME_READ_FALLBACK_ENABLED: false,
        MULTIGAME_DUAL_WRITE_ENABLED: false,
        MULTIGAME_GAME_SELECTOR_ENABLED: false,
    });
    const MULTIGAME_FLAG_KEYS = Object.keys(MULTIGAME_FLAG_DEFAULTS);
    const ACTIVE_GAME_STORAGE_KEY = 'ds_active_game_id';
    const GAME_METADATA_SUPER_ADMIN_UID = '2z2BdO8aVsUovqQWWL9WCRMdV933';
    let activeGameIdCache = '';

    function manager() {
        return typeof global.FirebaseManager !== 'undefined' ? global.FirebaseManager : null;
    }

    const utils = (
        global.DSSharedFirebaseGatewayUtils
        && typeof global.DSSharedFirebaseGatewayUtils.createUtils === 'function'
    )
        ? global.DSSharedFirebaseGatewayUtils.createUtils(global)
        : createUtils(global);
    const withManager = utils.withManager;
    const notLoadedResult = utils.notLoadedResult;

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

    function normalizeFeatureFlagValue(value, fallbackValue) {
        if (typeof value === 'boolean') {
            return value;
        }
        if (typeof value === 'number') {
            return value !== 0;
        }
        if (typeof value === 'string') {
            const normalized = value.trim().toLowerCase();
            if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on') {
                return true;
            }
            if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') {
                return false;
            }
        }
        return fallbackValue;
    }

    function resolveLocalFeatureFlags(overrides) {
        const scopedOverrides = overrides && typeof overrides === 'object' ? overrides : {};
        const resolved = {};
        MULTIGAME_FLAG_KEYS.forEach((flagName) => {
            resolved[flagName] = normalizeFeatureFlagValue(
                scopedOverrides[flagName],
                MULTIGAME_FLAG_DEFAULTS[flagName]
            );
        });
        return resolved;
    }

    function getFeatureFlags(overrides) {
        return withManager(
            (svc) => {
                if (typeof svc.getFeatureFlags === 'function') {
                    return svc.getFeatureFlags(overrides);
                }
                return resolveLocalFeatureFlags(overrides);
            },
            resolveLocalFeatureFlags(overrides)
        );
    }

    function isFeatureFlagEnabled(flagName, overrides) {
        if (!Object.prototype.hasOwnProperty.call(MULTIGAME_FLAG_DEFAULTS, flagName)) {
            return false;
        }
        return getFeatureFlags(overrides)[flagName] === true;
    }

    function listAvailableGamesFromCore() {
        if (!global.DSCoreGames || typeof global.DSCoreGames.listAvailableGames !== 'function') {
            return [];
        }
        return global.DSCoreGames.listAvailableGames();
    }

    function normalizeGameId(value) {
        if (typeof value !== 'string') {
            return '';
        }
        return value
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '');
    }

    function normalizeGameIdsFromCatalog(catalog) {
        if (!Array.isArray(catalog)) {
            return [];
        }
        return catalog
            .map((game) => normalizeGameId(game && game.id))
            .filter(Boolean);
    }

    function listKnownGameIds() {
        const managerGameIds = withManager(
            (svc) => {
                if (typeof svc.listAvailableGames !== 'function') {
                    return [];
                }
                return normalizeGameIdsFromCatalog(svc.listAvailableGames());
            },
            []
        );
        if (managerGameIds.length > 0) {
            return managerGameIds;
        }
        return normalizeGameIdsFromCatalog(listAvailableGamesFromCore());
    }

    function resolveDefaultGameId() {
        if (global.DSCoreGames && typeof global.DSCoreGames.getDefaultGameId === 'function') {
            const explicitDefault = normalizeGameId(global.DSCoreGames.getDefaultGameId());
            if (explicitDefault) {
                return explicitDefault;
            }
        }
        const knownGameIds = listKnownGameIds();
        if (knownGameIds.length > 0) {
            return knownGameIds[0];
        }
        return 'last_war';
    }

    function readStoredActiveGameId() {
        if (!global.localStorage || typeof global.localStorage.getItem !== 'function') {
            return '';
        }
        try {
            return normalizeGameId(global.localStorage.getItem(ACTIVE_GAME_STORAGE_KEY));
        } catch (error) {
            return '';
        }
    }

    function writeStoredActiveGameId(gameId) {
        if (!global.localStorage || typeof global.localStorage.setItem !== 'function') {
            return;
        }
        try {
            global.localStorage.setItem(ACTIVE_GAME_STORAGE_KEY, gameId);
        } catch (error) {
            // Best effort only.
        }
    }

    function removeStoredActiveGameId() {
        if (!global.localStorage || typeof global.localStorage.removeItem !== 'function') {
            return;
        }
        try {
            global.localStorage.removeItem(ACTIVE_GAME_STORAGE_KEY);
        } catch (error) {
            // Best effort only.
        }
    }

    function setActiveGame(gameId) {
        const normalizedId = normalizeGameId(gameId);
        if (!normalizedId) {
            return { success: false, code: 'invalid-game-id', error: 'Invalid game id' };
        }

        const knownGameIds = listKnownGameIds();
        if (knownGameIds.length > 0 && !knownGameIds.includes(normalizedId)) {
            return { success: false, code: 'unknown-game-id', error: 'Unknown game id' };
        }

        const changed = activeGameIdCache !== normalizedId;
        activeGameIdCache = normalizedId;
        writeStoredActiveGameId(normalizedId);
        return { success: true, gameId: normalizedId, changed: changed };
    }

    function getActiveGame() {
        if (activeGameIdCache) {
            return { gameId: activeGameIdCache, source: 'memory' };
        }
        const storedId = readStoredActiveGameId();
        if (storedId) {
            activeGameIdCache = storedId;
            return { gameId: storedId, source: 'storage' };
        }
        return { gameId: '', source: 'none' };
    }

    function clearActiveGame() {
        activeGameIdCache = '';
        removeStoredActiveGameId();
    }

    function ensureActiveGame() {
        const current = getActiveGame();
        if (current.gameId) {
            return current;
        }
        const defaultGameId = resolveDefaultGameId();
        const setResult = setActiveGame(defaultGameId);
        if (!setResult.success) {
            return { gameId: '', source: 'none' };
        }
        return { gameId: setResult.gameId, source: 'default' };
    }

    function createMissingActiveGameError() {
        const error = new Error('missing-active-game');
        error.code = 'missing-active-game';
        error.errorKey = 'missing-active-game';
        return error;
    }

    function requireActiveGame() {
        const context = getActiveGame();
        if (!context.gameId) {
            throw createMissingActiveGameError();
        }
        return context.gameId;
    }

    function normalizeGameContextInput(context) {
        if (typeof context === 'string') {
            return { gameId: normalizeGameId(context), explicit: true };
        }
        if (context && typeof context === 'object' && typeof context.gameId === 'string') {
            return { gameId: normalizeGameId(context.gameId), explicit: true };
        }
        return { gameId: '', explicit: false };
    }

    function isSignedInRuntime() {
        const svc = manager();
        if (!svc || typeof svc.isSignedIn !== 'function') {
            return false;
        }
        try {
            return svc.isSignedIn() === true;
        } catch (error) {
            return false;
        }
    }

    function resolveGameplayContext(methodName, context) {
        const parsed = normalizeGameContextInput(context);
        if (parsed.explicit && parsed.gameId) {
            setActiveGame(parsed.gameId);
            return { gameId: parsed.gameId, explicit: true };
        }

        const current = getActiveGame();
        if (current.gameId) {
            return { gameId: current.gameId, explicit: false };
        }

        if (isSignedInRuntime()) {
            const ensured = ensureActiveGame();
            if (ensured && ensured.gameId) {
                return { gameId: ensured.gameId, explicit: false };
            }
            throw createMissingActiveGameError();
        }
        return { gameId: resolveDefaultGameId(), explicit: false };
    }

    function normalizeEventId(value) {
        if (typeof value !== 'string') {
            return '';
        }
        return value.trim();
    }

    function resolveEventScopedContext(methodName, eventIdOrContext, contextMaybe) {
        const explicitEventId = normalizeEventId(eventIdOrContext);
        const context = explicitEventId
            ? contextMaybe
            : (typeof contextMaybe !== 'undefined' ? contextMaybe : eventIdOrContext);
        const eventIdFromContext = context && typeof context === 'object' ? normalizeEventId(context.eventId) : '';
        const eventId = explicitEventId || eventIdFromContext;
        const gameplayContext = resolveGameplayContext(methodName, context);
        return {
            eventId: eventId,
            gameId: gameplayContext.gameId,
            explicit: gameplayContext.explicit,
        };
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
        setAllianceDataCallback: function setAllianceDataCallback(callback) {
            return withManager((svc) => svc.setAllianceDataCallback(callback), null);
        },
        getFeatureFlags: function getFeatureFlagsPublic(overrides) {
            return getFeatureFlags(overrides);
        },
        isFeatureFlagEnabled: function isFeatureFlagEnabledPublic(flagName, overrides) {
            return isFeatureFlagEnabled(flagName, overrides);
        },
        listAvailableGames: function listAvailableGames() {
            return withManager(
                (svc) => {
                    if (typeof svc.listAvailableGames === 'function') {
                        return svc.listAvailableGames();
                    }
                    return listAvailableGamesFromCore();
                },
                listAvailableGamesFromCore()
            );
        },
        isGameMetadataSuperAdmin: function isGameMetadataSuperAdmin(userOrUid) {
            return withManager(
                (svc) => {
                    if (typeof svc.isGameMetadataSuperAdmin === 'function') {
                        return svc.isGameMetadataSuperAdmin(userOrUid);
                    }
                    if (typeof userOrUid === 'string') {
                        return userOrUid.trim() === GAME_METADATA_SUPER_ADMIN_UID;
                    }
                    const uid = userOrUid && typeof userOrUid === 'object' && typeof userOrUid.uid === 'string'
                        ? userOrUid.uid.trim()
                        : '';
                    return uid === GAME_METADATA_SUPER_ADMIN_UID;
                },
                (typeof userOrUid === 'string'
                    ? userOrUid.trim() === GAME_METADATA_SUPER_ADMIN_UID
                    : !!(userOrUid && typeof userOrUid === 'object' && typeof userOrUid.uid === 'string' && userOrUid.uid.trim() === GAME_METADATA_SUPER_ADMIN_UID))
            );
        },
        listGameMetadata: async function listGameMetadata() {
            return withManager(
                (svc) => (typeof svc.listGameMetadata === 'function' ? svc.listGameMetadata() : listAvailableGamesFromCore()),
                listAvailableGamesFromCore()
            );
        },
        getGameMetadata: async function getGameMetadata(gameId) {
            if (typeof gameId !== 'string' || !gameId.trim()) {
                return null;
            }
            return withManager(
                (svc) => (typeof svc.getGameMetadata === 'function' ? svc.getGameMetadata(gameId) : null),
                null
            );
        },
        setGameMetadata: async function setGameMetadata(gameId, payload) {
            if (typeof gameId !== 'string' || !gameId.trim()) {
                return {
                    success: false,
                    errorKey: 'game_metadata_unknown_game',
                    error: 'game_metadata_unknown_game',
                };
            }
            return withManager(
                (svc) => (typeof svc.setGameMetadata === 'function' ? svc.setGameMetadata(gameId, payload) : notLoadedResult()),
                notLoadedResult()
            );
        },
        getActiveGame: function getActiveGamePublic() {
            return getActiveGame();
        },
        setActiveGame: function setActiveGamePublic(gameId) {
            return setActiveGame(gameId);
        },
        clearActiveGame: function clearActiveGamePublic() {
            return clearActiveGame();
        },
        ensureActiveGame: function ensureActiveGamePublic() {
            return ensureActiveGame();
        },
        requireActiveGame: function requireActiveGamePublic() {
            return requireActiveGame();
        },
        getMigrationVersion: function getMigrationVersion() {
            return withManager(
                (svc) => (typeof svc.getMigrationVersion === 'function' ? svc.getMigrationVersion() : 0),
                0
            );
        },
        getMigratedToGameSubcollectionsAt: function getMigratedToGameSubcollectionsAt() {
            return withManager(
                (svc) => (typeof svc.getMigratedToGameSubcollectionsAt === 'function' ? svc.getMigratedToGameSubcollectionsAt() : null),
                null
            );
        },
        getObservabilityCounters: function getObservabilityCounters() {
            return withManager(
                (svc) => (typeof svc.getObservabilityCounters === 'function'
                    ? svc.getObservabilityCounters()
                    : {
                        dualWriteMismatchCount: 0,
                        invitationContextMismatchCount: 0,
                        fallbackReadHitCount: 0,
                    }),
                {
                    dualWriteMismatchCount: 0,
                    invitationContextMismatchCount: 0,
                    fallbackReadHitCount: 0,
                }
            );
        },
        resetObservabilityCounters: function resetObservabilityCounters() {
            return withManager(
                (svc) => (typeof svc.resetObservabilityCounters === 'function' ? svc.resetObservabilityCounters() : false),
                false
            );
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
            clearActiveGame();
            return withManager((svc) => svc.signOut(), notLoadedResult());
        },
        deleteUserAccountAndData: async function deleteUserAccountAndData() {
            return withManager((svc) => svc.deleteUserAccountAndData(), notLoadedResult());
        },
        loadUserData: async function loadUserData(user) {
            return withManager((svc) => svc.loadUserData(user), notLoadedResult());
        },
        isSignedIn: function isSignedIn() {
            return withManager((svc) => svc.isSignedIn(), false);
        },
        saveUserData: async function saveUserData(options, context) {
            const gameContext = resolveGameplayContext('saveUserData', context);
            return withManager((svc) => svc.saveUserData(options, gameContext), notLoadedResult());
        },
        uploadPlayerDatabase: async function uploadPlayerDatabase(file, context) {
            const gameContext = resolveGameplayContext('uploadPlayerDatabase', context);
            return withManager((svc) => svc.uploadPlayerDatabase(file, gameContext), Promise.reject(notLoadedResult()));
        },
        getPlayerDatabase: function getPlayerDatabase(context) {
            const gameContext = resolveGameplayContext('getPlayerDatabase', context);
            return withManager((svc) => svc.getPlayerDatabase(gameContext), {});
        },
        getAlliancePlayerDatabase: function getAlliancePlayerDatabase(context) {
            const gameContext = resolveGameplayContext('getAlliancePlayerDatabase', context);
            return withManager((svc) => svc.getAlliancePlayerDatabase(gameContext), {});
        },
        upsertPlayerEntry: async function upsertPlayerEntry(source, originalName, nextPlayer, context) {
            const gameContext = resolveGameplayContext('upsertPlayerEntry', context);
            return withManager((svc) => svc.upsertPlayerEntry(source, originalName, nextPlayer, gameContext), notLoadedResult());
        },
        removePlayerEntry: async function removePlayerEntry(source, playerName, context) {
            const gameContext = resolveGameplayContext('removePlayerEntry', context);
            return withManager((svc) => svc.removePlayerEntry(source, playerName, gameContext), notLoadedResult());
        },
        getAllEventData: function getAllEventData(context) {
            const gameContext = resolveGameplayContext('getAllEventData', context);
            return withManager((svc) => svc.getAllEventData(gameContext), {});
        },
        getEventIds: function getEventIds(context) {
            const gameContext = resolveGameplayContext('getEventIds', context);
            return withManager((svc) => svc.getEventIds(gameContext), []);
        },
        getEventMeta: function getEventMeta(eventIdOrContext, context) {
            const scopedContext = resolveEventScopedContext('getEventMeta', eventIdOrContext, context);
            if (!scopedContext.eventId) {
                return null;
            }
            return withManager((svc) => svc.getEventMeta(scopedContext.eventId, scopedContext), null);
        },
        upsertEvent: function upsertEvent(eventIdOrContext, payload, context) {
            const scopedContext = resolveEventScopedContext('upsertEvent', eventIdOrContext, context);
            if (!scopedContext.eventId) {
                return null;
            }
            return withManager((svc) => svc.upsertEvent(scopedContext.eventId, payload, scopedContext), null);
        },
        removeEvent: function removeEvent(eventIdOrContext, context) {
            const scopedContext = resolveEventScopedContext('removeEvent', eventIdOrContext, context);
            if (!scopedContext.eventId) {
                return false;
            }
            return withManager((svc) => svc.removeEvent(scopedContext.eventId, scopedContext), false);
        },
        setEventMetadata: function setEventMetadata(eventIdOrContext, metadata, context) {
            const scopedContext = resolveEventScopedContext('setEventMetadata', eventIdOrContext, context);
            if (!scopedContext.eventId) {
                return null;
            }
            return withManager((svc) => svc.setEventMetadata(scopedContext.eventId, metadata, scopedContext), null);
        },
        getActivePlayerDatabase: function getActivePlayerDatabase(context) {
            const gameContext = resolveGameplayContext('getActivePlayerDatabase', context);
            return withManager((svc) => svc.getActivePlayerDatabase(gameContext), {});
        },
        getUserProfile: function getUserProfile(context) {
            const gameContext = resolveGameplayContext('getUserProfile', context);
            return withManager((svc) => svc.getUserProfile(gameContext), { displayName: '', nickname: '', avatarDataUrl: '' });
        },
        setUserProfile: function setUserProfile(profile, context) {
            const gameContext = resolveGameplayContext('setUserProfile', context);
            return withManager((svc) => svc.setUserProfile(profile, gameContext), { displayName: '', nickname: '', avatarDataUrl: '' });
        },
        getPlayerSource: function getPlayerSource(context) {
            const gameContext = resolveGameplayContext('getPlayerSource', context);
            return withManager((svc) => svc.getPlayerSource(gameContext), 'personal');
        },
        getBuildingConfig: function getBuildingConfig(eventIdOrContext, context) {
            const scopedContext = resolveEventScopedContext('getBuildingConfig', eventIdOrContext, context);
            if (!scopedContext.eventId) {
                return null;
            }
            return withManager((svc) => svc.getBuildingConfig(scopedContext.eventId, scopedContext), null);
        },
        setBuildingConfig: function setBuildingConfig(eventIdOrContext, config, context) {
            const scopedContext = resolveEventScopedContext('setBuildingConfig', eventIdOrContext, context);
            if (!scopedContext.eventId) {
                return null;
            }
            return withManager((svc) => svc.setBuildingConfig(scopedContext.eventId, config, scopedContext), null);
        },
        getBuildingConfigVersion: function getBuildingConfigVersion(eventIdOrContext, context) {
            const scopedContext = resolveEventScopedContext('getBuildingConfigVersion', eventIdOrContext, context);
            if (!scopedContext.eventId) {
                return 0;
            }
            return withManager((svc) => svc.getBuildingConfigVersion(scopedContext.eventId, scopedContext), 0);
        },
        setBuildingConfigVersion: function setBuildingConfigVersion(eventIdOrContext, version, context) {
            const scopedContext = resolveEventScopedContext('setBuildingConfigVersion', eventIdOrContext, context);
            if (!scopedContext.eventId) {
                return null;
            }
            return withManager((svc) => svc.setBuildingConfigVersion(scopedContext.eventId, version, scopedContext), null);
        },
        getBuildingPositions: function getBuildingPositions(eventIdOrContext, context) {
            const scopedContext = resolveEventScopedContext('getBuildingPositions', eventIdOrContext, context);
            if (!scopedContext.eventId) {
                return null;
            }
            return withManager((svc) => svc.getBuildingPositions(scopedContext.eventId, scopedContext), null);
        },
        setBuildingPositions: function setBuildingPositions(eventIdOrContext, positions, context) {
            const scopedContext = resolveEventScopedContext('setBuildingPositions', eventIdOrContext, context);
            if (!scopedContext.eventId) {
                return null;
            }
            return withManager((svc) => svc.setBuildingPositions(scopedContext.eventId, positions, scopedContext), null);
        },
        getBuildingPositionsVersion: function getBuildingPositionsVersion(eventIdOrContext, context) {
            const scopedContext = resolveEventScopedContext('getBuildingPositionsVersion', eventIdOrContext, context);
            if (!scopedContext.eventId) {
                return 0;
            }
            return withManager((svc) => svc.getBuildingPositionsVersion(scopedContext.eventId, scopedContext), 0);
        },
        setBuildingPositionsVersion: function setBuildingPositionsVersion(eventIdOrContext, version, context) {
            const scopedContext = resolveEventScopedContext('setBuildingPositionsVersion', eventIdOrContext, context);
            if (!scopedContext.eventId) {
                return null;
            }
            return withManager((svc) => svc.setBuildingPositionsVersion(scopedContext.eventId, version, scopedContext), null);
        },
        getGlobalDefaultBuildingConfig: function getGlobalDefaultBuildingConfig(eventId) {
            return withManager((svc) => svc.getGlobalDefaultBuildingConfig(eventId), null);
        },
        getGlobalDefaultBuildingConfigVersion: function getGlobalDefaultBuildingConfigVersion() {
            return withManager((svc) => svc.getGlobalDefaultBuildingConfigVersion(), 0);
        },
        getGlobalDefaultBuildingPositions: function getGlobalDefaultBuildingPositions(eventId) {
            return withManager((svc) => svc.getGlobalDefaultBuildingPositions(eventId), {});
        },
        getGlobalDefaultBuildingPositionsVersion: function getGlobalDefaultBuildingPositionsVersion() {
            return withManager((svc) => svc.getGlobalDefaultBuildingPositionsVersion(), 0);
        },
        createAlliance: async function createAlliance(name, context) {
            const gameContext = resolveGameplayContext('createAlliance', context);
            return withManager((svc) => svc.createAlliance(name, gameContext), notLoadedResult());
        },
        leaveAlliance: async function leaveAlliance(context) {
            const gameContext = resolveGameplayContext('leaveAlliance', context);
            return withManager((svc) => svc.leaveAlliance(gameContext), notLoadedResult());
        },
        loadAllianceData: async function loadAllianceData(context) {
            const gameContext = resolveGameplayContext('loadAllianceData', context);
            return withManager((svc) => svc.loadAllianceData(gameContext), notLoadedResult());
        },
        sendInvitation: async function sendInvitation(email, context) {
            const gameContext = resolveGameplayContext('sendInvitation', context);
            return withManager((svc) => svc.sendInvitation(email, gameContext), notLoadedResult());
        },
        checkInvitations: async function checkInvitations(context) {
            const gameContext = resolveGameplayContext('checkInvitations', context);
            return withManager((svc) => svc.checkInvitations(gameContext), []);
        },
        acceptInvitation: async function acceptInvitation(invitationId, context) {
            const gameContext = resolveGameplayContext('acceptInvitation', context);
            return withManager((svc) => svc.acceptInvitation(invitationId, gameContext), notLoadedResult());
        },
        rejectInvitation: async function rejectInvitation(invitationId, context) {
            const gameContext = resolveGameplayContext('rejectInvitation', context);
            return withManager((svc) => svc.rejectInvitation(invitationId, gameContext), notLoadedResult());
        },
        revokeInvitation: async function revokeInvitation(invitationId, context) {
            const gameContext = resolveGameplayContext('revokeInvitation', context);
            return withManager((svc) => svc.revokeInvitation(invitationId, gameContext), notLoadedResult());
        },
        resendInvitation: async function resendInvitation(invitationId, context) {
            const gameContext = resolveGameplayContext('resendInvitation', context);
            return withManager((svc) => svc.resendInvitation(invitationId, gameContext), notLoadedResult());
        },
        uploadAlliancePlayerDatabase: async function uploadAlliancePlayerDatabase(file, context) {
            const gameContext = resolveGameplayContext('uploadAlliancePlayerDatabase', context);
            return withManager((svc) => svc.uploadAlliancePlayerDatabase(file, gameContext), Promise.reject(notLoadedResult()));
        },
        setPlayerSource: async function setPlayerSource(source, context) {
            const gameContext = resolveGameplayContext('setPlayerSource', context);
            return withManager((svc) => svc.setPlayerSource(source, gameContext), notLoadedResult());
        },
        getAllianceId: function getAllianceId(context) {
            const gameContext = resolveGameplayContext('getAllianceId', context);
            return withManager((svc) => svc.getAllianceId(gameContext), null);
        },
        getAllianceName: function getAllianceName(context) {
            const gameContext = resolveGameplayContext('getAllianceName', context);
            return withManager((svc) => svc.getAllianceName(gameContext), null);
        },
        getAllianceData: function getAllianceData(context) {
            const gameContext = resolveGameplayContext('getAllianceData', context);
            return withManager((svc) => svc.getAllianceData(gameContext), null);
        },
        getPendingInvitations: function getPendingInvitations(context) {
            const gameContext = resolveGameplayContext('getPendingInvitations', context);
            return withManager((svc) => svc.getPendingInvitations(gameContext), []);
        },
        getSentInvitations: function getSentInvitations(context) {
            const gameContext = resolveGameplayContext('getSentInvitations', context);
            return withManager((svc) => svc.getSentInvitations(gameContext), []);
        },
        getInvitationNotifications: function getInvitationNotifications(context) {
            const gameContext = resolveGameplayContext('getInvitationNotifications', context);
            return withManager((svc) => svc.getInvitationNotifications(gameContext), []);
        },
        getAllianceMembers: function getAllianceMembers(context) {
            const gameContext = resolveGameplayContext('getAllianceMembers', context);
            return withManager((svc) => svc.getAllianceMembers(gameContext), {});
        },
    };

    global.FirebaseService = FirebaseService;
})(window);
