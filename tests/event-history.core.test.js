const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const firestoreUtilsPath = path.resolve(__dirname, '../js/core/firestore-utils.js');
const modulePath = path.resolve(__dirname, '../js/features/event-history/event-history-core.js');

function loadModule() {
    global.window = global;
    // Load DSFirestoreUtils dependency first
    delete global.DSFirestoreUtils;
    delete require.cache[require.resolve(firestoreUtilsPath)];
    require(firestoreUtilsPath);

    delete global.DSFeatureEventHistoryCore;
    delete require.cache[require.resolve(modulePath)];
    require(modulePath);
}

// ---------------------------------------------------------------------------
// buildHistoryRecord
// ---------------------------------------------------------------------------

test('buildHistoryRecord: returns doc with status=planned and finalized=false', () => {
    loadModule();
    const assignment = {
        eventTypeId: 'desert_storm',
        eventName: 'Desert Storm #1',
        gameId: 'last_war',
        scheduledAt: '2026-03-01T18:00:00Z',
        teamA: [],
        teamB: [],
    };
    const record = global.DSFeatureEventHistoryCore.buildHistoryRecord(assignment, 'uid_leader');
    assert.equal(record.status, 'planned');
    assert.equal(record.finalized, false);
});

test('buildHistoryRecord: createdBy matches passed uid', () => {
    loadModule();
    const assignment = {
        eventTypeId: 'desert_storm',
        eventName: 'Test',
        gameId: 'last_war',
        scheduledAt: null,
        teamA: [],
        teamB: [],
    };
    const record = global.DSFeatureEventHistoryCore.buildHistoryRecord(assignment, 'uid_test_user');
    assert.equal(record.createdBy, 'uid_test_user');
});

test('buildHistoryRecord: completedAt is null on creation', () => {
    loadModule();
    const record = global.DSFeatureEventHistoryCore.buildHistoryRecord({}, 'uid_leader');
    assert.equal(record.completedAt, null);
});

test('buildHistoryRecord: teamAssignments copies teamA and teamB arrays', () => {
    loadModule();
    const assignment = {
        teamA: [{ playerName: 'Alice' }],
        teamB: [{ playerName: 'Bob' }],
    };
    const record = global.DSFeatureEventHistoryCore.buildHistoryRecord(assignment, 'uid_leader');
    assert.equal(record.teamAssignments.teamA.length, 1);
    assert.equal(record.teamAssignments.teamB.length, 1);
});

// ---------------------------------------------------------------------------
// buildAttendanceDocs
// ---------------------------------------------------------------------------

test('buildAttendanceDocs: one entry per player across both teams', () => {
    loadModule();
    const teamAssignments = {
        teamA: [{ playerName: 'Alice' }, { playerName: 'Bob' }],
        teamB: [{ playerName: 'Charlie' }],
    };
    const docs = global.DSFeatureEventHistoryCore.buildAttendanceDocs(teamAssignments);
    assert.equal(docs.length, 3);
});

test('buildAttendanceDocs: docId is sanitized, playerName is raw', () => {
    loadModule();
    const teamAssignments = {
        teamA: [{ playerName: 'Player.Name' }],
        teamB: [],
    };
    const docs = global.DSFeatureEventHistoryCore.buildAttendanceDocs(teamAssignments);
    assert.equal(docs[0].docId, 'Player_Name');
    assert.equal(docs[0].playerName, 'Player.Name');
});

test('buildAttendanceDocs: default status is confirmed', () => {
    loadModule();
    const teamAssignments = {
        teamA: [{ playerName: 'Alice' }],
        teamB: [],
    };
    const docs = global.DSFeatureEventHistoryCore.buildAttendanceDocs(teamAssignments);
    assert.equal(docs[0].attendanceDoc.status, 'confirmed');
});

test('buildAttendanceDocs: teamA player has team=teamA', () => {
    loadModule();
    const teamAssignments = {
        teamA: [{ playerName: 'Alice' }],
        teamB: [{ playerName: 'Bob' }],
    };
    const docs = global.DSFeatureEventHistoryCore.buildAttendanceDocs(teamAssignments);
    const aliceDoc = docs.find(d => d.playerName === 'Alice');
    const bobDoc = docs.find(d => d.playerName === 'Bob');
    assert.equal(aliceDoc.attendanceDoc.team, 'teamA');
    assert.equal(bobDoc.attendanceDoc.team, 'teamB');
});

test('buildAttendanceDocs: player with dot in name — raw name preserved, docId sanitized', () => {
    loadModule();
    const teamAssignments = {
        teamA: [{ playerName: 'Super.Player' }],
        teamB: [],
    };
    const docs = global.DSFeatureEventHistoryCore.buildAttendanceDocs(teamAssignments);
    assert.equal(docs[0].playerName, 'Super.Player');
    assert.equal(docs[0].attendanceDoc.playerName, 'Super.Player');
    assert.equal(docs[0].docId, 'Super_Player');
});

test('buildAttendanceDocs: special chars in name — docId sanitized', () => {
    loadModule();
    const teamAssignments = {
        teamA: [{ playerName: 'Player#1' }],
        teamB: [],
    };
    const docs = global.DSFeatureEventHistoryCore.buildAttendanceDocs(teamAssignments);
    assert.equal(docs[0].docId, 'Player_1');
    assert.equal(docs[0].playerName, 'Player#1');
});

