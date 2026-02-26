const test = require('node:test');
const assert = require('node:assert/strict');
const {
    makePlayer,
    makeAttendanceRecord,
    makeHistoryRecord,
    makePlayerStats,
    makeToken,
} = require('./factories.js');

test('makePlayer returns correct default shape', () => {
    const p = makePlayer();
    assert.equal(p.name, 'TestPlayer');
    assert.equal(p.power, 100);
    assert.equal(p.thp, 500);
    assert.equal(p.troops, 'Tank');
    assert.equal(p.reliabilityScore, null);
});

test('makePlayer applies overrides', () => {
    const p = makePlayer({ name: 'Alpha', power: 999 });
    assert.equal(p.name, 'Alpha');
    assert.equal(p.power, 999);
    assert.equal(p.thp, 500);
});

test('makeAttendanceRecord returns correct default shape', () => {
    const r = makeAttendanceRecord();
    assert.equal(r.status, 'attended');
    assert.equal(r.team, 'teamA');
    assert.equal(r.role, 'assigned');
    assert.equal(r.building, 'B1');
    assert.equal(r.markedBy, 'uid_leader');
    assert.equal(r.markedAt, null);
});

test('makeAttendanceRecord applies overrides', () => {
    const r = makeAttendanceRecord({ status: 'no-show', team: 'teamB' });
    assert.equal(r.status, 'no-show');
    assert.equal(r.team, 'teamB');
    assert.equal(r.building, 'B1');
});

test('makeHistoryRecord returns correct default shape', () => {
    const h = makeHistoryRecord();
    assert.equal(h.eventTypeId, 'desert_storm');
    assert.equal(h.eventName, 'Desert Storm #1');
    assert.equal(h.gameId, 'last_war');
    assert.ok(h.scheduledAt instanceof Date);
    assert.equal(h.completedAt, null);
    assert.equal(h.status, 'planned');
    assert.deepEqual(h.teamAssignments, { teamA: [], teamB: [] });
    assert.equal(h.notes, '');
    assert.equal(h.createdBy, 'uid_leader');
    assert.equal(h.finalized, false);
});

test('makePlayerStats returns correct default shape', () => {
    const s = makePlayerStats();
    assert.equal(s.totalEvents, 0);
    assert.equal(s.attended, 0);
    assert.equal(s.noShows, 0);
    assert.equal(s.excused, 0);
    assert.equal(s.reliabilityScore, null);
    assert.equal(s.currentStreak, 0);
    assert.equal(s.longestNoShowStreak, 0);
    assert.equal(s.lastEventDate, null);
    assert.deepEqual(s.recentHistory, []);
});

test('makePlayerStats applies overrides', () => {
    const s = makePlayerStats({ totalEvents: 5, attended: 4, reliabilityScore: 0.8 });
    assert.equal(s.totalEvents, 5);
    assert.equal(s.attended, 4);
    assert.equal(s.reliabilityScore, 0.8);
    assert.equal(s.noShows, 0);
});

test('makeToken returns correct default shape', () => {
    const t = makeToken();
    assert.equal(t.token, 'abcdef1234567890abcdef1234567890');
    assert.equal(t.allianceId, 'alliance_1');
    assert.equal(t.playerName, 'TestPlayer');
    assert.equal(t.gameId, 'last_war');
    assert.equal(t.createdBy, 'uid_leader');
    assert.ok(t.expiresAt instanceof Date);
    assert.ok(t.expiresAt > new Date());
    assert.equal(t.used, false);
    assert.equal(t.usedAt, null);
    assert.equal(t.usedByAnonUid, null);
    assert.deepEqual(t.currentSnapshot, { power: 100, thp: 500, troops: 'Tank' });
    assert.equal(t.linkedEventId, null);
});

test('makeToken applies overrides', () => {
    const t = makeToken({ used: true, playerName: 'BetaPlayer' });
    assert.equal(t.used, true);
    assert.equal(t.playerName, 'BetaPlayer');
    assert.equal(t.gameId, 'last_war');
});
