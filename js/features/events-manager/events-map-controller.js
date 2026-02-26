(function initEventsMapController(global) {
    'use strict';

    var MAP_PREVIEW = 'preview';
    var MAP_EXPORT = 'export';
    var MAP_CANVAS_WIDTH = 1080;
    var MAP_CANVAS_FALLBACK_HEIGHT = 720;
    var MAP_GRID_STEP = 90;
    var MAP_UPLOAD_MAX_SIDE = MAP_CANVAS_WIDTH;
    var maxRetries = 3;

    var textColors = { 1: '#8B0000', 2: '#B85C00', 3: '#006464', 4: '#006699', 5: '#226644', 6: '#556B2F' };
    var bgColors = { 1: 'rgba(255,230,230,0.9)', 2: 'rgba(255,240,220,0.9)', 3: 'rgba(230,255,250,0.9)',
                      4: 'rgba(230,245,255,0.9)', 5: 'rgba(240,255,240,0.9)', 6: 'rgba(245,255,235,0.9)' };

    var mapRuntimeState = new Map();

    // ---- map runtime state ----

    function normalizeEventId(value) {
        if (typeof value !== 'string') {
            return '';
        }
        return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    }

    function normalizeMapPurpose(purpose) {
        return purpose === MAP_EXPORT ? MAP_EXPORT : MAP_PREVIEW;
    }

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

    function resetMapStateForEvent(eventId) {
        var event = normalizeEventId(eventId);
        if (!event) {
            return;
        }
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
    }

    function cleanupOrphanedMapState(eventIdSet) {
        Array.from(mapRuntimeState.keys()).forEach(function (key) {
            var parts = key.split('::');
            var eventId = parts.length > 1 ? parts[1] : '';
            if (!eventIdSet.has(eventId)) {
                mapRuntimeState.delete(key);
            }
        });
    }

    // ---- map file resolution ----

    function getEventMapFile(eventId) {
        var evt = global.DSCoreEvents.getEvent(eventId);
        if (!evt) return null;
        var mapDataUrl = typeof evt.mapDataUrl === 'string' ? evt.mapDataUrl.trim() : '';
        return mapDataUrl || null;
    }

    // ---- map loading ----

    function loadMapImage(eventId, purpose, getCurrentEvent) {
        var currentEvent = typeof getCurrentEvent === 'function' ? getCurrentEvent() : eventId;
        var eid = eventId || currentEvent;
        var mapPurpose = normalizeMapPurpose(purpose);
        var mapState = ensureMapRuntimeState(normalizeEventId(eid), mapPurpose);
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

    global.DSEventsMapController = {
        // constants
        MAP_PREVIEW: MAP_PREVIEW,
        MAP_EXPORT: MAP_EXPORT,
        MAP_CANVAS_WIDTH: MAP_CANVAS_WIDTH,
        MAP_CANVAS_FALLBACK_HEIGHT: MAP_CANVAS_FALLBACK_HEIGHT,
        MAP_GRID_STEP: MAP_GRID_STEP,
        MAP_UPLOAD_MAX_SIDE: MAP_UPLOAD_MAX_SIDE,
        textColors: textColors,
        bgColors: bgColors,

        // runtime state
        ensureMapRuntimeState: ensureMapRuntimeState,
        getMapRuntimeState: getMapRuntimeStateFn,
        deleteMapRuntimeStateForEvent: deleteMapRuntimeStateForEvent,
        resetMapStateForEvent: resetMapStateForEvent,
        cleanupOrphanedMapState: cleanupOrphanedMapState,

        // map file
        getEventMapFile: getEventMapFile,
        loadMapImage: loadMapImage,

        // re-export helpers for consistency
        normalizeMapPurpose: normalizeMapPurpose,
    };
})(window);
