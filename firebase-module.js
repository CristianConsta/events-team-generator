/**
 * FIREBASE MODULE FOR DESERT STORM & CANYON BATTLEFIELD
 * =====================================================
 * 
 * This module handles all Firebase functionality:
 * - Authentication (Google + Email/Password)
 * - Firestore database operations
 * - Player database management
 * - Backup/restore functionality
 * 
 * USAGE:
 * 1. Include Firebase SDKs in your HTML
 * 2. Include this file
 * 3. Call FirebaseManager.init()
 * 4. Use provided functions
 */

const FirebaseManager = (function() {
    
    // Firebase configuration - loaded from firebase-config.js
    // DO NOT hardcode your API key here - use firebase-config.js instead
    let firebaseConfig = null;
    
    // Check if config is loaded from firebase-config.js (global const or window property)
    if (typeof FIREBASE_CONFIG !== 'undefined' && FIREBASE_CONFIG) {
        firebaseConfig = FIREBASE_CONFIG;
        console.log('✅ Firebase config loaded from firebase-config.js');
    } else if (typeof window !== 'undefined' && window.FIREBASE_CONFIG) {
        firebaseConfig = window.FIREBASE_CONFIG;
        console.log('✅ Firebase config loaded from window.FIREBASE_CONFIG');
    } else {
        console.error('❌ Firebase config not found!');
        console.error('Please create firebase-config.js with your Firebase credentials');
        console.error('For GitHub Pages, ensure FIREBASE_CONFIG_JS secret is configured.');
    }
    
    function createEmptyEventEntry(overrides) {
        const source = overrides && typeof overrides === 'object' ? overrides : {};
        return {
            name: typeof source.name === 'string' ? source.name : '',
            logoDataUrl: typeof source.logoDataUrl === 'string' ? source.logoDataUrl : '',
            mapDataUrl: typeof source.mapDataUrl === 'string' ? source.mapDataUrl : '',
            buildingConfig: null,
            buildingConfigVersion: 0,
            buildingPositions: null,
            buildingPositionsVersion: 0,
        };
    }

    function createEmptyEventData() {
        return {};
    }

    const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
    const MAX_PLAYER_DATABASE_SIZE = 100;
    const MAX_PROFILE_TEXT_LEN = 60;
    const MAX_AVATAR_DATA_URL_LEN = 400000;
    const INVITE_MAX_RESENDS = 3;
    const INVITE_REMINDER_DAY1_MS = 24 * 60 * 60 * 1000;
    const INVITE_REMINDER_DAY3_MS = 3 * INVITE_REMINDER_DAY1_MS;
    const LEGACY_EVENT_IDS = ['desert_storm', 'canyon_battlefield'];
    const LEGACY_EVENT_BUILDING_DEFAULTS = {
        desert_storm: [
            { name: 'Bomb Squad', priority: 1, slots: 4, label: 'Bomb Squad' },
            { name: 'Oil Refinery 1', priority: 3, slots: 2, label: 'Oil Refinery 1' },
            { name: 'Oil Refinery 2', priority: 3, slots: 2, label: 'Oil Refinery 2' },
            { name: 'Field Hospital 1', priority: 4, slots: 2, label: 'Field Hospital 1' },
            { name: 'Field Hospital 2', priority: 4, slots: 2, label: 'Field Hospital 2' },
            { name: 'Field Hospital 3', priority: 4, slots: 2, label: 'Field Hospital 3' },
            { name: 'Field Hospital 4', priority: 4, slots: 2, label: 'Field Hospital 4' },
            { name: 'Info Center', priority: 5, slots: 2, label: 'Info Center' },
            { name: 'Science Hub', priority: 5, slots: 2, label: 'Science Hub' },
        ],
        canyon_battlefield: [
            { name: 'Bomb Squad', priority: 1, slots: 4, label: 'Bomb Squad' },
            { name: 'Missile Silo 1', priority: 2, slots: 2, label: 'Missile Silo 1' },
            { name: 'Missile Silo 2', priority: 2, slots: 2, label: 'Missile Silo 2' },
            { name: 'Radar Station 1', priority: 3, slots: 2, label: 'Radar Station 1' },
            { name: 'Radar Station 2', priority: 3, slots: 2, label: 'Radar Station 2' },
            { name: 'Watchtower 1', priority: 4, slots: 1, label: 'Watchtower 1' },
            { name: 'Watchtower 2', priority: 4, slots: 1, label: 'Watchtower 2' },
            { name: 'Watchtower 3', priority: 4, slots: 1, label: 'Watchtower 3' },
            { name: 'Watchtower 4', priority: 4, slots: 1, label: 'Watchtower 4' },
            { name: 'Command Center', priority: 3, slots: 2, label: 'Command Center' },
            { name: 'Supply Depot', priority: 5, slots: 1, label: 'Supply Depot' },
            { name: 'Armory', priority: 5, slots: 1, label: 'Armory' },
            { name: 'Comm Tower', priority: 5, slots: 0, label: 'Comm Tower' },
        ],
    };
    const GLOBAL_COORD_OWNER_EMAIL = 'constantinescu.cristian@gmail.com';
    const GLOBAL_COORDS_COLLECTION = 'app_config';
    const GLOBAL_COORDS_DOC_ID = 'default_event_positions';
    const GLOBAL_BUILDING_CONFIG_DOC_ID = 'default_event_building_config';
    const EVENT_NAME_MAX_LEN = 30;
    const MAX_EVENT_LOGO_DATA_URL_LEN = 300000;
    const MAX_EVENT_MAP_DATA_URL_LEN = 950000;
    const EVENT_MEDIA_SUBCOLLECTION = 'event_media';
    const USER_GAMES_SUBCOLLECTION = 'games';
    const DEFAULT_GAME_ID = 'last_war';
    const GAME_SUBCOLLECTION_MIGRATION_VERSION = 1;
    const MULTIGAME_FLAG_DEFAULTS = Object.freeze({
        MULTIGAME_ENABLED: false,
        MULTIGAME_READ_FALLBACK_ENABLED: true,
        MULTIGAME_DUAL_WRITE_ENABLED: false,
        MULTIGAME_GAME_SELECTOR_ENABLED: false,
    });
    const MULTIGAME_FLAG_KEYS = Object.keys(MULTIGAME_FLAG_DEFAULTS);

    // Private variables
    let auth = null;
    let db = null;
    let currentUser = null;
    let playerDatabase = {};
    // Per-event building data: { [eventId]: { name, logoDataUrl, mapDataUrl, buildingConfig, buildingConfigVersion, buildingPositions, buildingPositionsVersion } }
    let eventData = createEmptyEventData();
    let allianceId = null;
    let allianceName = null;
    let allianceData = null;
    let playerSource = 'personal';
    let pendingInvitations = [];
    let sentInvitations = [];
    let invitationNotifications = [];
    let userProfile = { displayName: '', nickname: '', avatarDataUrl: '' };
    let onAuthCallback = null;
    let onDataLoadCallback = null;
    let onAllianceDataCallback = null;
    const SAVE_DEBOUNCE_MS = 1500;
    let lastSavedUserState = null;
    let saveDebounceTimer = null;
    let pendingSavePromise = null;
    let pendingSaveResolve = null;
    let saveLifecycleHandlersBound = false;
    let allianceDocUnsubscribe = null;

    let globalDefaultEventPositions = {};
    let globalDefaultPositionsVersion = 0;
    let globalDefaultEventBuildingConfig = {};
    let globalDefaultBuildingConfigVersion = 0;
    let migrationVersion = 0;
    let migratedToGameSubcollectionsAt = null;

    function normalizeFeatureFlagValue(value, fallbackValue) {
        if (typeof value === 'boolean') {
            return value;
        }
        if (typeof value === 'number') {
            return value !== 0;
        }
        if (typeof value === 'string') {
            const normalized = value.trim().toLowerCase();
            if (!normalized) {
                return fallbackValue;
            }
            if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on') {
                return true;
            }
            if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') {
                return false;
            }
        }
        return fallbackValue;
    }

    function readRuntimeFeatureFlagOverrides() {
        if (typeof window === 'undefined' || !window || typeof window !== 'object') {
            return {};
        }
        const runtimeFlags = window.__MULTIGAME_FLAGS;
        if (!runtimeFlags || typeof runtimeFlags !== 'object') {
            return {};
        }
        return runtimeFlags;
    }

    function resolveFeatureFlags(overrides) {
        const runtimeOverrides = readRuntimeFeatureFlagOverrides();
        const scopedOverrides = overrides && typeof overrides === 'object' ? overrides : {};
        const mergedFlags = {
            ...runtimeOverrides,
            ...scopedOverrides,
        };
        const resolvedFlags = {};
        MULTIGAME_FLAG_KEYS.forEach((flagName) => {
            const fallbackValue = MULTIGAME_FLAG_DEFAULTS[flagName];
            resolvedFlags[flagName] = normalizeFeatureFlagValue(mergedFlags[flagName], fallbackValue);
        });
        return resolvedFlags;
    }

    function isFeatureFlagEnabled(flagName, overrides) {
        if (!Object.prototype.hasOwnProperty.call(MULTIGAME_FLAG_DEFAULTS, flagName)) {
            return false;
        }
        const resolvedFlags = resolveFeatureFlags(overrides);
        return resolvedFlags[flagName] === true;
    }

    function emptyGlobalEventPositions(payload) {
        const source = payload && typeof payload === 'object' ? payload : {};
        const normalized = {};
        LEGACY_EVENT_IDS.forEach((eventId) => {
            normalized[eventId] = {};
        });
        Object.keys(source).forEach((rawId) => {
            const eid = normalizeEventId(rawId);
            if (!eid) {
                return;
            }
            if (!normalized[eid]) {
                normalized[eid] = {};
            }
        });
        return normalized;
    }

    function emptyGlobalBuildingConfig(payload) {
        const source = payload && typeof payload === 'object' ? payload : {};
        const normalized = {};
        LEGACY_EVENT_IDS.forEach((eventId) => {
            normalized[eventId] = null;
        });
        Object.keys(source).forEach((rawId) => {
            const eid = normalizeEventId(rawId);
            if (!eid) {
                return;
            }
            if (!Object.prototype.hasOwnProperty.call(normalized, eid)) {
                normalized[eid] = null;
            }
        });
        return normalized;
    }

    function normalizeEventId(value) {
        if (typeof value !== 'string') {
            return '';
        }
        return value
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '');
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

    function getUserGameDocRef(userId, gameId) {
        if (!db || !userId) {
            return null;
        }
        const normalizedGameId = normalizeGameId(gameId) || DEFAULT_GAME_ID;
        return db.collection('users').doc(userId).collection(USER_GAMES_SUBCOLLECTION).doc(normalizedGameId);
    }

    function parseMigrationVersion(value) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed) || parsed < 0) {
            return 0;
        }
        return Math.floor(parsed);
    }

    function updateMigrationMarkersFromUserData(data) {
        const source = data && typeof data === 'object' ? data : {};
        migrationVersion = parseMigrationVersion(source.migrationVersion);
        migratedToGameSubcollectionsAt = source.migratedToGameSubcollectionsAt || null;
    }

    function resolveGameScopedReadPayload(options) {
        const source = options && typeof options === 'object' ? options : {};
        const normalizedGameId = normalizeGameId(source.gameId) || DEFAULT_GAME_ID;
        const gameData = source.gameData && typeof source.gameData === 'object' ? source.gameData : null;
        const legacyData = source.legacyData && typeof source.legacyData === 'object' ? source.legacyData : null;

        if (gameData) {
            return {
                gameId: normalizedGameId,
                source: 'game',
                usedLegacyFallback: false,
                data: gameData,
            };
        }
        if (normalizedGameId === DEFAULT_GAME_ID && legacyData) {
            return {
                gameId: normalizedGameId,
                source: 'legacy-fallback',
                usedLegacyFallback: true,
                data: legacyData,
            };
        }
        return {
            gameId: normalizedGameId,
            source: 'none',
            usedLegacyFallback: false,
            data: null,
        };
    }

    function normalizeEventName(value, fallback) {
        const raw = typeof value === 'string' ? value.trim() : '';
        const resolved = raw || (typeof fallback === 'string' ? fallback : '');
        return resolved.slice(0, EVENT_NAME_MAX_LEN);
    }

    function sanitizeEventImageDataUrl(value, maxLength) {
        const raw = typeof value === 'string' ? value.trim() : '';
        if (!raw || !raw.startsWith('data:image/')) {
            return '';
        }
        if (raw.length > maxLength) {
            return '';
        }
        return raw;
    }

    function getDefaultEventName(eventId) {
        if (eventId === 'desert_storm') {
            return 'Desert Storm';
        }
        if (eventId === 'canyon_battlefield') {
            return 'Canyon Storm';
        }
        return eventId;
    }

    function cloneDefaultLegacyBuildingConfig(eventId) {
        const defaults = LEGACY_EVENT_BUILDING_DEFAULTS[eventId];
        if (!Array.isArray(defaults)) {
            return [];
        }
        return defaults.map((item) => ({
            ...item,
            showOnMap: item && item.showOnMap !== false,
        }));
    }

    function normalizeBuildingConfigForDefaults(config) {
        if (!Array.isArray(config)) {
            return null;
        }
        const normalized = [];
        config.forEach((item) => {
            if (!item || typeof item !== 'object') {
                return;
            }
            const name = typeof item.name === 'string' ? item.name.trim() : '';
            if (!name) {
                return;
            }
            const next = { name: name };
            if (typeof item.label === 'string' && item.label.trim()) {
                next.label = item.label.trim();
            }
            next.showOnMap = item.showOnMap !== false;
            const slots = Number(item.slots);
            if (Number.isFinite(slots)) {
                next.slots = Math.round(slots);
            }
            const priority = Number(item.priority);
            if (Number.isFinite(priority)) {
                next.priority = Math.round(priority);
            }
            normalized.push(next);
        });
        return normalized.length > 0 ? normalized : null;
    }

    function ensureLegacyEventEntriesWithDefaults(map) {
        const target = map && typeof map === 'object' ? map : {};
        let changed = false;
        LEGACY_EVENT_IDS.forEach((eventId) => {
            if (!target[eventId]) {
                target[eventId] = createEmptyEventEntry({ name: getDefaultEventName(eventId) });
                changed = true;
            }
            const entry = target[eventId];
            if (!entry.name) {
                entry.name = getDefaultEventName(eventId);
                changed = true;
            }

            const normalizedConfig = normalizeBuildingConfigForDefaults(entry.buildingConfig);
            if (!Array.isArray(normalizedConfig) || normalizedConfig.length === 0) {
                entry.buildingConfig = cloneDefaultLegacyBuildingConfig(eventId);
                if (!Number.isFinite(Number(entry.buildingConfigVersion)) || Number(entry.buildingConfigVersion) <= 0) {
                    entry.buildingConfigVersion = 1;
                }
                changed = true;
            } else if (!Array.isArray(entry.buildingConfig) || entry.buildingConfig.length !== normalizedConfig.length) {
                entry.buildingConfig = normalizedConfig;
                changed = true;
            }
        });
        return { events: target, changed: changed };
    }

    function ensureLegacyEventEntries(map) {
        return ensureLegacyEventEntriesWithDefaults(map).events;
    }

    eventData = ensureLegacyEventEntries(eventData);
    globalDefaultEventPositions = emptyGlobalEventPositions();
    globalDefaultEventBuildingConfig = emptyGlobalBuildingConfig();

    function normalizeCoordinatePair(value) {
        if (!Array.isArray(value) || value.length < 2) {
            return null;
        }
        const x = Number(value[0]);
        const y = Number(value[1]);
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            return null;
        }
        return [Math.round(x), Math.round(y)];
    }

    function normalizePositionsMap(positions) {
        if (!positions || typeof positions !== 'object') {
            return {};
        }
        const normalized = {};
        Object.entries(positions).forEach(([name, coords]) => {
            if (typeof name !== 'string' || !name.trim()) {
                return;
            }
            const pair = normalizeCoordinatePair(coords);
            if (pair) {
                normalized[name] = pair;
            }
        });
        return normalized;
    }

    function normalizeEventPositionsPayload(payload) {
        const source = payload && typeof payload === 'object'
            ? payload
            : {};
        const normalized = emptyGlobalEventPositions(source);
        Object.keys(source).forEach((rawId) => {
            const eid = normalizeEventId(rawId);
            if (!eid) {
                return;
            }
            normalized[eid] = normalizePositionsMap(source[rawId]);
        });
        return normalized;
    }

    function hasAnyPositions(events) {
        if (!events || typeof events !== 'object') {
            return false;
        }
        return Object.keys(events).some((eid) => Object.keys(events[eid] || {}).length > 0);
    }

    function toMillis(value) {
        if (!value) {
            return 0;
        }
        if (typeof value.toMillis === 'function') {
            const ms = Number(value.toMillis());
            return Number.isFinite(ms) && ms > 0 ? ms : 0;
        }
        if (typeof value === 'string') {
            const parsed = Date.parse(value);
            return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
        }
        if (typeof value === 'number') {
            return Number.isFinite(value) && value > 0 ? value : 0;
        }
        return 0;
    }

    function extractVersionFromUserData(data) {
        if (!data || typeof data !== 'object') {
            return 0;
        }
        const metadata = data.metadata && typeof data.metadata === 'object'
            ? data.metadata
            : {};
        const metaVersion = Math.max(
            toMillis(metadata.lastModified),
            toMillis(metadata.lastUpload)
        );
        let eventVersion = 0;
        if (data.events && typeof data.events === 'object') {
            Object.keys(data.events).forEach((rawId) => {
                const eid = normalizeEventId(rawId);
                if (!eid) {
                    return;
                }
                const entry = data.events[rawId];
                if (!entry || typeof entry !== 'object') {
                    return;
                }
                const positionsVersion = Number(entry.buildingPositionsVersion);
                if (Number.isFinite(positionsVersion) && positionsVersion > eventVersion) {
                    eventVersion = positionsVersion;
                }
                const configVersion = Number(entry.buildingConfigVersion);
                if (Number.isFinite(configVersion) && configVersion > eventVersion) {
                    eventVersion = configVersion;
                }
            });
        } else {
            const legacyPositionsVersion = Number(data.buildingPositionsVersion);
            if (Number.isFinite(legacyPositionsVersion) && legacyPositionsVersion > 0) {
                eventVersion = legacyPositionsVersion;
            }
            const legacyConfigVersion = Number(data.buildingConfigVersion);
            if (Number.isFinite(legacyConfigVersion) && legacyConfigVersion > eventVersion) {
                eventVersion = legacyConfigVersion;
            }
        }
        return Math.max(metaVersion, eventVersion);
    }

    function extractPositionsFromUserData(data) {
        const events = emptyGlobalEventPositions(data && data.events ? data.events : null);
        if (data && data.events && typeof data.events === 'object') {
            Object.keys(data.events).forEach((rawId) => {
                const eid = normalizeEventId(rawId);
                if (!eid) {
                    return;
                }
                const entry = data.events[rawId];
                if (!entry || typeof entry !== 'object') {
                    return;
                }
                events[eid] = normalizePositionsMap(entry.buildingPositions);
            });
            return events;
        }
        if (data && data.buildingPositions && typeof data.buildingPositions === 'object') {
            events.desert_storm = normalizePositionsMap(data.buildingPositions);
        }
        return events;
    }

    function setGlobalDefaultPositions(events, version) {
        globalDefaultEventPositions = normalizeEventPositionsPayload(events);
        const parsedVersion = Number(version);
        globalDefaultPositionsVersion = Number.isFinite(parsedVersion) && parsedVersion > 0 ? parsedVersion : 0;
    }

    function normalizeBuildingConfigArray(config) {
        if (!Array.isArray(config)) {
            return null;
        }
        const normalized = [];
        config.forEach((item) => {
            if (!item || typeof item !== 'object') {
                return;
            }
            const name = typeof item.name === 'string' ? item.name.trim() : '';
            if (!name) {
                return;
            }
            const next = { name: name };
            if (typeof item.label === 'string' && item.label.trim()) {
                next.label = item.label.trim();
            }
            next.showOnMap = item.showOnMap !== false;
            const slots = Number(item.slots);
            if (Number.isFinite(slots)) {
                next.slots = Math.round(slots);
            }
            const priority = Number(item.priority);
            if (Number.isFinite(priority)) {
                next.priority = Math.round(priority);
            }
            normalized.push(next);
        });
        return normalized.length > 0 ? normalized : null;
    }

    function sanitizeEventEntry(eventId, payload, fallbackEntry) {
        const source = payload && typeof payload === 'object' ? payload : {};
        const fallback = fallbackEntry && typeof fallbackEntry === 'object' ? fallbackEntry : {};
        const fallbackName = fallback.name || getDefaultEventName(eventId) || eventId;
        const normalized = createEmptyEventEntry({
            name: normalizeEventName(source.name, fallbackName),
            logoDataUrl: sanitizeEventImageDataUrl(source.logoDataUrl, MAX_EVENT_LOGO_DATA_URL_LEN),
            mapDataUrl: sanitizeEventImageDataUrl(source.mapDataUrl, MAX_EVENT_MAP_DATA_URL_LEN),
        });

        const normalizedConfig = normalizeBuildingConfigArray(source.buildingConfig);
        normalized.buildingConfig = Array.isArray(normalizedConfig)
            ? normalizedConfig
            : (Array.isArray(fallback.buildingConfig) ? normalizeBuildingConfigArray(fallback.buildingConfig) : null);

        const configVersion = Number(source.buildingConfigVersion);
        normalized.buildingConfigVersion = Number.isFinite(configVersion) && configVersion > 0
            ? Math.round(configVersion)
            : (Number.isFinite(Number(fallback.buildingConfigVersion)) ? Math.round(Number(fallback.buildingConfigVersion)) : 0);

        const normalizedPositions = normalizePositionsMap(source.buildingPositions);
        normalized.buildingPositions = Object.keys(normalizedPositions).length > 0
            ? normalizedPositions
            : (fallback.buildingPositions && typeof fallback.buildingPositions === 'object' ? normalizePositionsMap(fallback.buildingPositions) : null);

        const positionsVersion = Number(source.buildingPositionsVersion);
        normalized.buildingPositionsVersion = Number.isFinite(positionsVersion) && positionsVersion > 0
            ? Math.round(positionsVersion)
            : (Number.isFinite(Number(fallback.buildingPositionsVersion)) ? Math.round(Number(fallback.buildingPositionsVersion)) : 0);

        return normalized;
    }

    function normalizeEventsMap(payload, fallbackMap) {
        const source = payload && typeof payload === 'object' ? payload : {};
        const fallback = fallbackMap && typeof fallbackMap === 'object' ? fallbackMap : {};
        const normalized = {};

        Object.keys(source).forEach((rawId) => {
            const eventId = normalizeEventId(rawId);
            if (!eventId) {
                return;
            }
            normalized[eventId] = sanitizeEventEntry(eventId, source[rawId], fallback[eventId]);
        });

        ensureLegacyEventEntries(normalized);
        return normalized;
    }

    function getEventMediaMap(payload) {
        const source = payload && typeof payload === 'object' ? payload : {};
        const media = {};
        Object.keys(source).forEach((rawId) => {
            const eventId = normalizeEventId(rawId);
            if (!eventId) {
                return;
            }
            const entry = source[rawId];
            if (!entry || typeof entry !== 'object') {
                return;
            }
            const logoDataUrl = sanitizeEventImageDataUrl(entry.logoDataUrl, MAX_EVENT_LOGO_DATA_URL_LEN);
            const mapDataUrl = sanitizeEventImageDataUrl(entry.mapDataUrl, MAX_EVENT_MAP_DATA_URL_LEN);
            if (!logoDataUrl && !mapDataUrl) {
                return;
            }
            media[eventId] = { logoDataUrl, mapDataUrl };
        });
        return media;
    }

    function buildEventsWithoutMedia(payload) {
        const source = payload && typeof payload === 'object' ? payload : {};
        const stripped = {};
        Object.keys(source).forEach((rawId) => {
            const eventId = normalizeEventId(rawId);
            if (!eventId) {
                return;
            }
            const entry = source[rawId];
            stripped[eventId] = sanitizeEventEntry(eventId, {
                name: entry && typeof entry.name === 'string' ? entry.name : '',
                logoDataUrl: '',
                mapDataUrl: '',
                buildingConfig: entry ? entry.buildingConfig : null,
                buildingConfigVersion: entry ? entry.buildingConfigVersion : 0,
                buildingPositions: entry ? entry.buildingPositions : null,
                buildingPositionsVersion: entry ? entry.buildingPositionsVersion : 0,
            }, createEmptyEventEntry({ name: getDefaultEventName(eventId) }));
        });
        ensureLegacyEventEntries(stripped);
        return stripped;
    }

    function applyEventMediaToEvents(mediaMap) {
        const media = mediaMap && typeof mediaMap === 'object' ? mediaMap : {};
        Object.keys(media).forEach((rawId) => {
            const eventId = normalizeEventId(rawId);
            if (!eventId) {
                return;
            }
            const entry = media[rawId];
            if (!entry || typeof entry !== 'object') {
                return;
            }
            ensureEventEntry(eventId);
            eventData[eventId].logoDataUrl = sanitizeEventImageDataUrl(entry.logoDataUrl, MAX_EVENT_LOGO_DATA_URL_LEN);
            eventData[eventId].mapDataUrl = sanitizeEventImageDataUrl(entry.mapDataUrl, MAX_EVENT_MAP_DATA_URL_LEN);
        });
    }

    async function loadEventMediaForUser(uid) {
        if (!db || !uid) {
            return {};
        }
        try {
            const snapshot = await db.collection('users').doc(uid).collection(EVENT_MEDIA_SUBCOLLECTION).get();
            const media = {};
            snapshot.forEach((doc) => {
                const eventId = normalizeEventId(doc.id);
                if (!eventId) {
                    return;
                }
                const data = doc.data() || {};
                const logoDataUrl = sanitizeEventImageDataUrl(data.logoDataUrl, MAX_EVENT_LOGO_DATA_URL_LEN);
                const mapDataUrl = sanitizeEventImageDataUrl(data.mapDataUrl, MAX_EVENT_MAP_DATA_URL_LEN);
                if (!logoDataUrl && !mapDataUrl) {
                    return;
                }
                media[eventId] = { logoDataUrl, mapDataUrl };
            });
            return media;
        } catch (error) {
            console.warn('⚠️ Failed to load event media docs:', error.message || error);
            return {};
        }
    }

    async function saveEventMediaDiff(uid, previousMediaMap, nextMediaMap) {
        if (!db || !uid) {
            return;
        }
        const previous = previousMediaMap && typeof previousMediaMap === 'object' ? previousMediaMap : {};
        const next = nextMediaMap && typeof nextMediaMap === 'object' ? nextMediaMap : {};
        const ids = new Set([...Object.keys(previous), ...Object.keys(next)]);
        if (ids.size === 0) {
            return;
        }
        const batch = db.batch();
        let changes = 0;
        ids.forEach((rawId) => {
            const eventId = normalizeEventId(rawId);
            if (!eventId) {
                return;
            }
            const prevEntry = previous[eventId] || { logoDataUrl: '', mapDataUrl: '' };
            const nextEntry = next[eventId] || { logoDataUrl: '', mapDataUrl: '' };
            const prevLogo = sanitizeEventImageDataUrl(prevEntry.logoDataUrl, MAX_EVENT_LOGO_DATA_URL_LEN);
            const prevMap = sanitizeEventImageDataUrl(prevEntry.mapDataUrl, MAX_EVENT_MAP_DATA_URL_LEN);
            const nextLogo = sanitizeEventImageDataUrl(nextEntry.logoDataUrl, MAX_EVENT_LOGO_DATA_URL_LEN);
            const nextMap = sanitizeEventImageDataUrl(nextEntry.mapDataUrl, MAX_EVENT_MAP_DATA_URL_LEN);
            if (prevLogo === nextLogo && prevMap === nextMap) {
                return;
            }
            const ref = db.collection('users').doc(uid).collection(EVENT_MEDIA_SUBCOLLECTION).doc(eventId);
            if (!nextLogo && !nextMap) {
                batch.delete(ref);
            } else {
                batch.set(ref, {
                    logoDataUrl: nextLogo,
                    mapDataUrl: nextMap,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
            }
            changes += 1;
        });
        if (changes > 0) {
            await batch.commit();
        }
    }

    function normalizeEventBuildingConfigPayload(payload) {
        const source = payload && typeof payload === 'object' ? payload : {};
        const normalized = emptyGlobalBuildingConfig(source);
        Object.keys(source).forEach((rawId) => {
            const eid = normalizeEventId(rawId);
            if (!eid) {
                return;
            }
            normalized[eid] = normalizeBuildingConfigArray(source[rawId]);
        });
        return normalized;
    }

    function hasAnyBuildingConfig(payload) {
        if (!payload || typeof payload !== 'object') {
            return false;
        }
        return Object.keys(payload).some((eid) => Array.isArray(payload[eid]) && payload[eid].length > 0);
    }

    function extractBuildingConfigFromUserData(data) {
        const result = emptyGlobalBuildingConfig(data && data.events ? data.events : null);
        if (data && data.events && typeof data.events === 'object') {
            Object.keys(data.events).forEach((rawId) => {
                const eid = normalizeEventId(rawId);
                if (!eid) {
                    return;
                }
                const entry = data.events[rawId];
                if (!entry || typeof entry !== 'object') {
                    return;
                }
                result[eid] = normalizeBuildingConfigArray(entry.buildingConfig);
            });
            return result;
        }
        if (data && Array.isArray(data.buildingConfig)) {
            result.desert_storm = normalizeBuildingConfigArray(data.buildingConfig);
        }
        return result;
    }

    function setGlobalDefaultBuildingConfig(payload, version) {
        globalDefaultEventBuildingConfig = normalizeEventBuildingConfigPayload(payload);
        const parsedVersion = Number(version);
        globalDefaultBuildingConfigVersion = Number.isFinite(parsedVersion) && parsedVersion > 0 ? parsedVersion : 0;
    }

    function getGlobalDefaultBuildingConfig(eventId) {
        const eid = eventId || 'desert_storm';
        return JSON.parse(JSON.stringify(globalDefaultEventBuildingConfig[eid] || null));
    }

    function getGlobalDefaultBuildingConfigVersion() {
        return globalDefaultBuildingConfigVersion;
    }

    function getGlobalDefaultBuildingPositions(eventId) {
        const eid = eventId || 'desert_storm';
        return JSON.parse(JSON.stringify(globalDefaultEventPositions[eid] || {}));
    }

    function getGlobalDefaultBuildingPositionsVersion() {
        return globalDefaultPositionsVersion;
    }

    function applyGlobalDefaultBuildingConfigToEventData(options) {
        const opts = options && typeof options === 'object' ? options : {};
        const overwriteExisting = opts.overwriteExisting === true;
        const targetEventIds = Array.isArray(opts.eventIds) && opts.eventIds.length > 0 ? opts.eventIds : Object.keys(globalDefaultEventBuildingConfig || {});
        let changed = false;

        targetEventIds.forEach((rawId) => {
            const eventId = normalizeEventId(rawId);
            if (!eventId) {
                return;
            }
            const sharedConfig = normalizeBuildingConfigArray(globalDefaultEventBuildingConfig[eventId]);
            if (!Array.isArray(sharedConfig) || sharedConfig.length === 0) {
                return;
            }

            const eid = ensureEventEntry(eventId);
            const existingConfig = normalizeBuildingConfigArray(eventData[eid].buildingConfig);
            const hasExisting = Array.isArray(existingConfig) && existingConfig.length > 0;
            if (hasExisting && !overwriteExisting) {
                return;
            }

            eventData[eid].buildingConfig = sharedConfig;
            if (globalDefaultBuildingConfigVersion > 0) {
                eventData[eid].buildingConfigVersion = globalDefaultBuildingConfigVersion;
            }
            changed = true;
        });

        return changed;
    }

    function isPermissionDeniedError(error) {
        if (!error) return false;
        const code = typeof error.code === 'string' ? error.code.toLowerCase() : '';
        const message = typeof error.message === 'string' ? error.message.toLowerCase() : '';
        return code.includes('permission-denied') || message.includes('missing or insufficient permissions');
    }

    function logOptionalSharedDefaultsIssue(message, error) {
        const details = (error && (error.message || error.code)) ? (error.message || error.code) : String(error || 'unknown');
        if (isPermissionDeniedError(error)) {
            console.info(`${message} (optional feature disabled by Firestore rules):`, details);
            return;
        }
        console.warn(message, details);
    }

    async function tryLoadGlobalDefaultsDoc() {
        try {
            const defaultsDoc = await db.collection(GLOBAL_COORDS_COLLECTION).doc(GLOBAL_COORDS_DOC_ID).get();
            if (!defaultsDoc.exists) {
                return false;
            }
            const data = defaultsDoc.data() || {};
            const events = normalizeEventPositionsPayload(data.events || {});
            const version = Number(data.version);
            if (!hasAnyPositions(events)) {
                return false;
            }
            setGlobalDefaultPositions(events, Number.isFinite(version) && version > 0 ? version : 0);
            return true;
        } catch (error) {
            logOptionalSharedDefaultsIssue('Unable to load shared coordinate defaults:', error);
            return false;
        }
    }

    async function tryLoadGlobalDefaultsFromOwnerUser() {
        if (currentUser && currentUser.email && currentUser.email.toLowerCase() === GLOBAL_COORD_OWNER_EMAIL) {
            const localOwnerEvents = extractPositionsFromUserData({ events: eventData });
            if (hasAnyPositions(localOwnerEvents)) {
                const localVersion = Math.max(extractVersionFromUserData({ events: eventData }), 1);
                setGlobalDefaultPositions(localOwnerEvents, localVersion);
                return true;
            }
        }
        try {
            let query = await db.collection('users')
                .where('metadata.emailLower', '==', GLOBAL_COORD_OWNER_EMAIL)
                .limit(1)
                .get();
            if (query.empty) {
                query = await db.collection('users')
                    .where('metadata.email', '==', GLOBAL_COORD_OWNER_EMAIL)
                    .limit(1)
                    .get();
            }
            if (query.empty) {
                return false;
            }

            const ownerData = query.docs[0].data() || {};
            const events = extractPositionsFromUserData(ownerData);
            if (!hasAnyPositions(events)) {
                return false;
            }
            const version = Math.max(extractVersionFromUserData(ownerData), 1);
            setGlobalDefaultPositions(events, version);
            return true;
        } catch (error) {
            logOptionalSharedDefaultsIssue('Unable to load owner coordinate defaults:', error);
            return false;
        }
    }

    async function loadGlobalDefaultBuildingPositions() {
        if (!db) {
            setGlobalDefaultPositions(emptyGlobalEventPositions(), 0);
            return false;
        }
        const fromSharedDoc = await tryLoadGlobalDefaultsDoc();
        if (fromSharedDoc) {
            return true;
        }
        if (!currentUser || !currentUser.email || currentUser.email.toLowerCase() !== GLOBAL_COORD_OWNER_EMAIL) {
            return false;
        }
        return tryLoadGlobalDefaultsFromOwnerUser();
    }

    async function maybePublishGlobalDefaultsFromCurrentUser(userData) {
        if (!currentUser || !currentUser.email || currentUser.email.toLowerCase() !== GLOBAL_COORD_OWNER_EMAIL) {
            return false;
        }
        const events = extractPositionsFromUserData(userData || {});
        if (!hasAnyPositions(events)) {
            return false;
        }
        const version = Math.max(Date.now(), extractVersionFromUserData(userData || {}), 1);
        try {
            await db.collection(GLOBAL_COORDS_COLLECTION).doc(GLOBAL_COORDS_DOC_ID).set({
                sourceEmail: GLOBAL_COORD_OWNER_EMAIL,
                version: version,
                events: events,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            setGlobalDefaultPositions(events, version);
            return true;
        } catch (error) {
            logOptionalSharedDefaultsIssue('Unable to publish shared coordinate defaults:', error);
            return false;
        }
    }

    async function loadGlobalDefaultBuildingConfig() {
        if (!db) {
            setGlobalDefaultBuildingConfig(emptyGlobalBuildingConfig(), 0);
            return false;
        }
        try {
            const configDoc = await db.collection(GLOBAL_COORDS_COLLECTION).doc(GLOBAL_BUILDING_CONFIG_DOC_ID).get();
            if (!configDoc.exists) {
                setGlobalDefaultBuildingConfig(emptyGlobalBuildingConfig(), 0);
                return false;
            }
            const data = configDoc.data() || {};
            const events = normalizeEventBuildingConfigPayload(data.events || {});
            const version = Number(data.version);
            if (!hasAnyBuildingConfig(events)) {
                setGlobalDefaultBuildingConfig(emptyGlobalBuildingConfig(), 0);
                return false;
            }
            setGlobalDefaultBuildingConfig(events, Number.isFinite(version) && version > 0 ? version : 0);
            return true;
        } catch (error) {
            logOptionalSharedDefaultsIssue('Unable to load shared building config defaults:', error);
            setGlobalDefaultBuildingConfig(emptyGlobalBuildingConfig(), 0);
            return false;
        }
    }

    async function maybePublishGlobalBuildingConfigFromCurrentUser(userData) {
        if (!currentUser || !currentUser.email || currentUser.email.toLowerCase() !== GLOBAL_COORD_OWNER_EMAIL) {
            return false;
        }
        const events = extractBuildingConfigFromUserData(userData || {});
        if (!hasAnyBuildingConfig(events)) {
            return false;
        }
        const version = Math.max(Date.now(), extractVersionFromUserData(userData || {}), 1);
        try {
            await db.collection(GLOBAL_COORDS_COLLECTION).doc(GLOBAL_BUILDING_CONFIG_DOC_ID).set({
                sourceEmail: GLOBAL_COORD_OWNER_EMAIL,
                version: version,
                events: events,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            setGlobalDefaultBuildingConfig(events, version);
            return true;
        } catch (error) {
            logOptionalSharedDefaultsIssue('Unable to publish shared building config defaults:', error);
            return false;
        }
    }

    function normalizeUserProfile(profile) {
        const next = profile && typeof profile === 'object' ? profile : {};
        const displayName = typeof next.displayName === 'string' ? next.displayName.trim().slice(0, MAX_PROFILE_TEXT_LEN) : '';
        const nickname = typeof next.nickname === 'string' ? next.nickname.trim().slice(0, MAX_PROFILE_TEXT_LEN) : '';
        let avatarDataUrl = typeof next.avatarDataUrl === 'string' ? next.avatarDataUrl.trim() : '';
        if (!avatarDataUrl.startsWith('data:image/') || avatarDataUrl.length > MAX_AVATAR_DATA_URL_LEN) {
            avatarDataUrl = '';
        }
        return { displayName, nickname, avatarDataUrl };
    }

    function cloneJson(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function areJsonEqual(a, b) {
        return JSON.stringify(a) === JSON.stringify(b);
    }

    function getCurrentPersistedUserState() {
        return {
            playerDatabase: playerDatabase || {},
            events: buildEventsWithoutMedia(eventData),
            eventMedia: getEventMediaMap(eventData),
            userProfile: normalizeUserProfile(userProfile),
        };
    }

    function rememberLastSavedUserState(state) {
        const source = state && typeof state === 'object' ? state : getCurrentPersistedUserState();
        lastSavedUserState = cloneJson(source);
    }

    function clearSaveQueue() {
        if (saveDebounceTimer) {
            clearTimeout(saveDebounceTimer);
            saveDebounceTimer = null;
        }
        if (typeof pendingSaveResolve === 'function') {
            pendingSaveResolve({ success: false, cancelled: true, error: 'Save cancelled' });
        }
        pendingSavePromise = null;
        pendingSaveResolve = null;
    }

    function resetSaveState() {
        lastSavedUserState = null;
        clearSaveQueue();
    }

    function flushQueuedSaveOnLifecycle() {
        if (!pendingSavePromise || !saveDebounceTimer) {
            return;
        }
        clearTimeout(saveDebounceTimer);
        saveDebounceTimer = null;
        flushQueuedSave().catch((error) => {
            console.warn('Unable to flush queued save during lifecycle change:', error);
        });
    }

    function bindSaveLifecycleHandlers() {
        if (saveLifecycleHandlersBound || typeof window === 'undefined' || typeof document === 'undefined') {
            return;
        }
        saveLifecycleHandlersBound = true;
        window.addEventListener('pagehide', flushQueuedSaveOnLifecycle);
        window.addEventListener('beforeunload', flushQueuedSaveOnLifecycle);
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                flushQueuedSaveOnLifecycle();
            }
        });
    }
    
    /**
     * Initialize Firebase
     */
    function init() {
        try {
            if (!firebaseConfig) {
                throw new Error('Firebase configuration not loaded. Please create firebase-config.js');
            }
            
            firebase.initializeApp(firebaseConfig);
            auth = firebase.auth();
            db = firebase.firestore();
            bindSaveLifecycleHandlers();
            
            // Set up auth state observer
            auth.onAuthStateChanged(handleAuthStateChanged);
            
            console.log('✅ Firebase initialized successfully');
            return true;
        } catch (error) {
            console.error('❌ Firebase initialization failed:', error);
            return false;
        }
    }
    
    /**
     * Handle authentication state changes
     */
    function handleAuthStateChanged(user) {
        currentUser = user;
        if (!user) {
            stopAllianceDocListener();
        }
        
        if (user) {
            if (isPasswordProvider(user) && !user.emailVerified) {
                console.warn('Email not verified. Signing out.');
                auth.signOut();
                if (onAuthCallback) {
                    onAuthCallback(false, null);
                }
                return;
            }

            console.log('✅ User signed in:', user.email);
            resetSaveState();
            loadUserData(user);
            
            if (onAuthCallback) {
                onAuthCallback(true, user);
            }
        } else {
            console.log('ℹ️ User signed out');
            playerDatabase = {};
            eventData = ensureLegacyEventEntries(createEmptyEventData());
            allianceId = null;
            allianceName = null;
            allianceData = null;
            playerSource = 'personal';
            pendingInvitations = [];
            sentInvitations = [];
            invitationNotifications = [];
            userProfile = normalizeUserProfile(null);
            setGlobalDefaultPositions(emptyGlobalEventPositions(), 0);
            setGlobalDefaultBuildingConfig(emptyGlobalBuildingConfig(), 0);
            migrationVersion = 0;
            migratedToGameSubcollectionsAt = null;
            resetSaveState();

            if (onAuthCallback) {
                onAuthCallback(false, null);
            }
        }
    }
    
    /**
     * Set callback for auth state changes
     */
    function setAuthCallback(callback) {
        onAuthCallback = callback;
    }
    
    /**
     * Set callback for data load
     */
    function setDataLoadCallback(callback) {
        onDataLoadCallback = callback;
    }

    function setAllianceDataCallback(callback) {
        onAllianceDataCallback = callback;
    }

    function emitAllianceDataUpdate() {
        if (typeof onAllianceDataCallback === 'function') {
            onAllianceDataCallback(allianceData);
        }
    }

    function stopAllianceDocListener() {
        if (typeof allianceDocUnsubscribe === 'function') {
            allianceDocUnsubscribe();
        }
        allianceDocUnsubscribe = null;
    }

    function startAllianceDocListener() {
        stopAllianceDocListener();
        if (!db || !currentUser || !allianceId) {
            return;
        }

        const currentAllianceId = allianceId;
        allianceDocUnsubscribe = db.collection('alliances').doc(currentAllianceId).onSnapshot((doc) => {
            if (!currentUser || allianceId !== currentAllianceId) {
                return;
            }

            if (!doc.exists) {
                allianceId = null;
                allianceName = null;
                allianceData = null;
                if (playerSource === 'alliance') {
                    playerSource = 'personal';
                }
                stopAllianceDocListener();
                emitAllianceDataUpdate();
                return;
            }

            const data = doc.data() || {};
            if (!data.members || !data.members[currentUser.uid]) {
                allianceId = null;
                allianceName = null;
                allianceData = null;
                if (playerSource === 'alliance') {
                    playerSource = 'personal';
                }
                stopAllianceDocListener();
                emitAllianceDataUpdate();
                return;
            }

            allianceData = data;
            if (typeof data.name === 'string' && data.name.trim()) {
                allianceName = data.name.trim();
            }
            emitAllianceDataUpdate();
        }, (error) => {
            console.warn('Alliance listener error:', error);
        });
    }
    
    
    function isPasswordProvider(user) {
        if (!user || !user.providerData) {
            return false;
        }
        return user.providerData.some((provider) => provider.providerId === 'password');
    }

    // ============================================================
    // AUTHENTICATION FUNCTIONS
    // ============================================================
    
    /**
     * Sign in with Google
     */
    async function signInWithGoogle() {
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            const result = await auth.signInWithPopup(provider);
            console.log('✅ Google sign-in successful');
            return { success: true, user: result.user };
        } catch (error) {
            console.error('❌ Google sign-in failed:', error);
            const popupErrorCodes = new Set([
                'auth/popup-blocked',
                'auth/popup-closed-by-user',
                'auth/cancelled-popup-request',
                'auth/operation-not-supported-in-this-environment',
            ]);

            if (error && popupErrorCodes.has(error.code)) {
                try {
                    const provider = new firebase.auth.GoogleAuthProvider();
                    await auth.signInWithRedirect(provider);
                    console.log('🔁 Falling back to redirect sign-in');
                    return { success: true, redirect: true };
                } catch (redirectError) {
                    console.error('❌ Redirect sign-in failed:', redirectError);
                    return { success: false, error: redirectError.message || 'Redirect sign-in failed' };
                }
            }

            return { success: false, error: error.message || 'Google sign-in failed' };
        }
    }
    
    /**
     * Sign in with email and password
     */
    async function signInWithEmail(email, password) {
        try {
            const result = await auth.signInWithEmailAndPassword(email, password);

            if (!result.user.emailVerified) {
                await auth.signOut();
                return { success: false, error: 'Email not verified. Check your inbox.' };
            }
            console.log('✅ Email sign-in successful');
            return { success: true, user: result.user };
        } catch (error) {
            console.error('❌ Email sign-in failed:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Sign up with email and password
     */
    async function signUpWithEmail(email, password) {
        try {
            const result = await auth.createUserWithEmailAndPassword(email, password);
            await result.user.sendEmailVerification();
            console.log('✅ Account created successfully');
            return { 
                success: true, 
                user: result.user,
                message: 'Account created! Please check your email for verification.' 
            };
        } catch (error) {
            console.error('❌ Sign-up failed:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Send password reset email
     */
    async function resetPassword(email) {
        try {
            await auth.sendPasswordResetEmail(email);
            console.log('✅ Password reset email sent');
            return { 
                success: true, 
                message: 'Password reset email sent. Check your inbox.' 
            };
        } catch (error) {
            console.error('❌ Password reset failed:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Sign out current user
     */
    async function signOut() {
        try {
            await auth.signOut();
            console.log('✅ User signed out');
            return { success: true };
        } catch (error) {
            console.error('❌ Sign-out failed:', error);
            return { success: false, error: error.message };
        }
    }

    function isReauthRequiredError(error) {
        const code = error && error.code ? String(error.code) : '';
        return code === 'auth/requires-recent-login' || code === 'auth/user-token-expired';
    }

    async function deleteDocsByRefs(refs) {
        if (!Array.isArray(refs) || refs.length === 0) {
            return;
        }
        const chunkSize = 400;
        for (let i = 0; i < refs.length; i += chunkSize) {
            const chunk = refs.slice(i, i + chunkSize);
            const batch = db.batch();
            chunk.forEach((ref) => {
                batch.delete(ref);
            });
            await batch.commit();
        }
    }

    async function collectInvitationRefs(uid, emailLower) {
        const refMap = new Map();
        if (!db) {
            return [];
        }
        if (uid) {
            const byInviter = await db.collection('invitations')
                .where('invitedBy', '==', uid)
                .get();
            byInviter.docs.forEach((doc) => refMap.set(doc.id, doc.ref));
        }
        if (emailLower) {
            const byInvitee = await db.collection('invitations')
                .where('invitedEmail', '==', emailLower)
                .get();
            byInvitee.docs.forEach((doc) => refMap.set(doc.id, doc.ref));
        }
        return Array.from(refMap.values());
    }

    async function cleanupAllianceMembership(uid, emailLower) {
        if (!allianceId || !uid) {
            return;
        }
        try {
            const allianceRef = db.collection('alliances').doc(allianceId);
            const snap = await allianceRef.get();
            if (!snap.exists) {
                return;
            }
            const data = snap.data() || {};
            const members = data.members && typeof data.members === 'object' ? data.members : {};
            const memberIds = Object.keys(members);
            const onlyCurrentMember = memberIds.length === 1 && memberIds[0] === uid;
            if (onlyCurrentMember && data.createdBy === uid) {
                await allianceRef.delete();
                return;
            }
            const memberPath = `members.${uid}`;
            await allianceRef.update({
                [memberPath]: firebase.firestore.FieldValue.delete()
            });
        } catch (error) {
            console.warn('Failed to clean alliance membership during account deletion:', error.message || error);
        }
    }

    async function deleteUserAccountAndData() {
        const authUser = (auth && auth.currentUser) || currentUser;
        if (!authUser) {
            return { success: false, error: 'No user signed in' };
        }

        const uid = authUser.uid;
        const email = authUser.email || '';
        const emailLower = email ? email.toLowerCase() : '';
        const dataDeletionErrors = [];

        try {
            await cleanupAllianceMembership(uid, emailLower);
        } catch (error) {
            dataDeletionErrors.push(error);
        }

        try {
            const invitationRefs = await collectInvitationRefs(uid, emailLower);
            await deleteDocsByRefs(invitationRefs);
        } catch (error) {
            dataDeletionErrors.push(error);
        }

        try {
            const userDocIds = Array.from(new Set([uid, email, emailLower].filter(Boolean)));
            for (const docId of userDocIds) {
                try {
                    await db.collection('users').doc(docId).delete();
                } catch (error) {
                    if (docId === uid) {
                        throw error;
                    }
                    console.warn(`Skipping optional user doc delete (${docId}):`, error.message || error);
                }
            }
        } catch (error) {
            dataDeletionErrors.push(error);
        }

        playerDatabase = {};
        eventData = ensureLegacyEventEntries(createEmptyEventData());
        stopAllianceDocListener();
        allianceId = null;
        allianceName = null;
        allianceData = null;
        playerSource = 'personal';
        pendingInvitations = [];
        sentInvitations = [];
        invitationNotifications = [];
        userProfile = normalizeUserProfile(null);
        setGlobalDefaultPositions(emptyGlobalEventPositions(), 0);
        setGlobalDefaultBuildingConfig(emptyGlobalBuildingConfig(), 0);
        migrationVersion = 0;
        migratedToGameSubcollectionsAt = null;
        resetSaveState();

        try {
            await authUser.delete();
            return { success: dataDeletionErrors.length === 0, dataDeleted: true, accountDeleted: true };
        } catch (error) {
            if (isReauthRequiredError(error)) {
                try {
                    await auth.signOut();
                } catch (signOutError) {
                    console.warn('Failed to sign out after reauth-required delete:', signOutError.message || signOutError);
                }
                return {
                    success: false,
                    dataDeleted: true,
                    accountDeleted: false,
                    reauthRequired: true,
                    error: error.message,
                };
            }
            return {
                success: false,
                dataDeleted: dataDeletionErrors.length === 0,
                accountDeleted: false,
                error: error.message,
            };
        }
    }
    
    /**
     * Get current user
     */
    function getCurrentUser() {
        return currentUser;
    }
    
    /**
     * Check if user is signed in
     */
    function isSignedIn() {
        return currentUser !== null;
    }
    
    // ============================================================
    // DATABASE FUNCTIONS
    // ============================================================
    
    /**
     * Load user data from Firestore
     */
    async function loadUserData(user) {
        try {
            console.log('Loading data for UID:', user.uid);
            const userDocRef = db.collection('users').doc(user.uid);
            const gameDocRef = getUserGameDocRef(user.uid, DEFAULT_GAME_ID);
            const [legacyDoc, gameDoc] = await Promise.all([
                userDocRef.get(),
                gameDocRef ? gameDocRef.get() : Promise.resolve({ exists: false, data: () => ({}) })
            ]);

            const legacyData = legacyDoc.exists ? (legacyDoc.data() || {}) : null;
            const gameScopedData = gameDoc && gameDoc.exists ? (gameDoc.data() || {}) : null;
            updateMigrationMarkersFromUserData(legacyData);
            const resolvedRead = resolveGameScopedReadPayload({
                gameId: DEFAULT_GAME_ID,
                gameData: gameScopedData,
                legacyData: legacyData,
            });

            if (resolvedRead.data) {
                const data = resolvedRead.data;
                let shouldPersistLegacyDefaults = false;
                playerDatabase = data.playerDatabase || {};
                allianceId = data.allianceId || null;
                allianceName = data.allianceName || null;
                playerSource = data.playerSource || 'personal';
                userProfile = normalizeUserProfile(data.userProfile || data.profile || null);

                if (
                    resolvedRead.source === 'game'
                    && (migrationVersion < GAME_SUBCOLLECTION_MIGRATION_VERSION || !migratedToGameSubcollectionsAt)
                ) {
                    try {
                        await userDocRef.set({
                            migrationVersion: GAME_SUBCOLLECTION_MIGRATION_VERSION,
                            migratedToGameSubcollectionsAt: firebase.firestore.FieldValue.serverTimestamp(),
                            lastActiveGameId: DEFAULT_GAME_ID,
                        }, { merge: true });
                        migrationVersion = GAME_SUBCOLLECTION_MIGRATION_VERSION;
                        migratedToGameSubcollectionsAt = new Date().toISOString();
                    } catch (markerErr) {
                        console.warn('⚠️ Failed to persist game-subcollection migration markers:', markerErr);
                    }
                }

                // Load per-event building data
                if (data.events && typeof data.events === 'object') {
                    eventData = normalizeEventsMap(data.events);
                    const ensuredLegacy = ensureLegacyEventEntriesWithDefaults(eventData);
                    eventData = ensuredLegacy.events;
                    shouldPersistLegacyDefaults = ensuredLegacy.changed;
                } else if (
                    Array.isArray(data.buildingConfig)
                    || (data.buildingPositions && typeof data.buildingPositions === 'object')
                    || typeof data.buildingConfigVersion === 'number'
                ) {
                    // Migration: old top-level fields → move to events.desert_storm
                    console.log('🔄 Migrating old building data to per-event schema...');
                    eventData = ensureLegacyEventEntries(createEmptyEventData());
                    eventData.desert_storm = sanitizeEventEntry('desert_storm', {
                        name: getDefaultEventName('desert_storm'),
                        buildingConfig: Array.isArray(data.buildingConfig) ? data.buildingConfig : null,
                        buildingConfigVersion: typeof data.buildingConfigVersion === 'number' ? data.buildingConfigVersion : 0,
                        buildingPositions: data.buildingPositions && typeof data.buildingPositions === 'object' ? data.buildingPositions : null,
                        buildingPositionsVersion: typeof data.buildingPositionsVersion === 'number' ? data.buildingPositionsVersion : 0
                    }, eventData.desert_storm);
                    // Save migrated data and remove old top-level fields
                    try {
                        const batch = db.batch();
                        batch.set(userDocRef, {
                            events: buildEventsWithoutMedia(eventData)
                        }, { merge: true });
                        batch.update(userDocRef, {
                            buildingConfig: firebase.firestore.FieldValue.delete(),
                            buildingConfigVersion: firebase.firestore.FieldValue.delete(),
                            buildingPositions: firebase.firestore.FieldValue.delete(),
                            buildingPositionsVersion: firebase.firestore.FieldValue.delete()
                        });
                        await batch.commit();
                        console.log('✅ Migration complete');
                    } catch (migErr) {
                        console.warn('⚠️ Migration save failed (will retry next load):', migErr);
                    }
                } else {
                    // No building data at all — reset
                    const ensuredLegacy = ensureLegacyEventEntriesWithDefaults(createEmptyEventData());
                    eventData = ensuredLegacy.events;
                    shouldPersistLegacyDefaults = ensuredLegacy.changed;
                }

                const inlineMedia = getEventMediaMap(eventData);
                const storedMedia = await loadEventMediaForUser(user.uid);
                const mergedMedia = Object.assign({}, inlineMedia, storedMedia);
                eventData = buildEventsWithoutMedia(eventData);
                applyEventMediaToEvents(mergedMedia);

                if (Object.keys(inlineMedia).length > 0) {
                    shouldPersistLegacyDefaults = true;
                    try {
                        await saveEventMediaDiff(user.uid, storedMedia, mergedMedia);
                        console.log('✅ Migrated inline event media to subcollection docs');
                    } catch (mediaErr) {
                        console.warn('⚠️ Failed to migrate inline event media:', mediaErr);
                    }
                }

                if (shouldPersistLegacyDefaults) {
                    try {
                        await userDocRef.set({
                            events: buildEventsWithoutMedia(eventData),
                        }, { merge: true });
                        console.log('✅ Legacy default events enforced for user');
                    } catch (defaultErr) {
                        console.warn('⚠️ Failed to persist legacy default events:', defaultErr);
                    }
                }

                await loadGlobalDefaultBuildingPositions();
                await loadGlobalDefaultBuildingConfig();
                await maybePublishGlobalDefaultsFromCurrentUser(data);
                await maybePublishGlobalBuildingConfigFromCurrentUser(data);
                const appliedSharedDefaults = applyGlobalDefaultBuildingConfigToEventData({
                    eventIds: LEGACY_EVENT_IDS,
                    overwriteExisting: false,
                });
                if (appliedSharedDefaults) {
                    shouldPersistLegacyDefaults = true;
                }

                console.log(`✅ Loaded ${Object.keys(playerDatabase).length} players`);

                if (allianceId) {
                    await loadAllianceData();
                }
                await checkInvitations();
                rememberLastSavedUserState();

                if (onDataLoadCallback) {
                    onDataLoadCallback(playerDatabase);
                }

                return {
                    success: true,
                    data: playerDatabase,
                    playerCount: Object.keys(playerDatabase).length
                };
            } else {
                console.log('ℹ️ No existing data found');
                playerDatabase = {};
                eventData = ensureLegacyEventEntries(createEmptyEventData());
                allianceId = null;
                allianceName = null;
                playerSource = 'personal';
                userProfile = normalizeUserProfile(null);
                migrationVersion = 0;
                migratedToGameSubcollectionsAt = null;
                await loadGlobalDefaultBuildingPositions();
                await loadGlobalDefaultBuildingConfig();
                applyGlobalDefaultBuildingConfigToEventData({
                    eventIds: LEGACY_EVENT_IDS,
                    overwriteExisting: true,
                });
                await checkInvitations();
                rememberLastSavedUserState();
                return { success: true, data: {}, playerCount: 0 };
            }
        } catch (error) {
            console.error('❌ Failed to load data:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Save user data to Firestore
     */
    async function persistChangedUserData() {
        if (!currentUser) {
            return { success: false, error: 'No user signed in' };
        }

        const currentState = getCurrentPersistedUserState();
        const payload = {};
        const changedFields = [];

        if (!lastSavedUserState || !areJsonEqual(lastSavedUserState.playerDatabase, currentState.playerDatabase)) {
            payload.playerDatabase = currentState.playerDatabase;
            changedFields.push('playerDatabase');
        }
        if (!lastSavedUserState || !areJsonEqual(lastSavedUserState.events, currentState.events)) {
            payload.events = currentState.events;
            changedFields.push('events');
        }
        const mediaChanged = !lastSavedUserState || !areJsonEqual(lastSavedUserState.eventMedia, currentState.eventMedia);
        if (mediaChanged) {
            changedFields.push('eventMedia');
        }
        if (!lastSavedUserState || !areJsonEqual(lastSavedUserState.userProfile, currentState.userProfile)) {
            payload.userProfile = currentState.userProfile;
            changedFields.push('userProfile');
        }

        const hasDocPayload = Object.keys(payload).length > 0;
        if (!hasDocPayload && !mediaChanged) {
            return { success: true, skipped: true };
        }

        if (hasDocPayload) {
            payload.metadata = {
                email: currentUser.email || null,
                emailLower: currentUser.email ? currentUser.email.toLowerCase() : null,
                totalPlayers: Object.keys(currentState.playerDatabase).length,
                lastModified: firebase.firestore.FieldValue.serverTimestamp()
            };
            if (changedFields.includes('playerDatabase')) {
                payload.metadata.lastUpload = new Date().toISOString();
            }
        }

        try {
            console.log(`💾 Saving data (${changedFields.join(', ')})...`);
            if (hasDocPayload) {
                await db.collection('users').doc(currentUser.uid).set(payload, { merge: true });
            }
            if (mediaChanged) {
                const previousMedia = lastSavedUserState && lastSavedUserState.eventMedia ? lastSavedUserState.eventMedia : {};
                await saveEventMediaDiff(currentUser.uid, previousMedia, currentState.eventMedia);
            }
            rememberLastSavedUserState(currentState);
            return { success: true, changedFields };
        } catch (error) {
            console.error('❌ Failed to save data:', error);
            return { success: false, error: error.message };
        }
    }

    async function flushQueuedSave() {
        if (!pendingSavePromise) {
            return;
        }
        saveDebounceTimer = null;
        const resolve = pendingSaveResolve;
        pendingSaveResolve = null;
        const result = await persistChangedUserData();
        pendingSavePromise = null;
        if (typeof resolve === 'function') {
            resolve(result);
        }
    }

    async function saveUserData(options) {
        if (!currentUser) {
            return { success: false, error: 'No user signed in' };
        }

        const immediate = !!(options && options.immediate === true);

        if (!pendingSavePromise) {
            pendingSavePromise = new Promise((resolve) => {
                pendingSaveResolve = resolve;
            });
        }

        if (immediate) {
            if (saveDebounceTimer) {
                clearTimeout(saveDebounceTimer);
                saveDebounceTimer = null;
            }
            flushQueuedSave();
        } else if (!saveDebounceTimer) {
            saveDebounceTimer = setTimeout(flushQueuedSave, SAVE_DEBOUNCE_MS);
        }

        return pendingSavePromise;
    }
    
    /**
     * Upload player database from Excel
     */
    async function uploadPlayerDatabase(file) {
        return new Promise((resolve, reject) => {
            if (!file || file.size > MAX_UPLOAD_BYTES) {
                reject({ success: false, error: 'File too large (max 5MB)' });
                return;
            }

            const reader = new FileReader();
            
            reader.onload = async (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, {type: 'array'});
                    
                    // Check if Players sheet exists
                    if (!workbook.Sheets['Players']) {
                        reject({ success: false, error: 'Excel file must contain a "Players" sheet' });
                        return;
                    }
                    
                    const sheet = workbook.Sheets['Players'];
                    // Headers at row 10, so start reading from row 10 (0-indexed = 9)
                    const players = XLSX.utils.sheet_to_json(sheet, {range: 9});
                    
                    const nextDatabase = {};
                    let skippedCount = 0;
                    const skippedPlayers = [];
                    const nowIso = new Date().toISOString();
                    
                    players.forEach(row => {
                        const name = normalizeEditablePlayerName(row['Player Name']);
                        const power = row['E1 Total Power(M)'];
                        const troops = row['E1 Troops'];
                        
                        // Only require name (power and troops are optional)
                        if (name) {
                            nextDatabase[name] = {
                                power: normalizeEditablePlayerPower(power), // Default to 0 if power missing
                                troops: normalizeEditablePlayerTroops(troops), // Default to 'Unknown' if troops missing
                                lastUpdated: nowIso,
                            };
                        } else {
                            // Track skipped players (only if name is missing)
                            skippedCount++;
                            skippedPlayers.push(`Row with no name (power: ${power || 'none'}, troops: ${troops || 'none'})`);
                        }
                    });

                    const addedCount = Object.keys(nextDatabase).length;
                    if (addedCount > MAX_PLAYER_DATABASE_SIZE) {
                        reject({
                            success: false,
                            errorKey: 'players_list_error_max_players',
                            errorParams: { max: MAX_PLAYER_DATABASE_SIZE },
                            error: `Maximum ${MAX_PLAYER_DATABASE_SIZE} players allowed.`,
                        });
                        return;
                    }

                    // Replace existing database with parsed data.
                    playerDatabase = nextDatabase;
                    
                    // Save to Firestore
                    const saveResult = await saveUserData();
                    
                    if (saveResult.success) {
                        console.log(`✅ Uploaded ${addedCount} players`);
                        if (skippedCount > 0) {
                            console.warn(`⚠️ Skipped ${skippedCount} rows with no player name:`, skippedPlayers);
                        }
                        
                        let message = `✅ ${addedCount} players stored in cloud`;
                        if (skippedCount > 0) {
                            message += ` (${skippedCount} skipped - missing name)`;
                        }
                        
                        resolve({ 
                            success: true, 
                            playerCount: addedCount,
                            skippedCount: skippedCount,
                            message: message
                        });
                    } else {
                        reject(saveResult);
                    }
                    
                } catch (error) {
                    console.error('❌ Failed to process Excel file:', error);
                    reject({ success: false, error: error.message });
                }
            };
            
            reader.onerror = () => {
                reject({ success: false, error: 'Failed to read file' });
            };
            
            reader.readAsArrayBuffer(file);
        });
    }
    
    /**
     * Get player database
     */
    function getPlayerDatabase() {
        return playerDatabase;
    }

    function resolveEventId(eventId) {
        const normalized = normalizeEventId(eventId || '');
        return normalized || 'desert_storm';
    }

    function ensureEventEntry(eventId, seed) {
        const eid = resolveEventId(eventId);
        if (!eventData[eid]) {
            eventData[eid] = sanitizeEventEntry(eid, seed || {}, createEmptyEventEntry({ name: getDefaultEventName(eid) }));
        } else if (!eventData[eid].name) {
            eventData[eid].name = getDefaultEventName(eid);
        }
        return eid;
    }

    function getAllEventData() {
        return JSON.parse(JSON.stringify(eventData));
    }

    function getEventIds() {
        return Object.keys(eventData);
    }

    function getEventMeta(eventId) {
        const eid = resolveEventId(eventId);
        const entry = eventData[eid];
        if (!entry) {
            return null;
        }
        return {
            id: eid,
            name: entry.name || getDefaultEventName(eid),
            logoDataUrl: entry.logoDataUrl || '',
            mapDataUrl: entry.mapDataUrl || '',
        };
    }

    function upsertEvent(eventId, payload) {
        const requestedId = resolveEventId(eventId || (payload && payload.id) || (payload && payload.name));
        const existing = eventData[requestedId] || createEmptyEventEntry({ name: getDefaultEventName(requestedId) });
        const sanitized = sanitizeEventEntry(requestedId, payload || {}, existing);
        eventData[requestedId] = sanitized;
        return getEventMeta(requestedId);
    }

    function removeEvent(eventId) {
        const eid = resolveEventId(eventId);
        if (LEGACY_EVENT_IDS.includes(eid)) {
            return false;
        }
        if (!Object.prototype.hasOwnProperty.call(eventData, eid)) {
            return false;
        }
        delete eventData[eid];
        return true;
    }

    /**
     * Get building configuration for an event
     */
    function getBuildingConfig(eventId) {
        const eid = ensureEventEntry(eventId);
        return eventData[eid] ? eventData[eid].buildingConfig : null;
    }

    /**
     * Set building configuration for an event
     */
    function setBuildingConfig(eventId, config) {
        const eid = ensureEventEntry(eventId);
        eventData[eid].buildingConfig = normalizeBuildingConfigArray(config);
    }

    function getBuildingConfigVersion(eventId) {
        const eid = ensureEventEntry(eventId);
        return eventData[eid] ? eventData[eid].buildingConfigVersion : 0;
    }

    function setBuildingConfigVersion(eventId, version) {
        const eid = ensureEventEntry(eventId);
        const numeric = Number(version);
        eventData[eid].buildingConfigVersion = Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : 0;
    }

    /**
     * Get building positions for an event
     */
    function getBuildingPositions(eventId) {
        const eid = ensureEventEntry(eventId);
        return eventData[eid] ? eventData[eid].buildingPositions : null;
    }

    /**
     * Set building positions for an event
     */
    function setBuildingPositions(eventId, positions) {
        const eid = ensureEventEntry(eventId);
        eventData[eid].buildingPositions = normalizePositionsMap(positions);
    }

    function getBuildingPositionsVersion(eventId) {
        const eid = ensureEventEntry(eventId);
        return eventData[eid] ? eventData[eid].buildingPositionsVersion : 0;
    }

    function setBuildingPositionsVersion(eventId, version) {
        const eid = ensureEventEntry(eventId);
        const numeric = Number(version);
        eventData[eid].buildingPositionsVersion = Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : 0;
    }

    function setEventMetadata(eventId, metadata) {
        const eid = ensureEventEntry(eventId, metadata);
        const source = metadata && typeof metadata === 'object' ? metadata : {};
        const current = eventData[eid] || createEmptyEventEntry({ name: getDefaultEventName(eid) });
        eventData[eid] = sanitizeEventEntry(eid, {
            name: Object.prototype.hasOwnProperty.call(source, 'name') ? source.name : current.name,
            logoDataUrl: Object.prototype.hasOwnProperty.call(source, 'logoDataUrl') ? source.logoDataUrl : current.logoDataUrl,
            mapDataUrl: Object.prototype.hasOwnProperty.call(source, 'mapDataUrl') ? source.mapDataUrl : current.mapDataUrl,
            buildingConfig: current.buildingConfig,
            buildingConfigVersion: current.buildingConfigVersion,
            buildingPositions: current.buildingPositions,
            buildingPositionsVersion: current.buildingPositionsVersion,
        }, current);
        return getEventMeta(eid);
    }

    /**
     * Get player count
     */
    function getPlayerCount() {
        return Object.keys(playerDatabase).length;
    }
    
    /**
     * Get player by name
     */
    function getPlayer(name) {
        return playerDatabase[name] || null;
    }

    function normalizeEditablePlayerName(name) {
        return typeof name === 'string' ? name.trim() : '';
    }

    function normalizeEditablePlayerPower(power) {
        const parsed = Number(power);
        if (!Number.isFinite(parsed) || parsed < 0) {
            return 0;
        }
        return parsed;
    }

    function normalizeEditablePlayerTroops(troops) {
        const value = typeof troops === 'string' ? troops.trim() : '';
        if (value === 'Tank' || value === 'Aero' || value === 'Missile') {
            return value;
        }
        return 'Unknown';
    }

    function getMutablePlayerDatabaseForSource(source) {
        if (source === 'personal') {
            return { ...playerDatabase };
        }
        if (source === 'alliance') {
            if (!allianceData || typeof allianceData !== 'object' || !allianceData.playerDatabase || typeof allianceData.playerDatabase !== 'object') {
                return {};
            }
            return { ...allianceData.playerDatabase };
        }
        return null;
    }

    async function persistPlayerDatabaseForSource(source, nextDatabase) {
        if (source === 'personal') {
            const previousDatabase = playerDatabase;
            playerDatabase = nextDatabase;
            const saveResult = await saveUserData({ immediate: true });
            if (!saveResult.success) {
                playerDatabase = previousDatabase;
                return saveResult;
            }
            return { success: true };
        }

        if (source === 'alliance') {
            if (!currentUser || !allianceId) {
                return { success: false, errorKey: 'players_list_error_no_alliance' };
            }
            await db.collection('alliances').doc(allianceId).set({
                playerDatabase: nextDatabase,
                metadata: {
                    totalPlayers: Object.keys(nextDatabase).length,
                    lastModified: firebase.firestore.FieldValue.serverTimestamp(),
                },
            }, { merge: true });

            if (!allianceData || typeof allianceData !== 'object') {
                allianceData = {};
            }
            allianceData.playerDatabase = nextDatabase;
            if (!allianceData.metadata || typeof allianceData.metadata !== 'object') {
                allianceData.metadata = {};
            }
            allianceData.metadata.totalPlayers = Object.keys(nextDatabase).length;
            allianceData.metadata.lastModified = new Date().toISOString();
            return { success: true };
        }

        return { success: false, errorKey: 'players_list_error_invalid_source' };
    }

    async function upsertPlayerEntry(source, originalName, nextPlayer) {
        if (!currentUser) {
            return { success: false, error: 'No user signed in' };
        }

        const normalizedSource = source === 'alliance' ? 'alliance' : (source === 'personal' ? 'personal' : '');
        if (!normalizedSource) {
            return { success: false, errorKey: 'players_list_error_invalid_source' };
        }
        if (normalizedSource === 'alliance' && (!allianceId || !allianceData)) {
            return { success: false, errorKey: 'players_list_error_no_alliance' };
        }

        const previousName = normalizeEditablePlayerName(originalName);
        const nextName = normalizeEditablePlayerName(nextPlayer && nextPlayer.name);
        if (!nextName) {
            return { success: false, errorKey: 'players_list_error_name_required' };
        }

        const power = normalizeEditablePlayerPower(nextPlayer && nextPlayer.power);
        const troops = normalizeEditablePlayerTroops(nextPlayer && nextPlayer.troops);
        const nowIso = new Date().toISOString();

        const nextDatabase = getMutablePlayerDatabaseForSource(normalizedSource);
        if (!nextDatabase || typeof nextDatabase !== 'object') {
            return { success: false, errorKey: 'players_list_error_invalid_source' };
        }

        if (previousName && !Object.prototype.hasOwnProperty.call(nextDatabase, previousName)) {
            return { success: false, errorKey: 'players_list_error_not_found' };
        }

        if (previousName !== nextName && Object.prototype.hasOwnProperty.call(nextDatabase, nextName)) {
            return { success: false, errorKey: 'players_list_error_duplicate_name' };
        }

        const isAddingNewPlayer = !previousName && !Object.prototype.hasOwnProperty.call(nextDatabase, nextName);
        if (isAddingNewPlayer && Object.keys(nextDatabase).length >= MAX_PLAYER_DATABASE_SIZE) {
            return {
                success: false,
                errorKey: 'players_list_error_max_players',
                errorParams: { max: MAX_PLAYER_DATABASE_SIZE },
            };
        }

        if (previousName && previousName !== nextName) {
            delete nextDatabase[previousName];
        }

        nextDatabase[nextName] = {
            power: power,
            troops: troops,
            lastUpdated: nowIso,
        };

        const persistResult = await persistPlayerDatabaseForSource(normalizedSource, nextDatabase);
        if (!persistResult.success) {
            return persistResult;
        }

        return { success: true, name: nextName, source: normalizedSource };
    }

    async function removePlayerEntry(source, playerName) {
        if (!currentUser) {
            return { success: false, error: 'No user signed in' };
        }

        const normalizedSource = source === 'alliance' ? 'alliance' : (source === 'personal' ? 'personal' : '');
        if (!normalizedSource) {
            return { success: false, errorKey: 'players_list_error_invalid_source' };
        }
        if (normalizedSource === 'alliance' && (!allianceId || !allianceData)) {
            return { success: false, errorKey: 'players_list_error_no_alliance' };
        }

        const normalizedName = normalizeEditablePlayerName(playerName);
        if (!normalizedName) {
            return { success: false, errorKey: 'players_list_error_not_found' };
        }

        const nextDatabase = getMutablePlayerDatabaseForSource(normalizedSource);
        if (!nextDatabase || typeof nextDatabase !== 'object') {
            return { success: false, errorKey: 'players_list_error_invalid_source' };
        }
        if (!Object.prototype.hasOwnProperty.call(nextDatabase, normalizedName)) {
            return { success: false, errorKey: 'players_list_error_not_found' };
        }

        delete nextDatabase[normalizedName];
        const persistResult = await persistPlayerDatabaseForSource(normalizedSource, nextDatabase);
        if (!persistResult.success) {
            return persistResult;
        }

        return { success: true, name: normalizedName, source: normalizedSource };
    }
    
    // ============================================================
    // ALLIANCE FUNCTIONS
    // ============================================================

    async function createAlliance(name) {
        if (!currentUser) return { success: false, error: 'Not signed in' };
        if (!name || name.length > 40) return { success: false, error: 'Name must be 1-40 characters' };

        try {
            const members = {};
            members[currentUser.uid] = {
                email: currentUser.email,
                joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
                role: 'member'
            };

            const docRef = await db.collection('alliances').add({
                name: name,
                createdBy: currentUser.uid,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                members: members,
                playerDatabase: {},
                metadata: {
                    totalPlayers: 0,
                    lastUpload: null,
                    lastModified: firebase.firestore.FieldValue.serverTimestamp()
                }
            });

            const id = docRef.id;
            allianceId = id;
            allianceName = name;
            await db.collection('users').doc(currentUser.uid).set({
                allianceId: id,
                allianceName: name
            }, { merge: true });

            await loadAllianceData();
            return { success: true, allianceId: id };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async function loadAllianceData() {
        if (!currentUser || !allianceId) {
            stopAllianceDocListener();
            allianceData = null;
            emitAllianceDataUpdate();
            return;
        }
        try {
            const doc = await db.collection('alliances').doc(allianceId).get();
            if (doc.exists) {
                allianceData = doc.data();
                if (!allianceData.members || !allianceData.members[currentUser.uid]) {
                    stopAllianceDocListener();
                    allianceId = null;
                    allianceName = null;
                    allianceData = null;
                    playerSource = 'personal';
                    await db.collection('users').doc(currentUser.uid).set({
                        allianceId: null, allianceName: null, playerSource: 'personal'
                    }, { merge: true });
                    emitAllianceDataUpdate();
                } else {
                    if (typeof allianceData.name === 'string' && allianceData.name.trim()) {
                        allianceName = allianceData.name.trim();
                    }
                    startAllianceDocListener();
                    emitAllianceDataUpdate();
                }
            } else {
                stopAllianceDocListener();
                allianceId = null;
                allianceName = null;
                allianceData = null;
                playerSource = 'personal';
                await db.collection('users').doc(currentUser.uid).set({
                    allianceId: null, allianceName: null, playerSource: 'personal'
                }, { merge: true });
                emitAllianceDataUpdate();
            }
        } catch (error) {
            console.error('Failed to load alliance data:', error);
        }
    }

    async function leaveAlliance() {
        if (!currentUser || !allianceId) return { success: false, error: 'Not in an alliance' };

        try {
            const memberPath = `members.${currentUser.uid}`;
            await db.collection('alliances').doc(allianceId).update({
                [memberPath]: firebase.firestore.FieldValue.delete()
            });

            stopAllianceDocListener();
            allianceId = null;
            allianceName = null;
            allianceData = null;
            playerSource = 'personal';

            await db.collection('users').doc(currentUser.uid).set({
                allianceId: null, allianceName: null, playerSource: 'personal'
            }, { merge: true });

            emitAllianceDataUpdate();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    function timestampToMillis(value) {
        if (!value) {
            return 0;
        }
        if (typeof value.toMillis === 'function') {
            return value.toMillis();
        }
        if (typeof value.toDate === 'function') {
            return value.toDate().getTime();
        }
        if (value instanceof Date) {
            return value.getTime();
        }
        if (typeof value === 'number' && Number.isFinite(value)) {
            return value;
        }
        const parsed = new Date(value).getTime();
        return Number.isFinite(parsed) ? parsed : 0;
    }

    function invitationSortKey(invitation) {
        if (!invitation || typeof invitation !== 'object') {
            return 0;
        }
        return timestampToMillis(invitation.lastSentAt) || timestampToMillis(invitation.createdAt);
    }

    function sortInvitationsNewestFirst(a, b) {
        return invitationSortKey(b) - invitationSortKey(a);
    }

    function getInviterDisplayName() {
        const displayName = userProfile && typeof userProfile.displayName === 'string' ? userProfile.displayName.trim() : '';
        if (displayName) {
            return displayName;
        }
        const nickname = userProfile && typeof userProfile.nickname === 'string' ? userProfile.nickname.trim() : '';
        if (nickname) {
            return nickname;
        }
        const providerName = currentUser && typeof currentUser.displayName === 'string' ? currentUser.displayName.trim() : '';
        return providerName || '';
    }

    function isAllianceMemberEmail(email) {
        const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
        if (!normalizedEmail || !allianceData || !allianceData.members || typeof allianceData.members !== 'object') {
            return false;
        }
        return Object.values(allianceData.members).some((member) => {
            const memberEmail = member && typeof member.email === 'string' ? member.email.toLowerCase() : '';
            return memberEmail === normalizedEmail;
        });
    }

    function normalizeInvitationRecord(doc) {
        const data = doc && typeof doc.data === 'function'
            ? (doc.data() || {})
            : (doc && doc.data && typeof doc.data === 'object' ? doc.data : {});
        const resendCountRaw = Number(data.resendCount);
        const maxResendRaw = Number(data.maxResendCount);
        const resendCount = Number.isFinite(resendCountRaw) && resendCountRaw > 0 ? Math.floor(resendCountRaw) : 0;
        const maxResendCount = Number.isFinite(maxResendRaw) && maxResendRaw > 0 ? Math.floor(maxResendRaw) : INVITE_MAX_RESENDS;

        return {
            id: doc && typeof doc.id === 'string' ? doc.id : '',
            allianceId: typeof data.allianceId === 'string' ? data.allianceId : '',
            allianceName: typeof data.allianceName === 'string' ? data.allianceName : '',
            invitedEmail: typeof data.invitedEmail === 'string' ? data.invitedEmail : '',
            invitedBy: typeof data.invitedBy === 'string' ? data.invitedBy : '',
            inviterEmail: typeof data.inviterEmail === 'string' ? data.inviterEmail : '',
            inviterName: typeof data.inviterName === 'string' ? data.inviterName : '',
            status: typeof data.status === 'string' ? data.status : 'pending',
            resendCount: resendCount,
            maxResendCount: maxResendCount,
            createdAt: data.createdAt || null,
            lastSentAt: data.lastSentAt || data.createdAt || null,
            reminderDay1SentAt: data.reminderDay1SentAt || null,
            reminderDay3SentAt: data.reminderDay3SentAt || null,
            respondedAt: data.respondedAt || null,
            revokedAt: data.revokedAt || null,
            updatedAt: data.updatedAt || null,
            _ref: doc && doc.ref ? doc.ref : null,
        };
    }

    function stripInvitationPrivateFields(invitation) {
        if (!invitation || typeof invitation !== 'object') {
            return invitation;
        }
        const clone = { ...invitation };
        delete clone._ref;
        return clone;
    }

    function buildInvitationNotifications(invitations) {
        const notifications = [];
        invitations.forEach((invitation) => {
            if (!invitation || typeof invitation !== 'object') {
                return;
            }
            const invitationId = typeof invitation.id === 'string' ? invitation.id : '';
            if (!invitationId) {
                return;
            }

            const basePayload = {
                invitationId: invitationId,
                allianceId: invitation.allianceId || '',
                allianceName: invitation.allianceName || '',
                invitedEmail: invitation.invitedEmail || '',
                invitedBy: invitation.invitedBy || '',
                inviterEmail: invitation.inviterEmail || '',
                inviterName: invitation.inviterName || '',
            };

            notifications.push({
                ...basePayload,
                id: `invite:${invitationId}`,
                notificationType: 'invitation_pending',
                createdAt: invitation.lastSentAt || invitation.createdAt || null,
            });

            if (timestampToMillis(invitation.reminderDay1SentAt)) {
                notifications.push({
                    ...basePayload,
                    id: `invite:${invitationId}:day1`,
                    notificationType: 'invite_reminder_day1',
                    createdAt: invitation.reminderDay1SentAt,
                });
            }

            if (timestampToMillis(invitation.reminderDay3SentAt)) {
                notifications.push({
                    ...basePayload,
                    id: `invite:${invitationId}:day3`,
                    notificationType: 'invite_reminder_day3',
                    createdAt: invitation.reminderDay3SentAt,
                });
            }
        });

        notifications.sort((a, b) => timestampToMillis(b.createdAt) - timestampToMillis(a.createdAt));
        return notifications;
    }

    async function markPendingInvitationReminders(invitations) {
        if (!Array.isArray(invitations) || invitations.length === 0) {
            return;
        }

        const now = Date.now();
        const writes = [];

        invitations.forEach((invitation) => {
            if (!invitation || invitation.status !== 'pending' || !invitation._ref) {
                return;
            }

            const lastSentMillis = timestampToMillis(invitation.lastSentAt) || timestampToMillis(invitation.createdAt);
            if (!lastSentMillis) {
                return;
            }

            const ageMs = now - lastSentMillis;
            const hasDay1Reminder = timestampToMillis(invitation.reminderDay1SentAt) > 0;
            const hasDay3Reminder = timestampToMillis(invitation.reminderDay3SentAt) > 0;
            const shouldSetDay1 = ageMs >= INVITE_REMINDER_DAY1_MS && !hasDay1Reminder;
            const shouldSetDay3 = ageMs >= INVITE_REMINDER_DAY3_MS && !hasDay3Reminder;

            if (!shouldSetDay1 && !shouldSetDay3) {
                return;
            }

            const payload = {
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            };

            if (shouldSetDay1 || (shouldSetDay3 && !hasDay1Reminder)) {
                payload.reminderDay1SentAt = firebase.firestore.FieldValue.serverTimestamp();
                invitation.reminderDay1SentAt = new Date(now);
            }

            if (shouldSetDay3) {
                payload.reminderDay3SentAt = firebase.firestore.FieldValue.serverTimestamp();
                invitation.reminderDay3SentAt = new Date(now);
            }

            writes.push(invitation._ref.update(payload));
        });

        if (writes.length === 0) {
            return;
        }

        try {
            await Promise.all(writes);
        } catch (error) {
            console.warn('Failed to persist invitation reminder timestamps:', error);
        }
    }

    async function sendInvitation(email) {
        if (!currentUser || !allianceId) return { success: false, error: 'Not in an alliance' };

        const normalizedEmail = email.trim().toLowerCase();
        if (!normalizedEmail) return { success: false, error: 'Email is required' };

        const currentUserEmail = currentUser && typeof currentUser.email === 'string'
            ? currentUser.email.toLowerCase()
            : '';
        if (currentUserEmail && normalizedEmail === currentUserEmail) {
            return { success: false, errorKey: 'alliance_error_invite_self' };
        }
        if (isAllianceMemberEmail(normalizedEmail)) {
            return { success: false, errorKey: 'alliance_error_invitee_already_member' };
        }

        try {
            const existing = await db.collection('invitations')
                .where('allianceId', '==', allianceId)
                .where('invitedEmail', '==', normalizedEmail)
                .where('status', '==', 'pending')
                .get();

            if (!existing.empty) {
                return { success: false, errorKey: 'alliance_invite_pending_exists' };
            }

            const inviteRef = await db.collection('invitations').add({
                allianceId: allianceId,
                allianceName: allianceName,
                invitedEmail: normalizedEmail,
                invitedBy: currentUser.uid,
                inviterEmail: currentUser.email,
                inviterName: getInviterDisplayName(),
                status: 'pending',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastSentAt: firebase.firestore.FieldValue.serverTimestamp(),
                resendCount: 0,
                maxResendCount: INVITE_MAX_RESENDS,
                reminderDay1SentAt: null,
                reminderDay3SentAt: null,
                respondedAt: null,
                revokedAt: null,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            });

            await checkInvitations();
            return { success: true, invitationId: inviteRef.id };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async function checkInvitations() {
        if (!currentUser || !currentUser.email) {
            pendingInvitations = [];
            sentInvitations = [];
            invitationNotifications = [];
            return invitationNotifications;
        }

        try {
            const normalizedEmail = currentUser.email.toLowerCase();
            const pendingReceivedPromise = db.collection('invitations')
                .where('invitedEmail', '==', normalizedEmail)
                .where('status', '==', 'pending')
                .get();
            const pendingSentPromise = db.collection('invitations')
                .where('invitedBy', '==', currentUser.uid)
                .get();

            const [receivedSnapshot, sentSnapshot] = await Promise.all([pendingReceivedPromise, pendingSentPromise]);

            pendingInvitations = receivedSnapshot.docs
                .map((doc) => normalizeInvitationRecord(doc))
                .filter((invite) => invite.status === 'pending')
                .sort(sortInvitationsNewestFirst);
            await markPendingInvitationReminders(pendingInvitations);

            sentInvitations = sentSnapshot.docs
                .map((doc) => normalizeInvitationRecord(doc))
                .filter((invite) => invite.status === 'pending')
                .filter((invite) => !allianceId || invite.allianceId === allianceId)
                .sort(sortInvitationsNewestFirst);

            invitationNotifications = buildInvitationNotifications(pendingInvitations);
            return getInvitationNotifications();
        } catch (error) {
            console.error('Failed to check invitations:', error);
            pendingInvitations = [];
            sentInvitations = [];
            invitationNotifications = [];
            return [];
        }
    }

    async function acceptInvitation(invitationId) {
        if (!currentUser) return { success: false, error: 'Not signed in' };

        try {
            const invDoc = await db.collection('invitations').doc(invitationId).get();
            if (!invDoc.exists) return { success: false, error: 'Invitation not found' };

            const inv = invDoc.data();
            if (inv.status !== 'pending') return { success: false, error: 'Invitation already responded to' };
            const invitedEmail = typeof inv.invitedEmail === 'string' ? inv.invitedEmail.toLowerCase() : '';
            const userEmail = currentUser.email ? currentUser.email.toLowerCase() : '';
            if (!invitedEmail || !userEmail || invitedEmail !== userEmail) {
                return { success: false, error: 'Invitation does not belong to this user' };
            }

            if (allianceId) {
                await leaveAlliance();
            }

            const memberPath = `members.${currentUser.uid}`;
            await db.collection('alliances').doc(inv.allianceId).update({
                [memberPath]: {
                    email: currentUser.email,
                    joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    role: 'member'
                }
            });

            await db.collection('invitations').doc(invitationId).update({
                status: 'accepted',
                respondedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            });

            allianceId = inv.allianceId;
            allianceName = inv.allianceName;
            await db.collection('users').doc(currentUser.uid).set({
                allianceId: inv.allianceId,
                allianceName: inv.allianceName
            }, { merge: true });

            await loadAllianceData();
            await checkInvitations();
            return { success: true, allianceId: inv.allianceId, allianceName: inv.allianceName };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async function rejectInvitation(invitationId) {
        if (!currentUser) return { success: false, error: 'Not signed in' };

        try {
            const invDoc = await db.collection('invitations').doc(invitationId).get();
            if (!invDoc.exists) return { success: false, error: 'Invitation not found' };
            const inv = invDoc.data() || {};
            if (inv.status !== 'pending') return { success: false, error: 'Invitation already responded to' };
            const invitedEmail = typeof inv.invitedEmail === 'string' ? inv.invitedEmail.toLowerCase() : '';
            const userEmail = currentUser.email ? currentUser.email.toLowerCase() : '';
            if (!invitedEmail || !userEmail || invitedEmail !== userEmail) {
                return { success: false, error: 'Invitation does not belong to this user' };
            }

            await db.collection('invitations').doc(invitationId).update({
                status: 'rejected',
                respondedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            });

            await checkInvitations();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async function revokeInvitation(invitationId) {
        if (!currentUser || !allianceId) return { success: false, error: 'Not in an alliance' };

        try {
            const invitationRef = db.collection('invitations').doc(invitationId);
            const invitationDoc = await invitationRef.get();
            if (!invitationDoc.exists) {
                return { success: false, errorKey: 'alliance_invite_not_found' };
            }

            const invitation = invitationDoc.data() || {};
            if (invitation.status !== 'pending') {
                return { success: false, errorKey: 'alliance_invite_not_pending' };
            }
            if (invitation.invitedBy !== currentUser.uid) {
                return { success: false, errorKey: 'alliance_invite_not_owner' };
            }
            if (invitation.allianceId !== allianceId) {
                return { success: false, errorKey: 'alliance_invite_not_owner' };
            }

            await invitationRef.update({
                status: 'revoked',
                revokedAt: firebase.firestore.FieldValue.serverTimestamp(),
                respondedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            });

            await checkInvitations();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async function resendInvitation(invitationId) {
        if (!currentUser || !allianceId) return { success: false, error: 'Not in an alliance' };

        try {
            const invitationRef = db.collection('invitations').doc(invitationId);
            const invitationDoc = await invitationRef.get();
            if (!invitationDoc.exists) {
                return { success: false, errorKey: 'alliance_invite_not_found' };
            }

            const invitation = invitationDoc.data() || {};
            if (invitation.status !== 'pending') {
                return { success: false, errorKey: 'alliance_invite_not_pending' };
            }
            if (invitation.invitedBy !== currentUser.uid) {
                return { success: false, errorKey: 'alliance_invite_not_owner' };
            }
            if (invitation.allianceId !== allianceId) {
                return { success: false, errorKey: 'alliance_invite_not_owner' };
            }

            const resendCountRaw = Number(invitation.resendCount);
            const resendCount = Number.isFinite(resendCountRaw) && resendCountRaw > 0 ? Math.floor(resendCountRaw) : 0;
            if (resendCount >= INVITE_MAX_RESENDS) {
                return {
                    success: false,
                    errorKey: 'alliance_invite_resend_limit',
                    errorParams: { max: INVITE_MAX_RESENDS },
                };
            }

            const nextResendCount = resendCount + 1;
            await invitationRef.update({
                resendCount: nextResendCount,
                maxResendCount: INVITE_MAX_RESENDS,
                inviterEmail: currentUser.email || invitation.inviterEmail || '',
                inviterName: getInviterDisplayName(),
                lastSentAt: firebase.firestore.FieldValue.serverTimestamp(),
                reminderDay1SentAt: null,
                reminderDay3SentAt: null,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            });

            await checkInvitations();
            return {
                success: true,
                resendCount: nextResendCount,
                maxResendCount: INVITE_MAX_RESENDS,
                remainingResends: Math.max(0, INVITE_MAX_RESENDS - nextResendCount),
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async function uploadAlliancePlayerDatabase(file) {
        if (!currentUser || !allianceId) {
            return Promise.reject({ success: false, error: 'Not in an alliance' });
        }

        return new Promise((resolve, reject) => {
            if (!file || file.size > MAX_UPLOAD_BYTES) {
                reject({ success: false, error: 'File too large (max 5MB)' });
                return;
            }

            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });

                    if (!workbook.Sheets['Players']) {
                        reject({ success: false, error: 'Excel file must contain a "Players" sheet' });
                        return;
                    }

                    const sheet = workbook.Sheets['Players'];
                    const players = XLSX.utils.sheet_to_json(sheet, { range: 9 });

                    const alliancePlayerDB = {};
                    const nowIso = new Date().toISOString();

                    players.forEach(row => {
                        const name = normalizeEditablePlayerName(row['Player Name']);
                        if (name) {
                            alliancePlayerDB[name] = {
                                power: normalizeEditablePlayerPower(row['E1 Total Power(M)']),
                                troops: normalizeEditablePlayerTroops(row['E1 Troops']),
                                lastUpdated: nowIso,
                                updatedBy: currentUser.uid
                            };
                        }
                    });

                    const addedCount = Object.keys(alliancePlayerDB).length;
                    if (addedCount > MAX_PLAYER_DATABASE_SIZE) {
                        reject({
                            success: false,
                            errorKey: 'players_list_error_max_players',
                            errorParams: { max: MAX_PLAYER_DATABASE_SIZE },
                            error: `Maximum ${MAX_PLAYER_DATABASE_SIZE} players allowed.`,
                        });
                        return;
                    }

                    await db.collection('alliances').doc(allianceId).set({
                        playerDatabase: alliancePlayerDB,
                        metadata: {
                            totalPlayers: addedCount,
                            lastUpload: new Date().toISOString(),
                            lastModified: firebase.firestore.FieldValue.serverTimestamp()
                        }
                    }, { merge: true });

                    if (allianceData) {
                        allianceData.playerDatabase = alliancePlayerDB;
                    }

                    resolve({
                        success: true,
                        playerCount: addedCount,
                        message: `${addedCount} players uploaded to alliance`
                    });
                } catch (error) {
                    reject({ success: false, error: error.message });
                }
            };
            reader.onerror = () => reject({ success: false, error: 'Failed to read file' });
            reader.readAsArrayBuffer(file);
        });
    }

    function getAlliancePlayerDatabase() {
        return allianceData && allianceData.playerDatabase ? allianceData.playerDatabase : {};
    }

    function getActivePlayerDatabase() {
        if (playerSource === 'alliance' && allianceData && allianceData.playerDatabase) {
            return allianceData.playerDatabase;
        }
        return playerDatabase;
    }

    function getUserProfile() {
        return normalizeUserProfile(userProfile);
    }

    function setUserProfile(profile) {
        userProfile = normalizeUserProfile(profile);
        return getUserProfile();
    }

    async function setPlayerSource(source) {
        if (source !== 'personal' && source !== 'alliance') return;
        playerSource = source;
        if (currentUser) {
            await db.collection('users').doc(currentUser.uid).set({
                playerSource: source
            }, { merge: true });
        }
    }

    function getAllianceId() { return allianceId; }
    function getAllianceName() { return allianceName; }
    function getAllianceData() { return allianceData; }
    function getPlayerSource() { return playerSource; }
    function getPendingInvitations() { return pendingInvitations.map(stripInvitationPrivateFields); }
    function getSentInvitations() { return sentInvitations.map(stripInvitationPrivateFields); }
    function getInvitationNotifications() { return invitationNotifications.map(stripInvitationPrivateFields); }
    function getAllianceMembers() {
        return allianceData && allianceData.members ? allianceData.members : {};
    }

    function getMigrationVersion() {
        return migrationVersion;
    }

    function getMigratedToGameSubcollectionsAt() {
        return migratedToGameSubcollectionsAt;
    }

    // ============================================================
    // BACKUP & RESTORE FUNCTIONS
    // ============================================================
    
    /**
     * Export player database as Excel
     */
    function exportBackup() {
        const players = Object.keys(playerDatabase).map(name => ({
            'Player Name': name,
            'E1 Total Power(M)': playerDatabase[name].power,
            'E1 Troops': playerDatabase[name].troops,
            'Last Updated': playerDatabase[name].lastUpdated
        }));
        
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(players);
        XLSX.utils.book_append_sheet(wb, ws, 'Players');
        
        // Add metadata sheet
        const metadata = [
            ['Total Players', Object.keys(playerDatabase).length],
            ['Export Date', new Date().toISOString()],
            ['Account Email', currentUser ? currentUser.email : 'N/A']
        ];
        const wsMeta = XLSX.utils.aoa_to_sheet(metadata);
        XLSX.utils.book_append_sheet(wb, wsMeta, 'Metadata');
        
        const emailSlug = currentUser && currentUser.email ? currentUser.email.replace('@', '_') : 'unknown';
        const filename = `backup_${emailSlug}_${Date.now()}.xlsx`;
        XLSX.writeFile(wb, filename);
        
        console.log('✅ Backup exported:', filename);
        return { success: true, filename: filename };
    }
    
    /**
     * Restore player database from Excel backup
     */
    async function restoreFromBackup(file) {
        return new Promise((resolve, reject) => {
            if (!file || file.size > MAX_UPLOAD_BYTES) {
                reject({ success: false, error: 'File too large (max 5MB)' });
                return;
            }

            const reader = new FileReader();
            
            reader.onload = async (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, {type: 'array'});
                    
                    if (!workbook.Sheets['Players']) {
                        reject({ success: false, error: 'Invalid backup file' });
                        return;
                    }
                    
                    const sheet = workbook.Sheets['Players'];
                    const players = XLSX.utils.sheet_to_json(sheet);
                    
                    const restored = {};
                    const nowIso = new Date().toISOString();
                    players.forEach(row => {
                        const name = normalizeEditablePlayerName(row['Player Name']);
                        if (name) {
                            restored[name] = {
                                power: normalizeEditablePlayerPower(row['E1 Total Power(M)']),
                                troops: normalizeEditablePlayerTroops(row['E1 Troops']),
                                lastUpdated: row['Last Updated'] || nowIso,
                            };
                        }
                    });

                    const restoredCount = Object.keys(restored).length;
                    if (restoredCount > MAX_PLAYER_DATABASE_SIZE) {
                        reject({
                            success: false,
                            errorKey: 'players_list_error_max_players',
                            errorParams: { max: MAX_PLAYER_DATABASE_SIZE },
                            error: `Maximum ${MAX_PLAYER_DATABASE_SIZE} players allowed.`,
                        });
                        return;
                    }
                    
                    playerDatabase = restored;
                    const saveResult = await saveUserData();
                    
                    if (saveResult.success) {
                        console.log(`✅ Restored ${restoredCount} players`);
                        resolve({ 
                            success: true, 
                            playerCount: restoredCount,
                            message: `✅ Database restored: ${restoredCount} players`
                        });
                    } else {
                        reject(saveResult);
                    }
                    
                } catch (error) {
                    console.error('❌ Failed to restore backup:', error);
                    reject({ success: false, error: error.message });
                }
            };
            
            reader.onerror = () => {
                reject({ success: false, error: 'Failed to read file' });
            };
            
            reader.readAsArrayBuffer(file);
        });
    }
    
    // ============================================================
    // TEMPLATE GENERATION FUNCTIONS
    // ============================================================
    
    /**
     * Generate player database template
     */
    function generatePlayerDatabaseTemplate() {
        const wb = XLSX.utils.book_new();
        
        const instructions = [
            ['PLAYER DATABASE TEMPLATE'],
            ['Fill this template with ALL your alliance members'],
            ['Update this file monthly or when player stats change'],
            [''],
            ['Instructions:'],
            ['1. Fill Player Name column (exact names from game)'],
            ['2. Fill E1 Total Power(M) column (numeric value, e.g., 65.0)'],
            ['3. Fill E1 Troops column (Tank, Aero, or Missile)'],
            ['4. Upload to generator - data saved to cloud forever!'],
            ['']
        ];
        
        const headers = [['Player Name', 'E1 Total Power(M)', 'E1 Troops']];
        const example = [
            ['Example Player', 65.0, 'Tank'],
            ['', '', ''],
            ['', '', '']
        ];
        
        const data = [...instructions, ...headers, ...example];
        const ws = XLSX.utils.aoa_to_sheet(data);
        
        // Set column widths
        ws['!cols'] = [{wch: 20}, {wch: 20}, {wch: 15}];
        
        XLSX.utils.book_append_sheet(wb, ws, 'Players');
        XLSX.writeFile(wb, 'player_database_template.xlsx');
        
        console.log('✅ Player database template downloaded');
    }
    
    /**
     * Generate team roster template
     */
    function generateTeamRosterTemplate() {
        const wb = XLSX.utils.book_new();
        
        const instructions = [
            ['TEAM ROSTER TEMPLATE'],
            ['Fill this template before each battle with weekly assignments'],
            [''],
            ['Instructions:'],
            ['1. Fill Player Name column (must match names in player database)'],
            ['2. Fill Team column with "A" or "B"'],
            ['3. Upload to generator - system matches with database automatically'],
            ['4. Generate assignments and download maps!'],
            [''],
            ['Required: 20 players per team (40 total)'],
            ['']
        ];
        
        const headers = [['Player Name', 'Team']];
        const examples = [
            ['Example Player 1', 'A'],
            ['Example Player 2', 'A'],
            ['Example Player 3', 'B'],
            ['', ''],
            ['', '']
        ];
        
        const data = [...instructions, ...headers, ...examples];
        const ws = XLSX.utils.aoa_to_sheet(data);
        
        // Set column widths
        ws['!cols'] = [{wch: 25}, {wch: 10}];
        
        XLSX.utils.book_append_sheet(wb, ws, 'Roster');
        XLSX.writeFile(wb, 'team_roster_template.xlsx');
        
        console.log('✅ Team roster template downloaded');
    }
    
    // ============================================================
    // PUBLIC API
    // ============================================================
    
    return {
        // Initialization
        init: init,
        setAuthCallback: setAuthCallback,
        setDataLoadCallback: setDataLoadCallback,
        setAllianceDataCallback: setAllianceDataCallback,
        getFeatureFlags: resolveFeatureFlags,
        isFeatureFlagEnabled: isFeatureFlagEnabled,
        
        // Authentication
        signInWithGoogle: signInWithGoogle,
        signInWithEmail: signInWithEmail,
        signUpWithEmail: signUpWithEmail,
        resetPassword: resetPassword,
        signOut: signOut,
        deleteUserAccountAndData: deleteUserAccountAndData,
        getCurrentUser: getCurrentUser,
        isSignedIn: isSignedIn,
        
        // Database operations
        loadUserData: loadUserData,
        saveUserData: saveUserData,
        uploadPlayerDatabase: uploadPlayerDatabase,
        getPlayerDatabase: getPlayerDatabase,
        getPlayerCount: getPlayerCount,
        getPlayer: getPlayer,
        upsertPlayerEntry: upsertPlayerEntry,
        removePlayerEntry: removePlayerEntry,
        getAllEventData: getAllEventData,
        getEventIds: getEventIds,
        getEventMeta: getEventMeta,
        upsertEvent: upsertEvent,
        removeEvent: removeEvent,
        setEventMetadata: setEventMetadata,

        // Building config
        getBuildingConfig: getBuildingConfig,
        setBuildingConfig: setBuildingConfig,
        getBuildingConfigVersion: getBuildingConfigVersion,
        setBuildingConfigVersion: setBuildingConfigVersion,
        getBuildingPositions: getBuildingPositions,
        setBuildingPositions: setBuildingPositions,
        getBuildingPositionsVersion: getBuildingPositionsVersion,
        setBuildingPositionsVersion: setBuildingPositionsVersion,
        getGlobalDefaultBuildingConfig: getGlobalDefaultBuildingConfig,
        getGlobalDefaultBuildingConfigVersion: getGlobalDefaultBuildingConfigVersion,
        getGlobalDefaultBuildingPositions: getGlobalDefaultBuildingPositions,
        getGlobalDefaultBuildingPositionsVersion: getGlobalDefaultBuildingPositionsVersion,
        
        // Backup & restore
        exportBackup: exportBackup,
        restoreFromBackup: restoreFromBackup,
        
        // Templates
        generatePlayerDatabaseTemplate: generatePlayerDatabaseTemplate,
        generateTeamRosterTemplate: generateTeamRosterTemplate,

        // Alliance
        createAlliance: createAlliance,
        leaveAlliance: leaveAlliance,
        loadAllianceData: loadAllianceData,
        sendInvitation: sendInvitation,
        checkInvitations: checkInvitations,
        acceptInvitation: acceptInvitation,
        rejectInvitation: rejectInvitation,
        revokeInvitation: revokeInvitation,
        resendInvitation: resendInvitation,
        uploadAlliancePlayerDatabase: uploadAlliancePlayerDatabase,
        getAlliancePlayerDatabase: getAlliancePlayerDatabase,
        getActivePlayerDatabase: getActivePlayerDatabase,
        getUserProfile: getUserProfile,
        setUserProfile: setUserProfile,
        setPlayerSource: setPlayerSource,
        getAllianceId: getAllianceId,
        getAllianceName: getAllianceName,
        getAllianceData: getAllianceData,
        getPlayerSource: getPlayerSource,
        getPendingInvitations: getPendingInvitations,
        getSentInvitations: getSentInvitations,
        getInvitationNotifications: getInvitationNotifications,
        getAllianceMembers: getAllianceMembers,
        getMigrationVersion: getMigrationVersion,
        getMigratedToGameSubcollectionsAt: getMigratedToGameSubcollectionsAt,
        resolveGameScopedReadPayload: resolveGameScopedReadPayload
    };
    
})();

// Expose for adapters that read from window/global object
if (typeof window !== 'undefined') {
    window.FirebaseManager = FirebaseManager;
}

// Auto-initialize on load
if (typeof firebase !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        FirebaseManager.init();
    });
}


