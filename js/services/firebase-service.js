(function initFirebaseService(global) {
    const MULTIGAME_FLAG_DEFAULTS = Object.freeze({
        MULTIGAME_ENABLED: false,
        MULTIGAME_READ_FALLBACK_ENABLED: true,
        MULTIGAME_DUAL_WRITE_ENABLED: false,
        MULTIGAME_GAME_SELECTOR_ENABLED: false,
    });
    const MULTIGAME_FLAG_KEYS = Object.keys(MULTIGAME_FLAG_DEFAULTS);
    const ACTIVE_GAME_STORAGE_KEY = 'ds_active_game_id';
    let activeGameIdCache = '';
    const legacyGameSignatureWarnings = new Set();

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

    function warnLegacyGameSignature(methodName) {
        if (legacyGameSignatureWarnings.has(methodName)) {
            return;
        }
        legacyGameSignatureWarnings.add(methodName);
        console.warn(`[multigame][legacy-signature] ${methodName} called without explicit gameId; using active game context.`);
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

        warnLegacyGameSignature(methodName);
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
        getEventMeta: function getEventMeta(eventId, context) {
            const gameContext = resolveGameplayContext('getEventMeta', context);
            return withManager((svc) => svc.getEventMeta(eventId, gameContext), null);
        },
        upsertEvent: function upsertEvent(eventId, payload, context) {
            const gameContext = resolveGameplayContext('upsertEvent', context);
            return withManager((svc) => svc.upsertEvent(eventId, payload, gameContext), null);
        },
        removeEvent: function removeEvent(eventId, context) {
            const gameContext = resolveGameplayContext('removeEvent', context);
            return withManager((svc) => svc.removeEvent(eventId, gameContext), false);
        },
        setEventMetadata: function setEventMetadata(eventId, metadata, context) {
            const gameContext = resolveGameplayContext('setEventMetadata', context);
            return withManager((svc) => svc.setEventMetadata(eventId, metadata, gameContext), null);
        },
        getActivePlayerDatabase: function getActivePlayerDatabase(context) {
            const gameContext = resolveGameplayContext('getActivePlayerDatabase', context);
            return withManager((svc) => svc.getActivePlayerDatabase(gameContext), {});
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
        getBuildingConfig: function getBuildingConfig(eventId, context) {
            const gameContext = resolveGameplayContext('getBuildingConfig', context);
            return withManager((svc) => svc.getBuildingConfig(eventId, gameContext), null);
        },
        setBuildingConfig: function setBuildingConfig(eventId, config, context) {
            const gameContext = resolveGameplayContext('setBuildingConfig', context);
            return withManager((svc) => svc.setBuildingConfig(eventId, config, gameContext), null);
        },
        getBuildingConfigVersion: function getBuildingConfigVersion(eventId, context) {
            const gameContext = resolveGameplayContext('getBuildingConfigVersion', context);
            return withManager((svc) => svc.getBuildingConfigVersion(eventId, gameContext), 0);
        },
        setBuildingConfigVersion: function setBuildingConfigVersion(eventId, version, context) {
            const gameContext = resolveGameplayContext('setBuildingConfigVersion', context);
            return withManager((svc) => svc.setBuildingConfigVersion(eventId, version, gameContext), null);
        },
        getBuildingPositions: function getBuildingPositions(eventId, context) {
            const gameContext = resolveGameplayContext('getBuildingPositions', context);
            return withManager((svc) => svc.getBuildingPositions(eventId, gameContext), null);
        },
        setBuildingPositions: function setBuildingPositions(eventId, positions, context) {
            const gameContext = resolveGameplayContext('setBuildingPositions', context);
            return withManager((svc) => svc.setBuildingPositions(eventId, positions, gameContext), null);
        },
        getBuildingPositionsVersion: function getBuildingPositionsVersion(eventId, context) {
            const gameContext = resolveGameplayContext('getBuildingPositionsVersion', context);
            return withManager((svc) => svc.getBuildingPositionsVersion(eventId, gameContext), 0);
        },
        setBuildingPositionsVersion: function setBuildingPositionsVersion(eventId, version, context) {
            const gameContext = resolveGameplayContext('setBuildingPositionsVersion', context);
            return withManager((svc) => svc.setBuildingPositionsVersion(eventId, version, gameContext), null);
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
        getSentInvitations: function getSentInvitations() {
            return withManager((svc) => svc.getSentInvitations(), []);
        },
        getInvitationNotifications: function getInvitationNotifications() {
            return withManager((svc) => svc.getInvitationNotifications(), []);
        },
        getAllianceMembers: function getAllianceMembers() {
            return withManager((svc) => svc.getAllianceMembers(), {});
        },
    };

    global.FirebaseService = FirebaseService;
})(window);
