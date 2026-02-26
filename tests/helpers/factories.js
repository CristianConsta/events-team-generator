// tests/helpers/factories.js
// Factory functions for creating test data objects

function makePlayer(overrides) {
    return Object.assign({
        name: 'TestPlayer',
        power: 100,
        thp: 500,
        troops: 'Tank',
        reliabilityScore: null,
    }, overrides || {});
}

function makeAttendanceRecord(overrides) {
    return Object.assign({
        status: 'attended',
        team: 'teamA',
        role: 'assigned',
        building: 'B1',
        markedBy: 'uid_leader',
        markedAt: null,
    }, overrides || {});
}

function makeHistoryRecord(overrides) {
    return Object.assign({
        eventTypeId: 'desert_storm',
        eventName: 'Desert Storm #1',
        gameId: 'last_war',
        scheduledAt: new Date('2026-01-01T18:00:00Z'),
        completedAt: null,
        status: 'planned',
        teamAssignments: { teamA: [], teamB: [] },
        notes: '',
        createdBy: 'uid_leader',
        finalized: false,
    }, overrides || {});
}

function makePlayerStats(overrides) {
    return Object.assign({
        totalEvents: 0,
        attended: 0,
        noShows: 0,
        excused: 0,
        reliabilityScore: null,
        currentStreak: 0,
        longestNoShowStreak: 0,
        lastEventDate: null,
        recentHistory: [],
    }, overrides || {});
}

function makeToken(overrides) {
    return Object.assign({
        token: 'abcdef1234567890abcdef1234567890',
        allianceId: 'alliance_1',
        playerName: 'TestPlayer',
        gameId: 'last_war',
        createdBy: 'uid_leader',
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        used: false,
        usedAt: null,
        usedByAnonUid: null,
        currentSnapshot: { power: 100, thp: 500, troops: 'Tank' },
        linkedEventId: null,
    }, overrides || {});
}

module.exports = { makePlayer, makeAttendanceRecord, makeHistoryRecord, makePlayerStats, makeToken };
