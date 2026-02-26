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
// buildDisplayName
// ---------------------------------------------------------------------------

test('buildDisplayName: generates correct format for Team A', () => {
    loadModule();
    const date = new Date(2026, 1, 26); // Feb 26, 2026
    const result = global.DSFeatureEventHistoryCore.buildDisplayName('Desert Storm', 'A', date);
    assert.equal(result, 'Desert Storm-Team A-26.02.2026');
});

test('buildDisplayName: generates correct format for Team B', () => {
    loadModule();
    const date = new Date(2026, 0, 5); // Jan 5, 2026
    const result = global.DSFeatureEventHistoryCore.buildDisplayName('Canyon Storm', 'B', date);
    assert.equal(result, 'Canyon Storm-Team B-05.01.2026');
});

test('buildDisplayName: uses Event as fallback when name is empty', () => {
    loadModule();
    const date = new Date(2026, 5, 15);
    const result = global.DSFeatureEventHistoryCore.buildDisplayName('', 'A', date);
    assert.equal(result, 'Event-Team A-15.06.2026');
});

// ---------------------------------------------------------------------------
// buildHistoryRecord
// ---------------------------------------------------------------------------

test('buildHistoryRecord: returns flat record with team and players', () => {
    loadModule();
    const assignment = {
        team: 'A',
        players: [{ playerName: 'Alice', building: 'HQ', role: 'starter' }],
        eventTypeId: 'desert_storm',
        eventDisplayName: 'Desert Storm',
        gameId: 'last_war',
    };
    const record = global.DSFeatureEventHistoryCore.buildHistoryRecord(assignment, 'uid_leader');
    assert.equal(record.team, 'A');
    assert.equal(record.finalized, false);
    assert.equal(record.active, true);
    assert.equal(record.players.length, 1);
    assert.equal(record.players[0].playerName, 'Alice');
    assert.equal(record.eventTypeId, 'desert_storm');
    assert.ok(record.eventName.includes('Desert Storm'));
    assert.ok(record.eventName.includes('Team A'));
});

test('buildHistoryRecord: createdByUid matches passed uid', () => {
    loadModule();
    const record = global.DSFeatureEventHistoryCore.buildHistoryRecord({
        team: 'B', players: [], eventTypeId: 'test',
    }, 'uid_test_user');
    assert.equal(record.createdByUid, 'uid_test_user');
});

test('buildHistoryRecord: handles missing fields gracefully', () => {
    loadModule();
    const record = global.DSFeatureEventHistoryCore.buildHistoryRecord({}, null);
    assert.equal(record.team, 'A');
    assert.deepEqual(record.players, []);
    assert.equal(record.createdByUid, null);
    assert.equal(record.active, true);
});

// ---------------------------------------------------------------------------
// buildAttendanceDocs
// ---------------------------------------------------------------------------

test('buildAttendanceDocs: one entry per player in flat array', () => {
    loadModule();
    const players = [
        { playerName: 'Alice', building: 'HQ' },
        { playerName: 'Bob', building: 'Barracks' },
        { playerName: 'Charlie' },
    ];
    const docs = global.DSFeatureEventHistoryCore.buildAttendanceDocs(players, 'A');
    assert.equal(docs.length, 3);
});

test('buildAttendanceDocs: docId is sanitized, playerName is raw', () => {
    loadModule();
    const players = [{ playerName: 'Player.Name' }];
    const docs = global.DSFeatureEventHistoryCore.buildAttendanceDocs(players, 'A');
    assert.equal(docs[0].docId, 'Player_Name');
    assert.equal(docs[0].playerName, 'Player.Name');
});

test('buildAttendanceDocs: default status is attended', () => {
    loadModule();
    const players = [{ playerName: 'Alice' }];
    const docs = global.DSFeatureEventHistoryCore.buildAttendanceDocs(players, 'A');
    assert.equal(docs[0].attendanceDoc.status, 'attended');
});

test('buildAttendanceDocs: team label passed through', () => {
    loadModule();
    const players = [{ playerName: 'Alice' }];
    const docsA = global.DSFeatureEventHistoryCore.buildAttendanceDocs(players, 'A');
    const docsB = global.DSFeatureEventHistoryCore.buildAttendanceDocs(players, 'B');
    assert.equal(docsA[0].attendanceDoc.team, 'A');
    assert.equal(docsB[0].attendanceDoc.team, 'B');
});

