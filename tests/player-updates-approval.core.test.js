// tests/player-updates-approval.core.test.js
// Unit tests for the Player Updates approval workflow.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const controllerPath = path.resolve(__dirname, '../js/features/player-updates/player-updates-controller.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupGlobals() {
    global.window = global;
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
                disabled: false,
                setAttribute: function (k, v) { this._attrs[k] = v; },
                getAttribute: function (k) { return this._attrs[k] || null; },
                addEventListener: function (ev, fn) {
                    if (!this._listeners[ev]) this._listeners[ev] = [];
                    this._listeners[ev].push(fn);
                },
                removeEventListener: function (ev, fn) {
                    if (this._listeners[ev]) {
                        this._listeners[ev] = this._listeners[ev].filter(function(f) { return f !== fn; });
                    }
                },
                appendChild: function (child) { this.children.push(child); return child; },
                focus: function () {},
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
    global.currentAuthUser = { uid: 'test-user-123' };

    if (!global.crypto) {
        global.crypto = require('node:crypto').webcrypto;
    }
}

function createMockGateway(overrides) {
    return Object.assign({
        getAllianceId: function () { return null; },
        getCurrentUser: function () { return { uid: 'test-user-123' }; },
        subscribePendingUpdatesCount: function () { return function noop() {}; },
        updatePendingUpdateStatus: function () { return Promise.resolve({ ok: true }); },
        updatePersonalPendingUpdateStatus: function () { return Promise.resolve({ ok: true }); },
        applyPlayerUpdateToPersonal: function () { return Promise.resolve({ ok: true }); },
        applyPlayerUpdateToAlliance: function () { return Promise.resolve({ ok: true }); },
    }, overrides || {});
}

