(function initFeaturePlayerUpdatesController(global) {
    var _gateway = null;
    var _unsubscribe = null;
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
        _gateway = null;
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

        var allianceId = global.currentAllianceId || (global.DSAppStateStore && global.DSAppStateStore.getState().allianceId) || null;
        var gameId = global.currentGameId || (global.DSAppStateStore && global.DSAppStateStore.getState().gameId) || null;
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
            var tokenIds = result.tokenIds || [];
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

    // Approve a pending update (applies to player record + marks approved).
    // updateId: string
    // Returns: Promise<{ ok, error? }>
    function approveUpdate(updateId) {
        if (!_gateway || !updateId) return Promise.resolve({ ok: false, error: 'not initialized' });
        var allianceId = global.currentAllianceId || (global.DSAppStateStore && global.DSAppStateStore.getState().allianceId) || null;
        var reviewedBy = global.currentAuthUser && global.currentAuthUser.uid;
        return _gateway.updatePendingUpdateStatus(allianceId, updateId, {
            status: 'approved',
            reviewedBy: reviewedBy,
            reviewedAt: new Date(),
        }).catch(function (err) {
            return { ok: false, error: err && err.message };
        });
    }

    // Reject a pending update.
    // updateId: string
    // Returns: Promise<{ ok, error? }>
    function rejectUpdate(updateId) {
        if (!_gateway || !updateId) return Promise.resolve({ ok: false, error: 'not initialized' });
        var allianceId = global.currentAllianceId || (global.DSAppStateStore && global.DSAppStateStore.getState().allianceId) || null;
        var reviewedBy = global.currentAuthUser && global.currentAuthUser.uid;
        return _gateway.updatePendingUpdateStatus(allianceId, updateId, {
            status: 'rejected',
            reviewedBy: reviewedBy,
            reviewedAt: new Date(),
        }).catch(function (err) {
            return { ok: false, error: err && err.message };
        });
    }

    // Revoke a token (marks it used/invalid so it cannot be submitted).
    // tokenId: string
    // Returns: Promise<{ ok, error? }>
    function revokeToken(tokenId) {
        if (!_gateway || !tokenId) return Promise.resolve({ ok: false, error: 'not initialized' });
        var allianceId = global.currentAllianceId || (global.DSAppStateStore && global.DSAppStateStore.getState().allianceId) || null;
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
        openTokenGenerationModal: openTokenGenerationModal,
        approveUpdate: approveUpdate,
        rejectUpdate: rejectUpdate,
        revokeToken: revokeToken,
        setAutoApproveThresholds: setAutoApproveThresholds,
    };
})(window);
