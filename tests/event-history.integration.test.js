// tests/event-history.integration.test.js
// Integration tests for the event-history controller.
// Uses mocked gateway — no Firebase required.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

// ---------------------------------------------------------------------------
// Module paths
// ---------------------------------------------------------------------------
const firestoreUtilsPath = path.resolve(__dirname, '../js/core/firestore-utils.js');
const reliabilityPath = path.resolve(__dirname, '../js/core/reliability.js');
const corePath = path.resolve(__dirname, '../js/features/event-history/event-history-core.js');
const viewPath = path.resolve(__dirname, '../js/features/event-history/event-history-view.js');
const controllerPath = path.resolve(__dirname, '../js/features/event-history/event-history-controller.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadDependencies() {
    global.window = global;

    // Minimal DOM stubs
    global.document = {
        getElementById: function(id) {
            return global._domStubs && global._domStubs[id] ? global._domStubs[id] : null;
        },
    };
    global._domStubs = {};

    // Clear cached modules
    [firestoreUtilsPath, reliabilityPath, corePath, viewPath, controllerPath].forEach(function(p) {
        delete require.cache[require.resolve(p)];
    });
    delete global.DSFirestoreUtils;
    delete global.DSCoreReliability;
    delete global.DSFeatureEventHistoryCore;
    delete global.DSFeatureEventHistoryView;
    delete global.DSFeatureEventHistoryController;

    require(firestoreUtilsPath);
    require(reliabilityPath);
    require(corePath);
    require(viewPath);
    require(controllerPath);
}

function makeMockGateway(overrides) {
    return Object.assign({
        getAllianceId: function() { return 'alliance_integ_1'; },
        getCurrentUser: function() { return { uid: 'uid_leader_1' }; },
        subscribePendingFinalizationCount: function(allianceId, callback) {
            callback(0);
            return function unsubscribe() {};
        },
        loadHistoryRecords: async function() { return []; },
        saveHistoryRecord: async function() { return { ok: true, historyId: 'hist_1' }; },
        saveAttendanceBatch: async function() { return { ok: true }; },
        enforceEventHistoryLimit: async function() { return { ok: true }; },
        loadAttendance: async function() { return []; },
        updateAttendanceStatus: async function() { return { ok: true }; },
        loadPlayerStats: async function() { return {}; },
        finalizeHistory: async function() { return { ok: true }; },
    }, overrides || {});
}

// ---------------------------------------------------------------------------
// init → subscribePendingFinalizationCount is called
// ---------------------------------------------------------------------------

test('controller.init: calls subscribePendingFinalizationCount with the alliance id', () => {
    loadDependencies();

    var capturedAllianceId = null;
    var callCount = 0;

    var gateway = makeMockGateway({
        subscribePendingFinalizationCount: function(allianceId, callback) {
            capturedAllianceId = allianceId;
            callCount++;
            callback(0);
            return function() {};
        },
    });

    global.DSFeatureEventHistoryController.init(gateway);

    assert.equal(callCount, 1, 'subscribePendingFinalizationCount should be called once');
    assert.equal(capturedAllianceId, 'alliance_integ_1');
});

test('controller.init: returns destroy function', () => {
    loadDependencies();
    const handle = global.DSFeatureEventHistoryController.init(makeMockGateway());
    assert.ok(handle && typeof handle.destroy === 'function', 'init should return { destroy }');
});

test('controller.init: destroy calls unsubscribe function', () => {
    loadDependencies();

    var unsubscribeCalled = false;
    var gateway = makeMockGateway({
        subscribePendingFinalizationCount: function(allianceId, callback) {
            callback(0);
            return function unsubscribe() { unsubscribeCalled = true; };
        },
    });

    const handle = global.DSFeatureEventHistoryController.init(gateway);
    handle.destroy();
    assert.equal(unsubscribeCalled, true, 'destroy should call the unsubscribe fn');
});

// ---------------------------------------------------------------------------
// Pending count badge updates
// ---------------------------------------------------------------------------

test('controller.init: pending count > 0 causes badge container text to be set', () => {
    loadDependencies();

    const badgeEl = { textContent: '', classList: { remove: function() {}, add: function() {} } };
    global._domStubs['eventHistoryPendingBadge'] = badgeEl;

    var gateway = makeMockGateway({
        subscribePendingFinalizationCount: function(allianceId, callback) {
            callback(3);
            return function() {};
        },
    });

    global.DSFeatureEventHistoryController.init(gateway);

    assert.equal(badgeEl.textContent, 3, 'Badge textContent should reflect the count');
});

