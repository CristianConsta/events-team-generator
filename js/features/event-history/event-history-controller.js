(function initFeatureEventHistoryController(global) {
    var _gateway = null;
    var _unsubscribePendingCount = null;
    var _currentHistoryDoc = null;
    var MAX_HISTORY_PER_EVENT = 10;

    function getAllianceId() {
        return _gateway ? _gateway.getAllianceId() : null;
    }

    function getCurrentUser() {
        if (_gateway && typeof _gateway.getCurrentUser === 'function') {
            return _gateway.getCurrentUser();
        }
        return null;
    }

    function getTranslate() {
        return typeof global.t === 'function' ? global.t : function(k) { return k; };
    }

    // Initialize the event history feature and attach Firestore listeners.
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

        // Wire attendance toggle via event delegation
        var attendanceBody = document.getElementById('attendancePanelBody');
        if (attendanceBody) {
            attendanceBody.addEventListener('click', function(e) {
                var btn = e.target.closest('[data-action="cycle-attendance-status"]');
                if (!btn || btn.disabled) return;
                var playerName = btn.getAttribute('data-player-name');
                var currentStatus = btn.getAttribute('data-current-status');
                var docId = btn.getAttribute('data-doc-id');
                var modal = document.getElementById('attendancePanelModal');
                var historyId = modal ? modal.getAttribute('data-history-id') : null;
                if (!historyId || !playerName) return;

                var core = global.DSFeatureEventHistoryCore;
                var newStatus = core ? core.nextAttendanceStatus(currentStatus) : 'attended';

                // Optimistic UI update
                if (global.DSFeatureEventHistoryView && typeof global.DSFeatureEventHistoryView.updateToggleButton === 'function') {
                    global.DSFeatureEventHistoryView.updateToggleButton(btn, newStatus, getTranslate());
                }

                // Persist to Firestore
                var allianceId = getAllianceId();
                var user = getCurrentUser();
                var markedBy = user ? user.uid : null;
                if (_gateway && typeof _gateway.updateAttendanceStatus === 'function') {
                    _gateway.updateAttendanceStatus(allianceId, historyId, docId || playerName, newStatus, markedBy)
                        .catch(function(err) {
                            console.error('toggleAttendanceStatus error:', err);
                            // Revert on failure
                            if (global.DSFeatureEventHistoryView && typeof global.DSFeatureEventHistoryView.updateToggleButton === 'function') {
                                global.DSFeatureEventHistoryView.updateToggleButton(btn, currentStatus, getTranslate());
                            }
                        });
                }
            });
        }

        // Wire open-attendance click delegation on history container
        var historyContainer = document.getElementById('eventHistoryContainer');
        if (historyContainer) {
            historyContainer.addEventListener('click', function(e) {
                var btn = e.target.closest('[data-action="open-attendance"]');
                if (!btn) return;
                var historyId = btn.getAttribute('data-history-id');
                if (historyId) {
                    openAttendancePanel(historyId);
                }
            });
        }

        // Wire finalize and cancel buttons on attendance modal
        var finalizeBtn = document.getElementById('attendanceFinalizeBtn');
        if (finalizeBtn) {
            finalizeBtn.addEventListener('click', function() {
                var modal = document.getElementById('attendancePanelModal');
                var historyId = modal ? modal.getAttribute('data-history-id') : null;
                if (!historyId) return;
                var confirmed = confirm(getTranslate()('attendance_finalize_confirm'));
                if (!confirmed) return;
                finalizeAttendance(historyId, function() {
                    if (modal) modal.classList.add('hidden');
                    showEventHistoryView();
                });
            });
        }

        var cancelBtn = document.getElementById('attendanceCancelBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', function() {
                var modal = document.getElementById('attendancePanelModal');
                if (modal) modal.classList.add('hidden');
            });
        }

        // Wire filter change listener once
        var filterEl = document.getElementById('eventHistoryFilterEventType');
        if (filterEl) {
            filterEl.addEventListener('change', function() {
                showEventHistoryView();
            });
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
            showEventHistoryView: showEventHistoryView,
            autoSave: autoSave,
            openAttendancePanel: openAttendancePanel,
            finalizeAttendance: finalizeAttendance,
        };
    }

    // Populate the event type filter dropdown from the events registry.
    function populateEventTypeFilter() {
        var select = document.getElementById('eventHistoryFilterEventType');
        if (!select) return;
        var registry = global.DSEventsRegistryController;
        if (!registry || typeof registry.getEventIds !== 'function') return;

        var eventIds = registry.getEventIds();
        // Keep the "All Events" option, clear the rest
        while (select.options.length > 1) {
            select.remove(1);
        }
        eventIds.forEach(function(eventId) {
            var option = document.createElement('option');
            option.value = eventId;
            option.textContent = registry.getEventDisplayName
                ? registry.getEventDisplayName(eventId)
                : eventId;
            select.appendChild(option);
        });
    }

    // Navigate to Event History view and render history list.
    function showEventHistoryView() {
        if (!_gateway) {
            console.error('showEventHistoryView: no gateway');
            return;
        }

        populateEventTypeFilter();

        var allianceId = getAllianceId(); // may be null for solo players
        var filters = {};
        if (global.DSFeatureEventHistoryActions && typeof global.DSFeatureEventHistoryActions.readHistoryFilterState === 'function') {
            filters = global.DSFeatureEventHistoryActions.readHistoryFilterState();
        }
        // Always filter to active records only
        filters.activeOnly = true;

        _gateway.loadHistoryRecords(allianceId, filters).then(function(records) {
            var container = document.getElementById('eventHistoryContainer');
            if (global.DSFeatureEventHistoryView && typeof global.DSFeatureEventHistoryView.renderHistoryList === 'function') {
                global.DSFeatureEventHistoryView.renderHistoryList(container, records, {
                    translate: getTranslate(),
                    onOpenAttendance: openAttendancePanel,
                });
            }
        }).catch(function(err) {
            console.error('showEventHistoryView error:', err);
        });
    }

    // Auto-save a team generation as a history entry.
    // team: 'A' | 'B'
    // assignments: array from DSCoreAssignment (starters assigned to buildings)
    // substitutes: array of substitute players
    // context: { eventTypeId, eventDisplayName, gameId }
    async function autoSave(team, assignments, substitutes, context) {
        try {
            if (!_gateway) {
                return { ok: false, error: 'Not initialized' };
            }

            var user = getCurrentUser();
            var createdByUid = user ? user.uid : null;

            // Merge starters and substitutes into a flat players array
            var players = (assignments || []).map(function(a) {
                return {
                    playerName: a.playerName || a.name || '',
                    building: a.building || null,
                    role: 'starter',
                };
            });
            (substitutes || []).forEach(function(s) {
                players.push({
                    playerName: s.playerName || s.name || '',
                    building: null,
                    role: 'substitute',
                });
            });

            var core = global.DSFeatureEventHistoryCore;
            if (!core || typeof core.buildHistoryRecord !== 'function') {
                return { ok: false, error: 'DSFeatureEventHistoryCore not available' };
            }

            var record = core.buildHistoryRecord({
                team: team,
                players: players,
                eventTypeId: context.eventTypeId,
                eventDisplayName: context.eventDisplayName,
                gameId: context.gameId,
            }, createdByUid);

            var allianceId = getAllianceId(); // null for solo players
            var saveResult = await _gateway.saveHistoryRecord(allianceId, record);
            if (!saveResult || !saveResult.ok) {
                return saveResult || { ok: false, error: 'Unknown error saving history record' };
            }

            var historyId = saveResult.historyId;

            // Save attendance docs (all default to 'attended')
            var attendanceDocs = core.buildAttendanceDocs(record.players, record.team);
            if (attendanceDocs.length > 0) {
                await _gateway.saveAttendanceBatch(allianceId, historyId, attendanceDocs.map(function(entry) {
                    return { docId: entry.docId, doc: entry.attendanceDoc };
                }));
            }

            // Enforce 10-entry limit per eventTypeId (soft-delete oldest)
            if (typeof _gateway.enforceEventHistoryLimit === 'function') {
                await _gateway.enforceEventHistoryLimit(allianceId, context.eventTypeId, MAX_HISTORY_PER_EVENT);
            }

            return { ok: true, historyId: historyId };
        } catch (err) {
            console.error('autoSave event history error:', err);
            return { ok: false, error: err.message };
        }
    }

    // Legacy manual save — delegates to autoSave with old-style assignment object
    async function saveAssignmentAsHistory(assignment) {
        var team = assignment.team || 'A';
        var players = [];
        if (assignment.teamAssignments) {
            var teamData = team === 'A' ? assignment.teamAssignments.teamA : assignment.teamAssignments.teamB;
            players = Array.isArray(teamData) ? teamData : [];
        } else if (Array.isArray(assignment.players)) {
            players = assignment.players;
        }
        return autoSave(team, players, [], {
            eventTypeId: assignment.eventTypeId || null,
            eventDisplayName: assignment.eventDisplayName || assignment.eventName || null,
            gameId: assignment.gameId || null,
        });
    }

    // Open attendance check-in panel for a history record.
    async function openAttendancePanel(historyId) {
        try {
            if (!_gateway || !historyId) {
                console.error('openAttendancePanel: missing params');
                return;
            }

            var allianceId = getAllianceId(); // null ok for solo

            var attendanceDocs = await _gateway.loadAttendance(allianceId, historyId);

            // Find the history doc
            var historyDoc = _currentHistoryDoc;
            if (!historyDoc || historyDoc.id !== historyId) {
                var filters = { activeOnly: true };
                var records = await _gateway.loadHistoryRecords(allianceId, filters);
                historyDoc = records.find(function(r) { return r.id === historyId; }) || null;
                _currentHistoryDoc = historyDoc;
            }

            var container = document.getElementById('attendancePanelBody');
            if (global.DSFeatureEventHistoryView && typeof global.DSFeatureEventHistoryView.renderAttendancePanel === 'function') {
                global.DSFeatureEventHistoryView.renderAttendancePanel(container, historyDoc, attendanceDocs, {
                    translate: getTranslate(),
                });
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

    // Finalize attendance — locks the record.
    async function finalizeAttendance(historyId, onSuccess) {
        try {
            var allianceId = getAllianceId();
            if (!_gateway || !historyId) {
                return { ok: false, error: 'Not available' };
            }

            // Ensure _currentHistoryDoc is loaded
            if (!_currentHistoryDoc || _currentHistoryDoc.id !== historyId) {
                var records = await _gateway.loadHistoryRecords(allianceId, { activeOnly: true });
                _currentHistoryDoc = records.find(function(r) { return r.id === historyId; }) || null;
            }

            var attendanceDocs = await _gateway.loadAttendance(allianceId, historyId);

            var utils = global.DSFirestoreUtils;
            var reliability = global.DSCoreReliability;

            var playerDocIds = attendanceDocs.map(function(doc) {
                return doc.docId || (utils ? utils.sanitizeDocId(doc.playerName) : doc.playerName);
            });

            var existingStats = {};
            if (playerDocIds.length > 0 && typeof _gateway.loadPlayerStats === 'function') {
                existingStats = await _gateway.loadPlayerStats(allianceId, playerDocIds);
            }

            var playerStatsUpdates = [];
            if (reliability && typeof reliability.recalculatePlayerStats === 'function') {
                attendanceDocs.forEach(function(doc) {
                    var docId = doc.docId || (utils ? utils.sanitizeDocId(doc.playerName) : doc.playerName);
                    var existing = existingStats[docId] || {};
                    var recentHistory = Array.isArray(existing.recentHistory) ? existing.recentHistory : [];

                    var newEntry = {
                        historyId: historyId,
                        status: doc.status,
                        eventName: (_currentHistoryDoc && _currentHistoryDoc.eventName) || null,
                    };
                    var updatedHistory = [newEntry].concat(recentHistory);
                    var newStats = reliability.recalculatePlayerStats(updatedHistory, existing);
                    playerStatsUpdates.push({ docId: docId, stats: newStats });
                });
            }

            var result = await _gateway.finalizeHistory(allianceId, historyId, playerStatsUpdates);
            if (result && result.ok) {
                _currentHistoryDoc = null;
                if (typeof onSuccess === 'function') {
                    onSuccess();
                } else {
                    var modal = document.getElementById('attendancePanelModal');
                    if (modal) {
                        modal.classList.add('hidden');
                    }
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
        autoSave: autoSave,
        saveAssignmentAsHistory: saveAssignmentAsHistory,
        openAttendancePanel: openAttendancePanel,
        finalizeAttendance: finalizeAttendance,
    };
})(window);