test('buildAttendanceDocs: player with dot in name — raw name preserved, docId sanitized', () => {
    loadModule();
    const players = [{ playerName: 'Super.Player' }];
    const docs = global.DSFeatureEventHistoryCore.buildAttendanceDocs(players, 'A');
    assert.equal(docs[0].playerName, 'Super.Player');
    assert.equal(docs[0].attendanceDoc.playerName, 'Super.Player');
    assert.equal(docs[0].docId, 'Super_Player');
});

test('buildAttendanceDocs: special chars in name — docId sanitized', () => {
    loadModule();
    const players = [{ playerName: 'Player#1' }];
    const docs = global.DSFeatureEventHistoryCore.buildAttendanceDocs(players, 'A');
    assert.equal(docs[0].docId, 'Player_1');
    assert.equal(docs[0].playerName, 'Player#1');
});

test('buildAttendanceDocs: skips entries without playerName', () => {
    loadModule();
    const players = [{ playerName: 'Alice' }, {}, { name: 'Bob' }];
    const docs = global.DSFeatureEventHistoryCore.buildAttendanceDocs(players, 'A');
    // 'Alice' has playerName, {} has neither, 'Bob' has name (accepted as fallback)
    assert.equal(docs.length, 2);
});

// ---------------------------------------------------------------------------
// nextAttendanceStatus
// ---------------------------------------------------------------------------

test('nextAttendanceStatus: attended → no_show', () => {
    loadModule();
    assert.equal(global.DSFeatureEventHistoryCore.nextAttendanceStatus('attended'), 'no_show');
});

test('nextAttendanceStatus: no_show → excused', () => {
    loadModule();
    assert.equal(global.DSFeatureEventHistoryCore.nextAttendanceStatus('no_show'), 'excused');
});

test('nextAttendanceStatus: excused → attended (cycles back)', () => {
    loadModule();
    assert.equal(global.DSFeatureEventHistoryCore.nextAttendanceStatus('excused'), 'attended');
});

test('nextAttendanceStatus: unknown status → attended (default)', () => {
    loadModule();
    assert.equal(global.DSFeatureEventHistoryCore.nextAttendanceStatus('unknown'), 'attended');
});

test('nextAttendanceStatus: empty string → attended (default)', () => {
    loadModule();
    assert.equal(global.DSFeatureEventHistoryCore.nextAttendanceStatus(''), 'attended');
});

// ---------------------------------------------------------------------------
// checkFinalizationStaleness
// ---------------------------------------------------------------------------

test('checkFinalizationStaleness: 8 days ago, finalized=false → stale', () => {
    loadModule();
    const now = new Date('2026-02-22T00:00:00Z');
    const createdAt = new Date('2026-02-14T00:00:00Z'); // 8 days ago
    const result = global.DSFeatureEventHistoryCore.checkFinalizationStaleness(
        { createdAt, finalized: false },
        now
    );
    assert.equal(result.stale, true);
    assert.ok(result.daysSinceCompleted >= 8);
});

test('checkFinalizationStaleness: 3 days ago, finalized=false → not stale', () => {
    loadModule();
    const now = new Date('2026-02-22T00:00:00Z');
    const createdAt = new Date('2026-02-19T00:00:00Z'); // 3 days ago
    const result = global.DSFeatureEventHistoryCore.checkFinalizationStaleness(
        { createdAt, finalized: false },
        now
    );
    assert.equal(result.stale, false);
    assert.ok(result.daysSinceCompleted >= 3);
});

test('checkFinalizationStaleness: finalized=true, 30 days ago → not stale', () => {
    loadModule();
    const now = new Date('2026-02-22T00:00:00Z');
    const createdAt = new Date('2026-01-23T00:00:00Z'); // 30 days ago
    const result = global.DSFeatureEventHistoryCore.checkFinalizationStaleness(
        { createdAt, finalized: true },
        now
    );
    assert.equal(result.stale, false);
});

test('checkFinalizationStaleness: createdAt=null → not stale', () => {
    loadModule();
    const now = new Date('2026-02-22T00:00:00Z');
    const result = global.DSFeatureEventHistoryCore.checkFinalizationStaleness(
        { createdAt: null, finalized: false },
        now
    );
    assert.equal(result.stale, false);
    assert.equal(result.daysSinceCompleted, 0);
});
