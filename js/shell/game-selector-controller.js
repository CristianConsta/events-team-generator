(function initGameSelectorController(global) {
    'use strict';

    var gameSelectorRequiresChoice = false;
    var postAuthSelectorShownThisSession = false;
    var postAuthGameSelectionPending = false;

    // Deps injected via init()
    var t;
    var showMessage;
    var getFirebaseService;
    var getActiveGame;
    var setActiveGame;
    var ensureActiveGameContext;
    var applyAvatar;
    var getAvatarInitials;
    var generateGameAvatarDataUrl;
    var closeNavigationMenu;
    var normalizeEventId;
    var getCurrentEvent;
    var listSelectableGames;
    var getSelectableGameById;
    var resolveActiveGameName;
    var refreshGameSelectorMenuAvailability;
    var refreshGameMetadataCatalogCache;
    var resetTransientPlanningState;
    var loadPlayerData;
    var updateAllianceHeaderDisplay;
    var renderAlliancePanel;
    var getCurrentPageView;
    var closeDownloadModal;

    function init(deps) {
        t = deps.t;
        showMessage = deps.showMessage;
        getFirebaseService = deps.getFirebaseService;
        getActiveGame = deps.getActiveGame;
        setActiveGame = deps.setActiveGame;
        ensureActiveGameContext = deps.ensureActiveGameContext;
        applyAvatar = deps.applyAvatar;
        getAvatarInitials = deps.getAvatarInitials;
        generateGameAvatarDataUrl = deps.generateGameAvatarDataUrl;
        closeNavigationMenu = deps.closeNavigationMenu;
        normalizeEventId = deps.normalizeEventId;
        getCurrentEvent = deps.getCurrentEvent;
        listSelectableGames = deps.listSelectableGames;
        getSelectableGameById = deps.getSelectableGameById;
        resolveActiveGameName = deps.resolveActiveGameName;
        refreshGameSelectorMenuAvailability = deps.refreshGameSelectorMenuAvailability;
        refreshGameMetadataCatalogCache = deps.refreshGameMetadataCatalogCache;
        resetTransientPlanningState = deps.resetTransientPlanningState;
        loadPlayerData = deps.loadPlayerData;
        updateAllianceHeaderDisplay = deps.updateAllianceHeaderDisplay;
        renderAlliancePanel = deps.renderAlliancePanel;
        getCurrentPageView = deps.getCurrentPageView;
        closeDownloadModal = deps.closeDownloadModal;
    }

    function createMissingActiveGameError() {
        var error = new Error('missing-active-game');
        error.code = 'missing-active-game';
        error.errorKey = 'missing-active-game';
        return error;
    }

    function getActiveGameContext() {
        var FirebaseService = getFirebaseService();
        if (!FirebaseService || typeof FirebaseService.getActiveGame !== 'function') {
            return { gameId: '', source: 'none' };
        }
        var context = FirebaseService.getActiveGame();
        if (!context || typeof context !== 'object') {
            return { gameId: '', source: 'none' };
        }
        var gameId = typeof context.gameId === 'string' ? context.gameId.trim() : '';
        return {
            gameId: gameId,
            source: typeof context.source === 'string' ? context.source : 'none',
        };
    }

    function requireActiveGameContext() {
        var FirebaseService = getFirebaseService();
        if (FirebaseService && typeof FirebaseService.requireActiveGame === 'function') {
            return FirebaseService.requireActiveGame();
        }
        var gameId = getActiveGame();
        if (!gameId) {
            throw createMissingActiveGameError();
        }
        return gameId;
    }

    function enforceGameplayContext(statusElementId) {
        try {
            return requireActiveGameContext();
        } catch (error) {
            if (error && error.code === 'missing-active-game') {
                if (postAuthGameSelectionPending) {
                    if (statusElementId) {
                        showMessage(statusElementId, t('game_selector_invalid'), 'warning');
                    }
                    return '';
                }
                var FirebaseService = getFirebaseService();
                var signedIn = FirebaseService
                    && typeof FirebaseService.isSignedIn === 'function'
                    && FirebaseService.isSignedIn() === true;
                if (signedIn) {
                    var fallbackId = ensureActiveGameContext();
                    if (fallbackId) {
                        return fallbackId;
                    }
                }
                if (statusElementId) {
                    showMessage(statusElementId, t('game_selector_invalid'), 'error');
                }
                return '';
            }
            throw error;
        }
    }

    function getGameplayContext(statusElementId) {
        var gameId = enforceGameplayContext(statusElementId);
        if (!gameId) {
            return null;
        }
        return { gameId: gameId };
    }

    function getEventGameplayContext(eventId, statusElementId) {
        var gameplayContext = getGameplayContext(statusElementId);
        if (!gameplayContext) {
            return null;
        }
        var normalizedEventId = normalizeEventId(eventId || getCurrentEvent());
        if (!normalizedEventId) {
            return gameplayContext;
        }
        return {
            gameId: gameplayContext.gameId,
            eventId: normalizedEventId,
        };
    }

    function isPostAuthGameSelectorEnabled() {
        var FirebaseService = getFirebaseService();
        if (FirebaseService && typeof FirebaseService.isFeatureFlagEnabled === 'function') {
            var liveFlag = FirebaseService.isFeatureFlagEnabled('MULTIGAME_GAME_SELECTOR_ENABLED');
            if (liveFlag === true) {
                return true;
            }
            if (liveFlag === false) {
                return false;
            }
        }
        if (global.__APP_FEATURE_FLAGS && typeof global.__APP_FEATURE_FLAGS.MULTIGAME_GAME_SELECTOR_ENABLED === 'boolean') {
            return global.__APP_FEATURE_FLAGS.MULTIGAME_GAME_SELECTOR_ENABLED;
        }
        return false;
    }

    function renderGameSelectorOptions(preferredGameId) {
        var selector = document.getElementById('gameSelectorInput');
        var list = document.getElementById('gameSelectorList');
        if (!selector || !list) {
            return [];
        }
        var games = listSelectableGames();
        selector.replaceChildren();
        list.replaceChildren();
        games.forEach(function (game) {
            var option = document.createElement('option');
            option.value = game.id;
            option.textContent = game.name;
            selector.appendChild(option);

            var row = document.createElement('button');
            row.type = 'button';
            row.className = 'game-selector-option';
            row.dataset.gameId = game.id;
            row.setAttribute('role', 'option');
            row.setAttribute('aria-selected', 'false');

            var avatar = document.createElement('span');
            avatar.className = 'header-avatar game-selector-option-avatar';
            avatar.setAttribute('aria-hidden', 'true');
            var avatarImage = document.createElement('img');
            avatarImage.className = 'hidden';
            avatarImage.alt = (game.name || game.id) + ' logo';
            var avatarInitials = document.createElement('span');
            avatarInitials.textContent = 'G';
            avatar.appendChild(avatarImage);
            avatar.appendChild(avatarInitials);

            var body = document.createElement('span');
            body.className = 'game-selector-option-body';
            var name = document.createElement('span');
            name.className = 'game-selector-option-name';
            name.textContent = game.name || game.id;
            body.appendChild(name);

            var check = document.createElement('span');
            check.className = 'game-selector-option-check';
            check.setAttribute('aria-hidden', 'true');
            check.textContent = '\u2713';

            var fallbackLogo = generateGameAvatarDataUrl(game.name || game.id, game.id);
            applyAvatar(game.logo || fallbackLogo, avatarImage, avatarInitials, getAvatarInitials(game.name || game.id, 'G'));

            row.appendChild(avatar);
            row.appendChild(body);
            row.appendChild(check);
            list.appendChild(row);
        });

        var preferred = typeof preferredGameId === 'string' ? preferredGameId.trim() : '';
        var selectedId = '';
        if (preferred && games.some(function (game) { return game.id === preferred; })) {
            selectedId = preferred;
        } else if (games.length > 0) {
            selectedId = games[0].id;
        }
        selector.value = selectedId;
        setGameSelectorSelection(selectedId);
        return games;
    }

    function setGameSelectorSelection(gameId) {
        var selector = document.getElementById('gameSelectorInput');
        var list = document.getElementById('gameSelectorList');
        var selectedId = typeof gameId === 'string' ? gameId.trim() : '';
        if (!selector || !list || !selectedId) {
            return false;
        }
        var row = Array.from(list.querySelectorAll('.game-selector-option'))
            .find(function (option) { return (option.dataset.gameId || '').trim() === selectedId; }) || null;
        if (!row) {
            return false;
        }
        selector.value = selectedId;
        list.querySelectorAll('.game-selector-option').forEach(function (option) {
            var isSelected = option === row;
            option.classList.toggle('is-selected', isSelected);
            option.setAttribute('aria-selected', isSelected ? 'true' : 'false');
        });
        return true;
    }

    function closeGameSelector(forceClose) {
        if (gameSelectorRequiresChoice && forceClose !== true) {
            return;
        }
        var overlay = document.getElementById('gameSelectorOverlay');
        if (!overlay) {
            return;
        }
        overlay.classList.add('hidden');
        gameSelectorRequiresChoice = false;
        var statusEl = document.getElementById('gameSelectorStatus');
        if (statusEl) {
            statusEl.replaceChildren();
        }
    }

    async function openGameSelector(options) {
        var config = options && typeof options === 'object' ? options : {};
        var overlay = document.getElementById('gameSelectorOverlay');
        var cancelBtn = document.getElementById('gameSelectorCancelBtn');
        var selector = document.getElementById('gameSelectorInput');
        var list = document.getElementById('gameSelectorList');
        if (!overlay || !cancelBtn || !selector || !list) {
            return;
        }

        closeNavigationMenu();
        refreshGameSelectorMenuAvailability();

        if (typeof refreshGameMetadataCatalogCache === 'function') {
            await refreshGameMetadataCatalogCache({ silent: true, preferredGameId: getActiveGame() || '' });
        }

        var activeGameId = getActiveGame() || ensureActiveGameContext();
        var games = renderGameSelectorOptions(activeGameId);
        var statusEl = document.getElementById('gameSelectorStatus');
        if (statusEl) {
            statusEl.replaceChildren();
        }

        gameSelectorRequiresChoice = config.requireChoice === true;
        cancelBtn.hidden = gameSelectorRequiresChoice;
        cancelBtn.disabled = gameSelectorRequiresChoice;

        if (games.length === 0) {
            showMessage('gameSelectorStatus', t('game_selector_no_games'), 'warning');
        }

        overlay.classList.remove('hidden');
        var selectedOption = list.querySelector('.game-selector-option.is-selected') || list.querySelector('.game-selector-option');
        if (selectedOption) {
            selectedOption.focus();
        }
    }

    function handleGameSelectorOverlayClick(event) {
        if (event && event.target && event.target.id === 'gameSelectorOverlay') {
            closeGameSelector(false);
        }
    }

    function resolveGameSelectorOptionFromEvent(event) {
        if (!event || !event.target) {
            return null;
        }
        var option = event.target.closest('.game-selector-option');
        if (!option || !(option instanceof HTMLElement)) {
            return null;
        }
        var gameId = typeof option.dataset.gameId === 'string' ? option.dataset.gameId.trim() : '';
        if (!gameId) {
            return null;
        }
        return { option: option, gameId: gameId };
    }

    function handleGameSelectorListClick(event) {
        var resolved = resolveGameSelectorOptionFromEvent(event);
        if (!resolved) {
            return;
        }
        if (!setGameSelectorSelection(resolved.gameId)) {
            return;
        }
        var status = document.getElementById('gameSelectorStatus');
        if (status) {
            status.replaceChildren();
        }
        confirmGameSelectorChoice();
    }

    function handleGameSelectorListKeydown(event) {
        if (!event || (event.key !== 'Enter' && event.key !== ' ')) {
            return;
        }
        var resolved = resolveGameSelectorOptionFromEvent(event);
        if (!resolved) {
            return;
        }
        event.preventDefault();
        if (!setGameSelectorSelection(resolved.gameId)) {
            return;
        }
        var status = document.getElementById('gameSelectorStatus');
        if (status) {
            status.replaceChildren();
        }
        confirmGameSelectorChoice();
    }

    async function applyGameSwitch(gameId, options) {
        var config = options && typeof options === 'object' ? options : {};
        var statusElementId = typeof config.statusElementId === 'string' ? config.statusElementId : '';

        var result = setActiveGame(gameId);
        if (!result || !result.success || !result.gameId) {
            if (statusElementId) {
                showMessage(statusElementId, t('game_selector_invalid'), 'error');
            }
            return false;
        }

        var shouldReload = result.changed === true || config.forceReload === true;
        if (shouldReload) {
            resetTransientPlanningState({ renderPlayersTable: false });
            var FirebaseService = getFirebaseService();
            if (
                FirebaseService
                && typeof FirebaseService.loadUserData === 'function'
                && typeof FirebaseService.getCurrentUser === 'function'
                && typeof FirebaseService.isSignedIn === 'function'
                && FirebaseService.isSignedIn()
            ) {
                var activeUser = FirebaseService.getCurrentUser();
                if (activeUser && activeUser.uid) {
                    try {
                        await FirebaseService.loadUserData(activeUser, { gameId: result.gameId });
                    } catch (error) {
                        if (statusElementId) {
                            showMessage(statusElementId, t('error_generic', { error: String(error && error.message ? error.message : error || 'unknown') }), 'error');
                        }
                        return false;
                    }
                }
            }
            loadPlayerData();
            updateAllianceHeaderDisplay();
            if (FirebaseService && typeof FirebaseService.loadAllianceData === 'function' && FirebaseService.isSignedIn()) {
                try {
                    await FirebaseService.loadAllianceData({ gameId: result.gameId });
                    if (getCurrentPageView() === 'alliance') {
                        renderAlliancePanel();
                        updateAllianceHeaderDisplay();
                    }
                } catch (_err) {
                    // Ignore transient alliance refresh errors after game switch.
                }
            }
        }

        closeGameSelector(true);
        return true;
    }

    async function confirmGameSelectorChoice() {
        var selector = document.getElementById('gameSelectorInput');
        if (!selector) {
            return;
        }
        var selectedGameId = typeof selector.value === 'string' ? selector.value.trim() : '';
        if (!selectedGameId) {
            showMessage('gameSelectorStatus', t('game_selector_invalid'), 'error');
            return;
        }
        var switched = await applyGameSwitch(selectedGameId, {
            statusElementId: 'gameSelectorStatus',
            forceReload: true,
        });
        if (switched) {
            postAuthGameSelectionPending = false;
        }
    }

    function showPostAuthGameSelector() {
        refreshGameSelectorMenuAvailability();
        if (!isPostAuthGameSelectorEnabled()) {
            postAuthGameSelectionPending = false;
            return;
        }
        if (postAuthSelectorShownThisSession) {
            return;
        }
        postAuthSelectorShownThisSession = true;
        var games = listSelectableGames();
        if (!Array.isArray(games) || games.length === 0) {
            postAuthGameSelectionPending = false;
            return;
        }
        if (getActiveGame()) {
            postAuthGameSelectionPending = false;
            return;
        }
        postAuthGameSelectionPending = true;
        openGameSelector({ requireChoice: true });
    }

    function resetPostAuthGameSelectorState() {
        postAuthSelectorShownThisSession = false;
        postAuthGameSelectionPending = false;
        closeGameSelector(true);
    }

    function isPostAuthGameSelectionPendingFn() {
        return postAuthGameSelectionPending === true;
    }

    global.DSGameSelectorController = {
        init: init,
        createMissingActiveGameError: createMissingActiveGameError,
        getActiveGameContext: getActiveGameContext,
        requireActiveGameContext: requireActiveGameContext,
        enforceGameplayContext: enforceGameplayContext,
        getGameplayContext: getGameplayContext,
        getEventGameplayContext: getEventGameplayContext,
        isPostAuthGameSelectorEnabled: isPostAuthGameSelectorEnabled,
        renderGameSelectorOptions: renderGameSelectorOptions,
        setGameSelectorSelection: setGameSelectorSelection,
        closeGameSelector: closeGameSelector,
        openGameSelector: openGameSelector,
        handleGameSelectorOverlayClick: handleGameSelectorOverlayClick,
        handleGameSelectorListClick: handleGameSelectorListClick,
        handleGameSelectorListKeydown: handleGameSelectorListKeydown,
        applyGameSwitch: applyGameSwitch,
        confirmGameSelectorChoice: confirmGameSelectorChoice,
        showPostAuthGameSelector: showPostAuthGameSelector,
        resetPostAuthGameSelectorState: resetPostAuthGameSelectorState,
        isPostAuthGameSelectionPending: isPostAuthGameSelectionPendingFn,
    };
})(window);
