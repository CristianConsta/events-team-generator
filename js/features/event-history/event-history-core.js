(function initFeatureEventHistoryCore(global) {
    var VALID_TRANSITIONS_FROM_CONFIRMED = {
        attended: true,
        no_show: true,
        late_sub: true,
        excused: true,
        cancelled_event: true,
    };

    var SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

    function buildHistoryRecord(assignment, createdByUid) {
        var now = new Date();
        return {
            eventTypeId: assignment.eventTypeId || null,
            eventName: assignment.eventName || null,
            gameId: assignment.gameId || null,
            scheduledAt: assignment.scheduledAt || null,
            completedAt: null,
            status: 'planned',
            teamAssignments: {
                teamA: Array.isArray(assignment.teamA) ? assignment.teamA.slice() : [],
                teamB: Array.isArray(assignment.teamB) ? assignment.teamB.slice() : [],
            },
            notes: '',
            createdBy: createdByUid || null,
            createdAt: now,
            finalized: false,
        };
    }

    function buildAttendanceDocs(teamAssignments) {
        var results = [];
        var utils = global.DSFirestoreUtils;

        function processTeam(players, teamLabel) {
            if (!Array.isArray(players)) {
                return;
            }
            players.forEach(function (player) {
                var playerName = player && player.playerName;
                if (!playerName) {
                    return;
                }
                var docId = utils.sanitizeDocId(playerName);
                results.push({
                    docId: docId,
                    playerName: playerName,
                    attendanceDoc: {
                        playerName: playerName,
                        team: teamLabel,
                        role: 'assigned',
                        building: player.building || null,
                        status: 'confirmed',
                        confirmedAt: null,
                        markedAt: null,
                        markedBy: null,
                    },
                });
            });
        }

        var assignments = teamAssignments || {};
        processTeam(assignments.teamA, 'teamA');
        processTeam(assignments.teamB, 'teamB');

        return results;
    }

    function validateStatusTransition(currentStatus, newStatus) {
        if (currentStatus === 'confirmed') {
            if (VALID_TRANSITIONS_FROM_CONFIRMED[newStatus]) {
                return { valid: true };
            }
            return {
                valid: false,
                reason: 'confirmed can only transition to attended, no_show, late_sub, excused, or cancelled_event',
            };
        }

        // All other statuses are terminal
        return {
            valid: false,
            reason: 'status "' + currentStatus + '" is terminal and cannot be changed',
        };
    }

    function checkFinalizationStaleness(historyDoc, now) {
        if (!historyDoc || !historyDoc.completedAt || historyDoc.finalized === true) {
            return { stale: false, daysSinceCompleted: 0 };
        }

        var completedAt = historyDoc.completedAt;
        var completedMs = completedAt instanceof Date
            ? completedAt.getTime()
            : (completedAt.toDate ? completedAt.toDate().getTime() : Number(completedAt));

        var nowMs = now instanceof Date ? now.getTime() : Number(now);
        var diffMs = nowMs - completedMs;
        var daysSinceCompleted = diffMs / (24 * 60 * 60 * 1000);

        var stale = diffMs > SEVEN_DAYS_MS;
        return {
            stale: stale,
            daysSinceCompleted: daysSinceCompleted,
        };
    }

    global.DSFeatureEventHistoryCore = {
        buildHistoryRecord: buildHistoryRecord,
        buildAttendanceDocs: buildAttendanceDocs,
        validateStatusTransition: validateStatusTransition,
        checkFinalizationStaleness: checkFinalizationStaleness,
    };
})(window);
