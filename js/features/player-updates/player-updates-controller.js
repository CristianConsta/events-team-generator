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

    // Open token generation modal for selected players.
    // playerNames: Array<string>
    function openTokenGenerationModal(playerNames) {
        if (!_gateway) return;
        if (!Array.isArray(playerNames) || playerNames.length === 0) {
            var msg = (global.DSI18N && global.DSI18N.t)
                ? global.DSI18N.t('request_updates_select_players')
                : 'Select players to request updates from.';
            alert(msg);
            return;
        }

        var options = (global.DSFeaturePlayerUpdatesActions && global.DSFeaturePlayerUpdatesActions.readTokenGenerationOptions)
            ? global.DSFeaturePlayerUpdatesActions.readTokenGenerationOptions()
            : { expiryHours: 48, linkedEventId: null };

        var allianceId = _gateway.getAllianceId ? _gateway.getAllianceId() : null;
        var gameId = global.currentGameId || null;
        var createdByUid = global.currentAuthUser && global.currentAuthUser.uid;
        var lang = (global.DSI18N && global.DSI18N.getCurrentLanguage) ? global.DSI18N.getCurrentLanguage() : 'en';

        var tokenDocs = playerNames.map(function (playerName) {
            var snapshot = {};
            var allPlayers = global.allPlayers || [];
            var found = allPlayers.find(function (p) { return p.name === playerName; });
            if (found) {
                snapshot = { power: found.power, thp: found.thp, troops: found.troops };
            }
            var doc = global.DSFeaturePlayerUpdatesCore
                ? global.DSFeaturePlayerUpdatesCore.buildTokenDoc(playerName, allianceId, gameId, createdByUid, {
                    expiryHours: options.expiryHours,
                    linkedEventId: options.linkedEventId,
                    currentSnapshot: snapshot,
                })
                : null;
            return { playerName: playerName, doc: doc };
        }).filter(function (t) { return t.doc !== null; });

        _gateway.saveTokenBatch(allianceId, tokenDocs).then(function (result) {
            if (!result || !result.ok) return;
            var tokens = tokenDocs.map(function (t, i) {
                var tokenHex = t.doc ? t.doc.token : '';
                var link = global.DSFeaturePlayerUpdatesCore
                    ? global.DSFeaturePlayerUpdatesCore.buildUpdateLink(tokenHex, allianceId, lang)
                    : '';
                return { playerName: t.playerName, link: link };
            });

            var modal = document.getElementById('tokenGenerationModal');
            var body = document.getElementById('tokenModalBody');
            if (modal && body && global.DSFeaturePlayerUpdatesView) {
                global.DSFeaturePlayerUpdatesView.renderTokenModal(body, tokens);
                modal.classList.remove('hidden');

                var closeBtn = document.getElementById('tokenModalCloseBtn');
                if (closeBtn) {
                    closeBtn.onclick = function () { modal.classList.add('hidden'); };
                }

                var copyAllBtn = document.getElementById('tokenCopyAllBtn');
                if (copyAllBtn) {
                    copyAllBtn.onclick = function () {
                        var formatted = global.DSFeaturePlayerUpdatesCore
                            ? global.DSFeaturePlayerUpdatesCore.formatLinksForMessaging(tokens)
                            : tokens.map(function (t) { return t.playerName + ': ' + t.link; }).join('\n');
                        if (navigator.clipboard) {
                            navigator.clipboard.writeText(formatted).catch(function () {});
                        }
                    };
                }
            }
        }).catch(function (err) {
            console.error('[PlayerUpdatesController] saveTokenBatch failed:', err);
        });
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

    // Internal: apply proposed values to target database(s) and mark status.
    // "personal" target = approver's own player database (users/{approverUid}/...)
    // "alliance" target = shared alliance database (alliances/{allianceId}/...)
    function _doApprove(updateId, update, allianceId, target) {
        var currentUser = _gateway.getCurrentUser ? _gateway.getCurrentUser() : null;
        var reviewedBy = currentUser ? currentUser.uid : null;
        var proposed = update.proposedValues || {};
        var playerName = update.playerName;
        var contextType = update.contextType;

        var applyPromises = [];

        if (target === 'personal' || target === 'both') {
            applyPromises.push(
                _gateway.applyPlayerUpdateToPersonal(playerName, proposed, update.gameId || null)
            );
        }
        if ((target === 'alliance' || target === 'both') && allianceId) {
            applyPromises.push(
                _gateway.applyPlayerUpdateToAlliance(playerName, proposed, update.gameId || null)
            );
        }

        return Promise.all(applyPromises).then(function(applyResults) {
            var anyFailed = applyResults.some(function(r) { return !r || !r.ok; });
            if (anyFailed) {
                return { ok: false, error: 'apply_failed' };
            }

            var decision = {
                status: 'approved',
                reviewedBy: reviewedBy,
                reviewedAt: new Date(),
                appliedTo: target,
            };

            if (contextType === 'personal') {
                var ownerUid = update.ownerUid;
                return _gateway.updatePersonalPendingUpdateStatus(ownerUid, updateId, decision)
                    .catch(function(err) { return { ok: false, error: err && err.message }; });
            } else {
                return _gateway.updatePendingUpdateStatus(allianceId, updateId, decision)
                    .catch(function(err) { return { ok: false, error: err && err.message }; });
            }
        });
    }

    // Approve a pending update — applies proposed values to player database(s).
    // For alliance users: prompts which database to update (personal / alliance / both).
    // For non-alliance users: always applies to personal database.
    function approveUpdate(updateId) {
        if (!_gateway || !updateId) return Promise.resolve({ ok: false, error: 'not initialized' });

        var update = _pendingUpdateDocs[updateId];
        if (!update) return Promise.resolve({ ok: false, error: 'update not found' });

        var allianceId = _gateway.getAllianceId ? _gateway.getAllianceId() : null;
        var isAllianceUser = !!allianceId;

        if (isAllianceUser) {
            return _showApplyTargetPrompt().then(function(target) {
                if (!target) {
                    return { ok: false, cancelled: true };
                }
                return _doApprove(updateId, update, allianceId, target);
            });
        } else {
            return _doApprove(updateId, update, null, 'personal');
        }
    }

    // Reject a pending update — only updates status, no data changes.
    function rejectUpdate(updateId) {
        if (!_gateway || !updateId) return Promise.resolve({ ok: false, error: 'not initialized' });

        var update = _pendingUpdateDocs[updateId];
        var allianceId = _gateway.getAllianceId ? _gateway.getAllianceId() : null;
        var currentUser = _gateway.getCurrentUser ? _gateway.getCurrentUser() : null;
        var reviewedBy = currentUser ? currentUser.uid : null;

        var decision = {
            status: 'rejected',
            reviewedBy: reviewedBy,
            reviewedAt: new Date(),
        };

        if (update && update.contextType === 'personal') {
            var ownerUid = update.ownerUid;
            return _gateway.updatePersonalPendingUpdateStatus(ownerUid, updateId, decision)
                .catch(function(err) { return { ok: false, error: err && err.message }; });
        } else {
            return _gateway.updatePendingUpdateStatus(allianceId, updateId, decision)
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
