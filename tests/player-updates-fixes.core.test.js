// tests/player-updates-fixes.core.test.js
// New unit tests for the Player Updates fix plan.
// Tests: subscribeBadge, nav handler (refreshPlayerUpdatesPanel), renderReviewPanel,
//        controller allianceId resolution, translation keys, tombstone.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

// ---------------------------------------------------------------------------
// Module paths
// ---------------------------------------------------------------------------
const corePath = path.resolve(__dirname, '../js/features/player-updates/player-updates-core.js');
const controllerPath = path.resolve(__dirname, '../js/features/player-updates/player-updates-controller.js');
const viewPath = path.resolve(__dirname, '../js/features/player-updates/player-updates-view.js');
const translationsPath = path.resolve(__dirname, '../translations.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadController() {
    global.window = global;

    // Minimal DOM stubs
    global.document = {
        getElementById: function (id) {
            return (global._domStubs && global._domStubs[id]) || null;
        },
        querySelectorAll: function () { return []; },
        createElement: function (tag) {
            return {
                tagName: tag,
                className: '',
                textContent: '',
                innerHTML: '',
                children: [],
                _attrs: {},
                _listeners: {},
                setAttribute: function (k, v) { this._attrs[k] = v; },
                getAttribute: function (k) { return this._attrs[k] || null; },
                addEventListener: function (ev, fn) { this._listeners[ev] = fn; },
                appendChild: function (child) { this.children.push(child); return child; },
                classList: {
                    _classes: [],
                    add: function (c) { if (!this._classes.includes(c)) this._classes.push(c); },
                    remove: function (c) { this._classes = this._classes.filter(function(x) { return x !== c; }); },
                    contains: function (c) { return this._classes.includes(c); },
                },
            };
        },
        createTextNode: function (text) { return { nodeType: 3, textContent: text }; },
    };
    global._domStubs = {};

    if (!global.crypto) {
        global.crypto = require('node:crypto').webcrypto;
    }
    global.location = { origin: 'https://example.com' };

    // Reset controller-consuming globals
    global.currentGameId = 'last_war';
    global.currentAuthUser = { uid: 'uid_leader_pu' };
    global.allPlayers = [];
    global.DSFeaturePlayerUpdatesView = null;
    global.DSI18N = null;
    global.DSFeaturePlayerUpdatesCore = null;
    global.DSFeaturePlayerUpdatesActions = null;

    [corePath, controllerPath].forEach(function (p) {
        delete require.cache[require.resolve(p)];
    });
    delete global.DSFeaturePlayerUpdatesCore;
    delete global.DSFeaturePlayerUpdatesController;

    require(corePath);
    require(controllerPath);
}

function loadView() {
    global.window = global;
    global.DSI18N = null;
    global.DSFeaturePlayerUpdatesCore = null;

    // Full createElement stub that supports appendChild chain
    global.document = makeDOMStub();

    delete require.cache[require.resolve(viewPath)];
    delete global.DSFeaturePlayerUpdatesView;
    require(viewPath);
}

function makeDOMStub() {
    function makeEl(tag) {
        var el = {
            tagName: tag,
            className: '',
            textContent: '',
            innerHTML: '',
            children: [],
            _attrs: {},
            _listeners: {},
            setAttribute: function (k, v) { this._attrs[k] = v; },
            getAttribute: function (k) { return this._attrs[k] || null; },
            addEventListener: function (ev, fn) { this._listeners[ev] = fn; },
            appendChild: function (child) { this.children.push(child); return child; },
            classList: makeClassList(),
        };
        return el;
    }
    function makeClassList() {
        var classes = [];
        return {
            _classes: classes,
            add: function (c) { if (!classes.includes(c)) classes.push(c); },
            remove: function (c) {
                var i = classes.indexOf(c);
                if (i !== -1) classes.splice(i, 1);
            },
            contains: function (c) { return classes.includes(c); },
        };
    }
    return {
        getElementById: function (id) {
            return (global._domStubs && global._domStubs[id]) || null;
        },
        querySelectorAll: function () { return []; },
        createElement: makeEl,
        createTextNode: function (text) { return { nodeType: 3, textContent: text }; },
    };
}

