(function initFeatureEventHistoryCore(global) {
    var ATTENDANCE_STATUSES = ['attended', 'no_show', 'excused'];

    function buildDisplayName(eventDisplayName, team, date) {
        var dd = String(date.getDate()).padStart(2, '0');
        var mm = String(date.getMonth() + 1).padStart(2, '0');
        var yyyy = date.getFullYear();
        var teamLabel = team === 'A' ? 'Team A' : 'Team B';
        return (eventDisplayName || 'Event') + '-' + teamLabel + '-' + dd + '.' + mm + '.' + yyyy;
    }

    // Build a single-team history record.
    // assignment: { team: 'A'|'B', players: [], eventTypeId, eventDisplayName, gameId }
    // createdByUid: string | null
    function buildHistoryRecord(assignment, createdByUid) {
        var now = new Date();
        var players = Array.isArray(assignment.players) ? assignment.players.map(function(p) {
            return {
                playerName: p.playerName || p.name || '',
                building: p.building || null,
                role: p.role || 'starter',
            };
        }) : [];

        return {
            eventTypeId: assignment.eventTypeId || null,
            eventName: buildDisplayName(
                assignment.eventDisplayName || assignment.eventTypeId || 'Event',
                assignment.team,
                now
            ),
            gameId: assignment.gameId || null,
            team: assignment.team || 'A',
            players: players,
            active: true,
            finalized: false,
            createdByUid: createdByUid || null,
            createdAt: now,
        };
    }

    // Build attendance docs from flat players array.
    // Each player defaults to status: 'attended'.
    function buildAttendanceDocs(players, team) {
        var utils = global.DSFirestoreUtils;
        return (players || []).map(function(player) {
            var playerName = player && (player.playerName || player.name);
            if (!playerName) return null;
            var docId = utils ? utils.sanitizeDocId(playerName) : playerName;
            return {
                docId: docId,
                playerName: playerName,
                attendanceDoc: {
                    playerName: playerName,
                    team: team || 'A',
                    building: player.building || null,
                    role: player.role || 'starter',
                    status: 'attended',
                    markedAt: null,
                    markedBy: null,
                },
            };
        }).filter(Boolean);
    }

    // Cycle attendance status: attended → no_show → excused → attended
    function nextAttendanceStatus(current) {
        var idx = ATTENDANCE_STATUSES.indexOf(current);
        if (idx === -1) return 'attended';
        return ATTENDANCE_STATUSES[(idx + 1) % ATTENDANCE_STATUSES.length];
    }

    function checkFinalizationStaleness(historyDoc, now) {
        if (!historyDoc || !historyDoc.createdAt || historyDoc.finalized === true) {
            return { stale: false, daysSinceCompleted: 0 };
        }

        var createdAt = historyDoc.createdAt;
        var createdMs = createdAt instanceof Date
            ? createdAt.getTime()
            : (createdAt.toDate ? createdAt.toDate().getTime() : Number(createdAt));

        var nowMs = now instanceof Date ? now.getTime() : Number(now);
        var diffMs = nowMs - createdMs;
        var daysSinceCompleted = diffMs / (24 * 60 * 60 * 1000);
        var SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

        return {
            stale: diffMs > SEVEN_DAYS_MS,
            daysSinceCompleted: daysSinceCompleted,
        };
    }

    global.DSFeatureEventHistoryCore = {
        ATTENDANCE_STATUSES: ATTENDANCE_STATUSES,
        buildDisplayName: buildDisplayName,
        buildHistoryRecord: buildHistoryRecord,
        buildAttendanceDocs: buildAttendanceDocs,
        nextAttendanceStatus: nextAttendanceStatus,
        checkFinalizationStaleness: checkFinalizationStaleness,
    };
})(window);
