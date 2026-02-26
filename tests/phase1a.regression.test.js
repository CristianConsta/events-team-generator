// tests/phase1a.regression.test.js
// Regression smoke tests for Phase 1A modules.
// Verifies that all new modules are loadable and expose their required public API.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const firestoreUtilsPath = path.resolve(__dirname, '../js/core/firestore-utils.js');
const reliabilityPath = path.resolve(__dirname, '../js/core/reliability.js');
const corePath = path.resolve(__dirname, '../js/features/event-history/event-history-core.js');
const actionsPath = path.resolve(__dirname, '../js/features/event-history/event-history-actions.js');
const viewPath = path.resolve(__dirname, '../js/features/event-history/event-history-view.js');
const controllerPath = path.resolve(__dirname, '../js/features/event-history/event-history-controller.js');

function loadAll() {
    global.window = global;
    global.document = {
        getElementById: function() { return null; },
        querySelector: function() { return null; },
    };

    [firestoreUtilsPath, reliabilityPath, corePath, actionsPath, viewPath, controllerPath].forEach(function(p) {
        delete require.cache[require.resolve(p)];
    });

    delete global.DSFirestoreUtils;
    delete global.DSCoreReliability;
    delete global.DSFeatureEventHistoryCore;
    delete global.DSFeatureEventHistoryActions;
    delete global.DSFeatureEventHistoryView;
    delete global.DSFeatureEventHistoryController;

    require(firestoreUtilsPath);
    require(reliabilityPath);
    require(corePath);
    require(actionsPath);
    require(viewPath);
    require(controllerPath);
}

// ---------------------------------------------------------------------------
// DSFirestoreUtils
// ---------------------------------------------------------------------------

test('regression: DSFirestoreUtils is loadable and exposes sanitizeDocId', () => {
    loadAll();
    assert.ok(global.DSFirestoreUtils, 'DSFirestoreUtils should be defined on window');
    assert.equal(typeof global.DSFirestoreUtils.sanitizeDocId, 'function');
});

test('regression: DSFirestoreUtils.sanitizeDocId works correctly', () => {
    loadAll();
    assert.equal(global.DSFirestoreUtils.sanitizeDocId('Player.Name'), 'Player_Name');
    assert.equal(global.DSFirestoreUtils.sanitizeDocId(''), '_empty_');
    assert.equal(global.DSFirestoreUtils.sanitizeDocId('Normal'), 'Normal');
});

// ---------------------------------------------------------------------------
// DSCoreReliability
// ---------------------------------------------------------------------------

test('regression: DSCoreReliability is loadable and exposes required functions', () => {
    loadAll();
    assert.ok(global.DSCoreReliability, 'DSCoreReliability should be defined on window');
    assert.equal(typeof global.DSCoreReliability.calculateReliabilityScore, 'function');
    assert.equal(typeof global.DSCoreReliability.getReliabilityTier, 'function');
    assert.equal(typeof global.DSCoreReliability.recalculatePlayerStats, 'function');
});

test('regression: DSCoreReliability.calculateReliabilityScore returns score for 1+ events', () => {
    loadAll();
    const score = global.DSCoreReliability.calculateReliabilityScore([
        { status: 'attended' },
    ]);
    assert.equal(score, 100);
});

// ---------------------------------------------------------------------------
// DSFeatureEventHistoryCore
// ---------------------------------------------------------------------------

test('regression: DSFeatureEventHistoryCore is loadable and exposes required functions', () => {
    loadAll();
    assert.ok(global.DSFeatureEventHistoryCore, 'DSFeatureEventHistoryCore should be defined on window');
    assert.equal(typeof global.DSFeatureEventHistoryCore.buildHistoryRecord, 'function');
    assert.equal(typeof global.DSFeatureEventHistoryCore.buildAttendanceDocs, 'function');
    assert.equal(typeof global.DSFeatureEventHistoryCore.nextAttendanceStatus, 'function');
    assert.equal(typeof global.DSFeatureEventHistoryCore.checkFinalizationStaleness, 'function');
    assert.equal(typeof global.DSFeatureEventHistoryCore.buildDisplayName, 'function');
});

test('regression: DSFeatureEventHistoryCore.buildHistoryRecord returns expected shape', () => {
    loadAll();
    const record = global.DSFeatureEventHistoryCore.buildHistoryRecord({
        eventTypeId: 'desert_storm',
        team: 'A',
        players: [],
    }, 'uid_leader');
    assert.equal(typeof record, 'object');
    assert.ok('active' in record);
    assert.ok('finalized' in record);
    assert.ok('createdByUid' in record);
    assert.ok('players' in record);
    assert.ok('team' in record);
});

// ---------------------------------------------------------------------------
// DSFeatureEventHistoryActions
// ---------------------------------------------------------------------------

test('regression: DSFeatureEventHistoryActions is loadable and exposes required functions', () => {
    loadAll();
    assert.ok(global.DSFeatureEventHistoryActions, 'DSFeatureEventHistoryActions should be defined on window');
    assert.equal(typeof global.DSFeatureEventHistoryActions.readHistoryFilterState, 'function');
});

// ---------------------------------------------------------------------------
// DSFeatureEventHistoryView
// ---------------------------------------------------------------------------

test('regression: DSFeatureEventHistoryView is loadable and exposes required functions', () => {
    loadAll();
    assert.ok(global.DSFeatureEventHistoryView, 'DSFeatureEventHistoryView should be defined on window');
    assert.equal(typeof global.DSFeatureEventHistoryView.renderHistoryList, 'function');
    assert.equal(typeof global.DSFeatureEventHistoryView.renderAttendancePanel, 'function');
    assert.equal(typeof global.DSFeatureEventHistoryView.renderReliabilityDot, 'function');
    assert.equal(typeof global.DSFeatureEventHistoryView.renderPendingBadge, 'function');
});

// ---------------------------------------------------------------------------
// DSFeatureEventHistoryController
// ---------------------------------------------------------------------------

test('regression: DSFeatureEventHistoryController is loadable and exposes required functions', () => {
    loadAll();
    assert.ok(global.DSFeatureEventHistoryController, 'DSFeatureEventHistoryController should be defined on window');
    assert.equal(typeof global.DSFeatureEventHistoryController.init, 'function');
    assert.equal(typeof global.DSFeatureEventHistoryController.showEventHistoryView, 'function');
    assert.equal(typeof global.DSFeatureEventHistoryController.saveAssignmentAsHistory, 'function');
    assert.equal(typeof global.DSFeatureEventHistoryController.autoSave, 'function');
    assert.equal(typeof global.DSFeatureEventHistoryController.openAttendancePanel, 'function');
    assert.equal(typeof global.DSFeatureEventHistoryController.finalizeAttendance, 'function');
});