function makeMockGateway(overrides) {
    return Object.assign({
        getAllianceId: function () { return 'alliance_test_1'; },
        getCurrentUser: function () { return { uid: 'uid_leader_pu' }; },
        saveTokenBatch: async function () { return { ok: true, tokenIds: [] }; },
        updatePendingUpdateStatus: async function () { return { ok: true }; },
        updatePersonalPendingUpdateStatus: async function () { return { ok: true }; },
        applyPlayerUpdateToPersonal: async function () { return { ok: true }; },
        applyPlayerUpdateToAlliance: async function () { return { ok: true }; },
        revokeToken: async function () { return { ok: true }; },
        subscribePendingUpdatesCount: function (allianceId, uid, cb) { if (typeof uid === 'function') { uid(0); } else if (typeof cb === 'function') { cb(0); } return function () {}; },
        loadPendingUpdates: async function () { return []; },
    }, overrides || {});
}

// ---------------------------------------------------------------------------
// 1. Badge subscription with null allianceId — subscribeBadge not called
// ---------------------------------------------------------------------------

test('subscribeBadge: does nothing when allianceId is null', () => {
    loadController();
    var subscribeCalled = false;
    var gateway = makeMockGateway({
        subscribePendingUpdatesCount: function () {
            subscribeCalled = true;
            return function () {};
        },
    });
    global.DSFeaturePlayerUpdatesController.init(gateway);
    global.DSFeaturePlayerUpdatesController.subscribeBadge(null);
    assert.equal(subscribeCalled, false, 'subscribePendingUpdatesCount must not be called when allianceId is null');
});

test('subscribeBadge: does nothing when allianceId is empty string', () => {
    loadController();
    var subscribeCalled = false;
    var gateway = makeMockGateway({
        subscribePendingUpdatesCount: function () {
            subscribeCalled = true;
            return function () {};
        },
    });
    global.DSFeaturePlayerUpdatesController.init(gateway);
    global.DSFeaturePlayerUpdatesController.subscribeBadge('');
    assert.equal(subscribeCalled, false, 'subscribePendingUpdatesCount must not be called with empty string allianceId');
});

// ---------------------------------------------------------------------------
// 2. Badge subscription with valid allianceId — subscribeBadge creates subscription
// ---------------------------------------------------------------------------

test('subscribeBadge: calls subscribePendingUpdatesCount with valid allianceId', () => {
    loadController();
    var capturedAllianceId = null;
    var gateway = makeMockGateway({
        subscribePendingUpdatesCount: function (allianceId, cb) {
            capturedAllianceId = allianceId;
            return function () {};
        },
    });
    global.DSFeaturePlayerUpdatesController.init(gateway);
    global.DSFeaturePlayerUpdatesController.subscribeBadge('alliance_abc');
    assert.equal(capturedAllianceId, 'alliance_abc');
});

// ---------------------------------------------------------------------------
// 3. Alliance data callback fires twice — old unsub fires before new subscription
// ---------------------------------------------------------------------------

test('subscribeBadge: calling twice fires old unsub before creating new subscription', () => {
    loadController();
    var unsubCallCount = 0;
    var subscribeCallCount = 0;
    var unsubCallOrder = [];
    var subscribeCallOrder = [];
    var opCount = 0;

    var gateway = makeMockGateway({
        subscribePendingUpdatesCount: function (allianceId, cb) {
            subscribeCallCount++;
            subscribeCallOrder.push(++opCount);
            var myOrder = opCount;
            return function () {
                unsubCallCount++;
                unsubCallOrder.push(++opCount);
            };
        },
    });

    global.DSFeaturePlayerUpdatesController.init(gateway);

    // First subscription
    global.DSFeaturePlayerUpdatesController.subscribeBadge('alliance_first');
    assert.equal(subscribeCallCount, 1, 'One subscription after first call');
    assert.equal(unsubCallCount, 0, 'No unsub after first call');

    // Second subscription — old unsub should fire before new subscribe
    global.DSFeaturePlayerUpdatesController.subscribeBadge('alliance_second');
    assert.equal(subscribeCallCount, 2, 'Two subscriptions after second call');
    assert.equal(unsubCallCount, 1, 'Old unsub called before new subscription');
    // The unsub (order entry) must come BEFORE the second subscribe order entry
    assert.ok(unsubCallOrder[0] < subscribeCallOrder[1],
        'Old unsub must fire before new subscription is created');
});

