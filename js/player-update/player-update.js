(function initPlayerUpdate(global) {
    var ERROR_CODES = {
        TOKEN_EXPIRED: 'player_update_error_expired',
        TOKEN_USED: 'player_update_error_used',
        TOKEN_INVALID: 'player_update_error_invalid',
        NETWORK_ERROR: 'player_update_error_network',
        AUTH_FAILED: 'player_update_error_auth',
        TOO_MANY_ATTEMPTS: 'player_update_shared_error_too_many_attempts',
    };
    var SUPPORTED_LANGUAGES = ['en', 'fr', 'de', 'it', 'ko', 'ro'];
    var lastRenderedSnapshot = null;

    function normalizeLanguageCode(rawLang) {
        if (typeof rawLang !== 'string') {
            return 'en';
        }
        var normalized = rawLang.trim().toLowerCase();
        if (!normalized) {
            return 'en';
        }
        if (normalized.indexOf('-') !== -1) {
            normalized = normalized.split('-')[0];
        }
        return SUPPORTED_LANGUAGES.indexOf(normalized) !== -1 ? normalized : 'en';
    }

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
        var stateIds = ['updateLoading', 'updateClaim', 'updateForm', 'updateSuccess', 'updateError'];
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

    function tLocal(key) {
        return global.DSI18N && typeof global.DSI18N.t === 'function'
            ? (global.DSI18N.t(key) || key) : key;
    }

    function tOrFallback(key, fallback) {
        var translated = tLocal(key);
        if (!translated || translated === key) {
            return fallback;
        }
        return translated;
    }

    function currentValueLabel() {
        var translated = tLocal('player_update_current_value_label');
        if (!translated || translated === 'player_update_current_value_label') {
            translated = tLocal('player_updates_old_value');
        }
        if (!translated || translated === 'player_updates_old_value') {
            return 'Current value';
        }
        return translated;
    }

    function getTokenMaxSubmissions(tokenDoc) {
        var parsed = tokenDoc && tokenDoc.maxSubmissions != null ? Number(tokenDoc.maxSubmissions) : NaN;
        if (!Number.isFinite(parsed) || parsed <= 0) {
            return 1;
        }
        return Math.floor(parsed);
    }

    function getTokenSubmissionCount(tokenDoc) {
        var parsed = tokenDoc && tokenDoc.submissionCount != null ? Number(tokenDoc.submissionCount) : 0;
        if (!Number.isFinite(parsed) || parsed < 0) {
            return 0;
        }
        return Math.floor(parsed);
    }

    function isTokenSubmissionLimitReached(tokenDoc) {
        return getTokenSubmissionCount(tokenDoc) >= getTokenMaxSubmissions(tokenDoc);
    }

    function getSharedInviteMaxAttempts(inviteDoc) {
        var parsed = inviteDoc && inviteDoc.maxVerificationAttempts != null ? Number(inviteDoc.maxVerificationAttempts) : NaN;
        if (!Number.isFinite(parsed) || parsed <= 0) {
            return 3;
        }
        return Math.floor(parsed);
    }

    function getSessionStorageHandle() {
        try {
            return global.sessionStorage || null;
        } catch (err) {
            return null;
        }
    }

    function getSharedAttemptsStorageKey(contextBag) {
        var source = contextBag && contextBag.contextType === 'alliance' ? 'alliance' : 'personal';
        var owner = source === 'alliance'
            ? (contextBag && contextBag.allianceId ? contextBag.allianceId : '')
            : (contextBag && contextBag.ownerUid ? contextBag.ownerUid : '');
        var inviteId = contextBag && contextBag.sharedId ? contextBag.sharedId : '';
        var gameId = contextBag && contextBag.gameId ? contextBag.gameId : '';
        return ['ds_shared_invite_attempts', source, owner, gameId, inviteId].join('::');
    }

    function getSharedAttemptCount(contextBag) {
        var storage = getSessionStorageHandle();
        if (!storage) {
            return 0;
        }
        var raw = storage.getItem(getSharedAttemptsStorageKey(contextBag));
        var parsed = Number(raw);
        if (!Number.isFinite(parsed) || parsed < 0) {
            return 0;
        }
        return Math.floor(parsed);
    }

    function setSharedAttemptCount(contextBag, count) {
        var storage = getSessionStorageHandle();
        if (!storage) {
            return;
        }
        storage.setItem(getSharedAttemptsStorageKey(contextBag), String(Math.max(0, Math.floor(Number(count) || 0))));
    }

    function incrementSharedAttemptCount(contextBag) {
        var nextCount = getSharedAttemptCount(contextBag) + 1;
        setSharedAttemptCount(contextBag, nextCount);
        return nextCount;
    }

    function buildPowerBandCode(powerValue) {
        var numeric = Number(powerValue);
        if (!Number.isFinite(numeric) || numeric < 0) {
            numeric = 0;
        }
        var bandStart = Math.floor(numeric / 50) * 50;
        var bandEnd = bandStart + 49;
        return {
            code: String(bandStart) + '-' + String(bandEnd),
            label: String(bandStart) + '-' + String(bandEnd) + 'M',
            start: bandStart,
        };
    }

    function buildPowerBandChoices(expectedBandCode) {
        var parts = typeof expectedBandCode === 'string' ? expectedBandCode.split('-') : [];
        var expectedStart = Number(parts[0]);
        if (!Number.isFinite(expectedStart) || expectedStart < 0) {
            expectedStart = 0;
        }
        var starts = [expectedStart - 100, expectedStart - 50, expectedStart, expectedStart + 50];
        var seen = {};
        return starts.filter(function(start) {
            return Number.isFinite(start) && start >= 0;
        }).map(function(start) {
            return buildPowerBandCode(start);
        }).filter(function(choice) {
            if (seen[choice.code]) {
                return false;
            }
            seen[choice.code] = true;
            return true;
        });
    }

    function buildLegacyPendingRef(firebase, isPersonal, uidParam, aid) {
        return isPersonal
            ? firebase.firestore().collection('users').doc(uidParam).collection('pending_updates')
            : firebase.firestore().collection('alliances').doc(aid).collection('pending_updates');
    }

    function buildNewPendingRef(firebase, isPersonal, uidParam, aid, gid) {
        if (!gid) {
            return null;
        }
        try {
            if (isPersonal) {
                return firebase.firestore()
                    .collection('games').doc(gid)
                    .collection('soloplayers').doc(uidParam)
                    .collection('pending_updates');
            }
            return firebase.firestore()
                .collection('games').doc(gid)
                .collection('alliances').doc(aid)
                .collection('pending_updates');
        } catch (err) {
            return null;
        }
    }

    function writePendingUpdateWithFallback(options) {
        var newPendingRef = options && options.newPendingRef ? options.newPendingRef : null;
        var legacyPendingRef = options && options.legacyPendingRef ? options.legacyPendingRef : null;
        var pendingUpdateDoc = options && options.pendingUpdateDoc ? options.pendingUpdateDoc : null;
        if (!pendingUpdateDoc) {
            return Promise.reject(new Error('missing_pending_update'));
        }
        if (!newPendingRef && !legacyPendingRef) {
            return Promise.reject(new Error('missing_pending_ref'));
        }
        if (!newPendingRef) {
            return legacyPendingRef.add(pendingUpdateDoc);
        }
        return newPendingRef
            .add(pendingUpdateDoc)
            .then(function(newDocRef) {
                if (!legacyPendingRef) {
                    return newDocRef;
                }
                return legacyPendingRef.doc(newDocRef.id).set(pendingUpdateDoc).catch(function() {})
                    .then(function() { return newDocRef; });
            })
            .catch(function() {
                if (!legacyPendingRef) {
                    throw new Error('shared_pending_write_failed');
                }
                return legacyPendingRef.add(pendingUpdateDoc)
                    .then(function(legacyDocRef) {
                        return newPendingRef.doc(legacyDocRef.id).set(pendingUpdateDoc).catch(function() {})
                            .then(function() { return legacyDocRef; });
                    });
            });
    }

    function wireFieldValidation() {
        var powerInput = getEl('updatePower');
        var thpInput = getEl('updateThp');
        var troopsInput = getEl('updateTroops');
        if (powerInput) {
            powerInput.oninput = function () {
                clearFieldError(powerInput, 'errorPower');
            };
        }
        if (thpInput) {
            thpInput.oninput = function () {
                clearFieldError(thpInput, 'errorThp');
            };
        }
        if (troopsInput) {
            troopsInput.onchange = function () {
                clearFieldError(troopsInput, 'errorTroops');
            };
        }
    }

    function showSharedVerificationStatus(message, isError) {
        var statusEl = getEl('sharedVerificationStatus');
        if (!statusEl) {
            return;
        }
        statusEl.textContent = message || '';
        statusEl.classList.toggle('field-error', !!isError);
    }

    function updateSharedAttemptsStatus(contextBag, inviteDoc) {
        var statusEl = getEl('sharedAttemptsStatus');
        if (!statusEl) {
            return;
        }
        var limit = getSharedInviteMaxAttempts(inviteDoc);
        var used = getSharedAttemptCount(contextBag);
        var remaining = Math.max(0, limit - used);
        statusEl.textContent = tLocal('player_update_shared_attempts_remaining')
            .replace('{remaining}', String(remaining))
            .replace('{max}', String(limit));
    }

    function buildSharedInviteDocRef(firebase, isPersonal, gameId, uidParam, aid, sharedId) {
        if (!gameId || !sharedId) {
            return null;
        }
        try {
            if (isPersonal) {
                return firebase.firestore()
                    .collection('games').doc(gameId)
                    .collection('soloplayers').doc(uidParam)
                    .collection('shared_update_invites').doc(sharedId);
            }
            return firebase.firestore()
                .collection('games').doc(gameId)
                .collection('alliances').doc(aid)
                .collection('shared_update_invites').doc(sharedId);
        } catch (err) {
            return null;
        }
    }

    function buildSharedInviteCandidatesRef(firebase, isPersonal, gameId, uidParam, aid, sharedId) {
        var inviteRef = buildSharedInviteDocRef(firebase, isPersonal, gameId, uidParam, aid, sharedId);
        if (!inviteRef) {
            return null;
        }
        return inviteRef.collection('candidates');
    }

    function toggleSharedVerificationMethodUi() {
        var troopsWrap = getEl('sharedVerifyTroopsWrap');
        var powerWrap = getEl('sharedVerifyPowerWrap');
        var usePower = !!(getEl('sharedVerifyMethodPower') && getEl('sharedVerifyMethodPower').checked);
        if (troopsWrap) {
            troopsWrap.classList.toggle('hidden', usePower);
        }
        if (powerWrap) {
            powerWrap.classList.toggle('hidden', !usePower);
        }
    }

    function configureSharedCandidateSelection(candidate, inviteContext, firebase, anonUid) {
        var selectedNameEl = getEl('sharedSelectedPlayerName');
        var verificationWrap = getEl('sharedVerification');
        var powerSelect = getEl('sharedVerifyPowerBand');
        if (selectedNameEl) {
            selectedNameEl.textContent = String(candidate.playerName || '');
        }
        if (powerSelect) {
            powerSelect.innerHTML = '';
            var placeholder = global.document.createElement('option');
            placeholder.value = '';
            placeholder.selected = true;
            placeholder.textContent = tLocal('player_update_shared_verify_power_placeholder');
            powerSelect.appendChild(placeholder);
            buildPowerBandChoices(candidate.verifyPowerBand).forEach(function(choice) {
                var option = global.document.createElement('option');
                option.value = choice.code;
                option.textContent = choice.label;
                powerSelect.appendChild(option);
            });
        }
        if (verificationWrap) {
            verificationWrap.classList.remove('hidden');
        }
        updateSharedAttemptsStatus(inviteContext, inviteContext.inviteDoc);
        showSharedVerificationStatus('', false);

        var verifyBtn = getEl('sharedVerifyBtn');
        if (!verifyBtn) {
            return;
        }
        verifyBtn.onclick = function() {
            var usedAttempts = getSharedAttemptCount(inviteContext);
            if (usedAttempts >= getSharedInviteMaxAttempts(inviteContext.inviteDoc)) {
                showError(ERROR_CODES.TOO_MANY_ATTEMPTS);
                return;
            }
            var usingPower = !!(getEl('sharedVerifyMethodPower') && getEl('sharedVerifyMethodPower').checked);
            var troopsValue = getEl('sharedVerifyTroops') ? getEl('sharedVerifyTroops').value : '';
            var powerBandValue = getEl('sharedVerifyPowerBand') ? getEl('sharedVerifyPowerBand').value : '';
            var verified = usingPower
                ? powerBandValue && powerBandValue === candidate.verifyPowerBand
                : troopsValue && troopsValue === candidate.verifyTroops;
            if (!verified) {
                var nextAttempts = incrementSharedAttemptCount(inviteContext);
                updateSharedAttemptsStatus(inviteContext, inviteContext.inviteDoc);
                if (nextAttempts >= getSharedInviteMaxAttempts(inviteContext.inviteDoc)) {
                    showError(ERROR_CODES.TOO_MANY_ATTEMPTS);
                    return;
                }
                showSharedVerificationStatus(tLocal('player_update_shared_verify_failed'), true);
                return;
            }
            var form = getEl('updateStatsForm');
            if (!form) {
                showError(ERROR_CODES.NETWORK_ERROR);
                return;
            }
            prefillForm(candidate.currentSnapshot || {}, candidate.playerName || '');
            showState('updateForm');
            wireFieldValidation();
            form.onsubmit = function(event) {
                event.preventDefault();
                var powerEl = getEl('updatePower');
                var thpEl = getEl('updateThp');
                var troopsEl = getEl('updateTroops');
                if (!validateFormFields(powerEl, thpEl, troopsEl)) {
                    return;
                }
                var proposed = {
                    power: powerEl ? Number(powerEl.value) : null,
                    thp: thpEl ? Number(thpEl.value) : null,
                    troops: troopsEl ? troopsEl.value : null,
                };
                var submitBtn = form.querySelector('button[type="submit"]');
                var originalBtnText = submitBtn ? submitBtn.textContent : '';
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.textContent = tOrFallback('player_update_submitting', 'Submitting...');
                }
                var pendingUpdateDoc = {
                    contextType: inviteContext.isPersonal ? 'personal' : 'alliance',
                    ownerUid: inviteContext.isPersonal ? inviteContext.uidParam : null,
                    allianceId: inviteContext.isPersonal ? null : inviteContext.aid,
                    playerName: candidate.playerName,
                    gameId: inviteContext.gameId,
                    proposedValues: proposed,
                    currentSnapshot: candidate.currentSnapshot || {},
                    playerKey: candidate.playerKey,
                    submittedAt: firebase.firestore.Timestamp.now(),
                    submittedByAnonUid: anonUid,
                    status: 'pending',
                    tokenId: 'shared:' + inviteContext.sharedId,
                    sharedInviteId: inviteContext.sharedId,
                };
                var newPendingRef = buildNewPendingRef(
                    firebase,
                    inviteContext.isPersonal,
                    inviteContext.uidParam,
                    inviteContext.aid,
                    inviteContext.gameId
                );
                writePendingUpdateWithFallback({
                    newPendingRef: newPendingRef,
                    pendingUpdateDoc: pendingUpdateDoc,
                })
                    .then(function() {
                        showState('updateSuccess');
                    })
                    .catch(function() {
                        if (submitBtn) {
                            submitBtn.disabled = false;
                            submitBtn.textContent = originalBtnText;
                        }
                        showError(ERROR_CODES.NETWORK_ERROR);
                    });
            };
        };
    }

    function startSharedInviteFlow(firebase, anonUid, inviteContext) {
        var inviteRef = buildSharedInviteDocRef(
            firebase,
            inviteContext.isPersonal,
            inviteContext.gameId,
            inviteContext.uidParam,
            inviteContext.aid,
            inviteContext.sharedId
        );
        var candidatesRef = buildSharedInviteCandidatesRef(
            firebase,
            inviteContext.isPersonal,
            inviteContext.gameId,
            inviteContext.uidParam,
            inviteContext.aid,
            inviteContext.sharedId
        );
        if (!inviteRef || !candidatesRef) {
            showError(ERROR_CODES.TOKEN_INVALID);
            return;
        }
        inviteRef.get().then(function(snapshot) {
            if (!snapshot.exists) {
                showError(ERROR_CODES.TOKEN_INVALID);
                return;
            }
            inviteContext.inviteDoc = snapshot.data() || {};
            if (inviteContext.inviteDoc.active === false) {
                showError(ERROR_CODES.TOKEN_INVALID);
                return;
            }
            var expiresAt = inviteContext.inviteDoc.expiresAt && inviteContext.inviteDoc.expiresAt.toDate
                ? inviteContext.inviteDoc.expiresAt.toDate()
                : new Date(inviteContext.inviteDoc.expiresAt);
            if (expiresAt < new Date()) {
                showError(ERROR_CODES.TOKEN_EXPIRED);
                return;
            }
            if (getSharedAttemptCount(inviteContext) >= getSharedInviteMaxAttempts(inviteContext.inviteDoc)) {
                showError(ERROR_CODES.TOO_MANY_ATTEMPTS);
                return;
            }

            showState('updateClaim');
            updateSharedAttemptsStatus(inviteContext, inviteContext.inviteDoc);
            toggleSharedVerificationMethodUi();

            var troopsRadio = getEl('sharedVerifyMethodTroops');
            var powerRadio = getEl('sharedVerifyMethodPower');
            if (troopsRadio) {
                troopsRadio.onchange = toggleSharedVerificationMethodUi;
            }
            if (powerRadio) {
                powerRadio.onchange = toggleSharedVerificationMethodUi;
            }

            var searchInput = getEl('sharedPlayerSearch');
            var resultsEl = getEl('sharedSearchResults');
            var searchTimer = null;
            if (!searchInput || !resultsEl) {
                showError(ERROR_CODES.NETWORK_ERROR);
                return;
            }
            searchInput.oninput = function() {
                var term = String(searchInput.value || '').trim().toLowerCase();
                if (searchTimer) {
                    global.clearTimeout(searchTimer);
                }
                searchTimer = global.setTimeout(function() {
                    resultsEl.innerHTML = '';
                    showSharedVerificationStatus('', false);
                    var verificationWrap = getEl('sharedVerification');
                    if (verificationWrap) {
                        verificationWrap.classList.add('hidden');
                    }
                    if (term.length < 3) {
                        return;
                    }
                    candidatesRef.where('searchPrefixes', 'array-contains', term).limit(3).get()
                        .then(function(querySnapshot) {
                            var candidates = [];
                            if (querySnapshot && typeof querySnapshot.forEach === 'function') {
                                querySnapshot.forEach(function(doc) {
                                    candidates.push(doc.data());
                                });
                            }
                            candidates.sort(function(a, b) {
                                return String(a.playerName || '').localeCompare(String(b.playerName || ''));
                            });
                            if (!candidates.length) {
                                var empty = global.document.createElement('p');
                                empty.className = 'update-shared-hint';
                                empty.textContent = tLocal('player_update_shared_no_results');
                                resultsEl.appendChild(empty);
                                return;
                            }
                            candidates.slice(0, 3).forEach(function(candidate) {
                                var button = global.document.createElement('button');
                                button.type = 'button';
                                button.className = 'update-shared-result-btn';
                                button.setAttribute('role', 'option');
                                button.innerHTML = '<strong>' + String(candidate.playerName || '') + '</strong><span>' + tLocal('player_update_shared_select_cta') + '</span>';
                                button.onclick = function() {
                                    configureSharedCandidateSelection(candidate, inviteContext, firebase, anonUid);
                                };
                                resultsEl.appendChild(button);
                            });
                        })
                        .catch(function() {
                            showSharedVerificationStatus(tLocal('player_update_error_network'), true);
                        });
                }, 180);
            };
        }).catch(function() {
            showError(ERROR_CODES.NETWORK_ERROR);
        });
    }

    function setCurrentStatValue(elementId, value) {
        var el = getEl(elementId);
        if (!el) {
            return;
        }
        var suffix = (value === null || value === undefined || value === '')
            ? '\u2014'
            : String(value);
        el.textContent = currentValueLabel() + ': ' + suffix;
    }

    function refreshCurrentStatLabels() {
        var snapshot = lastRenderedSnapshot || {};
        setCurrentStatValue('currentPowerValue', snapshot.power);
        setCurrentStatValue('currentThpValue', snapshot.thp);
        setCurrentStatValue('currentTroopsValue', snapshot.troops);
    }

    function setFieldError(inputEl, errorSpanId, message) {
        var span = getEl(errorSpanId);
        if (span) {
            span.textContent = message || '';
        }
        if (inputEl) {
            if (message) {
                inputEl.classList.add('field-input-error');
            } else {
                inputEl.classList.remove('field-input-error');
            }
        }
    }

    function clearFieldError(inputEl, errorSpanId) {
        setFieldError(inputEl, errorSpanId, '');
    }

    function validateFormFields(powerEl, thpEl, troopsEl) {
        var valid = true;

        // Power validation
        var powerVal = powerEl ? Number(powerEl.value) : NaN;
        if (!powerEl || powerEl.value === '' || isNaN(powerVal) || powerVal <= 0) {
            setFieldError(powerEl, 'errorPower', tLocal('player_update_error_power_required'));
            valid = false;
        } else if (powerVal > 9999) {
            setFieldError(powerEl, 'errorPower', tLocal('player_update_error_power_range'));
            valid = false;
        } else {
            clearFieldError(powerEl, 'errorPower');
        }

        // THP validation
        var thpVal = thpEl ? Number(thpEl.value) : NaN;
        if (thpEl && thpEl.value !== '' && !isNaN(thpVal)) {
            if (thpVal < 0 || thpVal > 99999) {
                setFieldError(thpEl, 'errorThp', tLocal('player_update_error_thp_range'));
                valid = false;
            } else {
                clearFieldError(thpEl, 'errorThp');
            }
        } else {
            clearFieldError(thpEl, 'errorThp');
        }

        // Troops validation
        var troopsVal = troopsEl ? troopsEl.value : '';
        if (!troopsVal) {
            setFieldError(troopsEl, 'errorTroops', tLocal('player_update_error_troops_required'));
            valid = false;
        } else {
            clearFieldError(troopsEl, 'errorTroops');
        }

        return valid;
    }

    function prefillForm(snapshot, playerName) {
        var nameEl = getEl('updatePlayerName');
        if (nameEl) {
            nameEl.textContent = playerName || '';
        }

        lastRenderedSnapshot = snapshot || {};
        refreshCurrentStatLabels();

        var powerEl = getEl('updatePower');
        if (powerEl) {
            powerEl.value = '';
        }
        var thpEl = getEl('updateThp');
        if (thpEl) {
            thpEl.value = '';
        }
        var troopsEl = getEl('updateTroops');
        if (troopsEl) {
            troopsEl.value = '';
        }
    }

    function init() {
        var params = parseParams();
        var hex = params.token || '';
        var sharedId = params.shared || params.sharedInvite || '';
        var aid = params.alliance || params.aid || '';
        var uidParam = params.uid || '';
        var gameIdParam = params.gid || params.gameId || '';
        var playerKeyParam = params.pk || params.playerKey || '';
        var lang = normalizeLanguageCode(params.lang || 'en');

        // Step 2: initialize i18n and language selector
        var languageSelectEl = getEl('languageSelect');
        if (global.DSI18N && typeof global.DSI18N.init === 'function') {
            global.DSI18N.init({
                onApply: function() {
                    refreshCurrentStatLabels();
                    if (global.document && global.document.title !== undefined) {
                        global.document.title = tLocal('player_update_page_title');
                    }
                },
            });
        }
        if (global.DSI18N && typeof global.DSI18N.setLanguage === 'function') {
            global.DSI18N.setLanguage(lang);
        } else if (global.DSI18N && typeof global.DSI18N.applyTranslations === 'function') {
            global.DSI18N.applyTranslations();
        }
        if (languageSelectEl) {
            languageSelectEl.value = (global.DSI18N && typeof global.DSI18N.getLanguage === 'function')
                ? global.DSI18N.getLanguage()
                : lang;
            languageSelectEl.addEventListener('change', function(evt) {
                var nextLang = normalizeLanguageCode(evt && evt.target ? evt.target.value : 'en');
                if (global.DSI18N && typeof global.DSI18N.setLanguage === 'function') {
                    global.DSI18N.setLanguage(nextLang);
                }
            });
        }
        if (global.document && global.document.title !== undefined) {
            global.document.title = tLocal('player_update_page_title');
        }

        // Step 3: show loading state
        showState('updateLoading');

        // Wire terminal-state buttons
        var retryBtn = getEl('updateRetryBtn');
        if (retryBtn) {
            retryBtn.onclick = function () {
                init();
            };
        }
        var doneBtn = getEl('updateDoneBtn');
        if (doneBtn) {
            doneBtn.onclick = function () {
                if (global.window && typeof global.window.close === 'function') {
                    global.window.close();
                }
                // Fallback: show a "you can close this tab" message
                var successEl = getEl('updateSuccess');
                if (successEl) {
                    var closeMsg = global.document.createElement('p');
                    closeMsg.style.marginTop = '12px';
                    closeMsg.style.fontSize = '0.875rem';
                    closeMsg.style.color = 'var(--ds-text-muted)';
                    closeMsg.textContent = tOrFallback('player_update_close_tab', 'You can now close this tab.');
                    doneBtn.replaceWith(closeMsg);
                }
            };
        }

        if ((!hex && !sharedId) || (!aid && !uidParam)) {
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
                if (sharedId) {
                    startSharedInviteFlow(firebase, anonUid, {
                        sharedId: sharedId,
                        aid: aid,
                        uidParam: uidParam,
                        isPersonal: isPersonal,
                        gameId: gameIdParam || 'last_war',
                        contextType: isPersonal ? 'personal' : 'alliance',
                        ownerUid: uidParam || null,
                        allianceId: isPersonal ? null : aid,
                    });
                    return;
                }

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
                        var tokenPlayerKey = '';
                        if (typeof tokenDoc.playerKey === 'string' && tokenDoc.playerKey.trim()) {
                            tokenPlayerKey = tokenDoc.playerKey.trim();
                        } else if (typeof playerKeyParam === 'string' && playerKeyParam.trim()) {
                            tokenPlayerKey = playerKeyParam.trim();
                        }

                        // Step 7: token already used
                        if (tokenDoc.used === true || isTokenSubmissionLimitReached(tokenDoc)) {
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
                        // Player key is mandatory so pending update can target a unique player doc.
                        if (!tokenPlayerKey) {
                            showError(ERROR_CODES.TOKEN_INVALID);
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

                        // Wire clear-on-input for inline validation errors
                        var powerInput = getEl('updatePower');
                        var thpInput = getEl('updateThp');
                        var troopsInput = getEl('updateTroops');
                        if (powerInput) {
                            powerInput.addEventListener('input', function () {
                                clearFieldError(powerInput, 'errorPower');
                            });
                        }
                        if (thpInput) {
                            thpInput.addEventListener('input', function () {
                                clearFieldError(thpInput, 'errorThp');
                            });
                        }
                        if (troopsInput) {
                            troopsInput.addEventListener('change', function () {
                                clearFieldError(troopsInput, 'errorTroops');
                            });
                        }

                        form.addEventListener('submit', function (e) {
                            e.preventDefault();

                            var powerEl = getEl('updatePower');
                            var thpEl = getEl('updateThp');
                            var troopsEl = getEl('updateTroops');

                            // Inline field validation — keeps form visible on failure
                            if (!validateFormFields(powerEl, thpEl, troopsEl)) {
                                return;
                            }

                            var proposed = {
                                power: powerEl ? Number(powerEl.value) : null,
                                thp: thpEl ? Number(thpEl.value) : null,
                                troops: troopsEl ? troopsEl.value : null,
                            };
                            var currentSubmissionCount = getTokenSubmissionCount(tokenDoc);
                            var tokenMaxSubmissions = getTokenMaxSubmissions(tokenDoc);
                            if (currentSubmissionCount >= tokenMaxSubmissions) {
                                showError(ERROR_CODES.TOKEN_USED);
                                return;
                            }

                            // disable submit button while writing
                            var submitBtn = form.querySelector('button[type="submit"]');
                            var originalBtnText = submitBtn ? submitBtn.textContent : '';
                            if (submitBtn) {
                                submitBtn.disabled = true;
                                var submittingLabel = tOrFallback('player_update_submitting', 'Submitting...');
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
                                playerKey: tokenPlayerKey,
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

                            var newPendingRef = buildNewPendingRef(effectiveGameId);

                            function writePendingUpdateWithFallback() {
                                if (!newPendingRef) {
                                    return legacyPendingRef.add(pendingUpdateDoc);
                                }

                                return newPendingRef
                                    .add(pendingUpdateDoc)
                                    .then(function(newDocRef) {
                                        // Keep legacy path in sync when possible, but don't fail the submission.
                                        return legacyPendingRef.doc(newDocRef.id).set(pendingUpdateDoc).catch(function() {})
                                            .then(function() { return newDocRef; });
                                    })
                                    .catch(function() {
                                        // Fall back to legacy path if game-scoped write is blocked/unavailable.
                                        return legacyPendingRef.add(pendingUpdateDoc)
                                            .then(function(legacyDocRef) {
                                                // Backfill game-scoped copy on best-effort basis.
                                                return newPendingRef.doc(legacyDocRef.id).set(pendingUpdateDoc).catch(function() {})
                                                    .then(function() { return legacyDocRef; });
                                            });
                                    });
                            }

                            writePendingUpdateWithFallback()
                                .then(function () {
                                    var nextSubmissionCount = currentSubmissionCount + 1;
                                    var reachedLimit = nextSubmissionCount >= tokenMaxSubmissions;
                                    var nowTs = firebase.firestore.Timestamp.now();
                                    var tokenUpdate = {
                                        submissionCount: nextSubmissionCount,
                                        lastSubmittedAt: nowTs,
                                        lastSubmittedByAnonUid: anonUid,
                                        usedByAnonUid: anonUid,
                                    };
                                    if (reachedLimit) {
                                        tokenUpdate.used = true;
                                        tokenUpdate.usedAt = nowTs;
                                    }
                                    return tokenRef.update(tokenUpdate).then(function() {
                                        tokenDoc.submissionCount = nextSubmissionCount;
                                        tokenDoc.used = reachedLimit;
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