test('controller.init: pending count 0 does not remove hidden class (badge stays hidden)', () => {
    loadDependencies();

    var removedClasses = [];
    var addedClasses = [];
    const badgeEl = {
        textContent: '',
        classList: {
            remove: function(cls) { removedClasses.push(cls); },
            add: function(cls) { addedClasses.push(cls); },
        },
    };
    global._domStubs['eventHistoryPendingBadge'] = badgeEl;

    var gateway = makeMockGateway({
        subscribePendingFinalizationCount: function(allianceId, callback) {
            callback(0);
            return function() {};
        },
    });

    global.DSFeatureEventHistoryController.init(gateway);

    assert.ok(addedClasses.includes('hidden'), 'hidden class should be added when count is 0');
    assert.ok(!removedClasses.includes('hidden'), 'hidden class should NOT be removed when count is 0');
});

test('controller.init: pending count > 0 removes hidden class from badge', () => {
    loadDependencies();

    var removedClasses = [];
    const badgeEl = {
        textContent: '',
        classList: {
            remove: function(cls) { removedClasses.push(cls); },
            add: function() {},
        },
    };
    global._domStubs['eventHistoryPendingBadge'] = badgeEl;

    var gateway = makeMockGateway({
        subscribePendingFinalizationCount: function(allianceId, callback) {
            callback(5);
            return function() {};
        },
    });

    global.DSFeatureEventHistoryController.init(gateway);

    assert.ok(removedClasses.includes('hidden'), 'hidden class should be removed when count > 0');
});

// ---------------------------------------------------------------------------
// controller.init: no allianceId — subscribePendingFinalizationCount NOT called
// ---------------------------------------------------------------------------

test('controller.init: no allianceId skips subscribePendingFinalizationCount', () => {
    loadDependencies();

    var callCount = 0;
    var gateway = makeMockGateway({
        getAllianceId: function() { return null; },
        subscribePendingFinalizationCount: function() { callCount++; return function() {}; },
    });

    global.DSFeatureEventHistoryController.init(gateway);
    assert.equal(callCount, 0, 'Should not subscribe when allianceId is null');
});

// ---------------------------------------------------------------------------
// autoSave
// ---------------------------------------------------------------------------

test('autoSave: returns ok=true and historyId on success', async () => {
    loadDependencies();

    var gateway = makeMockGateway({
        saveHistoryRecord: async function() { return { ok: true, historyId: 'hist_auto_1' }; },
    });

    global.DSFeatureEventHistoryController.init(gateway);

    const result = await global.DSFeatureEventHistoryController.autoSave(
        'A',
        [{ name: 'Alice', building: 'HQ' }],
        [{ name: 'Bob' }],
        { eventTypeId: 'desert_storm', eventDisplayName: 'Desert Storm', gameId: 'last_war' }
    );
    assert.equal(result.ok, true);
    assert.equal(result.historyId, 'hist_auto_1');
});

test('autoSave: merges starters and substitutes into players', async () => {
    loadDependencies();

    var savedRecord = null;
    var gateway = makeMockGateway({
        saveHistoryRecord: async function(allianceId, record) {
            savedRecord = record;
            return { ok: true, historyId: 'hist_auto_2' };
        },
    });

    global.DSFeatureEventHistoryController.init(gateway);

    await global.DSFeatureEventHistoryController.autoSave(
        'B',
        [{ name: 'Alice' }, { name: 'Bob' }],
        [{ name: 'Charlie' }],
        { eventTypeId: 'canyon_storm', eventDisplayName: 'Canyon Storm', gameId: 'last_war' }
    );

    assert.ok(savedRecord);
    assert.equal(savedRecord.team, 'B');
    assert.equal(savedRecord.players.length, 3);
    assert.equal(savedRecord.players[0].role, 'starter');
    assert.equal(savedRecord.players[2].role, 'substitute');
    assert.ok(savedRecord.eventName.includes('Canyon Storm'));
    assert.ok(savedRecord.eventName.includes('Team B'));
});