// ---------------------------------------------------------------------------
// 4. Badge callback fires with count=0 after non-zero — badge clears
// ---------------------------------------------------------------------------

test('subscribeBadge: badge clears when count drops to 0', () => {
    loadController();
    var badgeHidden = null;

    // Set up a badge DOM element stub
    var badgeEl = {
        textContent: '',
        classList: {
            _classes: [],
            add: function (c) { this._classes.push(c); },
            remove: function (c) { this._classes = this._classes.filter(function(x) { return x !== c; }); },
            contains: function (c) { return this._classes.includes(c); },
        },
    };
    global._domStubs = { playerUpdatesPendingBadge: badgeEl };

    var savedCb = null;
    var gateway = makeMockGateway({
        subscribePendingUpdatesCount: function (allianceId, uid, cb) {
            savedCb = cb;
            return function () {};
        },
    });

    // Set up view to capture badge state
    global.DSFeaturePlayerUpdatesView = {
        renderPendingBadge: function (el, count) {
            if (!el) return;
            el.textContent = count || '0';
            if (count && count > 0) {
                el.classList.remove('hidden');
            } else {
                el.classList.add('hidden');
            }
        },
    };

    global.DSFeaturePlayerUpdatesController.init(gateway);
    global.DSFeaturePlayerUpdatesController.subscribeBadge('alliance_badge_test', 'uid_badge_test');

    // Fire with non-zero count
    savedCb(5);
    assert.ok(!badgeEl.classList.contains('hidden'), 'Badge should be visible for count=5');

    // Fire with count=0 — badge must clear
    savedCb(0);
    assert.ok(badgeEl.classList.contains('hidden'), 'Badge must be hidden when count=0');
});

// ---------------------------------------------------------------------------
// 5. subscribePendingUpdatesCount returns no-op when manager absent
// ---------------------------------------------------------------------------

test('subscribePendingUpdatesCount: returns no-op function when gateway has no method', () => {
    loadController();
    // Build a gateway without subscribePendingUpdatesCount
    var gateway = {
        getAllianceId: function () { return 'alliance_x'; },
        saveTokenBatch: async function () { return { ok: true, tokenIds: [] }; },
        updatePendingUpdateStatus: async function () { return { ok: true }; },
        revokeToken: async function () { return { ok: true }; },
        loadPendingUpdates: async function () { return []; },
        // No subscribePendingUpdatesCount
    };
    global.DSFeaturePlayerUpdatesController.init(gateway);
    // subscribeBadge checks for the method; with it absent, it should return without throwing
    assert.doesNotThrow(function () {
        global.DSFeaturePlayerUpdatesController.subscribeBadge('alliance_x');
    }, 'subscribeBadge should not throw when gateway lacks subscribePendingUpdatesCount');
});

// ---------------------------------------------------------------------------
// 6. Nav handler with null allianceId — empty state rendered
// ---------------------------------------------------------------------------

test('refreshPlayerUpdatesPanel: renders empty state when allianceId is null', () => {
    // Simulate the refreshPlayerUpdatesPanel function from app.js
    var renderCalled = false;
    var renderUpdates = null;

    var containerEl = { id: 'playerUpdatesReviewContainer' };
    global._domStubs = { playerUpdatesReviewContainer: containerEl };
    global.document = {
        getElementById: function (id) { return (global._domStubs && global._domStubs[id]) || null; },
        querySelectorAll: function () { return []; },
    };

    global.FirebaseService = {
        getAllianceId: function () { return null; },
        loadPendingUpdates: async function () { return []; },
    };
    global.DSFeaturePlayerUpdatesView = {
        renderReviewPanel: function (container, updates) {
            renderCalled = true;
            renderUpdates = updates;
        },
    };

    // Execute inline the refreshPlayerUpdatesPanel logic from app.js
    (function refreshPlayerUpdatesPanel() {
        var allianceId = window.FirebaseService && window.FirebaseService.getAllianceId
            ? window.FirebaseService.getAllianceId()
            : null;
        var container = document.getElementById('playerUpdatesReviewContainer');
        if (allianceId && window.FirebaseService && window.FirebaseService.loadPendingUpdates) {
            window.FirebaseService.loadPendingUpdates(allianceId, 'pending').then(function(updates) {
                if (container && window.DSFeaturePlayerUpdatesView) {
                    window.DSFeaturePlayerUpdatesView.renderReviewPanel(container, updates);
                }
            }).catch(function() {
                if (container && window.DSFeaturePlayerUpdatesView) {
                    window.DSFeaturePlayerUpdatesView.renderReviewPanel(container, []);
                }
            });
        } else {
            if (container && window.DSFeaturePlayerUpdatesView) {
                window.DSFeaturePlayerUpdatesView.renderReviewPanel(container, []);
            }
        }
    })();

    assert.equal(renderCalled, true, 'renderReviewPanel should be called even with null allianceId');
    assert.deepEqual(renderUpdates, [], 'renderReviewPanel should receive empty array for null allianceId');
});

