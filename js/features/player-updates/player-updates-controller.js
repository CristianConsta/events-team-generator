(function initFeaturePlayerUpdatesController(global) {
    var _gateway = null;
    var _unsubscribe = null;
    var _badgeUnsub = null;
    var _pendingUpdateDocs = {}; // { [updateId]: update_doc }
    var _autoApproveThresholds = {
        powerMaxDeltaPct: null,
        thpMaxDeltaPct: null,
        troopChangesAllowed: false,
    };

    // Initialize the feature.
    // gateway: FirebaseService (the unified flat gateway)
    // Returns: { destroy() }
    function init(gateway) {
        _gateway = gateway;
        return {
            destroy: destroy,
        };
    }

    function destroy() {
        if (_unsubscribe) {
            _unsubscribe();
            _unsubscribe = null;
        }
        if (_badgeUnsub) {
            _badgeUnsub();
            _badgeUnsub = null;
        }
        _gateway = null;
    }

    // Register pending update docs so approve/reject can look up metadata.
    // Called by refreshPlayerUpdatesPanel in app.js after loading docs.
    function setPendingUpdateDocs(updates) {
        _pendingUpdateDocs = {};
        if (Array.isArray(updates)) {
            updates.forEach(function(u) {
                if (u && u.id) {
                    _pendingUpdateDocs[u.id] = u;
                }
            });
        }
    }

    // Subscribe to pending updates count for the nav badge.
    // C2 fix: works for both alliance and non-alliance users
    function subscribeBadge(allianceId, uid) {
        if (_badgeUnsub) {
            _badgeUnsub();
            _badgeUnsub = null;
        }
        if (!_gateway || typeof _gateway.subscribePendingUpdatesCount !== 'function') return;
        if (!allianceId && !uid) return;
        _badgeUnsub = _gateway.subscribePendingUpdatesCount(allianceId, uid, function(count) {
            var badge = document.getElementById('playerUpdatesPendingBadge');
            if (global.DSFeaturePlayerUpdatesView && typeof global.DSFeaturePlayerUpdatesView.renderPendingBadge === 'function') {
                global.DSFeaturePlayerUpdatesView.renderPendingBadge(badge, count);
            }
        });
    }

    // Deprecated on purpose:
    // Invite generation is allowed only from Players Management invite button flow.
    function openTokenGenerationModal() {
        var message = (global.DSI18N && global.DSI18N.t)
            ? global.DSI18N.t('player_updates_invite_from_players_page_only')
            : 'Player update invites can only be generated from Players Management.';
        if (global.console && typeof global.console.warn === 'function') {
            global.console.warn('[PlayerUpdatesController] Blocked legacy invite generation path. Use Players Management invite button.');
        }
        if (typeof global.alert === 'function') {
            global.alert(message);
        }
        return { ok: false, error: 'invite_generation_restricted' };
    }

    // Show alliance target selection modal. Returns Promise<'personal'|'alliance'|'both'|null>.
    // R2 fix: includes Escape key handler
    function _showApplyTargetPrompt() {
        return new Promise(function(resolve) {
            var modal = document.getElementById('applyTargetModal');
            if (!modal) {
                resolve('both');
                return;
            }

            modal.classList.remove('hidden');
            modal.focus();

            function close(target) {
                modal.classList.add('hidden');
                cleanup();
                resolve(target);
            }

            function onPersonal() { close('personal'); }
            function onAlliance() { close('alliance'); }
            function onBoth() { close('both'); }
            function onCancel() { close(null); }
            function onKeydown(e) {
                if (e.key === 'Escape') { close(null); }
            }

            var personalBtn = document.getElementById('applyTargetPersonalBtn');
            var allianceBtn = document.getElementById('applyTargetAllianceBtn');
            var bothBtn = document.getElementById('applyTargetBothBtn');
            var cancelBtn = document.getElementById('applyTargetCancelBtn');

            if (personalBtn) personalBtn.addEventListener('click', onPersonal);
            if (allianceBtn) allianceBtn.addEventListener('click', onAlliance);
            if (bothBtn) bothBtn.addEventListener('click', onBoth);
            if (cancelBtn) cancelBtn.addEventListener('click', onCancel);
            document.addEventListener('keydown', onKeydown);

            function cleanup() {
                if (personalBtn) personalBtn.removeEventListener('click', onPersonal);
                if (allianceBtn) allianceBtn.removeEventListener('click', onAlliance);
                if (bothBtn) bothBtn.removeEventListener('click', onBoth);
                if (cancelBtn) cancelBtn.removeEventListener('click', onCancel);
                document.removeEventListener('keydown', onKeydown);
            }
        });
    }

    function _normalizeNameForLookup(name) {
        return typeof name === 'string' ? name.trim().toLowerCase() : '';
    }

    function _findCanonicalName(playerMap, requestedName) {
        if (!playerMap || typeof playerMap !== 'object') {
            return '';
        }
        if (typeof requestedName !== 'string') {
            return '';
        }
        var raw = requestedName.trim();
        if (!raw) {
            return '';
        }
        if (Object.prototype.hasOwnProperty.call(playerMap, raw)) {
            return raw;
        }
        var wanted = _normalizeNameForLookup(raw);
        var keys = Object.keys(playerMap);
        for (var i = 0; i < keys.length; i += 1) {
            if (_normalizeNameForLookup(keys[i]) === wanted) {
                return keys[i];
            }
        }
        return '';
    }

    function _isPlayerNotFoundResult(result) {
        if (!result || result.ok) {
            return false;
        }
        return result.error === 'players_list_error_not_found';
    }

    function _isAllianceDataMissingResult(result) {
        if (!result || result.ok) {
            return false;
        }
        return result.error === 'players_list_error_no_alliance';
    }

    function _safeCallPromise(fn) {
        return Promise.resolve().then(fn).catch(function(err) {
            return { ok: false, error: err && err.message };
        });
    }

    function _retryWithCanonicalName(source, playerName, proposed, gameId, identifiers, initialResult) {
        if (!_isPlayerNotFoundResult(initialResult)) {
            return Promise.resolve(initialResult);
        }

        var dbGetter = source === 'alliance'
            ? _gateway.getAlliancePlayerDatabase
            : _gateway.getPlayerDatabase;
        if (typeof dbGetter !== 'function') {
            return Promise.resolve(initialResult);
        }

        var context = gameId ? { gameId: gameId } : undefined;
        var playerMap = {};
        try {
            playerMap = dbGetter(context) || {};
        } catch (err) {
            playerMap = {};
        }
        var canonicalName = _findCanonicalName(playerMap, playerName);
        if (!canonicalName || canonicalName === playerName) {
            return Promise.resolve(initialResult);
        }

        var applyFn = source === 'alliance'
            ? _gateway.applyPlayerUpdateToAlliance
            : _gateway.applyPlayerUpdateToPersonal;
        return _safeCallPromise(function() {
            return applyFn(canonicalName, proposed, gameId, identifiers);
        });
    }

    function _applyWithNameFallback(source, playerName, proposed, gameId, identifiers) {
        if (!_gateway) {
            return Promise.resolve({ ok: false, error: 'not initialized' });
        }
        var applyFn = source === 'alliance'
            ? _gateway.applyPlayerUpdateToAlliance
            : _gateway.applyPlayerUpdateToPersonal;
        if (typeof applyFn !== 'function') {
            return Promise.resolve({ ok: false, error: 'apply_not_available' });
        }
        var context = gameId ? { gameId: gameId } : undefined;
        return _safeCallPromise(function() {
            return applyFn(playerName, proposed, gameId, identifiers);
        }).then(function(result) {
            if (source === 'alliance'
                && _isAllianceDataMissingResult(result)
                && typeof _gateway.loadAllianceData === 'function') {
                return _safeCallPromise(function() {
                    return _gateway.loadAllianceData(context);
                }).then(function(loadResult) {
                    var loadSucceeded = !loadResult || loadResult.success !== false;
                    if (!loadSucceeded) {
                        return result;
                    }
                    return _safeCallPromise(function() {
                        return applyFn(playerName, proposed, gameId, identifiers);
                    }).then(function(retryResult) {
                        return _retryWithCanonicalName(source, playerName, proposed, gameId, identifiers, retryResult);
                    });
                });
            }

            return _retryWithCanonicalName(source, playerName, proposed, gameId, identifiers, result);
        });
    }

    // Internal: apply proposed values to target database(s) and mark status.
    // "personal" target = approver's own player database (users/{approverUid}/...)
    // "alliance" target = shared alliance database (alliances/{allianceId}/...)
    function _doApprove(updateId, update, allianceId, target) {
        var currentUser = _gateway.getCurrentUser ? _gateway.getCurrentUser() : null;
        var reviewedBy = currentUser ? currentUser.uid : null;
        var proposed = update.proposedValues || {};
        var playerName = update.playerName;
        var identifiers = {
            playerKey: update.playerKey || '',
            allianceId: update.allianceId || allianceId || '',
        };
        var contextType = update.contextType;

        var requestedPersonal = target === 'personal' || target === 'both';
        var requestedAlliance = target === 'alliance' || target === 'both';
        var applyResults = {
            personal: null,
            alliance: null,
        };

        if (requestedPersonal) {
            applyResults.personal = _applyWithNameFallback('personal', playerName, proposed, update.gameId || null, identifiers);
        }
        if (requestedAlliance) {
            if (allianceId) {
                applyResults.alliance = _applyWithNameFallback('alliance', playerName, proposed, update.gameId || null, identifiers);
            } else {
                applyResults.alliance = Promise.resolve({ ok: false, error: 'missing_alliance_id' });
            }
        }

        return Promise.all([
            applyResults.personal || Promise.resolve(null),
            applyResults.alliance || Promise.resolve(null),
        ]).then(function(results) {
            var personalResult = results[0];
            var allianceResult = results[1];

            var personalOk = !requestedPersonal || (personalResult && personalResult.ok);
            var allianceOk = !requestedAlliance || (allianceResult && allianceResult.ok);
            if (!personalOk || !allianceOk) {
                return {
                    ok: false,
                    error: (allianceResult && allianceResult.error)
                        || (personalResult && personalResult.error)
                        || 'apply_failed',
                };
            }

            var effectiveAppliedTo = target;
            var appliedPersonal = requestedPersonal && personalOk;
            var appliedAlliance = requestedAlliance && allianceOk;
            if (appliedPersonal && appliedAlliance) {
                effectiveAppliedTo = 'both';
            } else if (appliedAlliance) {
                effectiveAppliedTo = 'alliance';
            }

            var decision = {
                status: 'approved',
                reviewedBy: reviewedBy,
                reviewedAt: new Date(),
                appliedTo: effectiveAppliedTo,
            };

            if (contextType === 'personal') {
                var ownerUid = update.ownerUid;
                return _gateway.updatePersonalPendingUpdateStatus(ownerUid, updateId, decision, update.gameId || null)
                    .catch(function(err) { return { ok: false, error: err && err.message }; });
            } else {
                return _gateway.updatePendingUpdateStatus(allianceId, updateId, decision, update.gameId || null)
                    .catch(function(err) { return { ok: false, error: err && err.message }; });
            }
        });
    }

    // Approve a pending update — applies proposed values to the source database.
    // Source is defined by invite context:
    // - personal invite => personal player DB
    // - alliance invite => alliance player DB
    function approveUpdate(updateId) {
        if (!_gateway || !updateId) return Promise.resolve({ ok: false, error: 'not initialized' });

        var update = _pendingUpdateDocs[updateId];
        if (!update) return Promise.resolve({ ok: false, error: 'update not found' });

        var allianceId = _gateway.getAllianceId
            ? _gateway.getAllianceId(update && update.gameId ? { gameId: update.gameId } : undefined)
            : null;
        if (!allianceId && update && update.contextType === 'alliance') {
            allianceId = update.allianceId || null;
        }
        var target = (update.contextType === 'alliance') ? 'alliance' : 'personal';
        return _doApprove(updateId, update, allianceId, target);
    }

    // Reject a pending update — only updates status, no data changes.
    function rejectUpdate(updateId) {
        if (!_gateway || !updateId) return Promise.resolve({ ok: false, error: 'not initialized' });

        var update = _pendingUpdateDocs[updateId];
        var allianceId = _gateway.getAllianceId
            ? _gateway.getAllianceId(update && update.gameId ? { gameId: update.gameId } : undefined)
            : null;
        if (!allianceId && update && update.contextType === 'alliance') {
            allianceId = update.allianceId || null;
        }
        var currentUser = _gateway.getCurrentUser ? _gateway.getCurrentUser() : null;
        var reviewedBy = currentUser ? currentUser.uid : null;

        var decision = {
            status: 'rejected',
            reviewedBy: reviewedBy,
            reviewedAt: new Date(),
        };

        if (update && update.contextType === 'personal') {
            var ownerUid = update.ownerUid;
            return _gateway.updatePersonalPendingUpdateStatus(ownerUid, updateId, decision, update.gameId || null)
                .catch(function(err) { return { ok: false, error: err && err.message }; });
        } else {
            return _gateway.updatePendingUpdateStatus(allianceId, updateId, decision, update && update.gameId ? update.gameId : null)
                .catch(function(err) { return { ok: false, error: err && err.message }; });
        }
    }

    // Revoke a token (marks it used/invalid so it cannot be submitted).
    // tokenId: string
    // Returns: Promise<{ ok, error? }>
    function revokeToken(tokenId) {
        if (!_gateway || !tokenId) return Promise.resolve({ ok: false, error: 'not initialized' });
        var allianceId = _gateway.getAllianceId ? _gateway.getAllianceId() : null;
        return _gateway.revokeToken(allianceId, tokenId).catch(function (err) {
            return { ok: false, error: err && err.message };
        });
    }

    // Configure auto-approve thresholds (stored in alliance settings).
    // thresholds: { powerMaxDeltaPct, thpMaxDeltaPct, troopChangesAllowed }
    function setAutoApproveThresholds(thresholds) {
        _autoApproveThresholds = Object.assign({}, _autoApproveThresholds, thresholds || {});
    }

    global.DSFeaturePlayerUpdatesController = {
        init: init,
        subscribeBadge: subscribeBadge,
        openTokenGenerationModal: openTokenGenerationModal,
        approveUpdate: approveUpdate,
        rejectUpdate: rejectUpdate,
        revokeToken: revokeToken,
        setAutoApproveThresholds: setAutoApproveThresholds,
        setPendingUpdateDocs: setPendingUpdateDocs,
    };
})(window);
