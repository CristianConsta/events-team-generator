(function initPlayerDataUpload(global) {
    function getUploadErrorMessage(resultOrError, tFn) {
        if (resultOrError && typeof resultOrError === 'object') {
            if (resultOrError.errorKey) {
                return tFn(resultOrError.errorKey, resultOrError.errorParams || {});
            }
            if (typeof resultOrError.error === 'string' && resultOrError.error) {
                return resultOrError.error;
            }
            if (typeof resultOrError.message === 'string' && resultOrError.message) {
                return resultOrError.message;
            }
        }
        return String(resultOrError || 'unknown');
    }

    function hasAllianceUploadAccess(gameplayContext, FirebaseService) {
        if (typeof FirebaseService === 'undefined' || !FirebaseService || typeof FirebaseService.getAllianceId !== 'function') {
            return false;
        }

        var allianceId = FirebaseService.getAllianceId(gameplayContext || undefined);
        if (!allianceId) {
            return false;
        }

        if (typeof FirebaseService.getAllianceData !== 'function') {
            return true;
        }

        var allianceState = FirebaseService.getAllianceData(gameplayContext || undefined);
        if (!allianceState || typeof allianceState !== 'object') {
            return false;
        }

        if (typeof FirebaseService.getCurrentUser !== 'function') {
            return true;
        }

        var currentUser = FirebaseService.getCurrentUser();
        var uid = currentUser && typeof currentUser.uid === 'string' ? currentUser.uid : '';
        if (!uid) {
            return true;
        }

        var members = allianceState.members && typeof allianceState.members === 'object'
            ? allianceState.members
            : null;
        return !!(members && members[uid]);
    }

    async function resolveAllianceUploadAccess(gameplayContext, deps) {
        var context = gameplayContext || deps.getGameplayContext();
        var FirebaseService = deps.FirebaseService;
        if (!context || !FirebaseService) {
            return false;
        }

        if (
            typeof FirebaseService.loadAllianceData === 'function'
            && typeof FirebaseService.isSignedIn === 'function'
            && FirebaseService.isSignedIn()
        ) {
            try {
                await FirebaseService.loadAllianceData(context);
            } catch (error) {
                // Best effort refresh for upload decision only.
            }
        }

        return hasAllianceUploadAccess(context, FirebaseService);
    }

    async function performUpload(file, target, deps) {
        var t = deps.t;
        var showMessage = deps.showMessage;
        var getGameplayContext = deps.getGameplayContext;
        var FirebaseService = deps.FirebaseService;
        var loadPlayerData = deps.loadPlayerData;
        var ensureXLSXLoaded = deps.ensureXLSXLoaded;

        try {
            await ensureXLSXLoaded();
        } catch (error) {
            console.error(error);
            showMessage('uploadMessage', t('error_xlsx_missing'), 'error');
            return;
        }

        showMessage('uploadMessage', t('message_upload_processing'), 'processing');
        var gameplayContext = getGameplayContext('uploadMessage');
        if (!gameplayContext) {
            return;
        }
        var normalizedTarget = typeof target === 'string' ? target.trim().toLowerCase() : '';
        if (normalizedTarget !== 'personal' && normalizedTarget !== 'alliance' && normalizedTarget !== 'both') {
            showMessage('uploadMessage', t('message_upload_failed', { error: t('players_list_error_invalid_source') }), 'error');
            return;
        }
        var hasAlliance = hasAllianceUploadAccess(gameplayContext, FirebaseService);
        if ((normalizedTarget === 'alliance' || normalizedTarget === 'both') && !hasAlliance) {
            showMessage('uploadMessage', t('players_list_error_no_alliance'), 'error');
            return;
        }

        try {
            if (normalizedTarget === 'both') {
                var personalResult = null;
                var allianceResult = null;
                var personalError = '';
                var allianceError = '';

                try {
                    personalResult = await FirebaseService.uploadPlayerDatabase(file, gameplayContext);
                } catch (error) {
                    personalError = getUploadErrorMessage(error, t);
                }

                try {
                    allianceResult = await FirebaseService.uploadAlliancePlayerDatabase(file, gameplayContext);
                } catch (error) {
                    allianceError = getUploadErrorMessage(error, t);
                }

                var personalOk = !!(personalResult && personalResult.success);
                var allianceOk = !!(allianceResult && allianceResult.success);
                if (personalOk && allianceOk) {
                    showMessage('uploadMessage', personalResult.message + ' | ' + allianceResult.message, 'success');
                    loadPlayerData();
                    return;
                }

                if (personalOk || allianceOk) {
                    var personalStatus = personalOk ? t('success_generic') : t('message_upload_failed', { error: personalError || getUploadErrorMessage(personalResult, t) });
                    var allianceStatus = allianceOk ? t('success_generic') : t('message_upload_failed', { error: allianceError || getUploadErrorMessage(allianceResult, t) });
                    showMessage('uploadMessage', t('upload_target_personal') + ': ' + personalStatus + ' | ' + t('upload_target_alliance') + ': ' + allianceStatus, 'warning');
                    loadPlayerData();
                    return;
                }

                var mergedError = [personalError || getUploadErrorMessage(personalResult, t), allianceError || getUploadErrorMessage(allianceResult, t)]
                    .filter(Boolean)
                    .join(' | ');
                showMessage('uploadMessage', t('message_upload_failed', { error: mergedError || 'unknown' }), 'error');
                return;
            }

            var result = normalizedTarget === 'alliance'
                ? await FirebaseService.uploadAlliancePlayerDatabase(file, gameplayContext)
                : await FirebaseService.uploadPlayerDatabase(file, gameplayContext);

            if (!result || !result.success) {
                showMessage('uploadMessage', t('message_upload_failed', { error: getUploadErrorMessage(result, t) }), 'error');
                return;
            }
            showMessage('uploadMessage', result.message, 'success');
            loadPlayerData();
        } catch (error) {
            showMessage('uploadMessage', t('message_upload_failed', { error: getUploadErrorMessage(error, t) }), 'error');
        }
    }

    function openUploadTargetModal(options, deps) {
        var modal = deps.document.getElementById('uploadTargetModal');
        if (!modal) {
            return;
        }
        var config = options && typeof options === 'object' ? options : {};
        var gameplayContext = config.gameplayContext || deps.getGameplayContext();
        var hasAlliance = config.hasAlliance === true
            ? true
            : hasAllianceUploadAccess(gameplayContext, deps.FirebaseService);
        var personalBtn = deps.document.getElementById('uploadPersonalBtn');
        var allianceBtn = deps.document.getElementById('uploadAllianceBtn');
        var bothBtn = deps.document.getElementById('uploadBothBtn');
        if (personalBtn) personalBtn.classList.remove('hidden');
        if (allianceBtn) allianceBtn.classList.toggle('hidden', !hasAlliance);
        if (bothBtn) bothBtn.classList.toggle('hidden', !hasAlliance);
        deps.openModalOverlay(modal, { initialFocusSelector: '#uploadPersonalBtn' });
    }

    function renderSelectionSourceControls(deps) {
        var controls = deps.document.getElementById('selectionSourceControls');
        var personalBtn = deps.document.getElementById('selectionSourcePersonalBtn');
        var allianceBtn = deps.document.getElementById('selectionSourceAllianceBtn');
        var FirebaseService = deps.FirebaseService;
        if (!controls || !personalBtn || !allianceBtn || !FirebaseService) {
            return;
        }

        var gameplayContext = deps.getGameplayContext();
        var hasAlliance = !!(FirebaseService.getAllianceId && FirebaseService.getAllianceId(gameplayContext || undefined));
        if (!hasAlliance) {
            controls.classList.add('hidden');
            return;
        }
        controls.classList.remove('hidden');

        var source = FirebaseService.getPlayerSource ? FirebaseService.getPlayerSource(gameplayContext || undefined) : 'personal';
        var personalActive = source !== 'alliance';
        var allianceActive = source === 'alliance';
        personalBtn.classList.toggle('secondary', !personalActive);
        allianceBtn.classList.toggle('secondary', !allianceActive);
        personalBtn.disabled = personalActive;
        allianceBtn.disabled = allianceActive;
    }

    function syncPlayersFromActiveDatabase(options, deps) {
        var FirebaseService = deps.FirebaseService;
        if (!FirebaseService) {
            return;
        }

        var config = options && typeof options === 'object' ? options : {};
        var gameplayContext = deps.getGameplayContext();
        if (!gameplayContext) {
            return;
        }
        var playerDB = FirebaseService.getActivePlayerDatabase(gameplayContext);
        var source = FirebaseService.getPlayerSource(gameplayContext);
        var t = deps.t;
        var sourceLabel = source === 'alliance' ? t('player_source_alliance') : t('player_source_personal');
        var count = playerDB && typeof playerDB === 'object' ? Object.keys(playerDB).length : 0;
        var normalizePlayerRecordForUi = deps.normalizePlayerRecordForUi;

        var rows = Object.keys(playerDB || {}).map(function (name) {
            return normalizePlayerRecordForUi(name, playerDB[name]);
        });
        deps.setAllPlayers(rows);

        var playerCountEl = deps.document.getElementById('playerCount');
        if (playerCountEl) {
            playerCountEl.textContent = t('player_count_with_source', { count: count, source: sourceLabel });
        }

        var uploadHintEl = deps.document.getElementById('uploadHint');
        if (uploadHintEl) {
            uploadHintEl.textContent = count > 0 ? t('upload_hint') : '';
        }

        renderSelectionSourceControls(deps);
        deps.renderPlayersManagementPanel();

        if (config.renderGeneratorViews !== false) {
            deps.renderPlayersTable();
            deps.updateTeamCounters();
        }
    }

    global.DSPlayerDataUpload = {
        getUploadErrorMessage: getUploadErrorMessage,
        hasAllianceUploadAccess: hasAllianceUploadAccess,
        resolveAllianceUploadAccess: resolveAllianceUploadAccess,
        performUpload: performUpload,
        openUploadTargetModal: openUploadTargetModal,
        renderSelectionSourceControls: renderSelectionSourceControls,
        syncPlayersFromActiveDatabase: syncPlayersFromActiveDatabase,
    };
})(window);