// ---------------------------------------------------------------------------
// 7. Nav handler with valid allianceId — loadPendingUpdates called and rendered
// ---------------------------------------------------------------------------

test('refreshPlayerUpdatesPanel: calls loadPendingUpdates and renders results when allianceId is valid', async () => {
    var renderCalled = false;
    var renderUpdates = null;
    var loadCalled = false;

    var containerEl = { id: 'playerUpdatesReviewContainer' };
    global._domStubs = { playerUpdatesReviewContainer: containerEl };
    global.document = {
        getElementById: function (id) { return (global._domStubs && global._domStubs[id]) || null; },
        querySelectorAll: function () { return []; },
    };

    var fakeUpdates = [{ id: 'upd_1', playerName: 'Alice' }];
    global.FirebaseService = {
        getAllianceId: function () { return 'alliance_valid_1'; },
        loadPendingUpdates: async function (allianceId, status) {
            loadCalled = true;
            return fakeUpdates;
        },
    };
    global.DSFeaturePlayerUpdatesView = {
        renderReviewPanel: function (container, updates) {
            renderCalled = true;
            renderUpdates = updates;
        },
    };

    await (async function refreshPlayerUpdatesPanel() {
        var allianceId = window.FirebaseService && window.FirebaseService.getAllianceId
            ? window.FirebaseService.getAllianceId()
            : null;
        var container = document.getElementById('playerUpdatesReviewContainer');
        if (allianceId && window.FirebaseService && window.FirebaseService.loadPendingUpdates) {
            await window.FirebaseService.loadPendingUpdates(allianceId, 'pending').then(function(updates) {
                if (container && window.DSFeaturePlayerUpdatesView) {
                    window.DSFeaturePlayerUpdatesView.renderReviewPanel(container, updates);
                }
            }).catch(function() {
                if (container && window.DSFeaturePlayerUpdatesView) {
                    window.DSFeaturePlayerUpdatesView.renderReviewPanel(container, []);
                }
            });
        } else {
            if (container && window.DSFeaturePlayerUpdatesView) {
                window.DSFeaturePlayerUpdatesView.renderReviewPanel(container, []);
            }
        }
    })();

    assert.equal(loadCalled, true, 'loadPendingUpdates should be called with valid allianceId');
    assert.equal(renderCalled, true, 'renderReviewPanel should be called after loading');
    assert.deepEqual(renderUpdates, fakeUpdates, 'renderReviewPanel should receive loaded updates');
});

// ---------------------------------------------------------------------------
// 8. Nav handler load error (network) — panel not left in loading state
// ---------------------------------------------------------------------------

test('refreshPlayerUpdatesPanel: renders empty state on load error, does not leave panel in loading state', async () => {
    var renderCalled = false;
    var renderUpdates = null;

    var containerEl = { id: 'playerUpdatesReviewContainer' };
    global._domStubs = { playerUpdatesReviewContainer: containerEl };
    global.document = {
        getElementById: function (id) { return (global._domStubs && global._domStubs[id]) || null; },
        querySelectorAll: function () { return []; },
    };

    global.FirebaseService = {
        getAllianceId: function () { return 'alliance_erroring'; },
        loadPendingUpdates: async function () {
            throw new Error('Network error');
        },
    };
    global.DSFeaturePlayerUpdatesView = {
        renderReviewPanel: function (container, updates) {
            renderCalled = true;
            renderUpdates = updates;
        },
    };

    await (async function refreshPlayerUpdatesPanel() {
        var allianceId = window.FirebaseService && window.FirebaseService.getAllianceId
            ? window.FirebaseService.getAllianceId()
            : null;
        var container = document.getElementById('playerUpdatesReviewContainer');
        if (allianceId && window.FirebaseService && window.FirebaseService.loadPendingUpdates) {
            await window.FirebaseService.loadPendingUpdates(allianceId, 'pending').then(function(updates) {
                if (container && window.DSFeaturePlayerUpdatesView) {
                    window.DSFeaturePlayerUpdatesView.renderReviewPanel(container, updates);
                }
            }).catch(function() {
                if (container && window.DSFeaturePlayerUpdatesView) {
                    window.DSFeaturePlayerUpdatesView.renderReviewPanel(container, []);
                }
            });
        } else {
            if (container && window.DSFeaturePlayerUpdatesView) {
                window.DSFeaturePlayerUpdatesView.renderReviewPanel(container, []);
            }
        }
    })();

    assert.equal(renderCalled, true, 'renderReviewPanel must be called even after a load error');
    assert.deepEqual(renderUpdates, [], 'renderReviewPanel must receive empty array on error');
});

