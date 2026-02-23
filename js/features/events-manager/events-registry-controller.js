(function initEventsRegistryController(global) {
    'use strict';

    // ---- constants ----
    var DEFAULT_ASSIGNMENT_ALGORITHM_ID = 'balanced_round_robin';
    var MAP_PREVIEW = 'preview';
    var MAP_EXPORT = 'export';
    var MAP_CANVAS_WIDTH = 1080;
    var MAP_CANVAS_FALLBACK_HEIGHT = 720;
    var MAP_GRID_STEP = 90;
    var MAP_UPLOAD_MAX_SIDE = MAP_CANVAS_WIDTH;
    var BUILDING_POSITIONS_VERSION = 2;
    var BUILDING_CONFIG_VERSION = 2;
    var MAX_BUILDING_SLOTS_TOTAL = 20;
    var MIN_BUILDING_SLOTS = 0;
    var maxRetries = 3;

    var textColors = { 1: '#8B0000', 2: '#B85C00', 3: '#006464', 4: '#006699', 5: '#226644', 6: '#556B2F' };
    var bgColors = { 1: 'rgba(255,230,230,0.9)', 2: 'rgba(255,240,220,0.9)', 3: 'rgba(230,255,250,0.9)',
                      4: 'rgba(230,245,255,0.9)', 5: 'rgba(240,255,240,0.9)', 6: 'rgba(245,255,235,0.9)' };

    // ---- per-event runtime state (module-private) ----
    var buildingConfigs = {};
    var buildingPositionsMap = {};
    var mapRuntimeState = new Map();
    var coordMapWarningShown = {};

    var PROTECTED_EVENT_IDS = null; // lazily initialised

    // ---- deps injected by app.js via init() ----
    var deps = null;

    function ensureDeps() {
        if (!deps) {
            throw new Error('DSEventsRegistryController.init() must be called before use');
        }
    }

    // ---- helpers ----

    function getEventIds() {
        return global.DSCoreEvents.getEventIds();
    }

    function normalizeAssignmentAlgorithmId(value) {
        if (typeof value !== 'string') {
            return '';
        }
        return value.trim().toLowerCase();
    }

    function normalizeGameId(value) {
        if (typeof value !== 'string') {
            return '';
        }
        return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    }

    function normalizeEventId(value) {
        if (typeof value !== 'string') {
            return '';
        }
        return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    }

    function normalizeMapPurpose(purpose) {
        return purpose === MAP_EXPORT ? MAP_EXPORT : MAP_PREVIEW;
    }

    function resolveDefaultAssignmentAlgorithmId(gameId) {
        var normalizedGameId = normalizeGameId(gameId);
        if (global.DSAssignmentRegistry && typeof global.DSAssignmentRegistry.listAlgorithmsForGame === 'function') {
            var algorithms = global.DSAssignmentRegistry.listAlgorithmsForGame(normalizedGameId);
            if (Array.isArray(algorithms) && algorithms.length > 0 && algorithms[0] && typeof algorithms[0].id === 'string') {
                var normalized = normalizeAssignmentAlgorithmId(algorithms[0].id);
                if (normalized) {
                    return normalized;
                }
            }
        }
        return DEFAULT_ASSIGNMENT_ALGORITHM_ID;
    }

    function getProtectedEventIds() {
        if (!PROTECTED_EVENT_IDS) {
            PROTECTED_EVENT_IDS = new Set(
                Object.keys(global.DSCoreEvents.cloneLegacyEventRegistry ? global.DSCoreEvents.cloneLegacyEventRegistry() : {
                    desert_storm: true,
                    canyon_battlefield: true,
                })
            );
        }
        return PROTECTED_EVENT_IDS;
    }

    function isImageDataUrl(value, maxLength) {
        var dataUrl = typeof value === 'string' ? value.trim() : '';
        if (!dataUrl || !dataUrl.startsWith('data:image/')) {
            return false;
        }
        return dataUrl.length <= maxLength;
    }

    function hashString(value) {
        var input = String(value || '');
        var hash = 2166136261;
        for (var index = 0; index < input.length; index += 1) {
            hash ^= input.charCodeAt(index);
            hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
        }
        return Math.abs(hash >>> 0);
    }

    // ---- map runtime state ----

    function getMapRuntimeStateKey(eventId, purpose) {
        return normalizeMapPurpose(purpose) + '::' + normalizeEventId(eventId);
    }

    function createMapRuntimeState() {
        return {
            image: new Image(),
            loaded: false,
            retries: 0,
            unavailable: false,
            promise: null,
            sourceSignature: '',
        };
    }

    function ensureMapRuntimeState(eventId, purpose) {
        var key = getMapRuntimeStateKey(eventId, purpose);
        if (!mapRuntimeState.has(key)) {
            mapRuntimeState.set(key, createMapRuntimeState());
        }
        return mapRuntimeState.get(key);
    }

    function getMapRuntimeStateFn(eventId, purpose) {
        var eid = normalizeEventId(eventId);
        if (!eid) {
            return null;
        }
        return ensureMapRuntimeState(eid, purpose);
    }

    function deleteMapRuntimeStateForEvent(eventId) {
        var eid = normalizeEventId(eventId);
        if (!eid) {
            return;
        }
        [MAP_PREVIEW, MAP_EXPORT].forEach(function (purpose) {
            mapRuntimeState.delete(getMapRuntimeStateKey(eid, purpose));
        });
    }

    // ---- event runtime state ----

    function ensureEventRuntimeState(eventId) {
        var event = normalizeEventId(eventId);
        if (!event) {
            return;
        }
        if (!Object.prototype.hasOwnProperty.call(buildingConfigs, event)) {
            buildingConfigs[event] = null;
        }
        if (!Object.prototype.hasOwnProperty.call(buildingPositionsMap, event)) {
            buildingPositionsMap[event] = {};
        }
        [MAP_PREVIEW, MAP_EXPORT].forEach(function (purpose) {
            ensureMapRuntimeState(event, purpose);
        });
        if (!Object.prototype.hasOwnProperty.call(coordMapWarningShown, event)) {
            coordMapWarningShown[event] = false;
        }
    }

    function resetMapStateForEvent(eventId) {
        var event = normalizeEventId(eventId);
        if (!event) {
            return;
        }
        ensureEventRuntimeState(event);
        [MAP_PREVIEW, MAP_EXPORT].forEach(function (purpose) {
            var state = ensureMapRuntimeState(event, purpose);
            state.loaded = false;
            state.retries = 0;
            state.unavailable = false;
            state.promise = null;
            state.sourceSignature = '';
            if (state.image) {
                state.image.src = '';
            }
        });
        coordMapWarningShown[event] = false;
    }

    function syncRuntimeStateWithRegistry() {
        var eventIds = getEventIds();
        var eventIdSet = new Set(eventIds);

        eventIds.forEach(function (eventId) { ensureEventRuntimeState(eventId); });

        Object.keys(buildingConfigs).forEach(function (eventId) {
            if (!eventIdSet.has(eventId)) {
                delete buildingConfigs[eventId];
            }
        });
        Object.keys(buildingPositionsMap).forEach(function (eventId) {
            if (!eventIdSet.has(eventId)) {
                delete buildingPositionsMap[eventId];
            }
        });
        Array.from(mapRuntimeState.keys()).forEach(function (key) {
            var parts = key.split('::');
            var eventId = parts.length > 1 ? parts[1] : '';
            if (!eventIdSet.has(eventId)) {
                mapRuntimeState.delete(key);
            }
        });
        Object.keys(coordMapWarningShown).forEach(function (eventId) {
            if (!eventIdSet.has(eventId)) {
                delete coordMapWarningShown[eventId];
            }
        });

        var currentEvent = deps.getCurrentEvent();
        if (!eventIdSet.has(currentEvent)) {
            deps.setCurrentEvent(eventIds[0] || 'desert_storm');
        }
    }

    // ---- active event ----

    function getActiveEvent() {
        var currentEvent = deps.getCurrentEvent();
        var active = global.DSCoreEvents.getEvent(currentEvent);
        if (active) {
            return active;
        }
        var firstId = getEventIds()[0];
        if (firstId) {
            deps.setCurrentEvent(firstId);
            return global.DSCoreEvents.getEvent(firstId);
        }
        return null;
    }

    // ---- display helpers ----

    function getEventDisplayName(eventId) {
        if (
            global.DSFeatureEventsManagerSelector
            && typeof global.DSFeatureEventsManagerSelector.resolveEventDisplayName === 'function'
        ) {
            return global.DSFeatureEventsManagerSelector.resolveEventDisplayName(eventId, {
                getEvent: function (id) { return global.DSCoreEvents.getEvent(id); },
                translate: deps.t,
            });
        }

        var event = global.DSCoreEvents.getEvent(eventId);
        if (!event) {
            return eventId;
        }
        if (typeof event.name === 'string' && event.name.trim()) {
            return event.name.trim();
        }
        if (event.titleKey) {
            var translated = deps.t(event.titleKey);
            if (translated && translated !== event.titleKey) {
                return translated;
            }
        }
        return event.name || eventId;
    }

    function createEventSelectorButton(eventId) {
        var currentEvent = deps.getCurrentEvent();
        if (
            global.DSFeatureEventsManagerSelector
            && typeof global.DSFeatureEventsManagerSelector.createEventSelectorButton === 'function'
        ) {
            return global.DSFeatureEventsManagerSelector.createEventSelectorButton({
                document: document,
                eventId: eventId,
                currentEvent: currentEvent,
                displayName: getEventDisplayName(eventId),
                onSelect: switchEvent,
            });
        }

        var button = document.createElement('button');
        button.className = 'event-btn' + (eventId === currentEvent ? ' active' : '');
        button.type = 'button';
        button.dataset.event = eventId;
        button.textContent = getEventDisplayName(eventId);
        button.addEventListener('click', function () { switchEvent(eventId); });
        return button;
    }

    function renderEventSelector(containerId) {
        var currentEvent = deps.getCurrentEvent();
        if (
            global.DSFeatureEventsManagerSelector
            && typeof global.DSFeatureEventsManagerSelector.renderEventSelector === 'function'
        ) {
            global.DSFeatureEventsManagerSelector.renderEventSelector({
                document: document,
                containerId: containerId,
                eventIds: getEventIds(),
                currentEvent: currentEvent,
                getDisplayName: getEventDisplayName,
                onSelect: switchEvent,
            });
            return;
        }

        var container = document.getElementById(containerId);
        if (!container) {
            return;
        }
        var eventIds = getEventIds();
        container.innerHTML = '';
        eventIds.forEach(function (eventId) {
            container.appendChild(createEventSelectorButton(eventId));
        });
    }

    function renderAllEventSelectors() {
        renderEventSelector('selectionEventSelector');
    }

    // ---- storage normalization ----

    function normalizeStoredEventsData(rawData) {
        var source = rawData && typeof rawData === 'object' ? rawData : {};
        var normalized = {};
        Object.keys(source).forEach(function (rawId) {
            var eventId = normalizeEventId(rawId);
            if (!eventId) {
                return;
            }
            var entry = source[rawId];
            if (!entry || typeof entry !== 'object') {
                return;
            }
            normalized[eventId] = {
                name: typeof entry.name === 'string' ? entry.name.trim().slice(0, deps.EVENT_NAME_LIMIT) : '',
                logoDataUrl: isImageDataUrl(entry.logoDataUrl, deps.EVENT_LOGO_DATA_URL_LIMIT) ? entry.logoDataUrl.trim() : '',
                mapDataUrl: isImageDataUrl(entry.mapDataUrl, deps.EVENT_MAP_DATA_URL_LIMIT) ? entry.mapDataUrl.trim() : '',
                assignmentAlgorithmId: normalizeAssignmentAlgorithmId(entry.assignmentAlgorithmId),
                buildingConfig: Array.isArray(entry.buildingConfig) ? entry.buildingConfig : null,
                buildingPositions: entry.buildingPositions && typeof entry.buildingPositions === 'object' ? entry.buildingPositions : null,
            };
        });
        return normalized;
    }

    function buildRegistryFromStorage() {
        var legacyRegistry = global.DSCoreEvents.cloneLegacyEventRegistry
            ? global.DSCoreEvents.cloneLegacyEventRegistry()
            : global.DSCoreEvents.cloneEventRegistry();
        var nextRegistry = {};

        Object.keys(legacyRegistry).forEach(function (eventId) {
            nextRegistry[eventId] = Object.assign({}, legacyRegistry[eventId]);
        });

        var storedEvents = (function () {
            var FirebaseService = deps.getFirebaseService();
            if (!FirebaseService || !FirebaseService.getAllEventData) {
                return {};
            }
            var gameplayContext = deps.getGameplayContext();
            if (!gameplayContext) {
                return {};
            }
            return normalizeStoredEventsData(FirebaseService.getAllEventData(gameplayContext));
        })();

        Object.keys(storedEvents).forEach(function (eventId) {
            var stored = storedEvents[eventId];
            var base = nextRegistry[eventId] || {};
            var gameplayContext = deps.getGameplayContext();
            var baseBuildings = Array.isArray(base.buildings) ? base.buildings : [];
            var storedBuildings = Array.isArray(stored.buildingConfig)
                ? deps.normalizeBuildingConfig(stored.buildingConfig, stored.buildingConfig)
                : null;
            var buildings = Array.isArray(storedBuildings) && storedBuildings.length > 0
                ? storedBuildings
                : baseBuildings;
            var validNames = new Set(buildings.map(function (item) { return item.name; }));
            var defaultPositions = stored.buildingPositions
                ? global.DSCoreBuildings.normalizeBuildingPositions(stored.buildingPositions, validNames)
                : (base.defaultPositions || {});
            var mapDataUrl = stored.mapDataUrl || '';
            var nextName = stored.name || base.name || eventId;
            var nextAssignmentAlgorithmId = normalizeAssignmentAlgorithmId(stored.assignmentAlgorithmId)
                || normalizeAssignmentAlgorithmId(base.assignmentAlgorithmId)
                || resolveDefaultAssignmentAlgorithmId(gameplayContext ? gameplayContext.gameId : '');
            var preserveTitleKey = !stored.name || !base.name || stored.name === base.name;

            nextRegistry[eventId] = Object.assign({}, base, {
                id: eventId,
                name: nextName,
                titleKey: preserveTitleKey ? (base.titleKey || '') : '',
                mapFile: mapDataUrl || '',
                previewMapFile: mapDataUrl || '',
                exportMapFile: mapDataUrl || '',
                mapTitle: nextName.toUpperCase().slice(0, 50),
                excelPrefix: normalizeEventId(base.excelPrefix || eventId) || eventId,
                logoDataUrl: stored.logoDataUrl || '',
                mapDataUrl: mapDataUrl,
                assignmentAlgorithmId: nextAssignmentAlgorithmId,
                buildings: buildings,
                defaultPositions: defaultPositions,
                buildingAnchors: base.buildingAnchors || {},
            });
        });

        global.DSCoreEvents.setEventRegistry(nextRegistry);
        syncRuntimeStateWithRegistry();
        getEventIds().forEach(function (eventId) { resetMapStateForEvent(eventId); });
    }

    // ---- map loading ----

    function getEventMapFile(eventId) {
        ensureEventRuntimeState(eventId);
        var evt = global.DSCoreEvents.getEvent(eventId);
        if (!evt) return null;
        var mapDataUrl = typeof evt.mapDataUrl === 'string' ? evt.mapDataUrl.trim() : '';
        return mapDataUrl || null;
    }

    function loadMapImage(eventId, purpose) {
        var currentEvent = deps.getCurrentEvent();
        var eid = eventId || currentEvent;
        var mapPurpose = normalizeMapPurpose(purpose);
        ensureEventRuntimeState(eid);
        var mapState = ensureMapRuntimeState(eid, mapPurpose);
        if (mapState.loaded) {
            return Promise.resolve(true);
        }
        if (mapState.promise) {
            return mapState.promise;
        }

        var primaryFile = getEventMapFile(eid, mapPurpose);
        var candidateFiles = primaryFile ? [primaryFile] : [];
        var mapSourceSignature = candidateFiles.join('|');

        if (mapState.sourceSignature !== mapSourceSignature) {
            mapState.loaded = false;
            mapState.unavailable = false;
            mapState.retries = 0;
            mapState.promise = null;
            mapState.sourceSignature = mapSourceSignature;
        }

        mapState.promise = new Promise(function (resolve, reject) {
            var imageEl = mapState.image;
            var candidateIndex = 0;

            var tryLoadCandidate = function () {
                var src = candidateFiles[candidateIndex];
                if (!src) {
                    mapState.unavailable = true;
                    mapState.promise = null;
                    reject(new Error('No map source available for ' + eid + '/' + mapPurpose));
                    return;
                }
                if (typeof src === 'string' && /^(data:|blob:)/i.test(src.trim())) {
                    imageEl.src = src;
                    return;
                }
                var bust = src.includes('?') ? '&' : '?';
                imageEl.src = src + bust + 'v=' + Date.now();
            };

            imageEl.onload = function () {
                mapState.loaded = true;
                mapState.unavailable = false;
                mapState.retries = 0;
                mapState.promise = null;
                console.log('Map loaded for ' + eid + '/' + mapPurpose);
                resolve(true);
            };

            imageEl.onerror = function () {
                if (candidateIndex < candidateFiles.length - 1) {
                    candidateIndex += 1;
                    tryLoadCandidate();
                    return;
                }

                var retry = mapState.retries + 1;
                console.error('Map failed to load for ' + eid + '/' + mapPurpose + ', attempt: ' + retry);
                if (mapState.retries < maxRetries) {
                    mapState.retries += 1;
                    setTimeout(function () {
                        candidateIndex = 0;
                        tryLoadCandidate();
                    }, 700 * mapState.retries);
                } else {
                    console.error('Map loading failed for ' + eid + '/' + mapPurpose + ' after ' + maxRetries + ' attempts');
                    mapState.unavailable = true;
                    mapState.promise = null;
                    reject(new Error('Map failed to load: ' + eid + '/' + mapPurpose));
                }
            };

            tryLoadCandidate();
        });

        return mapState.promise;
    }

    // ---- switch event ----

    function switchEvent(eventId) {
        ensureDeps();
        var activeGameId = deps.enforceGameplayContext();
        if (!activeGameId) {
            return;
        }
        var currentEvent = deps.getCurrentEvent();
        var targetEventId = normalizeEventId(eventId);
        if (!targetEventId || !global.DSCoreEvents.getEvent(targetEventId)) return;
        if (targetEventId === currentEvent) {
            deps.setEventEditorCurrentId(targetEventId);
            deps.setEventEditorIsEditMode(false);
            applySelectedEventToEditor();
            renderEventsList();
            updateEventEditorState();
            return;
        }
        ensureEventRuntimeState(targetEventId);
        deps.setCurrentEvent(targetEventId);
        deps.setEventEditorCurrentId(targetEventId);
        deps.setEventEditorIsEditMode(false);

        renderAllEventSelectors();
        renderEventsList();
        updateEventEditorTitle();
        applySelectedEventToEditor();
        refreshEventEditorDeleteState();
        updateEventEditorState();

        deps.loadBuildingConfig();
        deps.loadBuildingPositions();

        if (deps.isConfigurationPageVisible()) {
            deps.renderBuildingsTable();
        }

        var coordOverlay = document.getElementById('coordPickerOverlay');
        if (coordOverlay && !coordOverlay.classList.contains('hidden')) {
            deps.refreshCoordinatesPickerForCurrentEvent();
        }

        deps.clearAssignments();

        updateGenerateEventLabels();

        var coordOverlayVisible = coordOverlay && !coordOverlay.classList.contains('hidden');
        var exportMapState = getMapRuntimeStateFn(targetEventId, MAP_EXPORT);
        if (coordOverlayVisible && exportMapState && !exportMapState.loaded) {
            loadMapImage(targetEventId, MAP_EXPORT).catch(function () {
                console.warn(targetEventId + ' export map failed to load');
            });
        }
    }

    function updateGenerateEventLabels() {
        var activeEvent = getActiveEvent();
        var label = activeEvent ? activeEvent.mapTitle : '';
        var elA = document.getElementById('generateEventLabelA');
        var elB = document.getElementById('generateEventLabelB');
        if (elA) elA.textContent = label;
        if (elB) elB.textContent = label;
    }

    // ---- avatar ----

    function generateEventAvatarDataUrl(nameSeed, idSeed) {
        var seed = (nameSeed || '') + '|' + (idSeed || '') + '|event-avatar';
        var hue = hashString(seed) % 360;
        var canvas = document.createElement('canvas');
        canvas.width = 96;
        canvas.height = 96;
        var ctx = canvas.getContext('2d');
        if (!ctx) {
            return '';
        }
        var grad = ctx.createLinearGradient(0, 0, 96, 96);
        grad.addColorStop(0, 'hsl(' + hue + ', 78%, 50%)');
        grad.addColorStop(1, 'hsl(' + ((hue + 60) % 360) + ', 72%, 40%)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 96, 96);
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.font = 'bold 34px Trebuchet MS';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(deps.getAvatarInitials(nameSeed || 'Event', ''), 48, 50);
        return canvas.toDataURL('image/png');
    }

    // ---- editor UI ----

    function updateEventLogoPreview() {
        var image = document.getElementById('eventLogoPreviewImage');
        if (!image) {
            return;
        }
        var nameInput = document.getElementById('eventNameInput');
        var eventEditorCurrentId = deps.getEventEditorCurrentId();
        var seedName = nameInput && typeof nameInput.value === 'string' && nameInput.value.trim()
            ? nameInput.value.trim()
            : (eventEditorCurrentId || 'Event');
        image.src = deps.getEventDraftLogoDataUrl() || generateEventAvatarDataUrl(seedName, eventEditorCurrentId || seedName);
    }

    function getEventMapPreviewSource(eventId) {
        if (!eventId) {
            return '';
        }
        var event = global.DSCoreEvents.getEvent(eventId);
        if (!event) {
            return '';
        }
        return event.mapDataUrl || '';
    }

    function updateEventMapPreview() {
        var image = document.getElementById('eventMapPreviewImage');
        var placeholder = document.getElementById('eventMapPreviewPlaceholder');
        if (!image || !placeholder) {
            return;
        }
        var eventEditorCurrentId = deps.getEventEditorCurrentId();
        var eventDraftMapRemoved = deps.getEventDraftMapRemoved();
        var fallbackMapSource = eventDraftMapRemoved ? '' : getEventMapPreviewSource(eventEditorCurrentId);
        var mapSource = deps.getEventDraftMapDataUrl() || fallbackMapSource;
        if (mapSource) {
            image.src = mapSource;
            image.classList.remove('hidden');
            placeholder.classList.add('hidden');
        } else {
            image.src = '';
            image.classList.add('hidden');
            placeholder.classList.remove('hidden');
        }
    }

    function updateEventEditorTitle() {
        var titleEl = document.getElementById('eventEditorTitle');
        if (!titleEl) {
            return;
        }
        var eventEditorCurrentId = deps.getEventEditorCurrentId();
        if (!eventEditorCurrentId) {
            titleEl.textContent = deps.t('events_manager_create_title');
            return;
        }
        var event = global.DSCoreEvents.getEvent(eventEditorCurrentId);
        var eventName = event ? (event.name || eventEditorCurrentId) : eventEditorCurrentId;
        titleEl.textContent = deps.getEventEditorIsEditMode()
            ? deps.t('events_manager_edit_title', { name: eventName })
            : eventName;
    }

    function isEventMapAvailable(eventId) {
        if (!eventId) {
            return false;
        }
        return Boolean(getEventMapPreviewSource(eventId));
    }

    function updateEventCoordinatesButton() {
        var button = document.getElementById('eventCoordinatesBtn');
        var row = document.getElementById('eventCoordinatesRow');
        if (!button) {
            return;
        }
        var eventEditorCurrentId = deps.getEventEditorCurrentId();
        var hasDraftMap = Boolean(deps.getEventDraftMapDataUrl());
        var hasSavedMap = !deps.getEventDraftMapRemoved() && isEventMapAvailable(eventEditorCurrentId);
        var showButton = hasDraftMap || hasSavedMap;
        if (row) {
            row.classList.toggle('hidden', !showButton);
        }
        button.classList.toggle('hidden', !showButton);
        button.disabled = !showButton;
    }

    function updateEventMapActionButtons(readOnly) {
        var uploadBtn = document.getElementById('eventMapUploadBtn');
        var removeBtn = document.getElementById('eventMapRemoveBtn');
        var eventEditorCurrentId = deps.getEventEditorCurrentId();
        var hasDraftMap = Boolean(deps.getEventDraftMapDataUrl());
        var hasSavedMap = !deps.getEventDraftMapRemoved() && isEventMapAvailable(eventEditorCurrentId);
        var hasMap = hasDraftMap || hasSavedMap;
        var canEditMap = !readOnly;

        if (uploadBtn) {
            var showUpload = canEditMap && !hasMap;
            uploadBtn.classList.toggle('hidden', !showUpload);
            uploadBtn.disabled = !showUpload;
        }
        if (removeBtn) {
            var showRemove = canEditMap && hasMap;
            removeBtn.classList.toggle('hidden', !showRemove);
            removeBtn.disabled = !showRemove;
        }
    }

    function updateEventEditorState() {
        var eventEditorCurrentId = deps.getEventEditorCurrentId();
        var eventEditorIsEditMode = deps.getEventEditorIsEditMode();
        var isNewDraft = !eventEditorCurrentId;
        var readOnly = !isNewDraft && !eventEditorIsEditMode;

        var eventNameInput = document.getElementById('eventNameInput');
        if (eventNameInput) {
            eventNameInput.disabled = readOnly;
        }

        ['eventLogoUploadBtn', 'eventLogoRandomBtn', 'eventAddBuildingBtn', 'eventSaveBtn', 'eventCancelEditBtn', 'eventAssignmentAlgorithmInput'].forEach(function (id) {
            var element = document.getElementById(id);
            if (element) {
                element.disabled = readOnly;
            }
        });

        ['eventLogoInput', 'eventMapInput'].forEach(function (id) {
            var input = document.getElementById(id);
            if (input) {
                input.disabled = readOnly;
            }
        });

        var rows = document.querySelectorAll(
            '#eventBuildingsEditorBody input, #eventBuildingsEditorBody button[data-action="remove-row"], #eventBuildingsEditorBody .display-toggle-btn'
        );
        rows.forEach(function (element) {
            element.disabled = readOnly;
        });

        var deleteBtn = document.getElementById('eventDeleteBtn');
        if (deleteBtn) {
            deleteBtn.disabled = readOnly || !eventEditorCurrentId || getProtectedEventIds().has(eventEditorCurrentId);
        }

        var editBtn = document.getElementById('eventEditModeBtn');
        if (editBtn) {
            var showEditBtn = !isNewDraft && !eventEditorIsEditMode;
            editBtn.classList.toggle('hidden', !showEditBtn);
            editBtn.disabled = !showEditBtn;
            editBtn.title = deps.t('events_manager_edit_action');
            editBtn.setAttribute('aria-label', deps.t('events_manager_edit_action'));
        }

        var cancelBtn = document.getElementById('eventCancelEditBtn');
        if (cancelBtn) {
            var showCancelBtn = eventEditorIsEditMode;
            cancelBtn.classList.toggle('hidden', !showCancelBtn);
            cancelBtn.disabled = !showCancelBtn;
            cancelBtn.title = deps.t('settings_cancel');
            cancelBtn.setAttribute('aria-label', deps.t('settings_cancel'));
        }

        var logoUploadBtn = document.getElementById('eventLogoUploadBtn');
        var logoRandomBtn = document.getElementById('eventLogoRandomBtn');
        var addBuildingBtn = document.getElementById('eventAddBuildingBtn');
        if (addBuildingBtn) {
            addBuildingBtn.title = deps.t('events_manager_add_building');
            addBuildingBtn.setAttribute('aria-label', deps.t('events_manager_add_building'));
        }
        if (logoUploadBtn) {
            logoUploadBtn.title = deps.t('events_manager_logo_upload');
            logoUploadBtn.setAttribute('aria-label', deps.t('events_manager_logo_upload'));
            logoUploadBtn.classList.toggle('hidden', readOnly);
        }
        if (logoRandomBtn) {
            logoRandomBtn.title = deps.t('events_manager_logo_randomize');
            logoRandomBtn.setAttribute('aria-label', deps.t('events_manager_logo_randomize'));
            logoRandomBtn.classList.toggle('hidden', readOnly);
        }

        var mapUploadBtn = document.getElementById('eventMapUploadBtn');
        var mapRemoveBtn = document.getElementById('eventMapRemoveBtn');
        if (mapUploadBtn) {
            mapUploadBtn.title = deps.t('events_manager_map_upload');
            mapUploadBtn.setAttribute('aria-label', deps.t('events_manager_map_upload'));
        }
        if (mapRemoveBtn) {
            mapRemoveBtn.title = deps.t('events_manager_map_remove');
            mapRemoveBtn.setAttribute('aria-label', deps.t('events_manager_map_remove'));
        }

        updateEventMapActionButtons(readOnly);
        updateEventCoordinatesButton();
        updateEventEditorTitle();
    }

    function enterEventEditMode() {
        if (!deps.getEventEditorCurrentId()) {
            return;
        }
        deps.setEventEditorIsEditMode(true);
        updateEventEditorState();
    }

    function cancelEventEditing() {
        if (!deps.getEventEditorIsEditMode()) {
            return;
        }
        var eventEditorCurrentId = deps.getEventEditorCurrentId();
        var currentEvent = deps.getCurrentEvent();
        if (!eventEditorCurrentId) {
            var fallbackEventId = (currentEvent && global.DSCoreEvents.getEvent(currentEvent))
                ? currentEvent
                : (getEventIds()[0] || '');
            deps.setEventEditorCurrentId(fallbackEventId);
            eventEditorCurrentId = fallbackEventId;
        }

        if (!eventEditorCurrentId || !global.DSCoreEvents.getEvent(eventEditorCurrentId)) {
            startNewEventDraft();
            return;
        }

        deps.setEventEditorIsEditMode(false);
        applySelectedEventToEditor();
        renderEventsList();
        refreshEventEditorDeleteState();
        var statusEl = document.getElementById('eventsStatus');
        if (statusEl) {
            statusEl.replaceChildren();
        }
    }

    function openCoordinatesPickerFromEditor() {
        var eventEditorCurrentId = deps.getEventEditorCurrentId();
        if (!eventEditorCurrentId) {
            deps.showMessage('eventsStatus', deps.t('events_manager_coordinates_save_first'), 'warning');
            return;
        }
        if ((!isEventMapAvailable(eventEditorCurrentId) || deps.getEventDraftMapRemoved()) && !deps.getEventDraftMapDataUrl()) {
            deps.showMessage('eventsStatus', deps.t('events_manager_coordinates_missing_map'), 'warning');
            return;
        }
        if (deps.getCurrentEvent() !== eventEditorCurrentId) {
            switchEvent(eventEditorCurrentId);
        }
        deps.openCoordinatesPicker();
    }

    // ---- building editor delegation ----

    function createEditorBuildingRow(rowData) {
        if (global.DSEventBuildingsEditorUI && typeof global.DSEventBuildingsEditorUI.createEditorBuildingRow === 'function') {
            return global.DSEventBuildingsEditorUI.createEditorBuildingRow({
                rowData: rowData,
                translate: deps.t,
                escapeAttribute: deps.escapeAttribute,
                clampSlots: deps.clampSlots,
                clampPriority: deps.clampPriority,
                minSlots: MIN_BUILDING_SLOTS,
                maxSlots: MAX_BUILDING_SLOTS_TOTAL,
            });
        }
        return document.createElement('tr');
    }

    function renderEventBuildingsEditor(buildings) {
        var tbody = document.getElementById('eventBuildingsEditorBody');
        if (global.DSEventBuildingsEditorUI && typeof global.DSEventBuildingsEditorUI.renderEventBuildingsEditor === 'function') {
            global.DSEventBuildingsEditorUI.renderEventBuildingsEditor({
                tbody: tbody,
                buildings: buildings,
                defaultRows: [{ name: '', slots: 0, priority: 1, showOnMap: true }],
                createRow: createEditorBuildingRow,
            });
            return;
        }
        if (tbody) {
            tbody.innerHTML = '';
            tbody.appendChild(createEditorBuildingRow({ name: '', slots: 0, priority: 1, showOnMap: true }));
        }
    }

    function addEventBuildingRow() {
        var tbody = document.getElementById('eventBuildingsEditorBody');
        if (global.DSEventBuildingsEditorUI && typeof global.DSEventBuildingsEditorUI.addEventBuildingRow === 'function') {
            global.DSEventBuildingsEditorUI.addEventBuildingRow({
                tbody: tbody,
                canEdit: deps.getEventEditorIsEditMode(),
                createRow: createEditorBuildingRow,
                rowData: { name: '', slots: 0, priority: 1, showOnMap: true },
            });
            return;
        }
        if (!deps.getEventEditorIsEditMode() || !tbody) {
            return;
        }
        tbody.appendChild(createEditorBuildingRow({ name: '', slots: 0, priority: 1, showOnMap: true }));
    }

    function readEventBuildingsEditor() {
        var tbody = document.getElementById('eventBuildingsEditorBody');
        if (global.DSEventBuildingsEditorUI && typeof global.DSEventBuildingsEditorUI.readEventBuildingsEditor === 'function') {
            return global.DSEventBuildingsEditorUI.readEventBuildingsEditor({
                tbody: tbody,
                translate: deps.t,
                clampSlots: deps.clampSlots,
                clampPriority: deps.clampPriority,
            });
        }
        if (!tbody) {
            return { buildings: [], error: deps.t('events_manager_buildings_required') };
        }
        return { buildings: [], error: null };
    }

    function bindEventEditorTableActions() {
        var tbody = document.getElementById('eventBuildingsEditorBody');
        if (global.DSEventBuildingsEditorUI && typeof global.DSEventBuildingsEditorUI.bindEventEditorTableActions === 'function') {
            global.DSEventBuildingsEditorUI.bindEventEditorTableActions({
                tbody: tbody,
                canEdit: function () { return deps.getEventEditorIsEditMode(); },
                ensureAtLeastOneRow: function () { addEventBuildingRow(); },
            });
            return;
        }
    }

    function setEditorName(value) {
        var input = document.getElementById('eventNameInput');
        if (input) {
            input.value = value || '';
        }
    }

    // ---- algorithm select ----

    function getEventAlgorithmSelectElement() {
        return document.getElementById('eventAssignmentAlgorithmInput');
    }

    function listSelectableAssignmentAlgorithmsForActiveGame() {
        var gameplayContext = deps.getGameplayContext();
        var gameId = gameplayContext ? gameplayContext.gameId : '';
        if (global.DSAssignmentRegistry && typeof global.DSAssignmentRegistry.listAlgorithmsForGame === 'function') {
            var algorithms = global.DSAssignmentRegistry.listAlgorithmsForGame(gameId);
            if (Array.isArray(algorithms) && algorithms.length > 0) {
                return algorithms
                    .filter(function (entry) { return entry && typeof entry.id === 'string'; })
                    .map(function (entry) {
                        return {
                            id: normalizeAssignmentAlgorithmId(entry.id),
                            name: typeof entry.name === 'string' && entry.name.trim() ? entry.name.trim() : entry.id,
                        };
                    })
                    .filter(function (entry) { return !!entry.id; });
            }
        }
        return [{
            id: DEFAULT_ASSIGNMENT_ALGORITHM_ID,
            name: 'Balanced Round Robin',
        }];
    }

    function renderEventAssignmentAlgorithmOptions(selectedAlgorithmId) {
        var select = getEventAlgorithmSelectElement();
        if (!select) {
            return;
        }
        var algorithms = listSelectableAssignmentAlgorithmsForActiveGame();
        var fallbackId = algorithms[0] ? algorithms[0].id : DEFAULT_ASSIGNMENT_ALGORITHM_ID;
        var selectedId = normalizeAssignmentAlgorithmId(selectedAlgorithmId) || fallbackId;
        select.innerHTML = '';
        algorithms.forEach(function (algorithm) {
            var option = document.createElement('option');
            option.value = algorithm.id;
            option.textContent = algorithm.name;
            select.appendChild(option);
        });
        var hasSelected = algorithms.some(function (algorithm) { return algorithm.id === selectedId; });
        select.value = hasSelected ? selectedId : fallbackId;
    }

    function getSelectedEventAssignmentAlgorithmId() {
        var select = getEventAlgorithmSelectElement();
        var selected = select && typeof select.value === 'string' ? normalizeAssignmentAlgorithmId(select.value) : '';
        if (selected) {
            return selected;
        }
        var algorithms = listSelectableAssignmentAlgorithmsForActiveGame();
        return algorithms[0] ? algorithms[0].id : DEFAULT_ASSIGNMENT_ALGORITHM_ID;
    }

    // ---- apply/render ----

    function applySelectedEventToEditor() {
        var eventEditorCurrentId = deps.getEventEditorCurrentId();
        var currentEvent = deps.getCurrentEvent();
        if (!eventEditorCurrentId) {
            deps.setEventEditorCurrentId(currentEvent);
            eventEditorCurrentId = currentEvent;
        }
        var event = global.DSCoreEvents.getEvent(eventEditorCurrentId);
        if (!event) {
            startNewEventDraft();
            return;
        }
        setEditorName(event.name || eventEditorCurrentId);
        deps.setEventDraftLogoDataUrl(event.logoDataUrl || generateEventAvatarDataUrl(event.name || eventEditorCurrentId, eventEditorCurrentId));
        deps.setEventDraftMapDataUrl(event.mapDataUrl || '');
        deps.setEventDraftMapRemoved(false);
        renderEventAssignmentAlgorithmOptions(event.assignmentAlgorithmId);
        updateEventLogoPreview();
        updateEventMapPreview();
        renderEventBuildingsEditor(Array.isArray(event.buildings) ? event.buildings : []);
        updateEventEditorState();
    }

    function renderEventsList() {
        var currentEvent = deps.getCurrentEvent();
        var eventEditorCurrentId = deps.getEventEditorCurrentId();
        if (global.DSEventListUI && typeof global.DSEventListUI.renderEventsList === 'function') {
            global.DSEventListUI.renderEventsList({
                listElement: document.getElementById('eventsList'),
                eventIds: getEventIds(),
                getEventById: function (eventId) { return global.DSCoreEvents.getEvent(eventId); },
                currentEventId: currentEvent,
                eventEditorCurrentId: eventEditorCurrentId,
                generateAvatarDataUrl: generateEventAvatarDataUrl,
                translate: deps.t,
                onSelectEvent: function (eventId) {
                    deps.setEventEditorCurrentId(eventId);
                    switchEvent(eventId);
                },
                onStartNewEvent: function () {
                    startNewEventDraft();
                    renderEventsList();
                },
            });
            return;
        }

        var listEl = document.getElementById('eventsList');
        if (!listEl) {
            return;
        }
    }

    function startNewEventDraft() {
        deps.setEventEditorCurrentId('');
        deps.setEventEditorIsEditMode(true);
        setEditorName('');
        var gameplayContext = deps.getGameplayContext();
        renderEventAssignmentAlgorithmOptions(resolveDefaultAssignmentAlgorithmId(gameplayContext ? gameplayContext.gameId : ''));
        deps.setEventDraftLogoDataUrl('');
        deps.setEventDraftMapDataUrl('');
        deps.setEventDraftMapRemoved(false);
        updateEventLogoPreview();
        updateEventMapPreview();
        renderEventBuildingsEditor([{ name: 'Bomb Squad', slots: 4, priority: 1, showOnMap: true }]);
        updateEventEditorState();
        var deleteBtn = document.getElementById('eventDeleteBtn');
        if (deleteBtn) {
            deleteBtn.disabled = true;
        }
    }

    function refreshEventEditorDeleteState() {
        var deleteBtn = document.getElementById('eventDeleteBtn');
        if (!deleteBtn) {
            return;
        }
        var eventEditorCurrentId = deps.getEventEditorCurrentId();
        deleteBtn.disabled = !eventEditorCurrentId || getProtectedEventIds().has(eventEditorCurrentId) || !deps.getEventEditorIsEditMode();
    }

    // ---- upload triggers ----

    function triggerEventLogoUpload() {
        if (!deps.getEventEditorIsEditMode()) {
            return;
        }
        var input = document.getElementById('eventLogoInput');
        if (input) {
            input.click();
        }
    }

    function triggerEventMapUpload() {
        if (!deps.getEventEditorIsEditMode()) {
            return;
        }
        var input = document.getElementById('eventMapInput');
        if (input) {
            input.click();
        }
    }

    function removeEventLogo() {
        if (!deps.getEventEditorIsEditMode()) {
            return;
        }
        deps.setEventDraftLogoDataUrl('');
        var input = document.getElementById('eventLogoInput');
        if (input) {
            input.value = '';
        }
        updateEventLogoPreview();
    }

    function removeEventMap() {
        if (!deps.getEventEditorIsEditMode()) {
            return;
        }
        deps.setEventDraftMapDataUrl('');
        deps.setEventDraftMapRemoved(true);
        var input = document.getElementById('eventMapInput');
        if (input) {
            input.value = '';
        }
        updateEventMapPreview();
        updateEventEditorState();
    }

    // ---- image processing ----

    async function createEventImageDataUrl(file, options) {
        var opts = options && typeof options === 'object' ? options : {};
        var maxBytes = Number(opts.maxBytes) || deps.AVATAR_MAX_UPLOAD_BYTES;
        var minDimension = Number(opts.minDimension) || deps.AVATAR_MIN_DIMENSION;
        var maxSide = Number(opts.maxSide) || 512;
        var maxDataUrlLength = Number(opts.maxDataUrlLength) || deps.EVENT_MAP_DATA_URL_LIMIT;
        var tooLargeMessage = opts.tooLargeMessage || deps.t('events_manager_image_too_large');
        var tooSmallMessage = opts.tooSmallMessage || deps.t('events_manager_image_too_small', { min: minDimension });

        if (!deps.isAllowedAvatarFile(file)) {
            throw new Error(deps.t('events_manager_invalid_image'));
        }
        if (typeof file.size === 'number' && file.size > maxBytes) {
            throw new Error(tooLargeMessage);
        }
        var rawDataUrl = await deps.readFileAsDataUrl(file);
        var img = await deps.loadImageFromDataUrl(rawDataUrl);
        if ((img.width || 0) < minDimension || (img.height || 0) < minDimension) {
            throw new Error(tooSmallMessage);
        }

        var longestSide = Math.max(img.width || 1, img.height || 1);
        var scale = Math.min(1, maxSide / longestSide);
        var width = Math.max(1, Math.round((img.width || 1) * scale));
        var height = Math.max(1, Math.round((img.height || 1) * scale));
        var canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        var ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error(deps.t('events_manager_image_process_failed'));
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        var qualities = [0.9, 0.8, 0.7, 0.6];
        for (var i = 0; i < qualities.length; i++) {
            var jpegDataUrl = canvas.toDataURL('image/jpeg', qualities[i]);
            if (jpegDataUrl.length <= maxDataUrlLength) {
                return jpegDataUrl;
            }
        }
        var pngDataUrl = canvas.toDataURL('image/png');
        if (pngDataUrl.length <= maxDataUrlLength) {
            return pngDataUrl;
        }
        throw new Error(deps.t('events_manager_image_data_too_large'));
    }

    async function createContainedSquareImageDataUrl(sourceDataUrl, options) {
        var opts = options && typeof options === 'object' ? options : {};
        var sideRaw = Number(opts.side);
        var side = Number.isFinite(sideRaw) && sideRaw > 0 ? Math.round(sideRaw) : 320;
        var maxDataUrlLength = Number(opts.maxDataUrlLength) || deps.EVENT_LOGO_DATA_URL_LIMIT;
        var img = await deps.loadImageFromDataUrl(sourceDataUrl);
        var canvas = document.createElement('canvas');
        canvas.width = side;
        canvas.height = side;
        var ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error(deps.t('events_manager_image_process_failed'));
        }

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, side, side);

        var sourceWidth = Math.max(1, Number(img.width) || 1);
        var sourceHeight = Math.max(1, Number(img.height) || 1);
        var drawScale = Math.min(side / sourceWidth, side / sourceHeight);
        var drawWidth = Math.max(1, Math.round(sourceWidth * drawScale));
        var drawHeight = Math.max(1, Math.round(sourceHeight * drawScale));
        var offsetX = Math.round((side - drawWidth) / 2);
        var offsetY = Math.round((side - drawHeight) / 2);
        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

        var qualities = [0.9, 0.8, 0.7, 0.6];
        for (var i = 0; i < qualities.length; i++) {
            var jpegDataUrl = canvas.toDataURL('image/jpeg', qualities[i]);
            if (jpegDataUrl.length <= maxDataUrlLength) {
                return jpegDataUrl;
            }
        }
        var pngDataUrl = canvas.toDataURL('image/png');
        if (pngDataUrl.length <= maxDataUrlLength) {
            return pngDataUrl;
        }
        throw new Error(deps.t('events_manager_image_data_too_large'));
    }

    async function createGameMetadataLogoDataUrl(file) {
        var resized = await createEventImageDataUrl(file, {
            maxBytes: deps.AVATAR_MAX_UPLOAD_BYTES,
            minDimension: deps.AVATAR_MIN_DIMENSION,
            maxSide: 320,
            maxDataUrlLength: deps.EVENT_LOGO_DATA_URL_LIMIT,
            tooLargeMessage: deps.t('events_manager_logo_too_large'),
        });
        return createContainedSquareImageDataUrl(resized, {
            side: 320,
            maxDataUrlLength: deps.EVENT_LOGO_DATA_URL_LIMIT,
        });
    }

    // ---- file change handlers ----

    async function handleEventLogoChange(event) {
        var input = event && event.target ? event.target : document.getElementById('eventLogoInput');
        var file = input && input.files ? input.files[0] : null;
        if (!file) {
            return;
        }
        try {
            deps.setEventDraftLogoDataUrl(await createEventImageDataUrl(file, {
                maxBytes: deps.AVATAR_MAX_UPLOAD_BYTES,
                minDimension: deps.AVATAR_MIN_DIMENSION,
                maxSide: 320,
                maxDataUrlLength: deps.EVENT_LOGO_DATA_URL_LIMIT,
                tooLargeMessage: deps.t('events_manager_logo_too_large'),
            }));
            updateEventLogoPreview();
            deps.showMessage('eventsStatus', deps.t('events_manager_logo_saved'), 'success');
        } catch (error) {
            deps.showMessage('eventsStatus', error.message || deps.t('events_manager_image_process_failed'), 'error');
        } finally {
            if (input) {
                input.value = '';
            }
        }
    }

    async function handleEventMapChange(event) {
        var input = event && event.target ? event.target : document.getElementById('eventMapInput');
        var file = input && input.files ? input.files[0] : null;
        if (!file) {
            return;
        }
        try {
            deps.setEventDraftMapDataUrl(await createEventImageDataUrl(file, {
                maxBytes: 4 * 1024 * 1024,
                minDimension: 320,
                maxSide: MAP_UPLOAD_MAX_SIDE,
                maxDataUrlLength: deps.EVENT_MAP_DATA_URL_LIMIT,
                tooLargeMessage: deps.t('events_manager_map_too_large'),
            }));
            deps.setEventDraftMapRemoved(false);
            updateEventMapPreview();
            updateEventEditorState();
            deps.showMessage('eventsStatus', deps.t('events_manager_map_saved'), 'success');
        } catch (error) {
            deps.showMessage('eventsStatus', error.message || deps.t('events_manager_image_process_failed'), 'error');
        } finally {
            if (input) {
                input.value = '';
            }
        }
    }

    // ---- event definition build ----

    function buildEventDefinition(eventId, name, buildings, assignmentAlgorithmId) {
        var existing = global.DSCoreEvents.getEvent(eventId) || {};
        var mapDataUrl = deps.getEventDraftMapDataUrl() || '';
        var logoDataUrl = deps.getEventDraftLogoDataUrl() || generateEventAvatarDataUrl(name, eventId);
        var gameplayContext = deps.getGameplayContext();
        var normalizedAssignmentAlgorithmId = normalizeAssignmentAlgorithmId(assignmentAlgorithmId)
            || normalizeAssignmentAlgorithmId(existing.assignmentAlgorithmId)
            || resolveDefaultAssignmentAlgorithmId(gameplayContext ? gameplayContext.gameId : '');
        var validNames = new Set(buildings.map(function (item) { return item.name; }));
        var currentPositions = buildingPositionsMap[eventId] || (existing.defaultPositions || {});
        var normalizedPositions = global.DSCoreBuildings.normalizeBuildingPositions(currentPositions, validNames);
        return {
            id: eventId,
            name: name,
            titleKey: existing.titleKey || '',
            mapFile: mapDataUrl || '',
            previewMapFile: mapDataUrl || '',
            exportMapFile: mapDataUrl || '',
            mapTitle: name.toUpperCase().slice(0, 50),
            excelPrefix: normalizeEventId(existing.excelPrefix || eventId) || eventId,
            logoDataUrl: logoDataUrl,
            mapDataUrl: mapDataUrl,
            assignmentAlgorithmId: normalizedAssignmentAlgorithmId,
            buildings: buildings,
            defaultPositions: normalizedPositions,
            buildingAnchors: existing.buildingAnchors || {},
        };
    }

    // ---- save / delete ----

    async function saveEventDefinition() {
        var gameplayContext = deps.getGameplayContext('eventsStatus');
        if (!gameplayContext) {
            return;
        }
        if (!deps.getEventEditorIsEditMode()) {
            deps.showMessage('eventsStatus', deps.t('events_manager_edit_first'), 'warning');
            return;
        }
        var nameInput = document.getElementById('eventNameInput');
        var rawName = nameInput && typeof nameInput.value === 'string' ? nameInput.value.trim() : '';
        var eventName = rawName.slice(0, deps.EVENT_NAME_LIMIT);
        if (!eventName) {
            deps.showMessage('eventsStatus', deps.t('events_manager_name_required'), 'error');
            return;
        }

        var result = readEventBuildingsEditor();
        if (result.error) {
            deps.showMessage('eventsStatus', result.error, 'error');
            return;
        }
        var buildings = result.buildings;

        var existingIds = getEventIds();
        var eventEditorCurrentId = deps.getEventEditorCurrentId();
        var eventId = eventEditorCurrentId || global.DSCoreEvents.slugifyEventId(eventName, existingIds);
        var eventContext = { gameId: gameplayContext.gameId, eventId: eventId };
        var assignmentAlgorithmId = getSelectedEventAssignmentAlgorithmId();
        var definition = buildEventDefinition(eventId, eventName, buildings, assignmentAlgorithmId);
        var isNewEvent = !eventEditorCurrentId;

        global.DSCoreEvents.upsertEvent(eventId, definition);
        ensureEventRuntimeState(eventId);
        buildingConfigs[eventId] = deps.normalizeBuildingConfig(buildings, buildings);
        var validNames = new Set(buildings.map(function (item) { return item.name; }));
        buildingPositionsMap[eventId] = global.DSCoreBuildings.normalizeBuildingPositions(
            buildingPositionsMap[eventId] || definition.defaultPositions || {},
            validNames
        );
        resetMapStateForEvent(eventId);

        var FirebaseService = deps.getFirebaseService();
        if (FirebaseService) {
            if (FirebaseService.upsertEvent) {
                FirebaseService.upsertEvent(eventId, {
                    id: eventId,
                    name: definition.name,
                    logoDataUrl: definition.logoDataUrl,
                    mapDataUrl: definition.mapDataUrl,
                    assignmentAlgorithmId: definition.assignmentAlgorithmId,
                    buildingConfig: buildingConfigs[eventId],
                    buildingPositions: buildingPositionsMap[eventId],
                }, eventContext);
            }
            FirebaseService.setBuildingConfig(eventId, buildingConfigs[eventId], eventContext);
            FirebaseService.setBuildingConfigVersion(eventId, deps.getTargetBuildingConfigVersion(), eventContext);
            FirebaseService.setBuildingPositions(eventId, buildingPositionsMap[eventId], eventContext);
            FirebaseService.setBuildingPositionsVersion(eventId, deps.getTargetBuildingPositionsVersion(), eventContext);
            var saveResult = await FirebaseService.saveUserData(undefined, gameplayContext);
            if (!saveResult || !saveResult.success) {
                deps.showMessage('eventsStatus', deps.t('events_manager_save_failed', { error: (saveResult && saveResult.error) || 'unknown' }), 'error');
                return;
            }
        }

        deps.setEventEditorCurrentId(eventId);
        deps.setCurrentEvent(eventId);
        deps.setEventEditorIsEditMode(false);
        syncRuntimeStateWithRegistry();
        renderAllEventSelectors();
        renderEventsList();
        refreshEventEditorDeleteState();
        updateEventEditorState();
        updateGenerateEventLabels();
        deps.loadBuildingConfig();
        deps.loadBuildingPositions();
        deps.renderBuildingsTable();
        deps.showMessage('eventsStatus', deps.t('events_manager_saved'), 'success');

        if (isNewEvent && definition.mapDataUrl) {
            deps.openCoordinatesPicker();
        }
    }

    async function deleteSelectedEvent() {
        var gameplayContext = deps.getGameplayContext('eventsStatus');
        if (!gameplayContext) {
            return;
        }
        if (!deps.getEventEditorIsEditMode()) {
            deps.showMessage('eventsStatus', deps.t('events_manager_edit_first'), 'warning');
            return;
        }
        var eventEditorCurrentId = deps.getEventEditorCurrentId();
        if (!eventEditorCurrentId) {
            deps.showMessage('eventsStatus', deps.t('events_manager_delete_pick_event'), 'error');
            return;
        }
        if (getProtectedEventIds().has(eventEditorCurrentId)) {
            deps.showMessage('eventsStatus', deps.t('events_manager_delete_protected'), 'warning');
            return;
        }
        if (!confirm(deps.t('events_manager_delete_confirm'))) {
            return;
        }

        var eventId = eventEditorCurrentId;
        var eventContext = { gameId: gameplayContext.gameId, eventId: eventId };
        var removed = global.DSCoreEvents.removeEvent(eventId);
        if (!removed) {
            deps.showMessage('eventsStatus', deps.t('events_manager_delete_failed'), 'error');
            return;
        }

        delete buildingConfigs[eventId];
        delete buildingPositionsMap[eventId];
        deleteMapRuntimeStateForEvent(eventId);
        delete coordMapWarningShown[eventId];

        var FirebaseService = deps.getFirebaseService();
        if (FirebaseService && FirebaseService.removeEvent) {
            FirebaseService.removeEvent(eventId, eventContext);
            var result = await FirebaseService.saveUserData(undefined, gameplayContext);
            if (!result || !result.success) {
                deps.showMessage('eventsStatus', deps.t('events_manager_delete_failed'), 'error');
                return;
            }
        }

        syncRuntimeStateWithRegistry();
        var firstEvent = getEventIds()[0] || '';
        if (firstEvent) {
            deps.setCurrentEvent(firstEvent);
        }
        startNewEventDraft();
        renderAllEventSelectors();
        renderEventsList();
        updateGenerateEventLabels();
        deps.loadBuildingConfig();
        deps.loadBuildingPositions();
        deps.renderBuildingsTable();
        deps.showMessage('eventsStatus', deps.t('events_manager_deleted'), 'success');
    }

    // ---- public API ----

    global.DSEventsRegistryController = {
        // init
        init: function (dependencies) {
            deps = dependencies;
        },

        // constants
        DEFAULT_ASSIGNMENT_ALGORITHM_ID: DEFAULT_ASSIGNMENT_ALGORITHM_ID,
        MAP_PREVIEW: MAP_PREVIEW,
        MAP_EXPORT: MAP_EXPORT,
        MAP_CANVAS_WIDTH: MAP_CANVAS_WIDTH,
        MAP_CANVAS_FALLBACK_HEIGHT: MAP_CANVAS_FALLBACK_HEIGHT,
        MAP_GRID_STEP: MAP_GRID_STEP,
        MAP_UPLOAD_MAX_SIDE: MAP_UPLOAD_MAX_SIDE,
        BUILDING_POSITIONS_VERSION: BUILDING_POSITIONS_VERSION,
        BUILDING_CONFIG_VERSION: BUILDING_CONFIG_VERSION,
        MAX_BUILDING_SLOTS_TOTAL: MAX_BUILDING_SLOTS_TOTAL,
        MIN_BUILDING_SLOTS: MIN_BUILDING_SLOTS,
        textColors: textColors,
        bgColors: bgColors,

        // state accessors
        getBuildingConfigs: function () { return buildingConfigs; },
        getBuildingPositionsMap: function () { return buildingPositionsMap; },
        getCoordMapWarningShown: function () { return coordMapWarningShown; },
        getProtectedEventIds: getProtectedEventIds,

        // normalizers
        normalizeEventId: normalizeEventId,
        normalizeAssignmentAlgorithmId: normalizeAssignmentAlgorithmId,
        normalizeGameId: normalizeGameId,
        normalizeMapPurpose: normalizeMapPurpose,
        normalizeStoredEventsData: normalizeStoredEventsData,
        isImageDataUrl: isImageDataUrl,
        hashString: hashString,
        resolveDefaultAssignmentAlgorithmId: resolveDefaultAssignmentAlgorithmId,

        // event ids / active event
        getEventIds: getEventIds,
        getActiveEvent: getActiveEvent,
        getEventDisplayName: getEventDisplayName,

        // runtime state management
        ensureEventRuntimeState: ensureEventRuntimeState,
        resetMapStateForEvent: resetMapStateForEvent,
        syncRuntimeStateWithRegistry: syncRuntimeStateWithRegistry,
        getMapRuntimeState: getMapRuntimeStateFn,
        deleteMapRuntimeStateForEvent: deleteMapRuntimeStateForEvent,

        // map
        getEventMapFile: getEventMapFile,
        loadMapImage: loadMapImage,

        // registry
        buildRegistryFromStorage: buildRegistryFromStorage,

        // event switching
        switchEvent: switchEvent,
        updateGenerateEventLabels: updateGenerateEventLabels,

        // avatar
        generateEventAvatarDataUrl: generateEventAvatarDataUrl,

        // editor UI
        updateEventLogoPreview: updateEventLogoPreview,
        updateEventMapPreview: updateEventMapPreview,
        updateEventEditorTitle: updateEventEditorTitle,
        updateEventEditorState: updateEventEditorState,
        updateEventCoordinatesButton: updateEventCoordinatesButton,
        updateEventMapActionButtons: updateEventMapActionButtons,
        isEventMapAvailable: isEventMapAvailable,
        getEventMapPreviewSource: getEventMapPreviewSource,
        enterEventEditMode: enterEventEditMode,
        cancelEventEditing: cancelEventEditing,
        openCoordinatesPickerFromEditor: openCoordinatesPickerFromEditor,

        // building editor
        createEditorBuildingRow: createEditorBuildingRow,
        renderEventBuildingsEditor: renderEventBuildingsEditor,
        addEventBuildingRow: addEventBuildingRow,
        readEventBuildingsEditor: readEventBuildingsEditor,
        bindEventEditorTableActions: bindEventEditorTableActions,
        setEditorName: setEditorName,

        // algorithm
        listSelectableAssignmentAlgorithmsForActiveGame: listSelectableAssignmentAlgorithmsForActiveGame,
        renderEventAssignmentAlgorithmOptions: renderEventAssignmentAlgorithmOptions,
        getSelectedEventAssignmentAlgorithmId: getSelectedEventAssignmentAlgorithmId,

        // apply / render
        applySelectedEventToEditor: applySelectedEventToEditor,
        renderEventsList: renderEventsList,
        renderAllEventSelectors: renderAllEventSelectors,
        renderEventSelector: renderEventSelector,
        createEventSelectorButton: createEventSelectorButton,
        startNewEventDraft: startNewEventDraft,
        refreshEventEditorDeleteState: refreshEventEditorDeleteState,

        // uploads
        triggerEventLogoUpload: triggerEventLogoUpload,
        triggerEventMapUpload: triggerEventMapUpload,
        removeEventLogo: removeEventLogo,
        removeEventMap: removeEventMap,

        // image processing
        createEventImageDataUrl: createEventImageDataUrl,
        createContainedSquareImageDataUrl: createContainedSquareImageDataUrl,
        createGameMetadataLogoDataUrl: createGameMetadataLogoDataUrl,

        // file handlers
        handleEventLogoChange: handleEventLogoChange,
        handleEventMapChange: handleEventMapChange,

        // event definition
        buildEventDefinition: buildEventDefinition,
        saveEventDefinition: saveEventDefinition,
        deleteSelectedEvent: deleteSelectedEvent,
    };
})(window);