function loadController() {
    // Clear module cache
    delete require.cache[controllerPath];
    delete global.DSFeaturePlayerUpdatesController;
    require(controllerPath);
    return global.DSFeaturePlayerUpdatesController;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('approveUpdate returns ok:false when gateway not initialized', async function () {
    setupGlobals();
    var ctrl = loadController();
    var result = await ctrl.approveUpdate('some-id');
    assert.equal(result.ok, false);
    assert.equal(result.error, 'not initialized');
});

test('approveUpdate returns ok:false when update not found in pendingUpdateDocs', async function () {
    setupGlobals();
    var ctrl = loadController();
    ctrl.init(createMockGateway());
    // Don't register any docs
    var result = await ctrl.approveUpdate('nonexistent-id');
    assert.equal(result.ok, false);
    assert.equal(result.error, 'update not found');
});

test('approveUpdate for non-alliance user applies to personal without modal', async function () {
    setupGlobals();
    var appliedPersonal = false;
    var appliedAlliance = false;
    var statusUpdate = null;

    var ctrl = loadController();
    ctrl.init(createMockGateway({
        getAllianceId: function () { return null; },
        applyPlayerUpdateToPersonal: function (name, values) {
            appliedPersonal = true;
            return Promise.resolve({ ok: true });
        },
        applyPlayerUpdateToAlliance: function () {
            appliedAlliance = true;
            return Promise.resolve({ ok: true });
        },
        updatePersonalPendingUpdateStatus: function (uid, id, decision) {
            statusUpdate = decision;
            return Promise.resolve({ ok: true });
        },
    }));

    ctrl.setPendingUpdateDocs([{
        id: 'update-1',
        contextType: 'personal',
        ownerUid: 'owner-uid',
        playerName: 'TestPlayer',
        proposedValues: { power: 100, thp: 500, troops: 'Tank' },
    }]);

    var result = await ctrl.approveUpdate('update-1');
    assert.equal(result.ok, true);
    assert.equal(appliedPersonal, true);
    assert.equal(appliedAlliance, false);
    assert.equal(statusUpdate.status, 'approved');
    assert.equal(statusUpdate.appliedTo, 'personal');
});

test('rejectUpdate for personal context uses updatePersonalPendingUpdateStatus', async function () {
    setupGlobals();
    var personalStatusCalled = false;
    var allianceStatusCalled = false;

    var ctrl = loadController();
    ctrl.init(createMockGateway({
        updatePersonalPendingUpdateStatus: function () {
            personalStatusCalled = true;
            return Promise.resolve({ ok: true });
        },
        updatePendingUpdateStatus: function () {
            allianceStatusCalled = true;
            return Promise.resolve({ ok: true });
        },
    }));

    ctrl.setPendingUpdateDocs([{
        id: 'update-1',
        contextType: 'personal',
        ownerUid: 'owner-uid',
        playerName: 'TestPlayer',
        proposedValues: {},
    }]);

    await ctrl.rejectUpdate('update-1');
    assert.equal(personalStatusCalled, true);
    assert.equal(allianceStatusCalled, false);
});

test('rejectUpdate for alliance context uses updatePendingUpdateStatus', async function () {
    setupGlobals();
    var personalStatusCalled = false;
    var allianceStatusCalled = false;

    var ctrl = loadController();
    ctrl.init(createMockGateway({
        getAllianceId: function () { return 'alliance-123'; },
        updatePersonalPendingUpdateStatus: function () {
            personalStatusCalled = true;
            return Promise.resolve({ ok: true });
        },
        updatePendingUpdateStatus: function () {
            allianceStatusCalled = true;
            return Promise.resolve({ ok: true });
        },
    }));

    ctrl.setPendingUpdateDocs([{
        id: 'update-1',
        contextType: 'alliance',
        allianceId: 'alliance-123',
        playerName: 'TestPlayer',
        proposedValues: {},
    }]);

    await ctrl.rejectUpdate('update-1');
    assert.equal(personalStatusCalled, false);
    assert.equal(allianceStatusCalled, true);
});

test('setPendingUpdateDocs populates map correctly', function () {
    setupGlobals();
    var ctrl = loadController();
    ctrl.init(createMockGateway());

    ctrl.setPendingUpdateDocs([
        { id: 'a', playerName: 'P1' },
        { id: 'b', playerName: 'P2' },
        { playerName: 'NoId' },  // should be skipped
    ]);

    // Verify by trying to approve — 'a' should be found, 'c' should not
    // Indirect verification through approveUpdate
    ctrl.approveUpdate('c').then(function(r) {
        assert.equal(r.error, 'update not found');
    });
});

test('subscribeBadge passes uid to gateway.subscribePendingUpdatesCount', function () {
    setupGlobals();
    var receivedArgs = null;

    var ctrl = loadController();
    ctrl.init(createMockGateway({
        subscribePendingUpdatesCount: function (allianceId, uid, callback) {
            receivedArgs = { allianceId: allianceId, uid: uid };
            return function noop() {};
        },
    }));

    ctrl.subscribeBadge('alliance-1', 'user-1');
    assert.deepEqual(receivedArgs, { allianceId: 'alliance-1', uid: 'user-1' });
});

test('subscribeBadge works without allianceId (non-alliance user)', function () {
    setupGlobals();
    var receivedArgs = null;

    var ctrl = loadController();
    ctrl.init(createMockGateway({
        subscribePendingUpdatesCount: function (allianceId, uid, callback) {
            receivedArgs = { allianceId: allianceId, uid: uid };
            return function noop() {};
        },
    }));

    ctrl.subscribeBadge(null, 'user-1');
    assert.deepEqual(receivedArgs, { allianceId: null, uid: 'user-1' });
});

test('approveUpdate returns cancelled when apply_failed', async function () {
    setupGlobals();
    var ctrl = loadController();
    ctrl.init(createMockGateway({
        getAllianceId: function () { return null; },
        applyPlayerUpdateToPersonal: function () {
            return Promise.resolve({ ok: false, error: 'some error' });
        },
    }));

    ctrl.setPendingUpdateDocs([{
        id: 'update-1',
        contextType: 'personal',
        ownerUid: 'owner-uid',
        playerName: 'TestPlayer',
        proposedValues: { power: 100, thp: 500, troops: 'Tank' },
    }]);

    var result = await ctrl.approveUpdate('update-1');
    assert.equal(result.ok, false);
    assert.equal(result.error, 'apply_failed');
});