// ---------------------------------------------------------------------------
// validateStatusTransition
// ---------------------------------------------------------------------------

test('validateStatusTransition: confirmed → attended is valid', () => {
    loadModule();
    assert.equal(global.DSFeatureEventHistoryCore.validateStatusTransition('confirmed', 'attended').valid, true);
});

test('validateStatusTransition: confirmed → no_show is valid', () => {
    loadModule();
    assert.equal(global.DSFeatureEventHistoryCore.validateStatusTransition('confirmed', 'no_show').valid, true);
});

test('validateStatusTransition: confirmed → late_sub is valid', () => {
    loadModule();
    assert.equal(global.DSFeatureEventHistoryCore.validateStatusTransition('confirmed', 'late_sub').valid, true);
});

test('validateStatusTransition: confirmed → excused is valid', () => {
    loadModule();
    assert.equal(global.DSFeatureEventHistoryCore.validateStatusTransition('confirmed', 'excused').valid, true);
});

test('validateStatusTransition: confirmed → cancelled_event is valid', () => {
    loadModule();
    assert.equal(global.DSFeatureEventHistoryCore.validateStatusTransition('confirmed', 'cancelled_event').valid, true);
});

test('validateStatusTransition: attended → attended is invalid', () => {
    loadModule();
    assert.equal(global.DSFeatureEventHistoryCore.validateStatusTransition('attended', 'attended').valid, false);
});

test('validateStatusTransition: attended → no_show is invalid', () => {
    loadModule();
    assert.equal(global.DSFeatureEventHistoryCore.validateStatusTransition('attended', 'no_show').valid, false);
});

test('validateStatusTransition: attended → confirmed is invalid', () => {
    loadModule();
    assert.equal(global.DSFeatureEventHistoryCore.validateStatusTransition('attended', 'confirmed').valid, false);
});

test('validateStatusTransition: no_show → attended is invalid', () => {
    loadModule();
    assert.equal(global.DSFeatureEventHistoryCore.validateStatusTransition('no_show', 'attended').valid, false);
});

test('validateStatusTransition: no_show → excused is invalid', () => {
    loadModule();
    assert.equal(global.DSFeatureEventHistoryCore.validateStatusTransition('no_show', 'excused').valid, false);
});

test('validateStatusTransition: late_sub → attended is invalid', () => {
    loadModule();
    assert.equal(global.DSFeatureEventHistoryCore.validateStatusTransition('late_sub', 'attended').valid, false);
});

test('validateStatusTransition: excused → attended is invalid', () => {
    loadModule();
    assert.equal(global.DSFeatureEventHistoryCore.validateStatusTransition('excused', 'attended').valid, false);
});

test('validateStatusTransition: cancelled_event → attended is invalid', () => {
    loadModule();
    assert.equal(global.DSFeatureEventHistoryCore.validateStatusTransition('cancelled_event', 'attended').valid, false);
});

test('validateStatusTransition: empty string → attended is invalid', () => {
    loadModule();
    assert.equal(global.DSFeatureEventHistoryCore.validateStatusTransition('', 'attended').valid, false);
});

// ---------------------------------------------------------------------------
// checkFinalizationStaleness
// ---------------------------------------------------------------------------

test('checkFinalizationStaleness: 8 days ago, finalized=false → stale', () => {
    loadModule();
    const now = new Date('2026-02-22T00:00:00Z');
    const completedAt = new Date('2026-02-14T00:00:00Z'); // 8 days ago
    const result = global.DSFeatureEventHistoryCore.checkFinalizationStaleness(
        { completedAt, finalized: false },
        now
    );
    assert.equal(result.stale, true);
    assert.ok(result.daysSinceCompleted >= 8);
});

test('checkFinalizationStaleness: 3 days ago, finalized=false → not stale', () => {
    loadModule();
    const now = new Date('2026-02-22T00:00:00Z');
    const completedAt = new Date('2026-02-19T00:00:00Z'); // 3 days ago
    const result = global.DSFeatureEventHistoryCore.checkFinalizationStaleness(
        { completedAt, finalized: false },
        now
    );
    assert.equal(result.stale, false);
    assert.ok(result.daysSinceCompleted >= 3);
});

test('checkFinalizationStaleness: finalized=true, 30 days ago → not stale', () => {
    loadModule();
    const now = new Date('2026-02-22T00:00:00Z');
    const completedAt = new Date('2026-01-23T00:00:00Z'); // 30 days ago
    const result = global.DSFeatureEventHistoryCore.checkFinalizationStaleness(
        { completedAt, finalized: true },
        now
    );
    assert.equal(result.stale, false);
});

test('checkFinalizationStaleness: completedAt=null → not stale', () => {
    loadModule();
    const now = new Date('2026-02-22T00:00:00Z');
    const result = global.DSFeatureEventHistoryCore.checkFinalizationStaleness(
        { completedAt: null, finalized: false },
        now
    );
    assert.equal(result.stale, false);
    assert.equal(result.daysSinceCompleted, 0);
});