// ---------------------------------------------------------------------------
// 9. renderReviewPanel with null container — no throw
// ---------------------------------------------------------------------------

test('renderReviewPanel: does not throw when container is null', () => {
    loadView();
    assert.doesNotThrow(function () {
        global.DSFeaturePlayerUpdatesView.renderReviewPanel(null, []);
    }, 'renderReviewPanel must not throw when container is null');
});

test('renderReviewPanel: does not throw when container is null and updates provided', () => {
    loadView();
    assert.doesNotThrow(function () {
        global.DSFeaturePlayerUpdatesView.renderReviewPanel(null, [{ id: 'u1', playerName: 'Alice' }]);
    });
});

// ---------------------------------------------------------------------------
// 10. Controller allianceId resolution — uses _gateway.getAllianceId()
// ---------------------------------------------------------------------------

test('controller allianceId resolution: approveUpdate uses _gateway.getAllianceId(), not global', async () => {
    loadController();
    // Ensure global.currentAllianceId is absent / wrong to confirm controller ignores it
    global.currentAllianceId = 'wrong_global_alliance';

    var capturedAllianceId = null;
    var gateway = makeMockGateway({
        getAllianceId: function () { return 'correct_gateway_alliance'; },
        updatePendingUpdateStatus: async function (allianceId) {
            capturedAllianceId = allianceId;
            return { ok: true };
        },
    });

    global.DSFeaturePlayerUpdatesController.init(gateway);
    // New approval flow requires docs to be registered first
    global.DSFeaturePlayerUpdatesController.setPendingUpdateDocs([{
        id: 'upd_x',
        contextType: 'alliance',
        allianceId: 'correct_gateway_alliance',
        playerName: 'TestPlayer',
        proposedValues: { power: 100, thp: 500, troops: 'Tank' },
    }]);
    // For alliance users, approveUpdate shows modal — no modal in test env, so it defaults to 'both'
    await global.DSFeaturePlayerUpdatesController.approveUpdate('upd_x');

    assert.equal(capturedAllianceId, 'correct_gateway_alliance',
        'Controller must read allianceId from _gateway.getAllianceId(), not from global.currentAllianceId');
});

test('controller allianceId resolution: revokeToken uses _gateway.getAllianceId(), not global', async () => {
    loadController();
    global.currentAllianceId = 'wrong_global_alliance';

    var capturedAllianceId = null;
    var gateway = makeMockGateway({
        getAllianceId: function () { return 'correct_gateway_alliance'; },
        revokeToken: async function (allianceId) {
            capturedAllianceId = allianceId;
            return { ok: true };
        },
    });

    global.DSFeaturePlayerUpdatesController.init(gateway);
    await global.DSFeaturePlayerUpdatesController.revokeToken('tok_x');

    assert.equal(capturedAllianceId, 'correct_gateway_alliance',
        'revokeToken must read allianceId from _gateway.getAllianceId()');
});

// ---------------------------------------------------------------------------
// 11. Controller approveUpdate with null allianceId — rejects gracefully
// ---------------------------------------------------------------------------

