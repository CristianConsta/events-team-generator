(function initFeatureEventHistoryController(global) {
    var _gateway = null;
    var _unsubscribePendingCount = null;
    var _currentHistoryDoc = null;

    function getAllianceId() {
        return _gateway ? _gateway.getAllianceId() : null;
    }

    function getCurrentUser() {
        if (_gateway && typeof _gateway.getCurrentUser === 'function') {
            return _gateway.getCurrentUser();
        }
        return null;
    }

    // Initialize the event history feature and attach Firestore listeners.
    // gateway: FirebaseService (the unified flat gateway)
    // Returns: { destroy() }
    function init(gateway) {
        _gateway = gateway;

        var allianceId = getAllianceId();
        if (allianceId && typeof _gateway.subscribePendingFinalizationCount === 'function') {
            _unsubscribePendingCount = _gateway.subscribePendingFinalizationCount(
                allianceId,
                function onPendingCount(count) {
                    var badgeContainer = document.getElementById('eventHistoryPendingBadge');
                    if (global.DSFeatureEventHistoryView && typeof global.DSFeatureEventHistoryView.renderPendingBadge === 'function') {
                        global.DSFeatureEventHistoryView.renderPendingBadge(badgeContainer, count);
                    }
                }
            );
        }

        return {
            destroy: function destroy() {
                if (typeof _unsubscribePendingCount === 'function') {
                    _unsubscribePendingCount();
                    _unsubscribePendingCount = null;
                }
                _gateway = null;
                _currentHistoryDoc = null;
            },
        };
    }

    // Navigate to Event History view and render history list.
    function showEventHistoryView() {
        var allianceId = getAllianceId();
        if (!allianceId || !_gateway) {
            console.error('showEventHistoryView: no alliance or gateway');
            return;
        }

        var filters = {};
        if (global.DSFeatureEventHistoryActions && typeof global.DSFeatureEventHistoryActions.readHistoryFilterState === 'function') {
            filters = global.DSFeatureEventHistoryActions.readHistoryFilterState();
        }

        _gateway.loadHistoryRecords(allianceId, filters).then(function(records) {
            var container = document.getElementById('eventHistoryContainer');
            if (global.DSFeatureEventHistoryView && typeof global.DSFeatureEventHistoryView.renderHistoryList === 'function') {
                global.DSFeatureEventHistoryView.renderHistoryList(container, records);
            }
        }).catch(function(err) {
            console.error('showEventHistoryView error:', err);
        });
    }

    // Save current assignment as new history record.
    // assignment: current generator output
    // Returns: Promise<{ ok, historyId?, error? }>
    async function saveAssignmentAsHistory(assignment) {
        try {
            var allianceId = getAllianceId();
            if (!allianceId || !_gateway) {
                return { ok: false, error: 'Not available' };
            }

            var user = getCurrentUser();
            var createdByUid = user ? user.uid : null;

            if (!global.DSFeatureEventHistoryCore || typeof global.DSFeatureEventHistoryCore.buildHistoryRecord !== 'function') {
                return { ok: false, error: 'DSFeatureEventHistoryCore not available' };
            }

            var record = global.DSFeatureEventHistoryCore.buildHistoryRecord(assignment, createdByUid);
            var saveResult = await _gateway.saveHistoryRecord(allianceId, record);
            if (!saveResult || !saveResult.ok) {
                return saveResult || { ok: false, error: 'Unknown error saving history record' };
            }

            var historyId = saveResult.historyId;
            var attendanceDocs = global.DSFeatureEventHistoryCore.buildAttendanceDocs(record.teamAssignments);
            if (attendanceDocs.length > 0) {
                var batchResult = await _gateway.saveAttendanceBatch(allianceId, historyId, attendanceDocs.map(function(entry) {
                    return { docId: entry.docId, doc: entry.attendanceDoc };
                }));
                if (!batchResult || !batchResult.ok) {
                    console.error('saveAssignmentAsHistory: attendance batch failed', batchResult);
                }
            }

            return { ok: true, historyId: historyId };
        } catch (err) {
            console.error('saveAssignmentAsHistory error:', err);
            return { ok: false, error: err.message };
        }
    }

    // Open attendance check-in panel for a history record.
    // historyId: string
    async function openAttendancePanel(historyId) {
        try {
            var allianceId = getAllianceId();
            if (!allianceId || !_gateway || !historyId) {
                console.error('openAttendancePanel: missing params');
                return;
            }

            var attendanceDocs = await _gateway.loadAttendance(allianceId, historyId);

            // Find the history doc from the rendered list or load it
            var historyDoc = _currentHistoryDoc;
            if (!historyDoc || historyDoc.id !== historyId) {
                var records = await _gateway.loadHistoryRecords(allianceId, {});
                historyDoc = records.find(function(r) { return r.id === historyId; }) || null;
                _currentHistoryDoc = historyDoc;
            }

            var stalenessCheck = null;
            if (global.DSFeatureEventHistoryCore && typeof global.DSFeatureEventHistoryCore.checkFinalizationStaleness === 'function') {
                stalenessCheck = global.DSFeatureEventHistoryCore.checkFinalizationStaleness(historyDoc, new Date());
            }

            var container = document.getElementById('attendancePanelBody');
            if (global.DSFeatureEventHistoryView && typeof global.DSFeatureEventHistoryView.renderAttendancePanel === 'function') {
                global.DSFeatureEventHistoryView.renderAttendancePanel(container, historyDoc, attendanceDocs, { stalenessCheck: stalenessCheck });
            }

            var modal = document.getElementById('attendancePanelModal');
            if (modal) {
                modal.classList.remove('hidden');
                modal.setAttribute('data-history-id', historyId);
            }
        } catch (err) {
            console.error('openAttendancePanel error:', err);
        }
    }

    // Mark attendance for all players in batch.
    // historyId: string, attendanceMap: { playerName (raw): status }
    // Returns: Promise<{ ok, error? }>
    async function markAttendanceBatch(historyId, attendanceMap) {
        try {
            var allianceId = getAllianceId();
            if (!allianceId || !_gateway || !historyId) {
                return { ok: false, error: 'Not available' };
            }
            if (!attendanceMap || typeof attendanceMap !== 'object') {
                return { ok: false, error: 'Invalid attendanceMap' };
            }

            var utils = global.DSFirestoreUtils;
            var playerNames = Object.keys(attendanceMap);
            var user = getCurrentUser();
            var markedBy = user ? (user.uid || null) : null;

            var promises = playerNames.map(function(playerName) {
                var status = attendanceMap[playerName];
                var docId = utils ? utils.sanitizeDocId(playerName) : playerName;
                return _gateway.updateAttendanceStatus(allianceId, historyId, docId, status, markedBy);
            });

            var results = await Promise.all(promises);
            var failed = results.filter(function(r) { return !r || !r.ok; });
            if (failed.length > 0) {
                return { ok: false, error: 'Some attendance updates failed' };
            }
            return { ok: true };
        } catch (err) {
            console.error('markAttendanceBatch error:', err);
            return { ok: false, error: err.message };
        }
    }

    // Finalize attendance — ATOMIC operation.
    // historyId: string
    // Returns: Promise<{ ok, error? }>
    async function finalizeAttendance(historyId) {
        try {
            var allianceId = getAllianceId();
            if (!allianceId || !_gateway || !historyId) {
                return { ok: false, error: 'Not available' };
            }

            var attendanceDocs = await _gateway.loadAttendance(allianceId, historyId);

            var utils = global.DSFirestoreUtils;
            var reliability = global.DSCoreReliability;

            // Group attendance by player docId for stats recalculation
            var playerDocIds = attendanceDocs.map(function(doc) {
                return doc.docId || (utils ? utils.sanitizeDocId(doc.playerName) : doc.playerName);
            });

            var existingStats = {};
            if (playerDocIds.length > 0) {
                existingStats = await _gateway.loadPlayerStats(allianceId, playerDocIds);
            }

            var playerStatsUpdates = [];
            if (reliability && typeof reliability.recalculatePlayerStats === 'function') {
                attendanceDocs.forEach(function(doc) {
                    var docId = doc.docId || (utils ? utils.sanitizeDocId(doc.playerName) : doc.playerName);
                    var existing = existingStats[docId] || {};
                    var recentHistory = Array.isArray(existing.recentHistory) ? existing.recentHistory : [];

                    // Prepend this event's attendance entry to the player's history
                    var newEntry = {
                        historyId: historyId,
                        status: doc.status,
                        eventName: (_currentHistoryDoc && _currentHistoryDoc.eventName) || null,
                        scheduledAt: (_currentHistoryDoc && _currentHistoryDoc.scheduledAt) || null,
                    };
                    var updatedHistory = [newEntry].concat(recentHistory);
                    var newStats = reliability.recalculatePlayerStats(updatedHistory, existing);

                    playerStatsUpdates.push({ docId: docId, stats: newStats });
                });
            }

            var result = await _gateway.finalizeHistory(allianceId, historyId, playerStatsUpdates);
            if (result && result.ok) {
                _currentHistoryDoc = null;
                var modal = document.getElementById('attendancePanelModal');
                if (modal) {
                    modal.classList.add('hidden');
                }
            }
            return result || { ok: false, error: 'Unknown error' };
        } catch (err) {
            console.error('finalizeAttendance error:', err);
            return { ok: false, error: err.message };
        }
    }

    global.DSFeatureEventHistoryController = {
        init: init,
        showEventHistoryView: showEventHistoryView,
        saveAssignmentAsHistory: saveAssignmentAsHistory,
        openAttendancePanel: openAttendancePanel,
        markAttendanceBatch: markAttendanceBatch,
        finalizeAttendance: finalizeAttendance,
    };
})(window);