test('autoSave: calls saveAttendanceBatch with correct count', async () => {
    loadDependencies();

    var batchCallArgs = null;
    var gateway = makeMockGateway({
        saveHistoryRecord: async function() { return { ok: true, historyId: 'hist_auto_3' }; },
        saveAttendanceBatch: async function(allianceId, historyId, docs) {
            batchCallArgs = { allianceId, historyId, docs };
            return { ok: true };
        },
    });

    global.DSFeatureEventHistoryController.init(gateway);

    await global.DSFeatureEventHistoryController.autoSave(
        'A',
        [{ name: 'Alice' }, { name: 'Bob' }],
        [{ name: 'Charlie' }],
        { eventTypeId: 'desert_storm', eventDisplayName: 'Desert Storm', gameId: 'last_war' }
    );

    assert.ok(batchCallArgs, 'saveAttendanceBatch should have been called');
    assert.equal(batchCallArgs.historyId, 'hist_auto_3');
    assert.equal(batchCallArgs.docs.length, 3, 'All 3 players should have attendance docs');
});

test('autoSave: calls enforceEventHistoryLimit', async () => {
    loadDependencies();

    var limitCalled = false;
    var limitArgs = {};
    var gateway = makeMockGateway({
        saveHistoryRecord: async function() { return { ok: true, historyId: 'hist_limit' }; },
        enforceEventHistoryLimit: async function(allianceId, eventTypeId, limit) {
            limitCalled = true;
            limitArgs = { allianceId, eventTypeId, limit };
            return { ok: true };
        },
    });

    global.DSFeatureEventHistoryController.init(gateway);

    await global.DSFeatureEventHistoryController.autoSave(
        'A', [], [],
        { eventTypeId: 'desert_storm', eventDisplayName: 'Desert Storm', gameId: 'last_war' }
    );

    assert.equal(limitCalled, true, 'enforceEventHistoryLimit should be called');
    assert.equal(limitArgs.eventTypeId, 'desert_storm');
    assert.equal(limitArgs.limit, 10);
});

test('autoSave: returns ok=false when gateway save fails', async () => {
    loadDependencies();

    var gateway = makeMockGateway({
        saveHistoryRecord: async function() { return { ok: false, error: 'Firestore error' }; },
    });

    global.DSFeatureEventHistoryController.init(gateway);

    const result = await global.DSFeatureEventHistoryController.autoSave(
        'A', [], [],
        { eventTypeId: 'test', eventDisplayName: 'Test', gameId: 'last_war' }
    );
    assert.equal(result.ok, false);
});

// ---------------------------------------------------------------------------
// saveAssignmentAsHistory (legacy wrapper)
// ---------------------------------------------------------------------------

test('saveAssignmentAsHistory: delegates to autoSave and returns ok=true', async () => {
    loadDependencies();

    var gateway = makeMockGateway({
        saveHistoryRecord: async function() { return { ok: true, historyId: 'hist_legacy' }; },
    });

    global.DSFeatureEventHistoryController.init(gateway);

    const result = await global.DSFeatureEventHistoryController.saveAssignmentAsHistory({
        team: 'A',
        eventTypeId: 'desert_storm',
        eventDisplayName: 'Desert Storm',
        gameId: 'last_war',
        teamAssignments: {
            teamA: [{ playerName: 'Alice' }],
            teamB: [],
        },
    });
    assert.equal(result.ok, true);
    assert.equal(result.historyId, 'hist_legacy');
});

// ---------------------------------------------------------------------------
// autoSave: solo player (no alliance)
// ---------------------------------------------------------------------------

test('autoSave: works without alliance (solo player)', async () => {
    loadDependencies();

    var savedAllianceId = 'NOT_CALLED';
    var gateway = makeMockGateway({
        getAllianceId: function() { return null; },
        saveHistoryRecord: async function(allianceId) {
            savedAllianceId = allianceId;
            return { ok: true, historyId: 'hist_solo' };
        },
    });

    global.DSFeatureEventHistoryController.init(gateway);

    const result = await global.DSFeatureEventHistoryController.autoSave(
        'A', [{ name: 'Alice' }], [],
        { eventTypeId: 'desert_storm', eventDisplayName: 'Desert Storm', gameId: 'last_war' }
    );

    assert.equal(result.ok, true);
    assert.equal(savedAllianceId, null, 'allianceId should be null for solo players');
});
