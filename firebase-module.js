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
    const MAX_PROFILE_TEXT_LEN = 60;
    const MAX_AVATAR_DATA_URL_LEN = 400000;
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
    const INVITE_COOLDOWN_FREE_INVITES = 3;
    const INVITE_COOLDOWN_STEP_MS = 60 * 1000;

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
    let inviteThrottleState = { sentCount: 0, cooldownUntilMs: 0 };
    let userProfile = { displayName: '', nickname: '', avatarDataUrl: '' };
    let inviteUserLookupPermissionLogged = false;
    let onAuthCallback = null;
    let onDataLoadCallback = null;
    let eventMediaSubcollectionEnabled = true;
    let eventMediaPermissionWarningShown = false;
    const SAVE_DEBOUNCE_MS = 250;
    let lastSavedUserState = null;
    let saveDebounceTimer = null;
    let pendingSavePromise = null;
    let pendingSaveResolve = null;

    let globalDefaultEventPositions = {};
    let globalDefaultPositionsVersion = 0;
    let globalDefaultEventBuildingConfig = {};
    let globalDefaultBuildingConfigVersion = 0;

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
        return JSON.parse(JSON.stringify(defaults)).map((entry) => ({
            ...entry,
            showOnMap: entry && entry.showOnMap !== false,
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
            const slots = Number(item.slots);
            if (Number.isFinite(slots)) {
                next.slots = Math.round(slots);
            }
            const priority = Number(item.priority);
            if (Number.isFinite(priority)) {
                next.priority = Math.round(priority);
            }
            next.showOnMap = item.showOnMap !== false;
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

    function normalizeInviteThrottleState(payload) {
        const source = payload && typeof payload === 'object' ? payload : {};
        const sentRaw = Number(source.sentCount);
        const sentCount = Number.isFinite(sentRaw) && sentRaw > 0 ? Math.floor(sentRaw) : 0;
        const cooldownUntilMs = toMillis(source.cooldownUntil);
        return {
            sentCount,
            cooldownUntilMs: Number.isFinite(cooldownUntilMs) && cooldownUntilMs > 0 ? cooldownUntilMs : 0
        };
    }

    function buildInviteThrottlePayload(nextState) {
        const cooldownUntilMs = Number(nextState && nextState.cooldownUntilMs);
        return {
            sentCount: Number(nextState && nextState.sentCount) > 0 ? Math.floor(Number(nextState.sentCount)) : 0,
            cooldownUntil: Number.isFinite(cooldownUntilMs) && cooldownUntilMs > 0
                ? firebase.firestore.Timestamp.fromMillis(cooldownUntilMs)
                : null,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        };
    }

    function buildInviteCooldownError(remainingMs) {
        const totalSeconds = Math.max(1, Math.ceil(Number(remainingMs || 0) / 1000));
        const minutes = Math.max(1, Math.ceil(totalSeconds / 60));
        return {
            success: false,
            errorKey: 'alliance_invite_cooldown',
            errorParams: { minutes, seconds: totalSeconds },
            error: `Invite cooldown active. Try again in ${minutes} minute(s).`
        };
    }

    function computeNextInviteThrottleState(nowMs) {
        const currentCount = Number.isFinite(Number(inviteThrottleState.sentCount))
            ? Math.max(0, Math.floor(Number(inviteThrottleState.sentCount)))
            : 0;
        const sentCount = currentCount + 1;
        const overtimeInvites = Math.max(0, sentCount - INVITE_COOLDOWN_FREE_INVITES);
        const cooldownMs = overtimeInvites > 0 ? overtimeInvites * INVITE_COOLDOWN_STEP_MS : 0;
        return {
            sentCount,
            cooldownUntilMs: cooldownMs > 0 ? nowMs + cooldownMs : 0
        };
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
            const slots = Number(item.slots);
            if (Number.isFinite(slots)) {
                next.slots = Math.round(slots);
            }
            const priority = Number(item.priority);
            if (Number.isFinite(priority)) {
                next.priority = Math.round(priority);
            }
            next.showOnMap = item.showOnMap !== false;
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
            if (isPermissionDeniedError(error)) {
                disableEventMediaSubcollection(error, 'load event media docs');
                return {};
            }
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
        try {
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
            return true;
        } catch (error) {
            if (isPermissionDeniedError(error)) {
                disableEventMediaSubcollection(error, 'save event media docs');
                return false;
            }
            throw error;
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
        }
        return result;
    }

    function hasLegacyTopLevelBuildingFields(data) {
        if (!data || typeof data !== 'object') {
            return false;
        }
        return (
            Object.prototype.hasOwnProperty.call(data, 'buildingConfig')
            || Object.prototype.hasOwnProperty.call(data, 'buildingConfigVersion')
            || Object.prototype.hasOwnProperty.call(data, 'buildingPositions')
            || Object.prototype.hasOwnProperty.call(data, 'buildingPositionsVersion')
        );
    }

    function mergeLegacyTopLevelBuildingFieldsIntoEvents(data, currentEvents) {
        if (!data || typeof data !== 'object') {
            return currentEvents;
        }
        const nextEvents = currentEvents && typeof currentEvents === 'object'
            ? currentEvents
            : ensureLegacyEventEntries(createEmptyEventData());

        const hasLegacyConfig = Array.isArray(data.buildingConfig) || typeof data.buildingConfigVersion === 'number';
        const hasLegacyPositions = data.buildingPositions && typeof data.buildingPositions === 'object'
            || typeof data.buildingPositionsVersion === 'number';
        if (!hasLegacyConfig && !hasLegacyPositions) {
            return nextEvents;
        }

        const desertEvent = sanitizeEventEntry('desert_storm', {
            name: getDefaultEventName('desert_storm'),
            buildingConfig: Array.isArray(data.buildingConfig) ? data.buildingConfig : (nextEvents.desert_storm && nextEvents.desert_storm.buildingConfig),
            buildingConfigVersion: typeof data.buildingConfigVersion === 'number' ? data.buildingConfigVersion : (nextEvents.desert_storm && nextEvents.desert_storm.buildingConfigVersion),
            buildingPositions: data.buildingPositions && typeof data.buildingPositions === 'object' ? data.buildingPositions : (nextEvents.desert_storm && nextEvents.desert_storm.buildingPositions),
            buildingPositionsVersion: typeof data.buildingPositionsVersion === 'number' ? data.buildingPositionsVersion : (nextEvents.desert_storm && nextEvents.desert_storm.buildingPositionsVersion),
        }, nextEvents.desert_storm);
        nextEvents.desert_storm = desertEvent;
        return nextEvents;
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

    function isEventMediaSubcollectionEnabled() {
        return eventMediaSubcollectionEnabled;
    }

    function disableEventMediaSubcollection(error, context) {
        eventMediaSubcollectionEnabled = false;
        if (eventMediaPermissionWarningShown) {
            return;
        }
        const details = (error && (error.message || error.code)) ? (error.message || error.code) : String(error || 'unknown');
        console.info(`Event media subcollection disabled (${context}); falling back to inline events media:`, details);
        eventMediaPermissionWarningShown = true;
    }

    function buildEventsPayloadForUserDoc() {
        if (isEventMediaSubcollectionEnabled()) {
            return buildEventsWithoutMedia(eventData);
        }
        return normalizeEventsMap(eventData);
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
        const useSubcollection = isEventMediaSubcollectionEnabled();
        return {
            playerDatabase: playerDatabase || {},
            events: useSubcollection ? buildEventsWithoutMedia(eventData) : normalizeEventsMap(eventData),
            eventMedia: useSubcollection ? getEventMediaMap(eventData) : {},
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
        eventMediaSubcollectionEnabled = true;
        eventMediaPermissionWarningShown = false;
        clearSaveQueue();
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
            inviteThrottleState = normalizeInviteThrottleState(null);
            userProfile = normalizeUserProfile(null);
            setGlobalDefaultPositions(emptyGlobalEventPositions(), 0);
            setGlobalDefaultBuildingConfig(emptyGlobalBuildingConfig(), 0);
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
            try {
                const byInviteeUid = await db.collection('invitations')
                    .where('invitedUserId', '==', uid)
                    .get();
                byInviteeUid.docs.forEach((doc) => refMap.set(doc.id, doc.ref));
            } catch (error) {
                console.warn('Unable to collect invitations by invitedUserId during account cleanup:', error.message || error);
            }
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
        allianceId = null;
        allianceName = null;
        allianceData = null;
        playerSource = 'personal';
        pendingInvitations = [];
        inviteThrottleState = normalizeInviteThrottleState(null);
        userProfile = normalizeUserProfile(null);
        setGlobalDefaultPositions(emptyGlobalEventPositions(), 0);
        setGlobalDefaultBuildingConfig(emptyGlobalBuildingConfig(), 0);
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
            const docRef = db.collection('users').doc(user.uid);
            const doc = await docRef.get();
            
            if (doc.exists) {
                const data = doc.data();
                let shouldPersistLegacyDefaults = false;
                const shouldRemoveLegacyTopLevelFields = hasLegacyTopLevelBuildingFields(data);
                playerDatabase = data.playerDatabase || {};
                allianceId = data.allianceId || null;
                allianceName = data.allianceName || null;
                playerSource = data.playerSource || 'personal';
                inviteThrottleState = normalizeInviteThrottleState(data.inviteThrottle);
                userProfile = normalizeUserProfile(data.userProfile || data.profile || null);

                // Event-scoped model: read only from events map.
                if (data.events && typeof data.events === 'object') {
                    eventData = normalizeEventsMap(data.events);
                } else {
                    eventData = ensureLegacyEventEntries(createEmptyEventData());
                }

                if (shouldRemoveLegacyTopLevelFields) {
                    console.log('🔄 Migrating legacy top-level building fields to events.* schema...');
                    eventData = mergeLegacyTopLevelBuildingFieldsIntoEvents(data, eventData);
                    shouldPersistLegacyDefaults = true;
                }

                const ensuredLegacy = ensureLegacyEventEntriesWithDefaults(eventData);
                eventData = ensuredLegacy.events;
                shouldPersistLegacyDefaults = shouldPersistLegacyDefaults || ensuredLegacy.changed;

                const inlineMedia = getEventMediaMap(eventData);
                const storedMedia = await loadEventMediaForUser(user.uid);
                const mergedMedia = Object.assign({}, inlineMedia, storedMedia);
                if (isEventMediaSubcollectionEnabled()) {
                    eventData = buildEventsWithoutMedia(eventData);
                    applyEventMediaToEvents(mergedMedia);

                    if (Object.keys(inlineMedia).length > 0) {
                        try {
                            const migrated = await saveEventMediaDiff(user.uid, storedMedia, mergedMedia);
                            if (migrated) {
                                shouldPersistLegacyDefaults = true;
                                console.log('✅ Migrated inline event media to subcollection docs');
                            }
                        } catch (mediaErr) {
                            console.warn('⚠️ Failed to migrate inline event media:', mediaErr);
                        }
                    }
                } else {
                    // Keep media inline when subcollection writes are blocked by rules.
                    applyEventMediaToEvents(mergedMedia);
                }

                if (shouldPersistLegacyDefaults) {
                    try {
                        if (shouldRemoveLegacyTopLevelFields) {
                            const batch = db.batch();
                            const userRef = db.collection('users').doc(user.uid);
                            batch.set(userRef, {
                                events: buildEventsPayloadForUserDoc(),
                            }, { merge: true });
                            batch.update(userRef, {
                                buildingConfig: firebase.firestore.FieldValue.delete(),
                                buildingConfigVersion: firebase.firestore.FieldValue.delete(),
                                buildingPositions: firebase.firestore.FieldValue.delete(),
                                buildingPositionsVersion: firebase.firestore.FieldValue.delete()
                            });
                            await batch.commit();
                            console.log('✅ Event model enforced and legacy top-level fields removed');
                        } else {
                            await db.collection('users').doc(user.uid).set({
                                events: buildEventsPayloadForUserDoc(),
                            }, { merge: true });
                            console.log('✅ Legacy default events enforced for user');
                        }
                    } catch (defaultErr) {
                        console.warn('⚠️ Failed to persist event-scoped defaults/cleanup:', defaultErr);
                    }
                } else if (shouldRemoveLegacyTopLevelFields) {
                    try {
                        await db.collection('users').doc(user.uid).update({
                            buildingConfig: firebase.firestore.FieldValue.delete(),
                            buildingConfigVersion: firebase.firestore.FieldValue.delete(),
                            buildingPositions: firebase.firestore.FieldValue.delete(),
                            buildingPositionsVersion: firebase.firestore.FieldValue.delete()
                        });
                        console.log('✅ Removed legacy top-level building fields');
                    } catch (cleanupErr) {
                        console.warn('⚠️ Failed to remove legacy top-level building fields:', cleanupErr);
                    }
                }

                await loadGlobalDefaultBuildingPositions();
                await loadGlobalDefaultBuildingConfig();
                const normalizedUserData = {
                    metadata: data.metadata || {},
                    events: buildEventsPayloadForUserDoc(),
                };
                await maybePublishGlobalDefaultsFromCurrentUser(normalizedUserData);
                await maybePublishGlobalBuildingConfigFromCurrentUser(normalizedUserData);

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
                inviteThrottleState = normalizeInviteThrottleState(null);
                userProfile = normalizeUserProfile(null);
                await loadGlobalDefaultBuildingPositions();
                await loadGlobalDefaultBuildingConfig();
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
            if (mediaChanged && isEventMediaSubcollectionEnabled()) {
                const previousMedia = lastSavedUserState && lastSavedUserState.eventMedia ? lastSavedUserState.eventMedia : {};
                const mediaSaved = await saveEventMediaDiff(currentUser.uid, previousMedia, currentState.eventMedia);
                if (mediaSaved === false) {
                    await db.collection('users').doc(currentUser.uid).set({
                        events: normalizeEventsMap(eventData),
                        metadata: {
                            lastModified: firebase.firestore.FieldValue.serverTimestamp()
                        }
                    }, { merge: true });
                }
            }
            rememberLastSavedUserState(getCurrentPersistedUserState());
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
                    
                    // Clear existing database
                    playerDatabase = {};
                    
                    // Add players to database
                    let addedCount = 0;
                    let skippedCount = 0;
                    const skippedPlayers = [];
                    
                    players.forEach(row => {
                        const name = row['Player Name'];
                        const power = row['E1 Total Power(M)'];
                        const troops = row['E1 Troops'];
                        
                        // Only require name (power and troops are optional)
                        if (name) {
                            playerDatabase[name] = {
                                power: power ? parseFloat(power) : 0, // Default to 0 if power missing
                                troops: troops || 'Unknown', // Default to 'Unknown' if troops missing
                                lastUpdated: new Date().toISOString()
                            };
                            addedCount++;
                        } else {
                            // Track skipped players (only if name is missing)
                            skippedCount++;
                            skippedPlayers.push(`Row with no name (power: ${power || 'none'}, troops: ${troops || 'none'})`);
                        }
                    });
                    
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

    function buildCurrentAllianceMemberPayload() {
        return {
            email: currentUser && currentUser.email ? currentUser.email : '',
            joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
            role: 'member'
        };
    }

    async function trySyncCurrentUserAllianceMembership(targetAllianceId) {
        if (!currentUser || !targetAllianceId) {
            return { success: false, permissionDenied: false };
        }

        const memberPath = `members.${currentUser.uid}`;
        try {
            await db.collection('alliances').doc(targetAllianceId).update({
                [memberPath]: buildCurrentAllianceMemberPayload()
            });
            return { success: true, permissionDenied: false };
        } catch (error) {
            if (isPermissionDeniedError(error)) {
                return { success: false, permissionDenied: true };
            }
            throw error;
        }
    }

    async function loadAcceptedInvitationsForAlliance(targetAllianceId) {
        if (!currentUser || !targetAllianceId) {
            return [];
        }

        const acceptedInvitations = [];
        const seenIds = new Set();
        const addInvitation = (doc) => {
            if (!doc || !doc.exists || seenIds.has(doc.id)) {
                return;
            }
            seenIds.add(doc.id);
            const payload = doc.data() || {};
            if (payload && payload.allianceId === targetAllianceId && payload.status === 'accepted') {
                acceptedInvitations.push({ id: doc.id, ...payload });
            }
        };

        try {
            const snapshot = await db.collection('invitations')
                .where('allianceId', '==', targetAllianceId)
                .where('status', '==', 'accepted')
                .get();
            snapshot.docs.forEach(addInvitation);
            return acceptedInvitations;
        } catch (error) {
            if (!isPermissionDeniedError(error)) {
                console.warn('Failed to load accepted invitations by alliance id:', error.message || error);
            }
        }

        try {
            const fallbackSnapshot = await db.collection('invitations')
                .where('invitedBy', '==', currentUser.uid)
                .where('status', '==', 'accepted')
                .get();
            fallbackSnapshot.docs.forEach(addInvitation);
        } catch (fallbackError) {
            if (!isPermissionDeniedError(fallbackError)) {
                console.warn('Failed to load accepted invitations by inviter fallback:', fallbackError.message || fallbackError);
            }
        }

        return acceptedInvitations;
    }

    async function reconcileAllianceMembersFromAcceptedInvites(targetAllianceId, membersInput) {
        const currentMembers = membersInput && typeof membersInput === 'object'
            ? JSON.parse(JSON.stringify(membersInput))
            : {};
        const acceptedInvitations = await loadAcceptedInvitationsForAlliance(targetAllianceId);
        if (!Array.isArray(acceptedInvitations) || acceptedInvitations.length === 0) {
            return currentMembers;
        }

        const missingMemberUpdates = {};
        acceptedInvitations.forEach((inv) => {
            const invitedUserId = typeof inv.invitedUserId === 'string' ? inv.invitedUserId.trim() : '';
            if (!invitedUserId || currentMembers[invitedUserId]) {
                return;
            }
            const invitedEmail = typeof inv.invitedEmail === 'string' ? inv.invitedEmail.trim() : '';
            currentMembers[invitedUserId] = {
                email: invitedEmail,
                role: 'member'
            };
            missingMemberUpdates[`members.${invitedUserId}`] = {
                email: invitedEmail,
                role: 'member',
                joinedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
        });

        if (Object.keys(missingMemberUpdates).length === 0) {
            return currentMembers;
        }

        try {
            await db.collection('alliances').doc(targetAllianceId).update(missingMemberUpdates);
        } catch (error) {
            if (!isPermissionDeniedError(error)) {
                console.warn('Failed to persist accepted-invite members back to alliance doc:', error.message || error);
            }
        }

        return currentMembers;
    }

    async function loadAllianceData() {
        if (!currentUser || !allianceId) {
            allianceData = null;
            return;
        }
        try {
            const doc = await db.collection('alliances').doc(allianceId).get();
            if (doc.exists) {
                allianceData = doc.data() || {};
                allianceData.members = await reconcileAllianceMembersFromAcceptedInvites(
                    allianceId,
                    allianceData.members
                );
                if (!allianceData.members || !allianceData.members[currentUser.uid]) {
                    const syncResult = await trySyncCurrentUserAllianceMembership(allianceId);
                    if (syncResult.success) {
                        const refreshedDoc = await db.collection('alliances').doc(allianceId).get();
                        if (refreshedDoc.exists) {
                            allianceData = refreshedDoc.data();
                        }
                        return;
                    }
                    if (syncResult.permissionDenied) {
                        if (!allianceName) {
                            allianceName = (allianceData && typeof allianceData.name === 'string')
                                ? allianceData.name
                                : allianceId;
                        }
                        if (!allianceData.members || typeof allianceData.members !== 'object') {
                            allianceData.members = {};
                        }
                        if (!allianceData.members[currentUser.uid]) {
                            allianceData.members[currentUser.uid] = {
                                email: currentUser.email || '',
                                role: 'member'
                            };
                        }
                        return;
                    }
                    allianceId = null;
                    allianceName = null;
                    allianceData = null;
                    playerSource = 'personal';
                    await db.collection('users').doc(currentUser.uid).set({
                        allianceId: null, allianceName: null, playerSource: 'personal'
                    }, { merge: true });
                }
            } else {
                allianceId = null;
                allianceName = null;
                allianceData = null;
                playerSource = 'personal';
                await db.collection('users').doc(currentUser.uid).set({
                    allianceId: null, allianceName: null, playerSource: 'personal'
                }, { merge: true });
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

            allianceId = null;
            allianceName = null;
            allianceData = null;
            playerSource = 'personal';

            await db.collection('users').doc(currentUser.uid).set({
                allianceId: null, allianceName: null, playerSource: 'personal'
            }, { merge: true });

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async function resolveUserByEmailLower(emailLower) {
        if (!emailLower) {
            return null;
        }
        try {
            const query = await db.collection('users')
                .where('metadata.emailLower', '==', emailLower)
                .limit(1)
                .get();
            if (query.empty) {
                return null;
            }
            return {
                uid: query.docs[0].id,
                data: query.docs[0].data() || {}
            };
        } catch (error) {
            if (isPermissionDeniedError(error)) {
                if (!inviteUserLookupPermissionLogged) {
                    console.info('Invited-user lookup by email is disabled by Firestore rules. Falling back to email-only invitations.');
                    inviteUserLookupPermissionLogged = true;
                }
                return null;
            }
            console.warn('Unable to resolve invited user by email; using email-only invitation lookup:', error.message || error);
            return null;
        }
    }

    function invitationBelongsToCurrentUser(invitation) {
        if (!invitation || !currentUser) {
            return false;
        }
        const invitedUserId = typeof invitation.invitedUserId === 'string' ? invitation.invitedUserId : '';
        const invitedEmail = typeof invitation.invitedEmail === 'string' ? invitation.invitedEmail.toLowerCase() : '';
        const userEmail = currentUser.email ? currentUser.email.toLowerCase() : '';
        if (invitedUserId && invitedUserId === currentUser.uid) {
            return true;
        }
        return !!(invitedEmail && userEmail && invitedEmail === userEmail);
    }

    async function sendInvitation(email) {
        if (!currentUser || !allianceId) return { success: false, error: 'Not in an alliance' };

        const normalizedEmail = email.trim().toLowerCase();
        if (!normalizedEmail) return { success: false, error: 'Email is required' };
        const currentEmailLower = currentUser.email ? currentUser.email.toLowerCase() : '';
        if (currentEmailLower && normalizedEmail === currentEmailLower) {
            return { success: false, errorKey: 'alliance_error_invite_self', error: 'You cannot invite your own account.' };
        }

        try {
            const userRef = db.collection('users').doc(currentUser.uid);
            try {
                const currentUserDoc = await userRef.get();
                if (currentUserDoc.exists) {
                    inviteThrottleState = normalizeInviteThrottleState((currentUserDoc.data() || {}).inviteThrottle);
                }
            } catch (throttleLoadError) {
                if (!isPermissionDeniedError(throttleLoadError)) {
                    console.warn('Unable to refresh invite cooldown state from user profile:', throttleLoadError.message || throttleLoadError);
                }
            }

            const nowMs = Date.now();
            const remainingMs = Math.max(0, Number(inviteThrottleState.cooldownUntilMs || 0) - nowMs);
            if (remainingMs > 0) {
                return buildInviteCooldownError(remainingMs);
            }

            let invitedUserId = '';
            const invitedUser = await resolveUserByEmailLower(normalizedEmail);
            if (invitedUser && invitedUser.uid) {
                invitedUserId = invitedUser.uid;
                if (invitedUser.data && invitedUser.data.allianceId && invitedUser.data.allianceId === allianceId) {
                    return { success: false, errorKey: 'alliance_error_invitee_already_member', error: 'This user is already in your alliance.' };
                }
            }

            const existing = await db.collection('invitations')
                .where('allianceId', '==', allianceId)
                .where('invitedEmail', '==', normalizedEmail)
                .where('status', '==', 'pending')
                .get();

            if (!existing.empty) {
                return { success: false, error: 'Invitation already pending for this email' };
            }

            if (invitedUserId) {
                try {
                    const existingByUid = await db.collection('invitations')
                        .where('allianceId', '==', allianceId)
                        .where('invitedUserId', '==', invitedUserId)
                        .where('status', '==', 'pending')
                        .get();
                    if (!existingByUid.empty) {
                        return { success: false, error: 'Invitation already pending for this user' };
                    }
                } catch (queryError) {
                    console.warn('Unable to check pending invitations by invited user id:', queryError.message || queryError);
                }
            }

            const invitationRef = db.collection('invitations').doc();
            const nextInviteThrottleState = computeNextInviteThrottleState(nowMs);
            const batch = db.batch();
            batch.set(invitationRef, {
                allianceId: allianceId,
                allianceName: allianceName,
                invitedEmail: normalizedEmail,
                invitedUserId: invitedUserId || null,
                invitedBy: currentUser.uid,
                inviterEmail: currentUser.email,
                inviterName: currentUser.displayName || '',
                status: 'pending',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                respondedAt: null
            });
            batch.set(userRef, {
                inviteThrottle: buildInviteThrottlePayload(nextInviteThrottleState)
            }, { merge: true });
            await batch.commit();
            inviteThrottleState = nextInviteThrottleState;

            const nextCooldownMinutes = Math.max(0, Math.ceil((Number(nextInviteThrottleState.cooldownUntilMs || 0) - nowMs) / 60000));
            return {
                success: true,
                cooldownMinutes: nextCooldownMinutes
            };
        } catch (error) {
            if (isPermissionDeniedError(error)) {
                return {
                    success: false,
                    error: 'Permission denied while sending invitation. Verify Firestore rules for invitations and users profile updates.'
                };
            }
            return { success: false, error: error.message };
        }
    }

    async function checkInvitations() {
        if (!currentUser) {
            pendingInvitations = [];
            return [];
        }

        try {
            const invitationMap = new Map();

            try {
                const byIdSnapshot = await db.collection('invitations')
                    .where('invitedUserId', '==', currentUser.uid)
                    .where('status', '==', 'pending')
                    .get();
                byIdSnapshot.docs.forEach((doc) => invitationMap.set(doc.id, { id: doc.id, ...doc.data() }));
            } catch (errorById) {
                console.warn('Unable to check invitations by invitedUserId. Falling back to email lookup:', errorById.message || errorById);
            }

            const emailLower = currentUser.email ? currentUser.email.toLowerCase() : '';
            if (emailLower) {
                const byEmailSnapshot = await db.collection('invitations')
                    .where('invitedEmail', '==', emailLower)
                    .where('status', '==', 'pending')
                    .get();
                byEmailSnapshot.docs.forEach((doc) => invitationMap.set(doc.id, { id: doc.id, ...doc.data() }));
            }

            pendingInvitations = Array.from(invitationMap.values()).filter((invitation) => {
                if (!invitation || typeof invitation !== 'object') {
                    return false;
                }
                if (!allianceId) {
                    return true;
                }
                const invitationAllianceId = typeof invitation.allianceId === 'string' ? invitation.allianceId : '';
                return !invitationAllianceId || invitationAllianceId !== allianceId;
            });

            return pendingInvitations;
        } catch (error) {
            console.error('Failed to check invitations:', error);
            pendingInvitations = [];
            return [];
        }
    }

    async function acceptInvitation(invitationId) {
        if (!currentUser) return { success: false, error: 'Not signed in' };

        try {
            const invitationRef = db.collection('invitations').doc(invitationId);
            const invDoc = await invitationRef.get();
            if (!invDoc.exists) return { success: false, error: 'Invitation not found' };

            const inv = invDoc.data();
            if (inv.status !== 'pending') return { success: false, error: 'Invitation already responded to' };
            if (!invitationBelongsToCurrentUser(inv)) {
                return { success: false, error: 'Invitation does not belong to this user' };
            }

            if (allianceId && allianceId !== inv.allianceId) {
                return {
                    success: false,
                    errorKey: 'alliance_error_already_in_alliance',
                    error: 'Leave your current alliance before accepting another invitation.'
                };
            }

            const allianceRef = db.collection('alliances').doc(inv.allianceId);
            const allianceSnap = await allianceRef.get();
            if (!allianceSnap.exists) {
                return { success: false, error: 'Alliance not found' };
            }
            const userRef = db.collection('users').doc(currentUser.uid);
            let membershipSyncPermissionDenied = false;
            try {
                const membershipSync = await trySyncCurrentUserAllianceMembership(inv.allianceId);
                membershipSyncPermissionDenied = !!membershipSync.permissionDenied;
            } catch (membershipSyncError) {
                return { success: false, error: membershipSyncError.message || String(membershipSyncError) };
            }

            const acceptBatch = db.batch();
            acceptBatch.set(invitationRef, {
                status: 'accepted',
                respondedAt: firebase.firestore.FieldValue.serverTimestamp(),
                invitedUserId: inv.invitedUserId || currentUser.uid
            }, { merge: true });
            acceptBatch.set(userRef, {
                allianceId: inv.allianceId,
                allianceName: inv.allianceName || '',
                playerSource: 'personal'
            }, { merge: true });
            await acceptBatch.commit();

            allianceId = inv.allianceId;
            allianceName = inv.allianceName;
            playerSource = 'personal';
            if (membershipSyncPermissionDenied) {
                const localAllianceData = allianceSnap.data() || {};
                if (!localAllianceData.members || typeof localAllianceData.members !== 'object') {
                    localAllianceData.members = {};
                }
                if (!localAllianceData.members[currentUser.uid]) {
                    localAllianceData.members[currentUser.uid] = {
                        email: currentUser.email || '',
                        role: 'member'
                    };
                }
                allianceData = localAllianceData;
            }
            pendingInvitations = pendingInvitations.filter((item) => {
                if (!item || typeof item !== 'object') {
                    return false;
                }
                if (item.id === invitationId) {
                    return false;
                }
                const itemAllianceId = typeof item.allianceId === 'string' ? item.allianceId : '';
                return !itemAllianceId || itemAllianceId !== inv.allianceId;
            });
            await loadAllianceData();
            return { success: true, allianceId: inv.allianceId, allianceName: inv.allianceName };
        } catch (error) {
            if (isPermissionDeniedError(error)) {
                return {
                    success: false,
                    error: 'Permission denied while accepting invitation. Verify Firestore rules for alliance membership and invitation updates.'
                };
            }
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
            if (!invitationBelongsToCurrentUser(inv)) {
                return { success: false, error: 'Invitation does not belong to this user' };
            }

            await db.collection('invitations').doc(invitationId).update({
                status: 'rejected',
                respondedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            pendingInvitations = pendingInvitations.filter(inv => inv.id !== invitationId);
            return { success: true };
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
                    let addedCount = 0;

                    players.forEach(row => {
                        const name = row['Player Name'];
                        if (name) {
                            alliancePlayerDB[name] = {
                                power: row['E1 Total Power(M)'] ? parseFloat(row['E1 Total Power(M)']) : 0,
                                troops: row['E1 Troops'] || 'Unknown',
                                lastUpdated: new Date().toISOString(),
                                updatedBy: currentUser.uid
                            };
                            addedCount++;
                        }
                    });

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
    function getPendingInvitations() { return pendingInvitations; }
    function getAllianceMembers() {
        return allianceData && allianceData.members ? allianceData.members : {};
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
                    players.forEach(row => {
                        const name = row['Player Name'];
                        if (name) {
                            restored[name] = {
                                power: row['E1 Total Power(M)'],
                                troops: row['E1 Troops'],
                                lastUpdated: row['Last Updated'] || new Date().toISOString()
                            };
                        }
                    });
                    
                    playerDatabase = restored;
                    const saveResult = await saveUserData();
                    
                    if (saveResult.success) {
                        console.log(`✅ Restored ${Object.keys(restored).length} players`);
                        resolve({ 
                            success: true, 
                            playerCount: Object.keys(restored).length,
                            message: `✅ Database restored: ${Object.keys(restored).length} players`
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
        getAllianceMembers: getAllianceMembers
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


