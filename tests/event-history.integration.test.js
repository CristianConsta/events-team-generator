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
            // Immediately invoke callback with 0; return unsubscribe fn
            callback(0);
            return function unsubscribe() {};
        },
        loadHistoryRecords: async function() { return []; },
        saveHistoryRecord: async function() { return { ok: true, historyId: 'hist_1' }; },
        saveAttendanceBatch: async function() { return { ok: true }; },
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

    // Stub the DOM element
    const badgeEl = { textContent: '', classList: { remove: function() {}, add: function() {} } };
    global._domStubs['eventHistoryPendingBadge'] = badgeEl;

    var gateway = makeMockGateway({
        subscribePendingFinalizationCount: function(allianceId, callback) {
            callback(3);   // 3 pending finalization events
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
// saveAssignmentAsHistory
// ---------------------------------------------------------------------------

test('saveAssignmentAsHistory: returns ok=true and historyId on success', async () => {
    loadDependencies();

    var gateway = makeMockGateway({
        saveHistoryRecord: async function() { return { ok: true, historyId: 'hist_test_1' }; },
    });

    global.DSFeatureEventHistoryController.init(gateway);

    const assignment = {
        eventTypeId: 'desert_storm',
        eventName: 'Desert Storm #1',
        gameId: 'last_war',
        scheduledAt: '2026-03-01T18:00:00Z',
        teamA: [{ playerName: 'Alice' }],
        teamB: [{ playerName: 'Bob' }],
    };

    const result = await global.DSFeatureEventHistoryController.saveAssignmentAsHistory(assignment);
    assert.equal(result.ok, true);
    assert.equal(result.historyId, 'hist_test_1');
});

test('saveAssignmentAsHistory: calls saveAttendanceBatch for each player', async () => {
    loadDependencies();

    var batchCallArgs = null;
    var gateway = makeMockGateway({
        saveHistoryRecord: async function() { return { ok: true, historyId: 'hist_2' }; },
        saveAttendanceBatch: async function(allianceId, historyId, docs) {
            batchCallArgs = { allianceId, historyId, docs };
            return { ok: true };
        },
    });

    global.DSFeatureEventHistoryController.init(gateway);

    const assignment = {
        teamA: [{ playerName: 'Alice' }, { playerName: 'Bob' }],
        teamB: [{ playerName: 'Charlie' }],
    };

    await global.DSFeatureEventHistoryController.saveAssignmentAsHistory(assignment);

    assert.ok(batchCallArgs, 'saveAttendanceBatch should have been called');
    assert.equal(batchCallArgs.historyId, 'hist_2');
    assert.equal(batchCallArgs.docs.length, 3, 'Should save attendance for all 3 players');
});

test('saveAssignmentAsHistory: returns ok=false when gateway returns error', async () => {
    loadDependencies();

    var gateway = makeMockGateway({
        saveHistoryRecord: async function() { return { ok: false, error: 'Firestore error' }; },
    });

    global.DSFeatureEventHistoryController.init(gateway);

    const result = await global.DSFeatureEventHistoryController.saveAssignmentAsHistory({
        teamA: [], teamB: [],
    });
    assert.equal(result.ok, false);
});

// ---------------------------------------------------------------------------
// markAttendanceBatch
// ---------------------------------------------------------------------------

test('markAttendanceBatch: calls updateAttendanceStatus for each player in map', async () => {
    loadDependencies();

    var updateCalls = [];
    var gateway = makeMockGateway({
        updateAttendanceStatus: async function(allianceId, historyId, docId, status, markedBy) {
            updateCalls.push({ docId, status });
            return { ok: true };
        },
    });

    global.DSFeatureEventHistoryController.init(gateway);

    await global.DSFeatureEventHistoryController.markAttendanceBatch('hist_3', {
        'Alice': 'attended',
        'Bob': 'no_show',
    });

    assert.equal(updateCalls.length, 2);
    const statuses = updateCalls.map(function(c) { return c.status; }).sort();
    assert.deepEqual(statuses, ['attended', 'no_show']);
});

test('markAttendanceBatch: returns ok=true when all updates succeed', async () => {
    loadDependencies();
    var gateway = makeMockGateway();
    global.DSFeatureEventHistoryController.init(gateway);

    const result = await global.DSFeatureEventHistoryController.markAttendanceBatch('hist_4', {
        'Alice': 'attended',
    });
    assert.equal(result.ok, true);
});

test('markAttendanceBatch: returns ok=false when any update fails', async () => {
    loadDependencies();

    var call = 0;
    var gateway = makeMockGateway({
        updateAttendanceStatus: async function() {
            call++;
            return call === 1 ? { ok: true } : { ok: false, error: 'write failed' };
        },
    });

    global.DSFeatureEventHistoryController.init(gateway);

    const result = await global.DSFeatureEventHistoryController.markAttendanceBatch('hist_5', {
        'Alice': 'attended',
        'Bob': 'attended',
    });
    assert.equal(result.ok, false);
});