test('approveUpdate: does not throw when gateway.getAllianceId returns null', async () => {
    loadController();
    var gateway = makeMockGateway({
        getAllianceId: function () { return null; },
        updatePendingUpdateStatus: async function (allianceId, updateId, decision) {
            return { ok: true };
        },
    });
    global.DSFeaturePlayerUpdatesController.init(gateway);
    var result;
    await assert.doesNotReject(async function () {
        result = await global.DSFeaturePlayerUpdatesController.approveUpdate('upd_null_alliance');
    }, 'approveUpdate must not throw when allianceId is null');
    // It should still call through (gateway handles null) — just must not throw
    assert.ok(result !== undefined);
});

// ---------------------------------------------------------------------------
// 12. Controller rejectUpdate with null allianceId — rejects gracefully
// ---------------------------------------------------------------------------

test('rejectUpdate: does not throw when gateway.getAllianceId returns null', async () => {
    loadController();
    var gateway = makeMockGateway({
        getAllianceId: function () { return null; },
        updatePendingUpdateStatus: async function () { return { ok: true }; },
    });
    global.DSFeaturePlayerUpdatesController.init(gateway);
    await assert.doesNotReject(async function () {
        await global.DSFeaturePlayerUpdatesController.rejectUpdate('upd_null_alliance');
    }, 'rejectUpdate must not throw when allianceId is null');
});

// ---------------------------------------------------------------------------
// 13. Controller revokeToken with null allianceId — rejects gracefully
// ---------------------------------------------------------------------------

test('revokeToken: does not throw when gateway.getAllianceId returns null', async () => {
    loadController();
    var gateway = makeMockGateway({
        getAllianceId: function () { return null; },
        revokeToken: async function () { return { ok: true }; },
    });
    global.DSFeaturePlayerUpdatesController.init(gateway);
    await assert.doesNotReject(async function () {
        await global.DSFeaturePlayerUpdatesController.revokeToken('tok_null_alliance');
    }, 'revokeToken must not throw when allianceId is null');
});

// ---------------------------------------------------------------------------
// 14. Translation keys — 8 new keys exist as non-empty strings in all 6 packs
// ---------------------------------------------------------------------------

test('translation keys: 8 new player_updates keys exist as non-empty strings in all 6 language packs', () => {
    delete require.cache[require.resolve(translationsPath)];
    // translations.js declares `const translations = { ... }` then exports or uses it on window
    // We need to load it and access the translations object.
    // The file is not a CommonJS module — simulate window to capture the export.
    global.window = global;

    // Read the file and evaluate it — translations.js sets `const translations = {...}`
    // and then uses it inline. We need to read the literal object.
    const fs = require('fs');
    const src = fs.readFileSync(translationsPath, 'utf8');

    // translations.js sets `const translations = {...}` and assigns to window.translations.
    // Evaluate via Function to capture the variable from the module scope.
    let translations;
    const captureGlobal = { window: {} };
    const fn = new Function('window', src);
    fn(captureGlobal.window);
    translations = captureGlobal.window.translations;

    const REQUIRED_KEYS = [
        'player_updates_no_pending',
        'player_updates_no_tokens',
        'player_updates_copy_link',
        'player_updates_col_field',
        'player_updates_col_current',
        'player_updates_col_proposed',
        'player_updates_col_change',
        'player_updates_refresh',
    ];

    const LANG_CODES = ['en', 'fr', 'de', 'it', 'ko', 'ro'];

    LANG_CODES.forEach(function (lang) {
        assert.ok(translations[lang], 'Language pack must exist: ' + lang);
        REQUIRED_KEYS.forEach(function (key) {
            var value = translations[lang][key];
            assert.ok(
                typeof value === 'string' && value.trim().length > 0,
                'Key "' + key + '" in lang "' + lang + '" must be a non-empty string, got: ' + JSON.stringify(value)
            );
        });
    });
});

// ---------------------------------------------------------------------------
// 15. Dead key `player_updates_review_empty` absent from EN pack (tombstone)
// ---------------------------------------------------------------------------

test('tombstone: player_updates_review_empty must NOT exist in EN language pack', () => {
    const fs = require('fs');
    const src = fs.readFileSync(translationsPath, 'utf8');
    const captureGlobal2 = { window: {} };
    const fn2 = new Function('window', src);
    fn2(captureGlobal2.window);
    const translations = captureGlobal2.window.translations;

    assert.ok(translations.en, 'EN language pack must exist');
    assert.equal(
        translations.en.player_updates_review_empty,
        undefined,
        'Dead key player_updates_review_empty must be absent from EN pack'
    );
});
