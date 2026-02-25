(function initPlayerUpdate(global) {
    var ERROR_CODES = {
        TOKEN_EXPIRED: 'player_update_error_expired',
        TOKEN_USED: 'player_update_error_used',
        TOKEN_INVALID: 'player_update_error_invalid',
        NETWORK_ERROR: 'player_update_error_network',
        AUTH_FAILED: 'player_update_error_auth',
    };

    function parseParams() {
        var search = global.location && global.location.search ? global.location.search : '';
        var params = {};
        if (!search) {
            return params;
        }
        search.replace(/^\?/, '').split('&').forEach(function (pair) {
            var parts = pair.split('=');
            if (parts.length >= 1 && parts[0]) {
                params[decodeURIComponent(parts[0])] = parts[1] ? decodeURIComponent(parts[1]) : '';
            }
        });
        return params;
    }

    function getEl(id) {
        return global.document ? global.document.getElementById(id) : null;
    }

    function showState(stateName) {
        var stateIds = ['updateLoading', 'updateForm', 'updateSuccess', 'updateError'];
        stateIds.forEach(function (id) {
            var el = getEl(id);
            if (!el) {
                return;
            }
            if (id === stateName) {
                el.classList.remove('hidden');
            } else {
                el.classList.add('hidden');
            }
        });
    }

    function showError(i18nKey) {
        showState('updateError');
        var msgEl = getEl('updateErrorMessage');
        if (!msgEl) {
            return;
        }
        if (global.DSI18N && typeof global.DSI18N.t === 'function') {
            msgEl.textContent = global.DSI18N.t(i18nKey) || i18nKey;
        } else {
            msgEl.dataset.i18n = i18nKey;
            msgEl.textContent = i18nKey;
        }
    }

    function prefillForm(snapshot, playerName) {
        var nameEl = getEl('updatePlayerName');
        if (nameEl) {
            nameEl.textContent = playerName || '';
        }
        if (!snapshot) {
            return;
        }
        var powerEl = getEl('updatePower');
        if (powerEl && snapshot.power !== undefined) {
            powerEl.value = snapshot.power;
        }
        var thpEl = getEl('updateThp');
        if (thpEl && snapshot.thp !== undefined) {
            thpEl.value = snapshot.thp;
        }
        var troopsEl = getEl('updateTroops');
        if (troopsEl && snapshot.troops) {
            troopsEl.value = snapshot.troops;
        }
    }

    function init() {
        var params = parseParams();
        var hex = params.token || '';
        var aid = params.alliance || params.aid || '';
        var uidParam = params.uid || '';
        var gameIdParam = params.gid || params.gameId || '';
        var lang = params.lang || 'EN';

        // Step 2: set i18n language
        if (global.DSI18N) {
            if (typeof global.DSI18N.setLanguage === 'function') {
                global.DSI18N.setLanguage(lang);
            }
            if (typeof global.DSI18N.applyTranslations === 'function') {
                global.DSI18N.applyTranslations();
            }
        }

        // Step 3: show loading state
        showState('updateLoading');

        // Wire terminal-state buttons
        var retryBtn = getEl('updateRetryBtn');
        if (retryBtn) {
            retryBtn.addEventListener('click', function () {
                showState('updateForm');
            });
        }
        var doneBtn = getEl('updateDoneBtn');
        if (doneBtn) {
            doneBtn.addEventListener('click', function () {
                if (global.window && typeof global.window.close === 'function') {
                    global.window.close();
                }
                // Fallback: show a "you can close this tab" message
                var successEl = getEl('updateSuccess');
                if (successEl) {
                    var closeMsg = global.document.createElement('p');
                    closeMsg.style.marginTop = '12px';
                    closeMsg.style.fontSize = '0.875rem';
                    closeMsg.style.color = 'var(--color-text-secondary, #9e9e9e)';
                    closeMsg.textContent = global.DSI18N && typeof global.DSI18N.t === 'function'
                        ? global.DSI18N.t('player_update_close_tab') || 'You can now close this tab.'
                        : 'You can now close this tab.';
                    doneBtn.replaceWith(closeMsg);
                }
            });
        }

        if (!hex || (!aid && !uidParam)) {
            showError(ERROR_CODES.TOKEN_INVALID);
            return;
        }

        var firebase = global.firebase;
        if (!firebase) {
            showError(ERROR_CODES.NETWORK_ERROR);
            return;
        }

        if (!firebase.apps || !firebase.apps.length) {
            var config = global.FIREBASE_CONFIG;
            if (!config) {
                showError(ERROR_CODES.NETWORK_ERROR);
                return;
            }
            firebase.initializeApp(config);
        }

        var isPersonal = !!uidParam;

        // Step 4: sign in anonymously (session-only, no persistence)
        firebase.auth().setPersistence(firebase.auth.Auth.Persistence.NONE)
            .then(function () {
                return firebase.auth().signInAnonymously();
            })
            .then(function (userCredential) {
                var anonUid = userCredential.user.uid;

                // Step 5: fetch token document by ID — try new game-centric path first
                function buildLegacyTokenRef() {
                    return isPersonal
                        ? firebase.firestore()
                            .collection('users').doc(uidParam)
                            .collection('update_tokens')
                            .doc(hex)
                        : firebase.firestore()
                            .collection('alliances').doc(aid)
                            .collection('update_tokens')
                            .doc(hex);
                }

                function buildNewTokenRef(gid) {
                    if (!gid) { return null; }
                    try {
                        if (isPersonal) {
                            return firebase.firestore()
                                .collection('games').doc(gid)
                                .collection('soloplayers').doc(uidParam)
                                .collection('update_tokens')
                                .doc(hex);
                        } else {
                            return firebase.firestore()
                                .collection('games').doc(gid)
                                .collection('alliances').doc(aid)
                                .collection('update_tokens')
                                .doc(hex);
                        }
                    } catch (e) {
                        return null;
                    }
                }

                function resolveTokenRef() {
                    var newRef = buildNewTokenRef(gameIdParam);
                    if (!newRef) {
                        return Promise.resolve(buildLegacyTokenRef());
                    }
                    return newRef.get().then(function(snap) {
                        if (snap.exists) {
                            return snap.ref;
                        }
                        return buildLegacyTokenRef();
                    }).catch(function() {
                        return buildLegacyTokenRef();
                    });
                }

                var tokenRef;
                return resolveTokenRef()
                    .then(function(resolvedRef) {
                        tokenRef = resolvedRef;
                        return tokenRef.get();
                    })
                    .then(function (snapshot) {
                        // Step 6: token not found
                        if (!snapshot.exists) {
                            showError(ERROR_CODES.TOKEN_INVALID);
                            return;
                        }

                        var tokenDoc = snapshot.data();
                        tokenRef = snapshot.ref;

                        // Step 7: token already used
                        if (tokenDoc.used === true) {
                            showError(ERROR_CODES.TOKEN_USED);
                            return;
                        }

                        // Step 8: token expired
                        var now = new Date();
                        var expiresAt = tokenDoc.expiresAt && tokenDoc.expiresAt.toDate
                            ? tokenDoc.expiresAt.toDate()
                            : new Date(tokenDoc.expiresAt);
                        if (expiresAt < now) {
                            showError(ERROR_CODES.TOKEN_EXPIRED);
                            return;
                        }

                        // Step 9: prefill form and show it
                        prefillForm(tokenDoc.currentSnapshot, tokenDoc.playerName);
                        showState('updateForm');

                        // Step 10: wire up form submit
                        var form = getEl('updateStatsForm');
                        if (!form) {
                            return;
                        }

                        form.addEventListener('submit', function (e) {
                            e.preventDefault();

                            var powerEl = getEl('updatePower');
                            var thpEl = getEl('updateThp');
                            var troopsEl = getEl('updateTroops');

                            var proposed = {
                                power: powerEl ? Number(powerEl.value) : null,
                                thp: thpEl ? Number(thpEl.value) : null,
                                troops: troopsEl ? troopsEl.value : null,
                            };

                            // client-side validation
                            var validation = global.DSFeaturePlayerUpdatesCore
                                ? global.DSFeaturePlayerUpdatesCore.validateProposedValues(proposed)
                                : { valid: true, errors: [] };

                            if (!validation.valid) {
                                // show first error inline — keep error state minimal
                                showError(ERROR_CODES.TOKEN_INVALID);
                                return;
                            }

                            // disable submit button while writing
                            var submitBtn = form.querySelector('button[type="submit"]');
                            var originalBtnText = submitBtn ? submitBtn.textContent : '';
                            if (submitBtn) {
                                submitBtn.disabled = true;
                                var submittingLabel = global.DSI18N && typeof global.DSI18N.t === 'function'
                                    ? (global.DSI18N.t('player_update_submitting') || 'Submitting...')
                                    : 'Submitting...';
                                submitBtn.textContent = submittingLabel;
                            }

                            // write pending_update doc
                            var pendingUpdateDoc = {
                                contextType: isPersonal ? 'personal' : 'alliance',
                                ownerUid: isPersonal ? uidParam : null,
                                allianceId: isPersonal ? null : aid,
                                playerName: tokenDoc.playerName,
                                gameId: tokenDoc.gameId || null,
                                proposedValues: proposed,
                                currentSnapshot: tokenDoc.currentSnapshot || {},
                                submittedAt: firebase.firestore.Timestamp.now(),
                                submittedByAnonUid: anonUid,
                                status: 'pending',
                                tokenId: hex,
                            };

                            var legacyPendingRef = isPersonal
                                ? firebase.firestore()
                                    .collection('users').doc(uidParam)
                                    .collection('pending_updates')
                                : firebase.firestore()
                                    .collection('alliances').doc(aid)
                                    .collection('pending_updates');

                            var effectiveGameId = tokenDoc.gameId || gameIdParam || '';
                            function buildNewPendingRef(gid) {
                                if (!gid) { return null; }
                                try {
                                    if (isPersonal) {
                                        return firebase.firestore()
                                            .collection('games').doc(gid)
                                            .collection('soloplayers').doc(uidParam)
                                            .collection('pending_updates');
                                    } else {
                                        return firebase.firestore()
                                            .collection('games').doc(gid)
                                            .collection('alliances').doc(aid)
                                            .collection('pending_updates');
                                    }
                                } catch (e) {
                                    return null;
                                }
                            }

                            legacyPendingRef
                                .add(pendingUpdateDoc)
                                .then(function (newDocRef) {
                                    // Dual-write to game-scoped pending_updates
                                    var newPendingRef = buildNewPendingRef(effectiveGameId);
                                    var dualWritePromise = newPendingRef
                                        ? newPendingRef.doc(newDocRef.id).set(pendingUpdateDoc).catch(function() {})
                                        : Promise.resolve();
                                    return dualWritePromise.then(function() {
                                        // update token as used
                                        return tokenRef.update({
                                            used: true,
                                            usedAt: firebase.firestore.Timestamp.now(),
                                            usedByAnonUid: anonUid,
                                        });
                                    });
                                })
                                .then(function () {
                                    // Step 11: show success
                                    showState('updateSuccess');
                                })
                                .catch(function () {
                                    if (submitBtn) {
                                        submitBtn.disabled = false;
                                        submitBtn.textContent = originalBtnText;
                                    }
                                    showError(ERROR_CODES.NETWORK_ERROR);
                                });
                        });
                    });
            })
            .catch(function (err) {
                var msg = err && err.message ? err.message : '';
                if (msg.indexOf('auth') !== -1 || msg.indexOf('ADMIN_ONLY') !== -1 || msg.indexOf('operation-not-allowed') !== -1) {
                    showError(ERROR_CODES.AUTH_FAILED);
                } else {
                    showError(ERROR_CODES.NETWORK_ERROR);
                }
            });
    }

    // Auto-init on DOMContentLoaded
    if (global.document) {
        global.document.addEventListener('DOMContentLoaded', init);
    }

    global.DSPlayerUpdate = {
        init: init,
    };
})(window);
