// ============================================================
// I18N
// ============================================================

function t(key, params) {
    return window.DSI18N.t(key, params);
}

function refreshLanguageDependentText() {
    const playerCountEl = document.getElementById('playerCount');
    if (playerCountEl && typeof allPlayers !== 'undefined') {
        if (typeof FirebaseService !== 'undefined') {
            const gameplayContext = getGameplayContext();
            const source = FirebaseService.getPlayerSource && FirebaseService.getPlayerSource(gameplayContext || undefined);
            const sourceLabel = source === 'alliance' ? t('player_source_alliance') : t('player_source_personal');
            playerCountEl.textContent = t('player_count_with_source', { count: allPlayers.length, source: sourceLabel });
        } else {
            playerCountEl.textContent = t('player_count', { count: allPlayers.length });
        }
    }
    const uploadHintEl = document.getElementById('uploadHint');
    if (uploadHintEl && typeof allPlayers !== 'undefined') {
        uploadHintEl.textContent = allPlayers.length > 0 ? t('upload_hint') : '';
    }
}

function onI18nApplied() {
    renderAllEventSelectors();
    renderEventsList();
    updateEventEditorTitle();
    updateEventEditorState();
    refreshLanguageDependentText();
    renderPlayersManagementPanel();
    renderPlayersTable();
    renderBuildingsTable();
    updateTeamCounters();
    syncAssignmentAlgorithmControl();
    const navMenuBtn = document.getElementById('navMenuBtn');
    if (navMenuBtn) {
        navMenuBtn.title = t('navigation_menu');
        navMenuBtn.setAttribute('aria-label', t('navigation_menu'));
    }
    const navMenuPanel = document.getElementById('navMenuPanel');
    if (navMenuPanel) {
        navMenuPanel.setAttribute('aria-label', t('navigation_menu'));
    }
    const profileBtn = document.getElementById('headerProfileBtn');
    if (profileBtn) {
        profileBtn.title = t('settings_button');
        profileBtn.setAttribute('aria-label', t('settings_button'));
    }
    const notificationBtn = document.getElementById('notificationBtn');
    if (notificationBtn) {
        notificationBtn.title = t('notifications_title');
    }
    updateUserHeaderIdentity(currentAuthUser);
    updateActiveGameBadge();
    refreshGameSelectorMenuAvailability();
    syncNavigationMenuState();
    const coordOverlay = document.getElementById('coordPickerOverlay');
    if (coordOverlay && !coordOverlay.classList.contains('hidden')) {
        updateCoordLabel();
    }
    const downloadOverlay = document.getElementById('downloadModalOverlay');
    if (downloadOverlay && !downloadOverlay.classList.contains('hidden') && activeDownloadTeam) {
        const team = activeDownloadTeam;
        document.getElementById('downloadModalTitle').textContent = t('download_modal_title', { team: team });
        document.getElementById('downloadModalSubtitle').textContent = t('download_modal_subtitle', { team: team });
    }
    updateOnboardingTooltip();
}

function applyTranslations() {
    window.DSI18N.applyTranslations();
}

function setLanguage(lang) {
    window.DSI18N.setLanguage(lang);
}

function initLanguage() {
    window.DSI18N.init({
        onApply: () => {
            onI18nApplied();
        },
    });
}

const UI_MOTION_MS = Object.freeze({
    panel: 170,
});

function clearPanelMotionTimer(element) {
    if (!element || !element.dataset) {
        return;
    }
    const timerId = Number(element.dataset.motionTimerId || 0);
    if (timerId) {
        clearTimeout(timerId);
    }
    delete element.dataset.motionTimerId;
}

function setPanelVisibility(element, shouldOpen) {
    if (!element) {
        return;
    }
    clearPanelMotionTimer(element);
    element.style.setProperty('--panel-motion-ms', `${UI_MOTION_MS.panel}ms`);
    if (shouldOpen) {
        element.classList.remove('hidden');
        const schedule = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (cb) => setTimeout(cb, 0);
        schedule(() => {
            element.classList.add('ui-open');
        });
        return;
    }
    element.classList.remove('ui-open');
    const timerId = setTimeout(() => {
        element.classList.add('hidden');
    }, UI_MOTION_MS.panel);
    if (element.dataset) {
        element.dataset.motionTimerId = String(timerId);
    }
}

function openModalOverlay(overlay, options) {
    if (!(overlay instanceof HTMLElement)) {
        return;
    }
    if (window.DSShellModalController && typeof window.DSShellModalController.open === 'function') {
        window.DSShellModalController.open({
            overlay: overlay,
            initialFocusSelector: options && typeof options.initialFocusSelector === 'string'
                ? options.initialFocusSelector
                : null,
        });
        return;
    }
    overlay.classList.remove('hidden');
    const focusSelector = options && typeof options.initialFocusSelector === 'string'
        ? options.initialFocusSelector
        : '';
    const focusTarget = focusSelector ? overlay.querySelector(focusSelector) : null;
    if (focusTarget instanceof HTMLElement) {
        const schedule = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (cb) => setTimeout(cb, 0);
        schedule(() => focusTarget.focus());
    }
}

function closeModalOverlay(overlay) {
    if (!(overlay instanceof HTMLElement)) {
        return false;
    }
    if (window.DSShellModalController && typeof window.DSShellModalController.close === 'function') {
        return window.DSShellModalController.close({
            overlay: overlay,
        });
    }
    overlay.classList.add('hidden');
    return true;
}

function createMissingActiveGameError() {
    const error = new Error('missing-active-game');
    error.code = 'missing-active-game';
    error.errorKey = 'missing-active-game';
    return error;
}

function listSelectableGames() {
    if (typeof FirebaseService === 'undefined' || typeof FirebaseService.listAvailableGames !== 'function') {
        return [];
    }
    const games = FirebaseService.listAvailableGames();
    if (!Array.isArray(games)) {
        return [];
    }
    const metadataById = new Map();
    if (Array.isArray(gameMetadataCatalogCache)) {
        gameMetadataCatalogCache
            .map(normalizeGameMetadataEntry)
            .filter(Boolean)
            .forEach((metadata) => {
                metadataById.set(metadata.id, metadata);
            });
    }
    return games
        .map((game) => {
            const id = game && typeof game.id === 'string' ? game.id.trim() : '';
            if (!id) {
                return null;
            }
            const catalogName = game && typeof game.name === 'string' && game.name.trim()
                ? game.name.trim()
                : id;
            const catalogLogo = game && typeof game.logo === 'string' ? game.logo.trim() : '';
            const metadata = metadataById.get(id) || null;
            const name = metadata && typeof metadata.name === 'string' && metadata.name.trim()
                ? metadata.name.trim()
                : catalogName;
            const logo = metadata && typeof metadata.logo === 'string' && metadata.logo.trim()
                ? metadata.logo.trim()
                : catalogLogo;
            return { id, name, logo };
        })
        .filter(Boolean);
}

function getSelectableGameById(gameId) {
    const normalizedId = typeof gameId === 'string' ? gameId.trim() : '';
    if (!normalizedId) {
        return null;
    }
    const selectableGame = listSelectableGames().find((game) => game.id === normalizedId) || null;
    if (selectableGame) {
        return selectableGame;
    }
    const cachedGame = Array.isArray(gameMetadataCatalogCache)
        ? gameMetadataCatalogCache.find((game) => game && game.id === normalizedId)
        : null;
    return cachedGame ? normalizeGameMetadataEntry(cachedGame) : null;
}

function resolveActiveGameName(gameId) {
    const selectedGame = getSelectableGameById(gameId);
    if (selectedGame && selectedGame.name) {
        return selectedGame.name;
    }
    if (!gameId) {
        return '';
    }
    if (typeof FirebaseService === 'undefined' || typeof FirebaseService.listAvailableGames !== 'function') {
        return gameId;
    }
    const games = FirebaseService.listAvailableGames();
    const match = Array.isArray(games) ? games.find((game) => game && game.id === gameId) : null;
    if (match && typeof match.name === 'string' && match.name.trim()) {
        return match.name.trim();
    }
    return gameId;
}

function updateActiveGameBadge(forcedGameId) {
    const badge = document.getElementById('activeGameBadge');
    const image = document.getElementById('activeGameBadgeImage');
    const initials = document.getElementById('activeGameBadgeInitials');
    if (!badge) {
        return;
    }
    const activeGameId = typeof forcedGameId === 'string' && forcedGameId.trim()
        ? forcedGameId.trim()
        : getActiveGame();
    if (!activeGameId) {
        badge.classList.add('hidden');
        badge.setAttribute('title', '');
        if (image) {
            image.src = '';
            image.classList.add('hidden');
        }
        if (initials) {
            initials.textContent = '';
        }
        return;
    }
    const selectedGame = getSelectableGameById(activeGameId);
    const gameName = selectedGame && selectedGame.name ? selectedGame.name : resolveActiveGameName(activeGameId);
    const gameLogo = selectedGame && typeof selectedGame.logo === 'string' ? selectedGame.logo.trim() : '';
    const fallbackAvatar = generateGameAvatarDataUrl(gameName || activeGameId, activeGameId);
    applyAvatar(gameLogo || fallbackAvatar, image, initials, getAvatarInitials(gameName || activeGameId, 'G'));
    badge.classList.remove('hidden');
    badge.setAttribute('title', gameName || activeGameId);
}

function refreshGameSelectorMenuAvailability() {
    const switchBtn = document.getElementById('navSwitchGameBtn');
    if (!switchBtn) {
        return;
    }
    const hasGames = listSelectableGames().length > 0;
    switchBtn.classList.toggle('hidden', !hasGames);
    switchBtn.disabled = !hasGames;
}

function getActiveGameContext() {
    if (typeof FirebaseService === 'undefined' || typeof FirebaseService.getActiveGame !== 'function') {
        return { gameId: '', source: 'none' };
    }
    const context = FirebaseService.getActiveGame();
    if (!context || typeof context !== 'object') {
        return { gameId: '', source: 'none' };
    }
    const gameId = typeof context.gameId === 'string' ? context.gameId.trim() : '';
    return {
        gameId: gameId,
        source: typeof context.source === 'string' ? context.source : 'none',
    };
}

function getActiveGame() {
    return getActiveGameContext().gameId;
}

function setActiveGame(gameId) {
    if (typeof FirebaseService === 'undefined' || typeof FirebaseService.setActiveGame !== 'function') {
        return { success: false, code: 'firebase-service-unavailable' };
    }
    const result = FirebaseService.setActiveGame(gameId);
    if (result && result.success && result.gameId) {
        window.__ACTIVE_GAME_ID = result.gameId;
        updateActiveGameBadge(result.gameId);
    }
    return result;
}

function ensureActiveGameContext() {
    if (typeof FirebaseService === 'undefined' || typeof FirebaseService.ensureActiveGame !== 'function') {
        return '';
    }
    const context = FirebaseService.ensureActiveGame();
    const gameId = context && typeof context.gameId === 'string' ? context.gameId : '';
    window.__ACTIVE_GAME_ID = gameId;
    updateActiveGameBadge(gameId);
    return gameId;
}

function requireActiveGameContext() {
    if (typeof FirebaseService !== 'undefined' && typeof FirebaseService.requireActiveGame === 'function') {
        return FirebaseService.requireActiveGame();
    }
    const gameId = getActiveGame();
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
                    showMessage(statusElementId, 'Select a game to continue.', 'warning');
                }
                return '';
            }
            const fallbackId = ensureActiveGameContext();
            if (fallbackId) {
                return fallbackId;
            }
            if (statusElementId) {
                showMessage(statusElementId, 'Active game context is required.', 'error');
            }
            return '';
        }
        throw error;
    }
}

function getGameplayContext(statusElementId) {
    const gameId = enforceGameplayContext(statusElementId);
    if (!gameId) {
        return null;
    }
    return { gameId: gameId };
}

function getEventGameplayContext(eventId, statusElementId) {
    const gameplayContext = getGameplayContext(statusElementId);
    if (!gameplayContext) {
        return null;
    }
    const normalizedEventId = normalizeEventId(eventId || currentEvent);
    if (!normalizedEventId) {
        return gameplayContext;
    }
    return {
        gameId: gameplayContext.gameId,
        eventId: normalizedEventId,
    };
}

let gameSelectorRequiresChoice = false;
let postAuthSelectorShownThisSession = false;
let postAuthGameSelectionPending = false;

function isPostAuthGameSelectorEnabled() {
    if (window.__APP_FEATURE_FLAGS && typeof window.__APP_FEATURE_FLAGS.MULTIGAME_GAME_SELECTOR_ENABLED === 'boolean') {
        return window.__APP_FEATURE_FLAGS.MULTIGAME_GAME_SELECTOR_ENABLED;
    }
    if (typeof FirebaseService === 'undefined' || typeof FirebaseService.isFeatureFlagEnabled !== 'function') {
        return false;
    }
    return FirebaseService.isFeatureFlagEnabled('MULTIGAME_GAME_SELECTOR_ENABLED');
}

function renderGameSelectorOptions(preferredGameId) {
    const selector = document.getElementById('gameSelectorInput');
    const list = document.getElementById('gameSelectorList');
    if (!selector || !list) {
        return [];
    }
    const games = listSelectableGames();
    selector.replaceChildren();
    list.replaceChildren();
    games.forEach((game) => {
        const option = document.createElement('option');
        option.value = game.id;
        option.textContent = game.name;
        selector.appendChild(option);

        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'game-selector-option';
        row.dataset.gameId = game.id;
        row.setAttribute('role', 'option');
        row.setAttribute('aria-selected', 'false');

        const avatar = document.createElement('span');
        avatar.className = 'header-avatar game-selector-option-avatar';
        avatar.setAttribute('aria-hidden', 'true');
        const avatarImage = document.createElement('img');
        avatarImage.className = 'hidden';
        avatarImage.alt = `${game.name || game.id} logo`;
        const avatarInitials = document.createElement('span');
        avatarInitials.textContent = 'G';
        avatar.appendChild(avatarImage);
        avatar.appendChild(avatarInitials);

        const body = document.createElement('span');
        body.className = 'game-selector-option-body';
        const name = document.createElement('span');
        name.className = 'game-selector-option-name';
        name.textContent = game.name || game.id;
        const meta = document.createElement('span');
        meta.className = 'game-selector-option-meta';
        meta.textContent = game.id;
        body.appendChild(name);
        body.appendChild(meta);

        const check = document.createElement('span');
        check.className = 'game-selector-option-check';
        check.setAttribute('aria-hidden', 'true');
        check.textContent = '✓';

        const fallbackLogo = generateGameAvatarDataUrl(game.name || game.id, game.id);
        applyAvatar(game.logo || fallbackLogo, avatarImage, avatarInitials, getAvatarInitials(game.name || game.id, 'G'));

        row.appendChild(avatar);
        row.appendChild(body);
        row.appendChild(check);
        list.appendChild(row);
    });

    const preferred = typeof preferredGameId === 'string' ? preferredGameId.trim() : '';
    let selectedId = '';
    if (preferred && games.some((game) => game.id === preferred)) {
        selectedId = preferred;
    } else if (games.length > 0) {
        selectedId = games[0].id;
    } else {
        selectedId = '';
    }
    selector.value = selectedId;
    setGameSelectorSelection(selectedId);
    return games;
}

function setGameSelectorSelection(gameId) {
    const selector = document.getElementById('gameSelectorInput');
    const list = document.getElementById('gameSelectorList');
    const selectedId = typeof gameId === 'string' ? gameId.trim() : '';
    if (!selector || !list || !selectedId) {
        return false;
    }
    const row = Array.from(list.querySelectorAll('.game-selector-option'))
        .find((option) => (option.dataset.gameId || '').trim() === selectedId) || null;
    if (!row) {
        return false;
    }
    selector.value = selectedId;
    list.querySelectorAll('.game-selector-option').forEach((option) => {
        const isSelected = option === row;
        option.classList.toggle('is-selected', isSelected);
        option.setAttribute('aria-selected', isSelected ? 'true' : 'false');
    });
    return true;
}

function closeGameSelector(forceClose) {
    if (gameSelectorRequiresChoice && forceClose !== true) {
        return;
    }
    const overlay = document.getElementById('gameSelectorOverlay');
    if (!overlay) {
        return;
    }
    overlay.classList.add('hidden');
    gameSelectorRequiresChoice = false;
    const statusEl = document.getElementById('gameSelectorStatus');
    if (statusEl) {
        statusEl.replaceChildren();
    }
}

function openGameSelector(options) {
    const config = options && typeof options === 'object' ? options : {};
    const overlay = document.getElementById('gameSelectorOverlay');
    const cancelBtn = document.getElementById('gameSelectorCancelBtn');
    const selector = document.getElementById('gameSelectorInput');
    const list = document.getElementById('gameSelectorList');
    if (!overlay || !cancelBtn || !selector || !list) {
        return;
    }

    closeNavigationMenu();
    refreshGameSelectorMenuAvailability();

    const activeGameId = getActiveGame() || ensureActiveGameContext();
    const games = renderGameSelectorOptions(activeGameId);
    const statusEl = document.getElementById('gameSelectorStatus');
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
    const selectedOption = list.querySelector('.game-selector-option.is-selected') || list.querySelector('.game-selector-option');
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
    const option = event.target.closest('.game-selector-option');
    if (!option || !(option instanceof HTMLElement)) {
        return null;
    }
    const gameId = typeof option.dataset.gameId === 'string' ? option.dataset.gameId.trim() : '';
    if (!gameId) {
        return null;
    }
    return { option, gameId };
}

function handleGameSelectorListClick(event) {
    const resolved = resolveGameSelectorOptionFromEvent(event);
    if (!resolved) {
        return;
    }
    if (!setGameSelectorSelection(resolved.gameId)) {
        return;
    }
    const status = document.getElementById('gameSelectorStatus');
    if (status) {
        status.replaceChildren();
    }
    confirmGameSelectorChoice();
}

function handleGameSelectorListKeydown(event) {
    if (!event || (event.key !== 'Enter' && event.key !== ' ')) {
        return;
    }
    const resolved = resolveGameSelectorOptionFromEvent(event);
    if (!resolved) {
        return;
    }
    event.preventDefault();
    if (!setGameSelectorSelection(resolved.gameId)) {
        return;
    }
    const status = document.getElementById('gameSelectorStatus');
    if (status) {
        status.replaceChildren();
    }
    confirmGameSelectorChoice();
}

function normalizeFilterPanels() {
    const troopsFilterBtn = document.getElementById('troopsFilterBtn');
    if (troopsFilterBtn) {
        troopsFilterBtn.classList.remove('active');
    }
    document.querySelectorAll('.filter-dropdown-panel').forEach((panel) => {
        const defaultVal = panel.id === 'troopsFilterPanel' ? '' : 'power-desc';
        panel.querySelectorAll('.filter-option').forEach((opt) => {
            opt.classList.toggle('selected', opt.dataset.value === defaultVal);
        });
    });
}

function resetTransientPlanningState(options) {
    const config = options && typeof options === 'object' ? options : {};
    teamSelections.teamA = [];
    teamSelections.teamB = [];
    assignmentsA = [];
    assignmentsB = [];
    substitutesA = [];
    substitutesB = [];
    closeDownloadModal();

    const searchFilterInput = document.getElementById('searchFilter');
    if (searchFilterInput) {
        searchFilterInput.value = '';
    }
    currentTroopsFilter = '';
    currentSortFilter = 'power-desc';
    normalizeFilterPanels();

    if (config.renderPlayersTable !== false) {
        renderPlayersTable();
    }
    updateTeamCounters();
}

async function applyGameSwitch(gameId, options) {
    const config = options && typeof options === 'object' ? options : {};
    const statusElementId = typeof config.statusElementId === 'string' ? config.statusElementId : '';

    const result = setActiveGame(gameId);
    if (!result || !result.success || !result.gameId) {
        if (statusElementId) {
            showMessage(statusElementId, t('game_selector_invalid'), 'error');
        }
        return false;
    }

    const shouldReload = result.changed === true || config.forceReload === true;
    if (shouldReload) {
        resetTransientPlanningState({ renderPlayersTable: false });
        if (
            typeof FirebaseService !== 'undefined'
            && typeof FirebaseService.loadUserData === 'function'
            && typeof FirebaseService.getCurrentUser === 'function'
            && typeof FirebaseService.isSignedIn === 'function'
            && FirebaseService.isSignedIn()
        ) {
            const activeUser = FirebaseService.getCurrentUser();
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
        if (typeof FirebaseService !== 'undefined' && typeof FirebaseService.loadAllianceData === 'function' && FirebaseService.isSignedIn()) {
            try {
                await FirebaseService.loadAllianceData({ gameId: result.gameId });
                if (currentPageView === 'alliance') {
                    renderAlliancePanel();
                    updateAllianceHeaderDisplay();
                }
            } catch (error) {
                // Ignore transient alliance refresh errors after game switch.
            }
        }
    }

    closeGameSelector(true);
    return true;
}

async function confirmGameSelectorChoice() {
    const selector = document.getElementById('gameSelectorInput');
    if (!selector) {
        return;
    }
    const selectedGameId = typeof selector.value === 'string' ? selector.value.trim() : '';
    if (!selectedGameId) {
        showMessage('gameSelectorStatus', t('game_selector_invalid'), 'error');
        return;
    }
    const switched = await applyGameSwitch(selectedGameId, {
        statusElementId: 'gameSelectorStatus',
        forceReload: true,
    });
    if (switched) {
        postAuthGameSelectionPending = false;
    }
}

function showPostAuthGameSelector() {
    refreshGameSelectorMenuAvailability();
    if (postAuthSelectorShownThisSession) {
        return;
    }
    postAuthSelectorShownThisSession = true;
    const games = listSelectableGames();
    if (!Array.isArray(games) || games.length === 0) {
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

function isPostAuthGameSelectionPending() {
    return postAuthGameSelectionPending === true;
}

function isGameMetadataSuperAdmin(userOrUid) {
    if (typeof FirebaseService !== 'undefined' && typeof FirebaseService.isGameMetadataSuperAdmin === 'function') {
        return FirebaseService.isGameMetadataSuperAdmin(userOrUid);
    }
    if (typeof userOrUid === 'string') {
        return userOrUid.trim() === GAME_METADATA_SUPER_ADMIN_UID;
    }
    const uid = userOrUid && typeof userOrUid === 'object' && typeof userOrUid.uid === 'string'
        ? userOrUid.uid.trim()
        : '';
    return uid === GAME_METADATA_SUPER_ADMIN_UID;
}

function syncGameMetadataMenuAvailability() {
    const navGameMetadataBtn = document.getElementById('navGameMetadataBtn');
    if (!navGameMetadataBtn) {
        return;
    }
    const allowed = isGameMetadataSuperAdmin(currentAuthUser);
    navGameMetadataBtn.classList.toggle('hidden', !allowed);
    navGameMetadataBtn.disabled = !allowed;
    if (!allowed) {
        closeGameMetadataOverlay();
    }
}

function clearGameMetadataForm() {
    const nameInput = document.getElementById('gameMetadataNameInput');
    const companyInput = document.getElementById('gameMetadataCompanyInput');
    if (nameInput) {
        nameInput.value = '';
    }
    if (companyInput) {
        companyInput.value = '';
    }
    const logoInput = document.getElementById('gameMetadataLogoInput');
    if (logoInput) {
        logoInput.value = '';
    }
    gameMetadataDraftLogoDataUrl = '';
    updateGameMetadataLogoPreview();
}

function clearGameMetadataStatus() {
    const status = document.getElementById('gameMetadataStatus');
    if (status) {
        status.replaceChildren();
    }
}

function setGameMetadataFormDisabled(disabled) {
    [
        'gameMetadataSelect',
        'gameMetadataNameInput',
        'gameMetadataLogoUploadBtn',
        'gameMetadataLogoRemoveBtn',
        'gameMetadataLogoInput',
        'gameMetadataCompanyInput',
        'gameMetadataSaveBtn',
    ]
        .forEach((id) => {
            const element = document.getElementById(id);
            if (element) {
                element.disabled = disabled;
            }
        });
}

function normalizeGameMetadataEntry(entry) {
    const source = entry && typeof entry === 'object' ? entry : {};
    const id = typeof source.id === 'string' ? source.id.trim() : '';
    if (!id) {
        return null;
    }
    return {
        id: id,
        name: typeof source.name === 'string' && source.name.trim() ? source.name.trim() : id,
        logo: typeof source.logo === 'string' ? source.logo.trim() : '',
        company: typeof source.company === 'string' ? source.company : '',
    };
}

function resolveGameMetadataDraftName() {
    const nameInput = document.getElementById('gameMetadataNameInput');
    const explicitName = nameInput && typeof nameInput.value === 'string' ? nameInput.value.trim() : '';
    if (explicitName) {
        return explicitName;
    }
    const selectedGameId = resolveSelectedMetadataGameId();
    const selectedGame = selectedGameId ? getSelectableGameById(selectedGameId) : null;
    if (selectedGame && selectedGame.name) {
        return selectedGame.name;
    }
    return selectedGameId || 'Game';
}

function generateGameAvatarDataUrl(nameSeed, idSeed) {
    return generateEventAvatarDataUrl(nameSeed || 'Game', `${idSeed || ''}|game-avatar`);
}

function updateGameMetadataLogoPreview() {
    const previewImage = document.getElementById('gameMetadataLogoPreviewImage');
    const previewInitials = document.getElementById('gameMetadataLogoPreviewInitials');
    if (!previewImage || !previewInitials) {
        return;
    }
    const selectedGameId = resolveSelectedMetadataGameId();
    const seedName = resolveGameMetadataDraftName();
    const fallbackAvatar = generateGameAvatarDataUrl(seedName, selectedGameId || seedName);
    applyAvatar(gameMetadataDraftLogoDataUrl || fallbackAvatar, previewImage, previewInitials, getAvatarInitials(seedName, 'G'));
}

function renderGameMetadataSelect(games, preferredGameId) {
    const select = document.getElementById('gameMetadataSelect');
    if (!select) {
        return '';
    }
    select.replaceChildren();
    const normalizedGames = Array.isArray(games) ? games.map(normalizeGameMetadataEntry).filter(Boolean) : [];
    normalizedGames.forEach((game) => {
        const option = document.createElement('option');
        option.value = game.id;
        option.textContent = game.name;
        select.appendChild(option);
    });

    const preferred = typeof preferredGameId === 'string' ? preferredGameId.trim() : '';
    if (preferred && normalizedGames.some((game) => game.id === preferred)) {
        select.value = preferred;
    } else if (normalizedGames.length > 0) {
        select.value = normalizedGames[0].id;
    } else {
        select.value = '';
    }
    return select.value;
}

async function reloadGameMetadataCatalog(preferredGameId) {
    const preferred = typeof preferredGameId === 'string' ? preferredGameId.trim() : '';
    await refreshGameMetadataCatalogCache({ silent: true, preferredGameId: preferred });
    return renderGameMetadataSelect(gameMetadataCatalogCache, preferred);
}

async function refreshGameMetadataCatalogCache(options) {
    if (typeof FirebaseService === 'undefined' || typeof FirebaseService.listGameMetadata !== 'function') {
        return gameMetadataCatalogCache;
    }
    const config = options && typeof options === 'object' ? options : {};
    const silent = config.silent === true;
    const preferredGameId = typeof config.preferredGameId === 'string' ? config.preferredGameId.trim() : '';
    try {
        const games = await FirebaseService.listGameMetadata();
        gameMetadataCatalogCache = Array.isArray(games) ? games.map(normalizeGameMetadataEntry).filter(Boolean) : [];
        const activeGameId = preferredGameId || getActiveGame() || '';
        updateActiveGameBadge(activeGameId);
        refreshGameSelectorMenuAvailability();
        return gameMetadataCatalogCache;
    } catch (error) {
        if (!silent) {
            console.warn('Failed to refresh game metadata catalog cache:', error);
        }
        return gameMetadataCatalogCache;
    }
}

function fillGameMetadataForm(game) {
    const metadata = normalizeGameMetadataEntry(game);
    if (!metadata) {
        clearGameMetadataForm();
        return;
    }
    const nameInput = document.getElementById('gameMetadataNameInput');
    const companyInput = document.getElementById('gameMetadataCompanyInput');
    if (nameInput) {
        nameInput.value = metadata.name || '';
    }
    if (companyInput) {
        companyInput.value = metadata.company || '';
    }
    const logoInput = document.getElementById('gameMetadataLogoInput');
    if (logoInput) {
        logoInput.value = '';
    }
    gameMetadataDraftLogoDataUrl = metadata.logo || '';
    updateGameMetadataLogoPreview();
}

function resolveSelectedMetadataGameId() {
    const select = document.getElementById('gameMetadataSelect');
    if (!select || typeof select.value !== 'string') {
        return '';
    }
    return select.value.trim();
}

function formatGameMetadataError(errorOrResult) {
    if (errorOrResult && typeof errorOrResult === 'object') {
        if (errorOrResult.errorKey) {
            return t(errorOrResult.errorKey, errorOrResult.errorParams || {});
        }
        if (typeof errorOrResult.error === 'string' && errorOrResult.error.trim()) {
            return errorOrResult.error;
        }
        if (typeof errorOrResult.message === 'string' && errorOrResult.message.trim()) {
            return errorOrResult.message;
        }
    }
    return String(errorOrResult || 'unknown');
}

async function loadGameMetadataForSelection(gameId) {
    const normalizedGameId = typeof gameId === 'string' ? gameId.trim() : '';
    if (!normalizedGameId) {
        clearGameMetadataForm();
        return;
    }
    setGameMetadataFormDisabled(true);
    try {
        let metadata = null;
        if (typeof FirebaseService !== 'undefined' && typeof FirebaseService.getGameMetadata === 'function') {
            metadata = await FirebaseService.getGameMetadata(normalizedGameId);
        }
        if (!metadata) {
            metadata = gameMetadataCatalogCache.find((game) => game && game.id === normalizedGameId) || null;
        }
        if (!metadata) {
            showMessage('gameMetadataStatus', t('game_metadata_unknown_game'), 'error');
            clearGameMetadataForm();
            return;
        }
        fillGameMetadataForm(metadata);
    } catch (error) {
        showMessage('gameMetadataStatus', t('game_metadata_load_failed', { error: formatGameMetadataError(error) }), 'error');
        clearGameMetadataForm();
    } finally {
        setGameMetadataFormDisabled(false);
    }
}

async function openGameMetadataOverlay() {
    closeNavigationMenu();
    if (!isGameMetadataSuperAdmin(currentAuthUser)) {
        alert(t('game_metadata_forbidden'));
        return;
    }
    const overlay = document.getElementById('gameMetadataOverlay');
    if (!overlay) {
        return;
    }
    overlay.classList.remove('hidden');
    clearGameMetadataStatus();
    clearGameMetadataForm();

    try {
        showMessage('gameMetadataStatus', t('message_upload_processing'), 'processing');
        const preferredGameId = getActiveGame() || ensureActiveGameContext() || '';
        const selectedGameId = await reloadGameMetadataCatalog(preferredGameId);
        clearGameMetadataStatus();
        if (!selectedGameId) {
            showMessage('gameMetadataStatus', t('game_selector_no_games'), 'warning');
            return;
        }
        await loadGameMetadataForSelection(selectedGameId);
    } catch (error) {
        showMessage('gameMetadataStatus', t('game_metadata_load_failed', { error: formatGameMetadataError(error) }), 'error');
    }
}

function closeGameMetadataOverlay() {
    const overlay = document.getElementById('gameMetadataOverlay');
    if (!overlay) {
        return;
    }
    overlay.classList.add('hidden');
    clearGameMetadataStatus();
}

function handleGameMetadataOverlayClick(event) {
    if (event && event.target && event.target.id === 'gameMetadataOverlay') {
        closeGameMetadataOverlay();
    }
}

async function handleGameMetadataSelectionChange() {
    clearGameMetadataStatus();
    const selectedGameId = resolveSelectedMetadataGameId();
    await loadGameMetadataForSelection(selectedGameId);
}

function triggerGameMetadataLogoUpload() {
    const input = document.getElementById('gameMetadataLogoInput');
    if (input) {
        input.click();
    }
}

function removeGameMetadataLogo() {
    gameMetadataDraftLogoDataUrl = '';
    const input = document.getElementById('gameMetadataLogoInput');
    if (input) {
        input.value = '';
    }
    updateGameMetadataLogoPreview();
}

async function handleGameMetadataLogoChange(event) {
    const input = event && event.target ? event.target : document.getElementById('gameMetadataLogoInput');
    const file = input && input.files ? input.files[0] : null;
    if (!file) {
        return;
    }
    try {
        gameMetadataDraftLogoDataUrl = await createGameMetadataLogoDataUrl(file);
        updateGameMetadataLogoPreview();
    } catch (error) {
        showMessage('gameMetadataStatus', error.message || t('events_manager_image_process_failed'), 'error');
    } finally {
        if (input) {
            input.value = '';
        }
    }
}

async function saveGameMetadata() {
    if (typeof FirebaseService === 'undefined' || typeof FirebaseService.setGameMetadata !== 'function') {
        showMessage('gameMetadataStatus', t('error_firebase_not_loaded'), 'error');
        return;
    }
    if (!isGameMetadataSuperAdmin(currentAuthUser)) {
        showMessage('gameMetadataStatus', t('game_metadata_forbidden'), 'error');
        return;
    }
    const selectedGameId = resolveSelectedMetadataGameId();
    if (!selectedGameId) {
        showMessage('gameMetadataStatus', t('game_metadata_unknown_game'), 'error');
        return;
    }
    const nameInput = document.getElementById('gameMetadataNameInput');
    const companyInput = document.getElementById('gameMetadataCompanyInput');
    const nameValue = nameInput && typeof nameInput.value === 'string' ? nameInput.value.trim() : '';
    const resolvedLogoDataUrl = gameMetadataDraftLogoDataUrl || generateGameAvatarDataUrl(nameValue || selectedGameId, selectedGameId);

    const payload = {
        name: nameValue,
        logo: resolvedLogoDataUrl,
        company: companyInput && typeof companyInput.value === 'string' ? companyInput.value.trim() : '',
    };

    setGameMetadataFormDisabled(true);
    showMessage('gameMetadataStatus', t('message_upload_processing'), 'processing');
    try {
        const result = await FirebaseService.setGameMetadata(selectedGameId, payload);
        if (!result || !result.success) {
            showMessage('gameMetadataStatus', formatGameMetadataError(result), 'error');
            return;
        }

        await reloadGameMetadataCatalog(selectedGameId);
        await loadGameMetadataForSelection(selectedGameId);
        showMessage('gameMetadataStatus', t('game_metadata_saved'), 'success');
        updateActiveGameBadge();
    } catch (error) {
        showMessage('gameMetadataStatus', formatGameMetadataError(error), 'error');
    } finally {
        setGameMetadataFormDisabled(false);
    }
}

window.setActiveGame = setActiveGame;
window.getActiveGame = getActiveGame;
window.updateActiveGameBadge = updateActiveGameBadge;
window.refreshGameMetadataCatalogCache = refreshGameMetadataCatalogCache;
window.showPostAuthGameSelector = showPostAuthGameSelector;
window.resetPostAuthGameSelectorState = resetPostAuthGameSelectorState;
window.isPostAuthGameSelectionPending = isPostAuthGameSelectionPending;

// ============================================================
// ONBOARDING TOUR
// ============================================================
const ONBOARDING_STEPS = [
    { titleKey: 'onboarding_step1_title', descKey: 'onboarding_step1_desc', targetSelector: '#navMenuBtn',           position: 'bottom' },
    { titleKey: 'onboarding_step2_title', descKey: 'onboarding_step2_desc', targetSelector: '#navPlayersBtn',        position: 'bottom' },
    { titleKey: 'onboarding_step3_title', descKey: 'onboarding_step3_desc', targetSelector: '#downloadTemplateBtn',  position: 'bottom' },
    { titleKey: 'onboarding_step4_title', descKey: 'onboarding_step4_desc', targetSelector: '#uploadPlayerBtn',      position: 'bottom' },
    { titleKey: 'onboarding_step5_title', descKey: 'onboarding_step5_desc', targetSelector: '#playersMgmtAddPanelHeader', position: 'bottom' },
    { titleKey: 'onboarding_step6_title', descKey: 'onboarding_step6_desc', targetSelector: '#navConfigBtn',         position: 'bottom' },
    { titleKey: 'onboarding_step7_title', descKey: 'onboarding_step7_desc', targetSelector: '#eventsList',           position: 'top'    },
    { titleKey: 'onboarding_step8_title', descKey: 'onboarding_step8_desc', targetSelector: '#mapCoordinatesBtn',    position: 'top'    },
    { titleKey: 'onboarding_step9_title', descKey: 'onboarding_step9_desc', targetSelector: '#navGeneratorBtn',      position: 'bottom' },
    { titleKey: 'onboarding_step10_title', descKey: 'onboarding_step10_desc', targetSelector: '#navAllianceBtn',     position: 'bottom' },
    { titleKey: 'onboarding_step11_title', descKey: 'onboarding_step11_desc', targetSelector: '#alliancePage',       position: 'top'    }
];

let onboardingActive      = false;
let currentOnboardingStep = 0;
let pendingOnboardingStep = null;
let currentHighlightTarget = null;

function initOnboarding() {
    try {
        if (localStorage.getItem('ds_onboarding_done')) return;
    } catch (e) { return; }
    onboardingActive = true;
    currentOnboardingStep = 0;
    showOnboardingStep(0);
}

function showOnboardingStep(index) {
    if (index >= ONBOARDING_STEPS.length) {
        completeOnboarding();
        return;
    }
    const step   = ONBOARDING_STEPS[index];
    if (
        step.targetSelector === '#navPlayersBtn' ||
        step.targetSelector === '#navConfigBtn' ||
        step.targetSelector === '#navGeneratorBtn' ||
        step.targetSelector === '#navAllianceBtn'
    ) {
        openNavigationMenu();
    }
    const target = document.querySelector(step.targetSelector);

    // Target not in DOM or hidden — defer until it appears
    if (!target || target.closest('.hidden') || getComputedStyle(target).display === 'none') {
        pendingOnboardingStep = index;
        return;
    }
    pendingOnboardingStep = null;
    currentOnboardingStep = index;

    // Remove previous highlight
    if (currentHighlightTarget) {
        currentHighlightTarget.classList.remove('onboarding-highlight');
    }
    currentHighlightTarget = target;
    target.classList.add('onboarding-highlight');

    // Populate tooltip text
    document.getElementById('onboardingStepLabel').textContent = t('onboarding_step', { current: index + 1, total: ONBOARDING_STEPS.length });
    document.getElementById('onboardingTitle').textContent      = t(step.titleKey);
    document.getElementById('onboardingDesc').textContent       = t(step.descKey);
    document.getElementById('onboardingSkip').textContent       = t('onboarding_skip');

    // Show and position
    const tooltip = document.getElementById('onboardingTooltip');
    tooltip.classList.remove('hidden');
    positionOnboardingTooltip();
}

function positionOnboardingTooltip() {
    const tooltip = document.getElementById('onboardingTooltip');
    if (!tooltip || tooltip.classList.contains('hidden')) return;

    const step   = ONBOARDING_STEPS[currentOnboardingStep];
    const target = document.querySelector(step.targetSelector);
    if (!target) return;

    const rect    = target.getBoundingClientRect();
    const tWidth  = tooltip.offsetWidth  || 280;
    const tHeight = tooltip.offsetHeight || 160;
    const vw      = window.innerWidth;
    const vh      = window.innerHeight;
    const gap     = 10;

    let place = step.position; // preferred: 'top' or 'bottom'

    // Flip if not enough room
    if (place === 'bottom' && rect.bottom + gap + tHeight > vh) place = 'top';
    if (place === 'top'    && rect.top    - gap - tHeight < 0)  place = 'bottom';

    let top, arrowOffset;
    if (place === 'bottom') {
        top = rect.bottom + gap;
        tooltip.setAttribute('data-arrow', 'top');
    } else {
        top = rect.top - gap - tHeight;
        tooltip.setAttribute('data-arrow', 'bottom');
    }

    // Horizontal: centre on target, clamp to viewport
    let left = rect.left + rect.width / 2 - tWidth / 2;
    left = Math.max(8, Math.min(left, vw - tWidth - 8));

    // Arrow horizontal offset (relative to tooltip left edge)
    arrowOffset = (rect.left + rect.width / 2) - left - 7; // 7 = half arrow width
    arrowOffset = Math.max(12, Math.min(arrowOffset, tWidth - 26));

    tooltip.style.top  = top  + 'px';
    tooltip.style.left = left + 'px';
    tooltip.style.setProperty('--arrow-offset', arrowOffset + 'px');
}

function dismissOnboardingStep() {
    if (!onboardingActive) return;
    // Remove highlight
    if (currentHighlightTarget) {
        currentHighlightTarget.classList.remove('onboarding-highlight');
        currentHighlightTarget = null;
    }
    // Hide tooltip
    document.getElementById('onboardingTooltip').classList.add('hidden');

    const next = currentOnboardingStep + 1;
    if (next >= ONBOARDING_STEPS.length) {
        completeOnboarding();
    } else {
        showOnboardingStep(next);
    }
}

function completeOnboarding() {
    onboardingActive = false;
    if (currentHighlightTarget) {
        currentHighlightTarget.classList.remove('onboarding-highlight');
        currentHighlightTarget = null;
    }
    document.getElementById('onboardingTooltip').classList.add('hidden');
    try { localStorage.setItem('ds_onboarding_done', 'true'); } catch (e) { /* ignore */ }
}

function updateOnboardingTooltip() {
    if (!onboardingActive) return;
    const step = ONBOARDING_STEPS[currentOnboardingStep];
    document.getElementById('onboardingStepLabel').textContent = t('onboarding_step', { current: currentOnboardingStep + 1, total: ONBOARDING_STEPS.length });
    document.getElementById('onboardingTitle').textContent      = t(step.titleKey);
    document.getElementById('onboardingDesc').textContent       = t(step.descKey);
    document.getElementById('onboardingSkip').textContent       = t('onboarding_skip');
}

// Keep tooltip pinned to target on scroll / resize
['scroll', 'resize'].forEach(ev =>
    window.addEventListener(ev, () => { if (onboardingActive) positionOnboardingTooltip(); }, { passive: true })
);

function bindStaticUiActions() {
    const on = (id, eventName, handler) => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener(eventName, handler);
        }
    };

    on('googleSignInBtn', 'click', handleGoogleSignIn);
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', (event) => {
            event.preventDefault();
            handleEmailSignIn();
        });
    }
    on('showSignUpBtn', 'click', showSignUpForm);
    on('passwordResetBtn', 'click', handlePasswordReset);

    on('navMenuBtn', 'click', toggleNavigationMenu);
    on('navGeneratorBtn', 'click', showGeneratorPage);
    on('navConfigBtn', 'click', showConfigurationPage);
    on('navPlayersBtn', 'click', showPlayersManagementPage);
    on('navAllianceBtn', 'click', showAlliancePage);
    on('mobileNavGeneratorBtn', 'click', showGeneratorPage);
    on('mobileNavConfigBtn', 'click', showConfigurationPage);
    on('mobileNavPlayersBtn', 'click', showPlayersManagementPage);
    on('mobileNavAllianceBtn', 'click', showAlliancePage);
    on('navGameMetadataBtn', 'click', openGameMetadataOverlay);
    on('navSettingsBtn', 'click', openSettingsModal);
    on('navSwitchGameBtn', 'click', () => {
        openGameSelector({ requireChoice: false });
    });
    on('navSignOutBtn', 'click', () => {
        closeNavigationMenu();
        handleSignOut();
    });
    on('headerProfileBtn', 'click', openSettingsModal);
    on('allianceDisplay', 'click', () => {
        const controller = getAllianceFeatureController();
        if (controller && typeof controller.openPanel === 'function') {
            controller.openPanel();
            return;
        }
        showAlliancePage();
    });
    on('allianceCreateBtn', 'click', () => {
        const controller = getAllianceFeatureController();
        if (controller && typeof controller.openPanel === 'function') {
            controller.openPanel();
            return;
        }
        showAlliancePage();
    });
    on('notificationBtn', 'click', () => {
        const controller = getNotificationsFeatureController();
        if (controller && typeof controller.togglePanel === 'function') {
            controller.togglePanel();
            return;
        }
        toggleNotificationsPanel();
    });
    on('notificationsPanelCloseBtn', 'click', () => {
        const controller = getNotificationsFeatureController();
        if (controller && typeof controller.togglePanel === 'function') {
            controller.togglePanel();
            return;
        }
        toggleNotificationsPanel();
    });

    on('settingsModal', 'click', handleModalOverlayDismissClick);
    on('settingsModalCloseBtn', 'click', closeSettingsModal);
    on('settingsAvatarUploadBtn', 'click', triggerSettingsAvatarUpload);
    on('settingsAvatarRemoveBtn', 'click', removeSettingsAvatar);
    on('settingsAvatarInput', 'change', handleSettingsAvatarChange);
    on('settingsDeleteBtn', 'click', deleteAccountFromSettings);
    on('settingsCancelBtn', 'click', closeSettingsModal);
    on('settingsSaveBtn', 'click', saveSettings);
    on('gameSelectorOverlay', 'click', handleGameSelectorOverlayClick);
    on('gameSelectorCancelBtn', 'click', () => closeGameSelector(false));
    on('gameSelectorConfirmBtn', 'click', confirmGameSelectorChoice);
    on('gameSelectorList', 'click', handleGameSelectorListClick);
    on('gameSelectorList', 'keydown', handleGameSelectorListKeydown);
    on('gameSelectorInput', 'change', () => {
        const status = document.getElementById('gameSelectorStatus');
        if (status) {
            status.replaceChildren();
        }
        setGameSelectorSelection(document.getElementById('gameSelectorInput').value);
    });
    on('gameMetadataOverlay', 'click', handleGameMetadataOverlayClick);
    on('gameMetadataCloseBtn', 'click', () => closeGameMetadataOverlay());
    on('gameMetadataSelect', 'change', handleGameMetadataSelectionChange);
    on('gameMetadataNameInput', 'input', updateGameMetadataLogoPreview);
    on('gameMetadataLogoUploadBtn', 'click', triggerGameMetadataLogoUpload);
    on('gameMetadataLogoRemoveBtn', 'click', removeGameMetadataLogo);
    on('gameMetadataLogoInput', 'change', handleGameMetadataLogoChange);
    on('gameMetadataSaveBtn', 'click', saveGameMetadata);

    on('uploadPersonalBtn', 'click', uploadToPersonal);
    on('uploadAllianceBtn', 'click', uploadToAlliance);
    on('uploadBothBtn', 'click', uploadToBoth);
    on('uploadTargetModal', 'click', handleModalOverlayDismissClick);
    on('uploadTargetCloseBtn', 'click', closeUploadTargetModal);
    on('selectionSourcePersonalBtn', 'click', () => switchPlayerSource('personal', 'selectionSourceStatus'));
    on('selectionSourceAllianceBtn', 'click', () => switchPlayerSource('alliance', 'selectionSourceStatus'));

    on('coordPickerOverlay', 'click', handleModalOverlayDismissClick);
    on('coordCloseBtn', 'click', closeCoordinatesPicker);
    on('coordPrevBtn', 'click', prevCoordBuilding);
    on('coordNextBtn', 'click', nextCoordBuilding);
    on('coordSaveBtn', 'click', saveBuildingPositions);

    on('searchFilter', 'input', filterPlayers);
    on('clearAllBtn', 'click', () => {
        const controller = getGeneratorFeatureController();
        if (controller && typeof controller.clearAllSelections === 'function') {
            controller.clearAllSelections();
            return;
        }
        clearAllSelections();
    });
    on('uploadPanelHeader', 'click', toggleUploadPanel);
    on('playersListPanelHeader', 'click', togglePlayersListPanel);
    on('playersMgmtAddPanelHeader', 'click', () => togglePlayersManagementAddPanel());
    on('playersMgmtSourcePersonalBtn', 'click', () => {
        const controller = getPlayersManagementFeatureController();
        if (controller && typeof controller.switchSource === 'function') {
            controller.switchSource('personal');
            return;
        }
        switchPlayersManagementSource('personal');
    });
    on('playersMgmtSourceAllianceBtn', 'click', () => {
        const controller = getPlayersManagementFeatureController();
        if (controller && typeof controller.switchSource === 'function') {
            controller.switchSource('alliance');
            return;
        }
        switchPlayersManagementSource('alliance');
    });
    const playersMgmtAddForm = document.getElementById('playersMgmtAddForm');
    if (playersMgmtAddForm) {
        playersMgmtAddForm.addEventListener('submit', (event) => {
            const controller = getPlayersManagementFeatureController();
            if (controller && typeof controller.submitAddPlayer === 'function') {
                controller.submitAddPlayer(event);
                return;
            }
            event.preventDefault();
            handlePlayersManagementAddPlayer();
        });
    }
    on('playersMgmtSearchFilter', 'input', (event) => {
        const controller = getPlayersManagementFeatureController();
        if (controller && typeof controller.handleFilterChange === 'function') {
            controller.handleFilterChange(event);
            return;
        }
        handlePlayersManagementFilterChange(event);
    });
    on('playersMgmtTroopsFilter', 'change', (event) => {
        const controller = getPlayersManagementFeatureController();
        if (controller && typeof controller.handleFilterChange === 'function') {
            controller.handleFilterChange(event);
            return;
        }
        handlePlayersManagementFilterChange(event);
    });
    on('playersMgmtSortFilter', 'change', (event) => {
        const controller = getPlayersManagementFeatureController();
        if (controller && typeof controller.handleFilterChange === 'function') {
            controller.handleFilterChange(event);
            return;
        }
        handlePlayersManagementFilterChange(event);
    });
    on('playersMgmtClearFiltersBtn', 'click', () => {
        const controller = getPlayersManagementFeatureController();
        if (controller && typeof controller.clearFilters === 'function') {
            controller.clearFilters();
            return;
        }
        clearPlayersManagementFilters();
    });
    on('assignmentAlgorithmBalanced', 'change', (event) => {
        const controller = getGeneratorFeatureController();
        if (controller && typeof controller.changeAlgorithm === 'function') {
            controller.changeAlgorithm(event);
            return;
        }
        handleAssignmentAlgorithmChange(event);
    });
    on('assignmentAlgorithmAggressive', 'change', (event) => {
        const controller = getGeneratorFeatureController();
        if (controller && typeof controller.changeAlgorithm === 'function') {
            controller.changeAlgorithm(event);
            return;
        }
        handleAssignmentAlgorithmChange(event);
    });
    on('assignmentAlgorithmSelect', 'change', (event) => {
        const controller = getGeneratorFeatureController();
        if (controller && typeof controller.changeAlgorithm === 'function') {
            controller.changeAlgorithm(event);
            return;
        }
        handleAssignmentAlgorithmChange(event);
    });
    on('downloadTemplateBtn', 'click', downloadPlayerTemplate);
    on('uploadPlayerBtn', 'click', () => {
        const input = document.getElementById('playerFileInput');
        if (input) input.click();
    });
    on('playerFileInput', 'change', uploadPlayerData);

    on('eventsPanelHeader', 'click', () => {
        const controller = getEventsManagerFeatureController();
        if (controller && typeof controller.toggleEventsPanel === 'function') {
            controller.toggleEventsPanel();
            return;
        }
        toggleEventsPanel();
    });
    on('eventEditModeBtn', 'click', () => {
        const controller = getEventsManagerFeatureController();
        if (controller && typeof controller.enterEditMode === 'function') {
            controller.enterEditMode();
            return;
        }
        enterEventEditMode();
    });
    on('eventLogoUploadBtn', 'click', () => {
        const controller = getEventsManagerFeatureController();
        if (controller && typeof controller.triggerLogoUpload === 'function') {
            controller.triggerLogoUpload();
            return;
        }
        triggerEventLogoUpload();
    });
    on('eventLogoRandomBtn', 'click', () => {
        const controller = getEventsManagerFeatureController();
        if (controller && typeof controller.removeLogo === 'function') {
            controller.removeLogo();
            return;
        }
        removeEventLogo();
    });
    on('eventLogoInput', 'change', (event) => {
        const controller = getEventsManagerFeatureController();
        if (controller && typeof controller.handleLogoChange === 'function') {
            controller.handleLogoChange(event);
            return;
        }
        handleEventLogoChange(event);
    });
    on('eventMapUploadBtn', 'click', () => {
        const controller = getEventsManagerFeatureController();
        if (controller && typeof controller.triggerMapUpload === 'function') {
            controller.triggerMapUpload();
            return;
        }
        triggerEventMapUpload();
    });
    on('eventMapRemoveBtn', 'click', () => {
        const controller = getEventsManagerFeatureController();
        if (controller && typeof controller.removeMap === 'function') {
            controller.removeMap();
            return;
        }
        removeEventMap();
    });
    on('eventMapInput', 'change', (event) => {
        const controller = getEventsManagerFeatureController();
        if (controller && typeof controller.handleMapChange === 'function') {
            controller.handleMapChange(event);
            return;
        }
        handleEventMapChange(event);
    });
    on('eventAddBuildingBtn', 'click', () => {
        const controller = getEventsManagerFeatureController();
        if (controller && typeof controller.addBuildingRow === 'function') {
            controller.addBuildingRow();
            return;
        }
        addEventBuildingRow();
    });
    on('eventSaveBtn', 'click', () => {
        const controller = getEventsManagerFeatureController();
        if (controller && typeof controller.saveEvent === 'function') {
            controller.saveEvent();
            return;
        }
        saveEventDefinition();
    });
    on('eventCancelEditBtn', 'click', () => {
        const controller = getEventsManagerFeatureController();
        if (controller && typeof controller.cancelEdit === 'function') {
            controller.cancelEdit();
            return;
        }
        cancelEventEditing();
    });
    on('eventDeleteBtn', 'click', () => {
        const controller = getEventsManagerFeatureController();
        if (controller && typeof controller.deleteEvent === 'function') {
            controller.deleteEvent();
            return;
        }
        deleteSelectedEvent();
    });

    on('mapCoordinatesBtn', 'click', () => {
        const controller = getEventsManagerFeatureController();
        if (controller && typeof controller.openCoordinatesPicker === 'function') {
            controller.openCoordinatesPicker();
            return;
        }
        openCoordinatesPickerFromEditor();
    });
    on('downloadModalOverlay', 'click', handleModalOverlayDismissClick);
    on('downloadModalCloseBtn', 'click', closeDownloadModal);
    on('generateBtnA', 'click', () => {
        const controller = getGeneratorFeatureController();
        if (controller && typeof controller.generateAssignments === 'function') {
            controller.generateAssignments('A');
            return;
        }
        generateTeamAssignments('A');
    });
    on('generateBtnB', 'click', () => {
        const controller = getGeneratorFeatureController();
        if (controller && typeof controller.generateAssignments === 'function') {
            controller.generateAssignments('B');
            return;
        }
        generateTeamAssignments('B');
    });
    on('supportCopyDiscordBtn', 'click', copySupportDiscordHandle);
    on('supportOpenDiscordBtn', 'click', openSupportDiscordProfile);
    on('supportReportBugBtn', 'click', () => openSupportIssueComposer('bug'));
    on('supportRequestFeatureBtn', 'click', () => openSupportIssueComposer('feature'));

    syncAssignmentAlgorithmControl();
    updateClearAllButtonVisibility();
}

// ── Dismiss event wiring (runs once DOM is ready) ──
let appUiRuntimeInitialized = false;

function initializeApplicationUiRuntime() {
    if (appUiRuntimeInitialized) {
        return;
    }
    appUiRuntimeInitialized = true;

    bindStaticUiActions();

    // Advance onboarding when the user interacts with the active target.
    document.addEventListener('click', (event) => {
        if (!onboardingActive) return;
        const step = ONBOARDING_STEPS[currentOnboardingStep];
        if (!step) return;
        const target = document.querySelector(step.targetSelector);
        if (!target) return;
        if (target.contains(event.target)) {
            dismissOnboardingStep();
        }
    });
    // Skip link
    document.getElementById('onboardingSkip').addEventListener('click', completeOnboarding);

    const settingsDisplayNameInput = document.getElementById('settingsDisplayNameInput');
    if (settingsDisplayNameInput) {
        settingsDisplayNameInput.addEventListener('input', updateSettingsAvatarPreview);
    }
    const settingsNicknameInput = document.getElementById('settingsNicknameInput');
    if (settingsNicknameInput) {
        settingsNicknameInput.addEventListener('input', updateSettingsAvatarPreview);
    }

    // Pointer-first canvas interaction improves mobile precision.
    const coordCanvas = document.getElementById('coordCanvas');
    if (coordCanvas) {
        coordCanvas.style.touchAction = 'none';
        coordCanvas.addEventListener('pointerdown', coordCanvasClick, { passive: false });
    }

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeNavigationMenu();
            closeSettingsModal();
            closeGameSelector(false);
        }
    });

    bindEventEditorTableActions();
    const eventNameInput = document.getElementById('eventNameInput');
    if (eventNameInput) {
        eventNameInput.addEventListener('input', () => {
            if (!eventDraftLogoDataUrl) {
                updateEventLogoPreview();
            }
        });
    }
    buildRegistryFromStorage();
    renderAllEventSelectors();
    renderEventsList();
    startNewEventDraft();
    switchEvent(currentEvent);
    updateUserHeaderIdentity(currentAuthUser);
    ensureActiveGameContext();
    updateActiveGameBadge();
    refreshGameSelectorMenuAvailability();
    if (typeof refreshGameMetadataCatalogCache === 'function') {
        refreshGameMetadataCatalogCache({ silent: true }).catch(() => {});
    }
}

// ============================================================
// INITIALIZATION CHECK
// ============================================================

const XLSX_SCRIPT_SRC = 'vendor/xlsx.full.min.js';
let xlsxLoadPromise = null;

function loadScriptOnce(src, markerName) {
    if (markerName && typeof window[markerName] !== 'undefined') {
        return Promise.resolve(true);
    }
    const existingScript = document.querySelector(`script[data-src="${src}"]`);
    if (existingScript) {
        return new Promise((resolve, reject) => {
            existingScript.addEventListener('load', () => resolve(true), { once: true });
            existingScript.addEventListener('error', () => reject(new Error(`Failed loading ${src}`)), { once: true });
        });
    }
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.defer = true;
        script.async = false;
        script.dataset.src = src;
        script.onload = () => resolve(true);
        script.onerror = () => reject(new Error(`Failed loading ${src}`));
        document.head.appendChild(script);
    });
}

async function ensureXLSXLoaded() {
    if (typeof XLSX !== 'undefined') {
        return true;
    }
    if (!xlsxLoadPromise) {
        xlsxLoadPromise = loadScriptOnce(XLSX_SCRIPT_SRC, 'XLSX').catch((error) => {
            xlsxLoadPromise = null;
            throw error;
        });
    }
    await xlsxLoadPromise;
    return true;
}

// Check if Firebase modules are loaded
if (typeof firebase === 'undefined') {
    alert(t('error_firebase_sdk_missing'));
    console.error('Firebase SDK failed to load from CDN');
}

if (typeof FirebaseService === 'undefined') {
    alert(t('error_firebase_module_missing'));
    console.error('FirebaseService not defined - firebase-module.js not loaded');
}

// ============================================================
// GLOBAL STATE
// ============================================================

let allPlayers = [];
let teamSelections = {
    teamA: [],  // Array of { name: string, role: 'starter'|'substitute' }
    teamB: []
};
let assignmentsA = [];
let assignmentsB = [];
let substitutesA = [];
let substitutesB = [];
let currentAuthUser = null;
let settingsDraftAvatarDataUrl = '';
let settingsDraftTheme = 'standard';

const PROFILE_TEXT_LIMIT = 60;
const PROFILE_AVATAR_DATA_URL_LIMIT = 400000;
const AVATAR_ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const AVATAR_ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const AVATAR_MIN_DIMENSION = 96;
const AVATAR_MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
const EVENT_NAME_LIMIT = 30;
const EVENT_LOGO_DATA_URL_LIMIT = 220000;
const EVENT_MAP_DATA_URL_LIMIT = 950000;
const DELETE_ACCOUNT_CONFIRM_WORD = 'delete';
const THEME_STORAGE_KEY = 'ds_theme';
const THEME_STANDARD = 'standard';
const THEME_LAST_WAR = 'last-war';
const SUPPORTED_THEMES = new Set([THEME_STANDARD, THEME_LAST_WAR]);
const SUPPORT_DISCORD_HANDLE = 'flashguru2000';
const SUPPORT_DISCORD_URL = 'https://discord.com/users/1239126582388592667';
const SUPPORT_REPO_ISSUES_NEW_URL = 'https://github.com/CristianConsta/events-team-generator/issues/new';
const ASSIGNMENT_ALGO_BALANCED = 'balanced';
const ASSIGNMENT_ALGO_AGGRESSIVE = 'aggressive';
const ASSIGNMENT_ALGO_DEFAULT = ASSIGNMENT_ALGO_BALANCED;
const PLAYERS_MANAGEMENT_DEFAULT_SORT = 'power-desc';
const GAME_METADATA_SUPER_ADMIN_UID = '2z2BdO8aVsUovqQWWL9WCRMdV933';
let currentAssignmentAlgorithm = ASSIGNMENT_ALGO_DEFAULT;
let currentPageView = 'generator';
let currentEvent = 'desert_storm';
let eventEditorCurrentId = '';
let eventDraftLogoDataUrl = '';
let eventDraftMapDataUrl = '';
let eventDraftMapRemoved = false;
let eventEditorIsEditMode = false;
let gameMetadataCatalogCache = [];
let gameMetadataDraftLogoDataUrl = '';
const appStateStore = (
    window.DSAppStateStore
    && typeof window.DSAppStateStore.createDefaultStore === 'function'
)
    ? window.DSAppStateStore.createDefaultStore({
        navigation: {
            currentView: currentPageView,
        },
        generator: {
            assignmentAlgorithm: currentAssignmentAlgorithm,
            teamSelections: teamSelections,
        },
        playersManagement: {
            filters: {
                searchTerm: '',
                troopsFilter: '',
                sortFilter: PLAYERS_MANAGEMENT_DEFAULT_SORT,
            },
        },
    })
    : null;
const appStateContract = (
    window.DSStateStoreContract
    && typeof window.DSStateStoreContract.createStateStoreContract === 'function'
    && appStateStore
)
    ? window.DSStateStoreContract.createStateStoreContract(appStateStore)
    : null;

function getAppRuntimeState() {
    if (appStateContract && typeof appStateContract.getState === 'function') {
        return appStateContract.getState();
    }
    return {
        navigation: { currentView: currentPageView },
        generator: {
            assignmentAlgorithm: currentAssignmentAlgorithm,
            teamSelections: teamSelections,
        },
        playersManagement: {
            filters: {
                searchTerm: '',
                troopsFilter: '',
                sortFilter: PLAYERS_MANAGEMENT_DEFAULT_SORT,
            },
        },
    };
}

function setAppRuntimeState(patch) {
    if (appStateContract && typeof appStateContract.setState === 'function') {
        appStateContract.setState(patch);
    }
}

function getCurrentPageViewState() {
    if (
        window.DSAppStateStore
        && window.DSAppStateStore.selectors
        && typeof window.DSAppStateStore.selectors.selectNavigationView === 'function'
    ) {
        return window.DSAppStateStore.selectors.selectNavigationView(getAppRuntimeState());
    }
    return currentPageView;
}

function setCurrentPageViewState(nextView) {
    currentPageView = nextView;
    setAppRuntimeState({
        navigation: {
            currentView: nextView,
        },
    });
}

function getCurrentAssignmentAlgorithmState() {
    if (
        window.DSAppStateStore
        && window.DSAppStateStore.selectors
        && typeof window.DSAppStateStore.selectors.selectAssignmentAlgorithm === 'function'
    ) {
        return window.DSAppStateStore.selectors.selectAssignmentAlgorithm(getAppRuntimeState());
    }
    return currentAssignmentAlgorithm;
}

function setCurrentAssignmentAlgorithmState(nextValue) {
    currentAssignmentAlgorithm = nextValue;
    setAppRuntimeState({
        generator: {
            assignmentAlgorithm: nextValue,
        },
    });
}

function syncGeneratorTeamSelectionsState() {
    setAppRuntimeState({
        generator: {
            teamSelections: {
                teamA: Array.isArray(teamSelections.teamA) ? teamSelections.teamA : [],
                teamB: Array.isArray(teamSelections.teamB) ? teamSelections.teamB : [],
            },
        },
    });
}

function syncPlayersManagementFilterState() {
    setAppRuntimeState({
        playersManagement: {
            filters: {
                searchTerm: playersManagementSearchTerm,
                troopsFilter: playersManagementTroopsFilter,
                sortFilter: playersManagementSortFilter,
            },
        },
    });
}
// Helper functions for starter/substitute counts
function getStarterCount(teamKey) {
    if (
        window.DSFeatureGeneratorTeamSelection
        && typeof window.DSFeatureGeneratorTeamSelection.getStarterCount === 'function'
    ) {
        return window.DSFeatureGeneratorTeamSelection.getStarterCount(teamSelections, teamKey);
    }
    return teamSelections[teamKey].filter(p => p.role === 'starter').length;
}

function getSubstituteCount(teamKey) {
    if (
        window.DSFeatureGeneratorTeamSelection
        && typeof window.DSFeatureGeneratorTeamSelection.getSubstituteCount === 'function'
    ) {
        return window.DSFeatureGeneratorTeamSelection.getSubstituteCount(teamSelections, teamKey);
    }
    return teamSelections[teamKey].filter(p => p.role === 'substitute').length;
}

function normalizeAssignmentAlgorithm(value) {
    if (
        window.DSCoreGeneratorAssignment
        && typeof window.DSCoreGeneratorAssignment.normalizeAssignmentAlgorithm === 'function'
    ) {
        return window.DSCoreGeneratorAssignment.normalizeAssignmentAlgorithm(value);
    }
    return value === ASSIGNMENT_ALGO_AGGRESSIVE ? ASSIGNMENT_ALGO_AGGRESSIVE : ASSIGNMENT_ALGO_BALANCED;
}

function syncAssignmentAlgorithmControl() {
    const normalized = normalizeAssignmentAlgorithm(getCurrentAssignmentAlgorithmState());
    if (
        window.DSFeatureGeneratorView
        && typeof window.DSFeatureGeneratorView.syncAssignmentAlgorithmControl === 'function'
    ) {
        window.DSFeatureGeneratorView.syncAssignmentAlgorithmControl({
            document: document,
            value: normalized,
        });
        return;
    }

    const radioInputs = document.querySelectorAll('input[name="assignmentAlgorithm"]');
    if (radioInputs && radioInputs.length > 0) {
        radioInputs.forEach((input) => {
            if (input instanceof HTMLInputElement) {
                input.checked = input.value === normalized;
            }
        });
        return;
    }

    const select = document.getElementById('assignmentAlgorithmSelect');
    if (select) {
        select.value = normalized;
    }
}

function handleAssignmentAlgorithmChange(event) {
    const controller = getGeneratorFeatureController();
    if (controller && typeof controller.changeAlgorithm === 'function') {
        controller.changeAlgorithm(event);
        return;
    }

    if (event && event.target instanceof HTMLInputElement && event.target.type === 'radio' && !event.target.checked) {
        return;
    }
    const next = normalizeAssignmentAlgorithm(event && event.target ? event.target.value : ASSIGNMENT_ALGO_DEFAULT);
    setCurrentAssignmentAlgorithmState(next);
    syncAssignmentAlgorithmControl();
}

let generatorFeatureController = null;
function getGeneratorFeatureController() {
    if (generatorFeatureController) {
        return generatorFeatureController;
    }
    if (
        window.DSFeatureGeneratorController
        && typeof window.DSFeatureGeneratorController.createController === 'function'
    ) {
        generatorFeatureController = window.DSFeatureGeneratorController.createController({
            document: document,
            defaultAlgorithm: ASSIGNMENT_ALGO_DEFAULT,
            normalizeAssignmentAlgorithm: normalizeAssignmentAlgorithm,
            setAssignmentAlgorithm: setCurrentAssignmentAlgorithmState,
            syncAssignmentAlgorithmControl: syncAssignmentAlgorithmControl,
            toggleTeamSelection: (playerName, team) => toggleTeam(playerName, team),
            setPlayerRole: (playerName, role) => togglePlayerRole(playerName, role),
            clearPlayerSelection: (playerName) => clearPlayerSelection(playerName),
            clearAllSelections: () => clearAllSelections(),
            generateAssignments: (team) => generateTeamAssignments(team),
            roleLimits: {
                maxTotal: 30,
                maxStarters: 20,
                maxSubstitutes: 10,
            },
        });
    }
    return generatorFeatureController;
}

let playersManagementFeatureController = null;
function getPlayersManagementFeatureController() {
    if (playersManagementFeatureController) {
        return playersManagementFeatureController;
    }
    if (
        window.DSFeaturePlayersManagementController
        && typeof window.DSFeaturePlayersManagementController.createController === 'function'
    ) {
        playersManagementFeatureController = window.DSFeaturePlayersManagementController.createController({
            document: document,
            handleAddPlayer: handlePlayersManagementAddPlayer,
            handleTableAction: handlePlayersManagementTableAction,
            handleFilterChange: handlePlayersManagementFilterChange,
            clearFilters: clearPlayersManagementFilters,
            switchSource: switchPlayersManagementSource,
            focusAddNameField: () => {
                const input = document.getElementById('playersMgmtNewName');
                if (input && typeof input.focus === 'function') {
                    input.focus();
                }
            },
        });
    }
    return playersManagementFeatureController;
}

let eventsManagerFeatureController = null;
function getEventsManagerFeatureController() {
    if (eventsManagerFeatureController) {
        return eventsManagerFeatureController;
    }
    if (
        window.DSFeatureEventsManagerController
        && typeof window.DSFeatureEventsManagerController.createController === 'function'
    ) {
        eventsManagerFeatureController = window.DSFeatureEventsManagerController.createController({
            toggleEventsPanel: toggleEventsPanel,
            enterEditMode: enterEventEditMode,
            triggerLogoUpload: triggerEventLogoUpload,
            removeLogo: removeEventLogo,
            handleLogoChange: handleEventLogoChange,
            triggerMapUpload: triggerEventMapUpload,
            removeMap: removeEventMap,
            handleMapChange: handleEventMapChange,
            addBuildingRow: addEventBuildingRow,
            saveEvent: saveEventDefinition,
            cancelEdit: cancelEventEditing,
            deleteEvent: deleteSelectedEvent,
            openCoordinatesPicker: openCoordinatesPickerFromEditor,
        });
    }
    return eventsManagerFeatureController;
}

let allianceFeatureController = null;
function getAllianceFeatureController() {
    if (allianceFeatureController) {
        return allianceFeatureController;
    }
    if (
        window.DSFeatureAllianceController
        && typeof window.DSFeatureAllianceController.createController === 'function'
    ) {
        allianceFeatureController = window.DSFeatureAllianceController.createController({
            renderPanel: renderAlliancePanel,
            createAlliance: handleCreateAlliance,
            sendInvitation: handleSendInvitation,
            leaveAlliance: handleLeaveAlliance,
            acceptInvitation: handleAcceptInvitation,
            rejectInvitation: handleRejectInvitation,
            resendInvitation: handleResendInvitation,
            revokeInvitation: handleRevokeInvitation,
            openPanel: openAlliancePanel,
            closePanel: closeAlliancePanel,
        });
    }
    return allianceFeatureController;
}

let notificationsFeatureController = null;
function getNotificationsFeatureController() {
    if (notificationsFeatureController) {
        return notificationsFeatureController;
    }
    if (
        window.DSFeatureNotificationsController
        && typeof window.DSFeatureNotificationsController.createController === 'function'
    ) {
        notificationsFeatureController = window.DSFeatureNotificationsController.createController({
            checkAndDisplay: checkAndDisplayNotifications,
            render: renderNotifications,
            togglePanel: toggleNotificationsPanel,
            closePanel: closeNotificationsPanel,
            startPolling: startNotificationPolling,
            stopPolling: stopNotificationPolling,
            openAllianceInvite: openAllianceInvitesFromNotification,
        });
    }
    return notificationsFeatureController;
}

let uploadPanelExpanded = true;
let playersListPanelExpanded = true;
let playersManagementAddPanelExpanded = false;
let playersManagementAddPanelInit = false;
let playersManagementEditingName = '';
let playersManagementSearchTerm = '';
let playersManagementTroopsFilter = '';
let playersManagementSortFilter = PLAYERS_MANAGEMENT_DEFAULT_SORT;
let eventsPanelExpanded = true;
let activeDownloadTeam = null;
syncPlayersManagementFilterState();

function normalizeThemePreference(theme) {
    if (typeof theme !== 'string') {
        return THEME_STANDARD;
    }
    const normalized = theme.trim().toLowerCase();
    return SUPPORTED_THEMES.has(normalized) ? normalized : THEME_STANDARD;
}

function getStoredThemePreference() {
    try {
        return normalizeThemePreference(localStorage.getItem(THEME_STORAGE_KEY));
    } catch (error) {
        return THEME_STANDARD;
    }
}

function persistThemePreference(theme) {
    try {
        localStorage.setItem(THEME_STORAGE_KEY, normalizeThemePreference(theme));
    } catch (error) {
        // Ignore local storage write failures.
    }
}

function applyPlatformTheme(theme, options) {
    const nextTheme = normalizeThemePreference(theme);
    const root = document.documentElement;
    if (root) {
        root.setAttribute('data-theme', nextTheme);
    }
    if (document.body) {
        document.body.setAttribute('data-theme', nextTheme);
    }
    if (!options || options.skipPersist !== true) {
        persistThemePreference(nextTheme);
    }
    return nextTheme;
}

function getCurrentAppliedTheme() {
    const root = document.documentElement;
    if (!root) {
        return THEME_STANDARD;
    }
    return normalizeThemePreference(root.getAttribute('data-theme'));
}

applyPlatformTheme(getStoredThemePreference(), { skipPersist: true });

function isConfigurationPageVisible() {
    return getCurrentPageViewState() === 'configuration';
}

function closeNavigationMenu() {
    const panel = document.getElementById('navMenuPanel');
    const menuBtn = document.getElementById('navMenuBtn');
    if (
        window.DSShellNavigationController
        && typeof window.DSShellNavigationController.syncMenuVisibility === 'function'
    ) {
        window.DSShellNavigationController.syncMenuVisibility({
            panel: panel,
            menuButton: menuBtn,
            open: false,
            setPanelVisibility: setPanelVisibility,
        });
        return;
    }
    if (panel) {
        setPanelVisibility(panel, false);
    }
    if (menuBtn) {
        menuBtn.setAttribute('aria-expanded', 'false');
    }
}

function openNavigationMenu() {
    const panel = document.getElementById('navMenuPanel');
    const menuBtn = document.getElementById('navMenuBtn');
    if (
        window.DSShellNavigationController
        && typeof window.DSShellNavigationController.syncMenuVisibility === 'function'
    ) {
        window.DSShellNavigationController.syncMenuVisibility({
            panel: panel,
            menuButton: menuBtn,
            open: true,
            setPanelVisibility: setPanelVisibility,
        });
        return;
    }
    if (panel) {
        setPanelVisibility(panel, true);
    }
    if (menuBtn) {
        menuBtn.setAttribute('aria-expanded', 'true');
    }
}

function toggleNavigationMenu(event) {
    if (event) {
        event.stopPropagation();
    }
    const panel = document.getElementById('navMenuPanel');
    if (!panel) {
        return;
    }
    if (panel.classList.contains('ui-open')) {
        closeNavigationMenu();
    } else {
        openNavigationMenu();
    }
}

function syncNavigationMenuState() {
    if (
        window.DSShellNavigationController
        && typeof window.DSShellNavigationController.syncNavigationButtons === 'function'
    ) {
        window.DSShellNavigationController.syncNavigationButtons({
            currentView: getCurrentPageViewState(),
            entries: [
                { view: 'generator', button: document.getElementById('navGeneratorBtn') },
                { view: 'configuration', button: document.getElementById('navConfigBtn') },
                { view: 'players', button: document.getElementById('navPlayersBtn') },
                { view: 'alliance', button: document.getElementById('navAllianceBtn') },
                { view: 'support', button: document.getElementById('navSupportBtn') },
                { view: 'generator', button: document.getElementById('mobileNavGeneratorBtn') },
                { view: 'configuration', button: document.getElementById('mobileNavConfigBtn') },
                { view: 'players', button: document.getElementById('mobileNavPlayersBtn') },
                { view: 'alliance', button: document.getElementById('mobileNavAllianceBtn') },
            ],
        });
        return;
    }

    const generatorBtn = document.getElementById('navGeneratorBtn');
    const configBtn = document.getElementById('navConfigBtn');
    const playersBtn = document.getElementById('navPlayersBtn');
    const allianceBtn = document.getElementById('navAllianceBtn');
    const supportBtn = document.getElementById('navSupportBtn');
    const mobileGeneratorBtn = document.getElementById('mobileNavGeneratorBtn');
    const mobileConfigBtn = document.getElementById('mobileNavConfigBtn');
    const mobilePlayersBtn = document.getElementById('mobileNavPlayersBtn');
    const mobileAllianceBtn = document.getElementById('mobileNavAllianceBtn');
    if (generatorBtn) {
        const isActive = getCurrentPageViewState() === 'generator';
        generatorBtn.classList.toggle('active', isActive);
        generatorBtn.setAttribute('aria-current', isActive ? 'page' : 'false');
    }
    if (configBtn) {
        const isActive = getCurrentPageViewState() === 'configuration';
        configBtn.classList.toggle('active', isActive);
        configBtn.setAttribute('aria-current', isActive ? 'page' : 'false');
    }
    if (playersBtn) {
        const isActive = getCurrentPageViewState() === 'players';
        playersBtn.classList.toggle('active', isActive);
        playersBtn.setAttribute('aria-current', isActive ? 'page' : 'false');
    }
    if (allianceBtn) {
        const isActive = getCurrentPageViewState() === 'alliance';
        allianceBtn.classList.toggle('active', isActive);
        allianceBtn.setAttribute('aria-current', isActive ? 'page' : 'false');
    }
    if (supportBtn) {
        const isActive = getCurrentPageViewState() === 'support';
        supportBtn.classList.toggle('active', isActive);
        supportBtn.setAttribute('aria-current', isActive ? 'page' : 'false');
    }
    if (mobileGeneratorBtn) {
        const isActive = getCurrentPageViewState() === 'generator';
        mobileGeneratorBtn.classList.toggle('active', isActive);
        mobileGeneratorBtn.setAttribute('aria-current', isActive ? 'page' : 'false');
    }
    if (mobileConfigBtn) {
        const isActive = getCurrentPageViewState() === 'configuration';
        mobileConfigBtn.classList.toggle('active', isActive);
        mobileConfigBtn.setAttribute('aria-current', isActive ? 'page' : 'false');
    }
    if (mobilePlayersBtn) {
        const isActive = getCurrentPageViewState() === 'players';
        mobilePlayersBtn.classList.toggle('active', isActive);
        mobilePlayersBtn.setAttribute('aria-current', isActive ? 'page' : 'false');
    }
    if (mobileAllianceBtn) {
        const isActive = getCurrentPageViewState() === 'alliance';
        mobileAllianceBtn.classList.toggle('active', isActive);
        mobileAllianceBtn.setAttribute('aria-current', isActive ? 'page' : 'false');
    }
}

function resumePendingOnboardingStep() {
    if (pendingOnboardingStep === null) {
        return;
    }
    const pending = pendingOnboardingStep;
    pendingOnboardingStep = null;
    showOnboardingStep(pending);
}

function updateFloatingButtonsVisibility() {
    const bar = document.getElementById('floatingButtons');
    const selectionSection = document.getElementById('selectionSection');
    if (!bar || !selectionSection) {
        return;
    }
    const hasPlayers = Array.isArray(allPlayers) && allPlayers.length > 0;
    const shouldShow = getCurrentPageViewState() === 'generator' && !selectionSection.classList.contains('hidden') && hasPlayers;
    bar.style.display = shouldShow ? 'flex' : 'none';
    reserveSpaceForFooter();
}

function setPageView(view) {
    const generatorPage = document.getElementById('generatorPage');
    const configurationPage = document.getElementById('configurationPage');
    const playersManagementPage = document.getElementById('playersManagementPage');
    const alliancePage = document.getElementById('alliancePage');
    const supportPage = document.getElementById('supportPage');
    if (!generatorPage || !configurationPage || !playersManagementPage || !alliancePage || !supportPage) {
        return;
    }

    if (view === 'configuration') {
        setCurrentPageViewState('configuration');
    } else if (view === 'players') {
        setCurrentPageViewState('players');
    } else if (view === 'alliance') {
        setCurrentPageViewState('alliance');
    } else if (view === 'support') {
        setCurrentPageViewState('support');
    } else {
        setCurrentPageViewState('generator');
    }
    let currentView = getCurrentPageViewState();
    if (
        window.DSShellNavigationController
        && typeof window.DSShellNavigationController.applyPageVisibility === 'function'
    ) {
        currentView = window.DSShellNavigationController.applyPageVisibility({
            currentView: currentView,
            pages: {
                generator: generatorPage,
                configuration: configurationPage,
                players: playersManagementPage,
                alliance: alliancePage,
                support: supportPage,
            },
        });
    } else {
        generatorPage.classList.toggle('hidden', currentView !== 'generator');
        configurationPage.classList.toggle('hidden', currentView !== 'configuration');
        playersManagementPage.classList.toggle('hidden', currentView !== 'players');
        alliancePage.classList.toggle('hidden', currentView !== 'alliance');
        supportPage.classList.toggle('hidden', currentView !== 'support');
    }
    syncNavigationMenuState();
    closeNavigationMenu();
    closeNotificationsPanel();

    if (currentView === 'configuration') {
        loadBuildingConfig();
        loadBuildingPositions();
        renderBuildingsTable();
        renderEventsList();
        refreshEventEditorDeleteState();
    } else if (currentView === 'players') {
        renderPlayersManagementPanel();
    } else if (currentView === 'alliance') {
        renderAlliancePanel();
    }

    updateFloatingButtonsVisibility();
    resumePendingOnboardingStep();
}

function showConfigurationPage() {
    setPageView('configuration');
}

function showGeneratorPage() {
    setPageView('generator');
}

function showPlayersManagementPage() {
    setPageView('players');
}

function openAlliancePanelFromMenu() {
    showAlliancePage();
}

function showAlliancePage() {
    setPageView('alliance');
    Promise.resolve()
        .then(async () => {
            if (typeof FirebaseService !== 'undefined' && FirebaseService.isSignedIn()) {
                const gameplayContext = getGameplayContext();
                await FirebaseService.loadAllianceData(gameplayContext || undefined);
            }
            await checkAndDisplayNotifications();
        })
        .then(() => {
            if (getCurrentPageViewState() === 'alliance') {
                renderAlliancePanel();
                updateAllianceHeaderDisplay();
            }
        })
        .catch(() => {
            // Ignore transient refresh failures when opening alliance page.
        });
}

function showSupportPage() {
    setPageView('support');
}

function copySupportDiscordHandle() {
    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
        showMessage('supportStatus', `Discord contact: @${SUPPORT_DISCORD_HANDLE}`, 'warning');
        return;
    }
    navigator.clipboard.writeText(SUPPORT_DISCORD_HANDLE)
        .then(() => {
            showMessage('supportStatus', `Discord handle copied: @${SUPPORT_DISCORD_HANDLE}`, 'success');
        })
        .catch(() => {
            showMessage('supportStatus', `Discord contact: @${SUPPORT_DISCORD_HANDLE}`, 'warning');
        });
}

function openSupportDiscordProfile() {
    const newWindow = window.open(SUPPORT_DISCORD_URL, '_blank', 'noopener,noreferrer');
    if (!newWindow) {
        showMessage('supportStatus', 'Popup blocked. Open discord.com and add @flashguru2000.', 'warning');
        return;
    }
    showMessage('supportStatus', 'Discord opened in a new tab. Add @flashguru2000.', 'success');
}

function openSupportIssueComposer(issueType) {
    const titleInput = document.getElementById('supportIssueTitle');
    const detailsInput = document.getElementById('supportIssueDetails');
    const customTitle = titleInput ? titleInput.value.trim() : '';
    const customDetails = detailsInput ? detailsInput.value.trim() : '';
    const normalizedType = issueType === 'bug' ? 'bug' : 'feature';
    const isBug = normalizedType === 'bug';
    const defaultTitle = isBug ? '[Bug] Short summary' : '[Feature] Short summary';
    const issueTitle = (customTitle || defaultTitle).slice(0, 120);
    const details = customDetails || (isBug
        ? 'Describe what happened, expected behavior, and steps to reproduce.'
        : 'Describe the feature, why it helps, and expected behavior.');
    const body = [
        isBug ? '### Bug report' : '### Feature request',
        '',
        details,
        '',
        '### Context',
        '- Submitted from Support page',
        `- Date: ${new Date().toISOString()}`,
        '',
    ].join('\n');
    const params = new URLSearchParams();
    params.set('title', issueTitle);
    params.set('body', body);
    params.set('labels', isBug ? 'bug' : 'enhancement');
    const issueUrl = `${SUPPORT_REPO_ISSUES_NEW_URL}?${params.toString()}`;
    const newWindow = window.open(issueUrl, '_blank', 'noopener,noreferrer');
    if (!newWindow) {
        showMessage('supportStatus', 'Popup blocked. Please open repository issues manually.', 'warning');
        return;
    }
    showMessage('supportStatus', 'Issue draft opened in GitHub. Submit to save it in repository issues.', 'success');
}

function getSignInDisplayName(user) {
    if (!user || typeof user.displayName !== 'string') {
        return '';
    }
    return user.displayName.trim().slice(0, PROFILE_TEXT_LIMIT);
}

function getProfileFromService() {
    if (typeof FirebaseService === 'undefined' || !FirebaseService.getUserProfile) {
        return { displayName: '', nickname: '', avatarDataUrl: '', theme: getStoredThemePreference() };
    }
    const activeGameId = getActiveGame() || ensureActiveGameContext();
    const profileContext = activeGameId ? { gameId: activeGameId } : undefined;
    const profile = FirebaseService.getUserProfile(profileContext);
    if (!profile || typeof profile !== 'object') {
        return { displayName: '', nickname: '', avatarDataUrl: '', theme: getStoredThemePreference() };
    }
    return {
        displayName: typeof profile.displayName === 'string' ? profile.displayName.trim().slice(0, PROFILE_TEXT_LIMIT) : '',
        nickname: typeof profile.nickname === 'string' ? profile.nickname.trim().replace(/^@+/, '').slice(0, PROFILE_TEXT_LIMIT) : '',
        avatarDataUrl: typeof profile.avatarDataUrl === 'string' ? profile.avatarDataUrl.trim().slice(0, PROFILE_AVATAR_DATA_URL_LIMIT) : '',
        theme: normalizeThemePreference(profile.theme || getStoredThemePreference()),
    };
}

function getAvatarInitials(primaryName, secondaryName) {
    const preferred = [primaryName, secondaryName]
        .filter((value) => typeof value === 'string' && value.trim())
        .map((value) => value.trim())[0] || '';
    if (!preferred) {
        return 'U';
    }
    const tokens = preferred.split(/\s+/).filter(Boolean);
    if (tokens.length === 1) {
        return tokens[0].slice(0, 2).toUpperCase();
    }
    return (tokens[0][0] + tokens[1][0]).toUpperCase();
}

function applyAvatar(dataUrl, imageEl, initialsEl, initials) {
    if (!imageEl || !initialsEl) {
        return;
    }
    if (dataUrl) {
        imageEl.src = dataUrl;
        imageEl.classList.remove('hidden');
        initialsEl.classList.add('hidden');
    } else {
        imageEl.src = '';
        imageEl.classList.add('hidden');
        initialsEl.textContent = initials;
        initialsEl.classList.remove('hidden');
    }
}

function updateUserHeaderIdentity(user) {
    if (typeof user !== 'undefined') {
        currentAuthUser = user;
    }
    const profile = getProfileFromService();
    const resolvedTheme = currentAuthUser ? profile.theme : getStoredThemePreference();
    applyPlatformTheme(resolvedTheme);
    const nickname = profile.nickname || '';
    const displayName = profile.displayName || '';
    const visibleLabel = nickname || displayName;

    const labelEl = document.getElementById('userIdentityLabel');
    if (labelEl) {
        labelEl.textContent = visibleLabel;
    }
    const userTextEl = document.getElementById('headerUserText');
    if (userTextEl) {
        userTextEl.classList.toggle('hidden', !visibleLabel);
    }

    const avatarImageEl = document.getElementById('headerAvatarImage');
    const avatarInitialsEl = document.getElementById('headerAvatarInitials');
    const initialsSource = visibleLabel || getSignInDisplayName(currentAuthUser);
    applyAvatar(profile.avatarDataUrl, avatarImageEl, avatarInitialsEl, getAvatarInitials(initialsSource, ''));
    syncGameMetadataMenuAvailability();
}

function openSettingsModal() {
    closeNavigationMenu();
    const modal = document.getElementById('settingsModal');
    if (!modal) {
        return;
    }
    const profile = getProfileFromService();
    const displayInput = document.getElementById('settingsDisplayNameInput');
    const nicknameInput = document.getElementById('settingsNicknameInput');
    const languageSelect = document.getElementById('languageSelect');
    const themeSelect = document.getElementById('settingsThemeSelect');
    const signInName = getSignInDisplayName(currentAuthUser);
    if (displayInput) {
        displayInput.value = profile.displayName || signInName || '';
    }
    if (nicknameInput) {
        nicknameInput.value = profile.nickname || '';
    }
    if (languageSelect && window.DSI18N && window.DSI18N.getLanguage) {
        languageSelect.value = window.DSI18N.getLanguage();
    }
    settingsDraftTheme = normalizeThemePreference(profile.theme || getCurrentAppliedTheme());
    if (themeSelect) {
        themeSelect.value = settingsDraftTheme;
    }
    settingsDraftAvatarDataUrl = profile.avatarDataUrl || '';
    const statusEl = document.getElementById('settingsStatus');
    if (statusEl) {
        statusEl.innerHTML = '';
    }
    const deleteConfirmInput = document.getElementById('settingsDeleteConfirmInput');
    if (deleteConfirmInput) {
        deleteConfirmInput.value = '';
    }
    const deleteBtn = document.getElementById('settingsDeleteBtn');
    if (deleteBtn) {
        deleteBtn.disabled = false;
    }
    updateSettingsAvatarPreview();
    openModalOverlay(modal, { initialFocusSelector: '#settingsDisplayNameInput' });
}

function closeSettingsModal() {
    const modal = document.getElementById('settingsModal');
    if (modal) {
        closeModalOverlay(modal);
    }
}

function handleModalOverlayDismissClick(event) {
    if (!event || !(event.currentTarget instanceof HTMLElement) || event.target !== event.currentTarget) {
        return;
    }
    if (event.currentTarget.id === 'settingsModal') {
        closeSettingsModal();
        return;
    }
    if (event.currentTarget.id === 'uploadTargetModal') {
        closeUploadTargetModal();
        return;
    }
    if (event.currentTarget.id === 'coordPickerOverlay') {
        closeCoordinatesPicker();
        return;
    }
    if (event.currentTarget.id === 'downloadModalOverlay') {
        closeDownloadModal();
    }
}

function triggerSettingsAvatarUpload() {
    const input = document.getElementById('settingsAvatarInput');
    if (input) {
        input.click();
    }
}

function removeSettingsAvatar() {
    settingsDraftAvatarDataUrl = '';
    const input = document.getElementById('settingsAvatarInput');
    if (input) {
        input.value = '';
    }
    updateSettingsAvatarPreview();
}

function updateSettingsAvatarPreview() {
    const displayInput = document.getElementById('settingsDisplayNameInput');
    const nicknameInput = document.getElementById('settingsNicknameInput');
    const name = displayInput && displayInput.value ? displayInput.value.trim() : getSignInDisplayName(currentAuthUser);
    const nickname = nicknameInput && nicknameInput.value ? nicknameInput.value.trim().replace(/^@+/, '') : '';
    const previewImg = document.getElementById('settingsAvatarImage');
    const previewInitials = document.getElementById('settingsAvatarInitials');
    applyAvatar(settingsDraftAvatarDataUrl, previewImg, previewInitials, getAvatarInitials(name, nickname));
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target.result);
        reader.onerror = () => reject(new Error(t('settings_avatar_processing_failed')));
        reader.readAsDataURL(file);
    });
}

function loadImageFromDataUrl(dataUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(t('settings_avatar_processing_failed')));
        img.src = dataUrl;
    });
}

function getFileExtension(name) {
    if (typeof name !== 'string') {
        return '';
    }
    const normalized = name.trim().toLowerCase();
    const dotIndex = normalized.lastIndexOf('.');
    if (dotIndex <= 0) {
        return '';
    }
    return normalized.slice(dotIndex);
}

function isAllowedAvatarFile(file) {
    if (!file) {
        return false;
    }
    const type = typeof file.type === 'string' ? file.type.trim().toLowerCase() : '';
    const extension = getFileExtension(file.name);

    if (type && !AVATAR_ALLOWED_TYPES.has(type)) {
        return false;
    }
    if (extension && !AVATAR_ALLOWED_EXTENSIONS.has(extension)) {
        return false;
    }

    return Boolean((type && AVATAR_ALLOWED_TYPES.has(type)) || (extension && AVATAR_ALLOWED_EXTENSIONS.has(extension)));
}

async function createAvatarDataUrl(file) {
    if (!isAllowedAvatarFile(file)) {
        throw new Error(t('settings_avatar_invalid_type'));
    }
    if (typeof file.size === 'number' && file.size > AVATAR_MAX_UPLOAD_BYTES) {
        throw new Error(t('settings_avatar_file_too_large', { maxMb: Math.floor(AVATAR_MAX_UPLOAD_BYTES / (1024 * 1024)) }));
    }
    const rawDataUrl = await readFileAsDataUrl(file);
    const img = await loadImageFromDataUrl(rawDataUrl);
    if ((img.width || 0) < AVATAR_MIN_DIMENSION || (img.height || 0) < AVATAR_MIN_DIMENSION) {
        throw new Error(t('settings_avatar_too_small', { min: AVATAR_MIN_DIMENSION }));
    }
    const maxSide = 256;
    const longestSide = Math.max(img.width || 1, img.height || 1);
    const scale = Math.min(1, maxSide / longestSide);
    const width = Math.max(1, Math.round((img.width || 1) * scale));
    const height = Math.max(1, Math.round((img.height || 1) * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error(t('settings_avatar_processing_failed'));
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    const jpegQualities = [0.9, 0.8, 0.7, 0.6, 0.5];
    for (const quality of jpegQualities) {
        const jpegDataUrl = canvas.toDataURL('image/jpeg', quality);
        if (jpegDataUrl.length <= PROFILE_AVATAR_DATA_URL_LIMIT) {
            return jpegDataUrl;
        }
    }

    const pngDataUrl = canvas.toDataURL('image/png');
    if (pngDataUrl.length <= PROFILE_AVATAR_DATA_URL_LIMIT) {
        return pngDataUrl;
    }
    throw new Error(t('settings_avatar_too_large'));
}

async function handleSettingsAvatarChange(event) {
    const input = event && event.target ? event.target : document.getElementById('settingsAvatarInput');
    const file = input && input.files ? input.files[0] : null;
    if (!file) {
        return;
    }
    try {
        settingsDraftAvatarDataUrl = await createAvatarDataUrl(file);
        const statusEl = document.getElementById('settingsStatus');
        if (statusEl) {
            statusEl.innerHTML = '';
        }
        updateSettingsAvatarPreview();
    } catch (error) {
        showMessage('settingsStatus', error.message || t('settings_avatar_processing_failed'), 'error');
    } finally {
        if (input) {
            input.value = '';
        }
    }
}

async function saveSettings() {
    if (typeof FirebaseService === 'undefined') {
        showMessage('settingsStatus', t('error_firebase_not_loaded'), 'error');
        return;
    }
    const gameplayContext = getGameplayContext('settingsStatus');
    if (!gameplayContext) {
        return;
    }
    const displayInput = document.getElementById('settingsDisplayNameInput');
    const nicknameInput = document.getElementById('settingsNicknameInput');
    const displayName = displayInput && typeof displayInput.value === 'string'
        ? displayInput.value.trim().slice(0, PROFILE_TEXT_LIMIT)
        : '';
    const nickname = nicknameInput && typeof nicknameInput.value === 'string'
        ? nicknameInput.value.trim().replace(/^@+/, '').slice(0, PROFILE_TEXT_LIMIT)
        : '';
    const themeSelect = document.getElementById('settingsThemeSelect');
    const selectedTheme = normalizeThemePreference(
        themeSelect && typeof themeSelect.value === 'string' ? themeSelect.value : settingsDraftTheme
    );

    if (FirebaseService.setUserProfile) {
        FirebaseService.setUserProfile({
            displayName: displayName,
            nickname: nickname,
            avatarDataUrl: settingsDraftAvatarDataUrl || '',
        }, gameplayContext);
    }

    const result = await FirebaseService.saveUserData(undefined, gameplayContext);
    if (result && result.success) {
        settingsDraftTheme = selectedTheme;
        applyPlatformTheme(selectedTheme);
        updateUserHeaderIdentity(currentAuthUser);
        showMessage('settingsStatus', t('settings_saved'), 'success');
        setTimeout(() => {
            closeSettingsModal();
        }, 600);
    } else {
        const errorText = result && result.error ? result.error : t('settings_avatar_processing_failed');
        showMessage('settingsStatus', t('settings_save_failed', { error: errorText }), 'error');
    }
}

async function deleteAccountFromSettings() {
    if (typeof FirebaseService === 'undefined' || typeof FirebaseService.deleteUserAccountAndData !== 'function') {
        showMessage('settingsStatus', t('error_firebase_not_loaded'), 'error');
        return;
    }

    const inputEl = document.getElementById('settingsDeleteConfirmInput');
    const typedValue = inputEl && typeof inputEl.value === 'string' ? inputEl.value.trim().toLowerCase() : '';
    if (typedValue !== DELETE_ACCOUNT_CONFIRM_WORD) {
        showMessage('settingsStatus', t('settings_delete_account_word_error', { word: DELETE_ACCOUNT_CONFIRM_WORD }), 'error');
        return;
    }

    if (!confirm(t('settings_delete_account_confirm_final'))) {
        return;
    }

    const deleteBtn = document.getElementById('settingsDeleteBtn');
    if (deleteBtn) {
        deleteBtn.disabled = true;
    }
    showMessage('settingsStatus', t('settings_delete_account_processing'), 'processing');

    try {
        const result = await FirebaseService.deleteUserAccountAndData();
        if (result && (result.success || result.accountDeleted)) {
            showMessage('settingsStatus', t('settings_delete_account_success'), 'success');
            return;
        }

        if (result && result.dataDeleted && result.reauthRequired) {
            showMessage('settingsStatus', t('settings_delete_account_reauth'), 'warning');
            return;
        }

        const errorText = result && result.error ? result.error : t('error_generic', { error: 'unknown' });
        showMessage('settingsStatus', t('settings_delete_account_failed', { error: errorText }), 'error');
    } catch (error) {
        showMessage('settingsStatus', t('settings_delete_account_failed', { error: error.message || 'unknown' }), 'error');
    } finally {
        if (typeof FirebaseService !== 'undefined' && typeof FirebaseService.signOut === 'function') {
            try {
                await FirebaseService.signOut();
            } catch (signOutError) {
                console.warn('Sign-out after account deletion flow failed:', signOutError && signOutError.message ? signOutError.message : signOutError);
            }
        }
        closeSettingsModal();
        if (deleteBtn) {
            deleteBtn.disabled = false;
        }
    }
}

// ============================================================
// EVENT REGISTRY
// ============================================================

const EVENT_REGISTRY = window.DSCoreEvents.EVENT_REGISTRY;
const DEFAULT_ASSIGNMENT_ALGORITHM_ID = 'balanced_round_robin';
function getEventIds() {
    return window.DSCoreEvents.getEventIds();
}

currentEvent = getEventIds()[0] || 'desert_storm';

function normalizeAssignmentAlgorithmId(value) {
    if (typeof value !== 'string') {
        return '';
    }
    return value.trim().toLowerCase();
}

function normalizeGameId(value) {
    if (typeof value !== 'string') {
        return '';
    }
    return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function resolveDefaultAssignmentAlgorithmId(gameId) {
    const normalizedGameId = normalizeGameId(gameId);
    if (window.DSAssignmentRegistry && typeof window.DSAssignmentRegistry.listAlgorithmsForGame === 'function') {
        const algorithms = window.DSAssignmentRegistry.listAlgorithmsForGame(normalizedGameId);
        if (Array.isArray(algorithms) && algorithms.length > 0 && algorithms[0] && typeof algorithms[0].id === 'string') {
            const normalized = normalizeAssignmentAlgorithmId(algorithms[0].id);
            if (normalized) {
                return normalized;
            }
        }
    }
    return DEFAULT_ASSIGNMENT_ALGORITHM_ID;
}

function getActiveEvent() {
    const active = window.DSCoreEvents.getEvent(currentEvent);
    if (active) {
        return active;
    }
    const firstId = getEventIds()[0];
    if (firstId) {
        currentEvent = firstId;
        return window.DSCoreEvents.getEvent(firstId);
    }
    return null;
}

// Per-event building state
let buildingConfigs = {};
let buildingPositionsMap = {};

const MAP_PREVIEW = 'preview';
const MAP_EXPORT = 'export';
const MAP_CANVAS_WIDTH = 1080;
const MAP_CANVAS_FALLBACK_HEIGHT = 720;
const MAP_GRID_STEP = 90;
const MAP_UPLOAD_MAX_SIDE = MAP_CANVAS_WIDTH;

// Per-event map state (image + loading state), keyed by purpose/event.
const mapRuntimeState = new Map();
let coordMapWarningShown = {};
const maxRetries = 3;

function normalizeMapPurpose(purpose) {
    return purpose === MAP_EXPORT ? MAP_EXPORT : MAP_PREVIEW;
}

function getMapRuntimeStateKey(eventId, purpose) {
    return `${normalizeMapPurpose(purpose)}::${normalizeEventId(eventId)}`;
}

function createMapRuntimeState() {
    return {
        image: new Image(),
        loaded: false,
        retries: 0,
        unavailable: false,
        promise: null,
        sourceSignature: '',
    };
}

function ensureMapRuntimeState(eventId, purpose) {
    const key = getMapRuntimeStateKey(eventId, purpose);
    if (!mapRuntimeState.has(key)) {
        mapRuntimeState.set(key, createMapRuntimeState());
    }
    return mapRuntimeState.get(key);
}

function getMapRuntimeState(eventId, purpose) {
    const eid = normalizeEventId(eventId);
    if (!eid) {
        return null;
    }
    return ensureMapRuntimeState(eid, purpose);
}

function deleteMapRuntimeStateForEvent(eventId) {
    const eid = normalizeEventId(eventId);
    if (!eid) {
        return;
    }
    [MAP_PREVIEW, MAP_EXPORT].forEach((purpose) => {
        mapRuntimeState.delete(getMapRuntimeStateKey(eid, purpose));
    });
}

function normalizeEventId(value) {
    if (typeof value !== 'string') {
        return '';
    }
    return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function isImageDataUrl(value, maxLength) {
    const dataUrl = typeof value === 'string' ? value.trim() : '';
    if (!dataUrl || !dataUrl.startsWith('data:image/')) {
        return false;
    }
    return dataUrl.length <= maxLength;
}

function ensureEventRuntimeState(eventId) {
    const event = normalizeEventId(eventId);
    if (!event) {
        return;
    }
    if (!Object.prototype.hasOwnProperty.call(buildingConfigs, event)) {
        buildingConfigs[event] = null;
    }
    if (!Object.prototype.hasOwnProperty.call(buildingPositionsMap, event)) {
        buildingPositionsMap[event] = {};
    }
    [MAP_PREVIEW, MAP_EXPORT].forEach((purpose) => {
        ensureMapRuntimeState(event, purpose);
    });
    if (!Object.prototype.hasOwnProperty.call(coordMapWarningShown, event)) {
        coordMapWarningShown[event] = false;
    }
}

function resetMapStateForEvent(eventId) {
    const event = normalizeEventId(eventId);
    if (!event) {
        return;
    }
    ensureEventRuntimeState(event);
    [MAP_PREVIEW, MAP_EXPORT].forEach((purpose) => {
        const state = ensureMapRuntimeState(event, purpose);
        state.loaded = false;
        state.retries = 0;
        state.unavailable = false;
        state.promise = null;
        state.sourceSignature = '';
        if (state.image) {
            state.image.src = '';
        }
    });
    coordMapWarningShown[event] = false;
}

function syncRuntimeStateWithRegistry() {
    const eventIds = getEventIds();
    const eventIdSet = new Set(eventIds);

    eventIds.forEach((eventId) => ensureEventRuntimeState(eventId));

    Object.keys(buildingConfigs).forEach((eventId) => {
        if (!eventIdSet.has(eventId)) {
            delete buildingConfigs[eventId];
        }
    });
    Object.keys(buildingPositionsMap).forEach((eventId) => {
        if (!eventIdSet.has(eventId)) {
            delete buildingPositionsMap[eventId];
        }
    });
    Array.from(mapRuntimeState.keys()).forEach((key) => {
        const parts = key.split('::');
        const eventId = parts.length > 1 ? parts[1] : '';
        if (!eventIdSet.has(eventId)) {
            mapRuntimeState.delete(key);
        }
    });
    Object.keys(coordMapWarningShown).forEach((eventId) => {
        if (!eventIdSet.has(eventId)) {
            delete coordMapWarningShown[eventId];
        }
    });

    if (!eventIdSet.has(currentEvent)) {
        currentEvent = eventIds[0] || 'desert_storm';
    }
}

function getEventDisplayName(eventId) {
    if (
        window.DSFeatureEventsManagerSelector
        && typeof window.DSFeatureEventsManagerSelector.resolveEventDisplayName === 'function'
    ) {
        return window.DSFeatureEventsManagerSelector.resolveEventDisplayName(eventId, {
            getEvent: (id) => window.DSCoreEvents.getEvent(id),
            translate: t,
        });
    }

    const event = window.DSCoreEvents.getEvent(eventId);
    if (!event) {
        return eventId;
    }
    if (typeof event.name === 'string' && event.name.trim()) {
        return event.name.trim();
    }
    if (event.titleKey) {
        const translated = t(event.titleKey);
        if (translated && translated !== event.titleKey) {
            return translated;
        }
    }
    return event.name || eventId;
}

function createEventSelectorButton(eventId) {
    if (
        window.DSFeatureEventsManagerSelector
        && typeof window.DSFeatureEventsManagerSelector.createEventSelectorButton === 'function'
    ) {
        return window.DSFeatureEventsManagerSelector.createEventSelectorButton({
            document: document,
            eventId: eventId,
            currentEvent: currentEvent,
            displayName: getEventDisplayName(eventId),
            onSelect: switchEvent,
        });
    }

    const button = document.createElement('button');
    button.className = `event-btn${eventId === currentEvent ? ' active' : ''}`;
    button.type = 'button';
    button.dataset.event = eventId;
    button.textContent = getEventDisplayName(eventId);
    button.addEventListener('click', () => switchEvent(eventId));
    return button;
}

function renderEventSelector(containerId) {
    if (
        window.DSFeatureEventsManagerSelector
        && typeof window.DSFeatureEventsManagerSelector.renderEventSelector === 'function'
    ) {
        window.DSFeatureEventsManagerSelector.renderEventSelector({
            document: document,
            containerId: containerId,
            eventIds: getEventIds(),
            currentEvent: currentEvent,
            getDisplayName: getEventDisplayName,
            onSelect: switchEvent,
        });
        return;
    }

    const container = document.getElementById(containerId);
    if (!container) {
        return;
    }
    const eventIds = getEventIds();
    container.innerHTML = '';
    eventIds.forEach((eventId) => {
        container.appendChild(createEventSelectorButton(eventId));
    });
}

function renderAllEventSelectors() {
    renderEventSelector('selectionEventSelector');
}

function normalizeStoredEventsData(rawData) {
    const source = rawData && typeof rawData === 'object' ? rawData : {};
    const normalized = {};
    Object.keys(source).forEach((rawId) => {
        const eventId = normalizeEventId(rawId);
        if (!eventId) {
            return;
        }
        const entry = source[rawId];
        if (!entry || typeof entry !== 'object') {
            return;
        }
        normalized[eventId] = {
            name: typeof entry.name === 'string' ? entry.name.trim().slice(0, EVENT_NAME_LIMIT) : '',
            logoDataUrl: isImageDataUrl(entry.logoDataUrl, EVENT_LOGO_DATA_URL_LIMIT) ? entry.logoDataUrl.trim() : '',
            mapDataUrl: isImageDataUrl(entry.mapDataUrl, EVENT_MAP_DATA_URL_LIMIT) ? entry.mapDataUrl.trim() : '',
            assignmentAlgorithmId: normalizeAssignmentAlgorithmId(entry.assignmentAlgorithmId),
            buildingConfig: Array.isArray(entry.buildingConfig) ? entry.buildingConfig : null,
            buildingPositions: entry.buildingPositions && typeof entry.buildingPositions === 'object' ? entry.buildingPositions : null,
        };
    });
    return normalized;
}

function buildRegistryFromStorage() {
    const legacyRegistry = window.DSCoreEvents.cloneLegacyEventRegistry
        ? window.DSCoreEvents.cloneLegacyEventRegistry()
        : window.DSCoreEvents.cloneEventRegistry();
    const nextRegistry = {};

    Object.keys(legacyRegistry).forEach((eventId) => {
        nextRegistry[eventId] = { ...legacyRegistry[eventId] };
    });

    const storedEvents = (() => {
        if (typeof FirebaseService === 'undefined' || !FirebaseService.getAllEventData) {
            return {};
        }
        const gameplayContext = getGameplayContext();
        if (!gameplayContext) {
            return {};
        }
        return normalizeStoredEventsData(FirebaseService.getAllEventData(gameplayContext));
    })();

    Object.keys(storedEvents).forEach((eventId) => {
        const stored = storedEvents[eventId];
        const base = nextRegistry[eventId] || {};
        const gameplayContext = getGameplayContext();
        const baseBuildings = Array.isArray(base.buildings) ? base.buildings : [];
        const storedBuildings = Array.isArray(stored.buildingConfig)
            ? normalizeBuildingConfig(stored.buildingConfig, stored.buildingConfig)
            : null;
        const buildings = Array.isArray(storedBuildings) && storedBuildings.length > 0
            ? storedBuildings
            : baseBuildings;
        const validNames = new Set(buildings.map((item) => item.name));
        const defaultPositions = stored.buildingPositions
            ? window.DSCoreBuildings.normalizeBuildingPositions(stored.buildingPositions, validNames)
            : (base.defaultPositions || {});
        const mapDataUrl = stored.mapDataUrl || '';
        const nextName = stored.name || base.name || eventId;
        const nextAssignmentAlgorithmId = normalizeAssignmentAlgorithmId(stored.assignmentAlgorithmId)
            || normalizeAssignmentAlgorithmId(base.assignmentAlgorithmId)
            || resolveDefaultAssignmentAlgorithmId(gameplayContext ? gameplayContext.gameId : '');
        const preserveTitleKey = !stored.name || !base.name || stored.name === base.name;

        nextRegistry[eventId] = {
            ...base,
            id: eventId,
            name: nextName,
            titleKey: preserveTitleKey ? (base.titleKey || '') : '',
            mapFile: mapDataUrl || '',
            previewMapFile: mapDataUrl || '',
            exportMapFile: mapDataUrl || '',
            mapTitle: nextName.toUpperCase().slice(0, 50),
            excelPrefix: normalizeEventId(base.excelPrefix || eventId) || eventId,
            logoDataUrl: stored.logoDataUrl || '',
            mapDataUrl: mapDataUrl,
            assignmentAlgorithmId: nextAssignmentAlgorithmId,
            buildings: buildings,
            defaultPositions: defaultPositions,
            buildingAnchors: base.buildingAnchors || {},
        };
    });

    window.DSCoreEvents.setEventRegistry(nextRegistry);
    syncRuntimeStateWithRegistry();
    getEventIds().forEach((eventId) => resetMapStateForEvent(eventId));
}

function getEventMapFile(eventId, purpose) {
    ensureEventRuntimeState(eventId);
    const evt = window.DSCoreEvents.getEvent(eventId);
    if (!evt) return null;
    const mapDataUrl = typeof evt.mapDataUrl === 'string' ? evt.mapDataUrl.trim() : '';
    return mapDataUrl || null;
}

function loadMapImage(eventId, purpose) {
    const eid = eventId || currentEvent;
    const mapPurpose = normalizeMapPurpose(purpose);
    ensureEventRuntimeState(eid);
    const mapState = ensureMapRuntimeState(eid, mapPurpose);
    if (mapState.loaded) {
        return Promise.resolve(true);
    }
    if (mapState.promise) {
        return mapState.promise;
    }

    const primaryFile = getEventMapFile(eid, mapPurpose);
    const candidateFiles = primaryFile ? [primaryFile] : [];
    const mapSourceSignature = candidateFiles.join('|');

    if (mapState.sourceSignature !== mapSourceSignature) {
        mapState.loaded = false;
        mapState.unavailable = false;
        mapState.retries = 0;
        mapState.promise = null;
        mapState.sourceSignature = mapSourceSignature;
    }

    mapState.promise = new Promise((resolve, reject) => {
        const imageEl = mapState.image;
        let candidateIndex = 0;

        const tryLoadCandidate = () => {
            const src = candidateFiles[candidateIndex];
            if (!src) {
                mapState.unavailable = true;
                mapState.promise = null;
                reject(new Error(`No map source available for ${eid}/${mapPurpose}`));
                return;
            }
            // Data/blob URLs cannot be cache-busted via query params.
            if (typeof src === 'string' && /^(data:|blob:)/i.test(src.trim())) {
                imageEl.src = src;
                return;
            }
            const bust = src.includes('?') ? '&' : '?';
            imageEl.src = `${src}${bust}v=${Date.now()}`;
        };

        imageEl.onload = () => {
            mapState.loaded = true;
            mapState.unavailable = false;
            mapState.retries = 0;
            mapState.promise = null;
            console.log(`Map loaded for ${eid}/${mapPurpose}`);
            resolve(true);
        };

        imageEl.onerror = () => {
            if (candidateIndex < candidateFiles.length - 1) {
                candidateIndex += 1;
                tryLoadCandidate();
                return;
            }

            const retry = mapState.retries + 1;
            console.error(`Map failed to load for ${eid}/${mapPurpose}, attempt: ${retry}`);
            if (mapState.retries < maxRetries) {
                mapState.retries += 1;
                setTimeout(() => {
                    candidateIndex = 0;
                    tryLoadCandidate();
                }, 700 * mapState.retries);
            } else {
                console.error(`Map loading failed for ${eid}/${mapPurpose} after ${maxRetries} attempts`);
                mapState.unavailable = true;
                mapState.promise = null;
                reject(new Error(`Map failed to load: ${eid}/${mapPurpose}`));
            }
        };

        tryLoadCandidate();
    });

    return mapState.promise;
}

const BUILDING_POSITIONS_VERSION = 2;
const BUILDING_CONFIG_VERSION = 2;

const textColors = { 1: '#8B0000', 2: '#B85C00', 3: '#006464', 4: '#006699', 5: '#226644', 6: '#556B2F' };
const bgColors = { 1: 'rgba(255,230,230,0.9)', 2: 'rgba(255,240,220,0.9)', 3: 'rgba(230,255,250,0.9)',
                  4: 'rgba(230,245,255,0.9)', 5: 'rgba(240,255,240,0.9)', 6: 'rgba(245,255,235,0.9)' };

const MAX_BUILDING_SLOTS_TOTAL = 20;
const MIN_BUILDING_SLOTS = 0;

function switchEvent(eventId) {
    const activeGameId = enforceGameplayContext();
    if (!activeGameId) {
        return;
    }
    const targetEventId = normalizeEventId(eventId);
    if (!targetEventId || !window.DSCoreEvents.getEvent(targetEventId)) return;
    if (targetEventId === currentEvent) {
        eventEditorCurrentId = targetEventId;
        eventEditorIsEditMode = false;
        applySelectedEventToEditor();
        renderEventsList();
        updateEventEditorState();
        return;
    }
    ensureEventRuntimeState(targetEventId);
    currentEvent = targetEventId;
    eventEditorCurrentId = targetEventId;
    eventEditorIsEditMode = false;

    renderAllEventSelectors();
    renderEventsList();
    updateEventEditorTitle();
    applySelectedEventToEditor();
    refreshEventEditorDeleteState();
    updateEventEditorState();

    // Load building config for new event
    loadBuildingConfig();
    loadBuildingPositions();

    // Re-render buildings table if configuration page is visible
    if (isConfigurationPageVisible()) {
        renderBuildingsTable();
    }

    // Rebind coordinate picker to the selected event if open
    const coordOverlay = document.getElementById('coordPickerOverlay');
    if (coordOverlay && !coordOverlay.classList.contains('hidden')) {
        refreshCoordinatesPickerForCurrentEvent();
    }

    // Clear old event's assignments
    assignmentsA = [];
    assignmentsB = [];
    substitutesA = [];
    substitutesB = [];

    // Update generate button event labels
    updateGenerateEventLabels();

    // If the coordinate picker is currently open, warm the export map so picker/export sizes match.
    const coordOverlayVisible = coordOverlay && !coordOverlay.classList.contains('hidden');
    const exportMapState = getMapRuntimeState(targetEventId, MAP_EXPORT);
    if (coordOverlayVisible && exportMapState && !exportMapState.loaded) {
        loadMapImage(targetEventId, MAP_EXPORT).catch(() => {
            console.warn(targetEventId + ' export map failed to load');
        });
    }
}

function updateGenerateEventLabels() {
    const activeEvent = getActiveEvent();
    const label = activeEvent ? activeEvent.mapTitle : '';
    const elA = document.getElementById('generateEventLabelA');
    const elB = document.getElementById('generateEventLabelB');
    if (elA) elA.textContent = label;
    if (elB) elB.textContent = label;
}

const PROTECTED_EVENT_IDS = new Set(
    Object.keys(window.DSCoreEvents.cloneLegacyEventRegistry ? window.DSCoreEvents.cloneLegacyEventRegistry() : {
        desert_storm: true,
        canyon_battlefield: true,
    })
);

function hashString(value) {
    const input = String(value || '');
    let hash = 2166136261;
    for (let index = 0; index < input.length; index += 1) {
        hash ^= input.charCodeAt(index);
        hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return Math.abs(hash >>> 0);
}

function generateEventAvatarDataUrl(nameSeed, idSeed) {
    const seed = `${nameSeed || ''}|${idSeed || ''}|event-avatar`;
    const hue = hashString(seed) % 360;
    const canvas = document.createElement('canvas');
    canvas.width = 96;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return '';
    }
    const grad = ctx.createLinearGradient(0, 0, 96, 96);
    grad.addColorStop(0, `hsl(${hue}, 78%, 50%)`);
    grad.addColorStop(1, `hsl(${(hue + 60) % 360}, 72%, 40%)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 96, 96);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = 'bold 34px Trebuchet MS';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(getAvatarInitials(nameSeed || 'Event', ''), 48, 50);
    return canvas.toDataURL('image/png');
}

function updateEventLogoPreview() {
    const image = document.getElementById('eventLogoPreviewImage');
    if (!image) {
        return;
    }
    const nameInput = document.getElementById('eventNameInput');
    const seedName = nameInput && typeof nameInput.value === 'string' && nameInput.value.trim()
        ? nameInput.value.trim()
        : (eventEditorCurrentId || 'Event');
    image.src = eventDraftLogoDataUrl || generateEventAvatarDataUrl(seedName, eventEditorCurrentId || seedName);
}

function getEventMapPreviewSource(eventId) {
    if (!eventId) {
        return '';
    }
    const event = window.DSCoreEvents.getEvent(eventId);
    if (!event) {
        return '';
    }
    return event.mapDataUrl || '';
}

function updateEventMapPreview() {
    const image = document.getElementById('eventMapPreviewImage');
    const placeholder = document.getElementById('eventMapPreviewPlaceholder');
    if (!image || !placeholder) {
        return;
    }
    const fallbackMapSource = eventDraftMapRemoved ? '' : getEventMapPreviewSource(eventEditorCurrentId);
    const mapSource = eventDraftMapDataUrl || fallbackMapSource;
    if (mapSource) {
        image.src = mapSource;
        image.classList.remove('hidden');
        placeholder.classList.add('hidden');
    } else {
        image.src = '';
        image.classList.add('hidden');
        placeholder.classList.remove('hidden');
    }
}

function updateEventEditorTitle() {
    const titleEl = document.getElementById('eventEditorTitle');
    if (!titleEl) {
        return;
    }
    if (!eventEditorCurrentId) {
        titleEl.textContent = t('events_manager_create_title');
        return;
    }
    const event = window.DSCoreEvents.getEvent(eventEditorCurrentId);
    const eventName = event ? (event.name || eventEditorCurrentId) : eventEditorCurrentId;
    titleEl.textContent = eventEditorIsEditMode
        ? t('events_manager_edit_title', { name: eventName })
        : eventName;
}

function isEventMapAvailable(eventId) {
    if (!eventId) {
        return false;
    }
    return Boolean(getEventMapPreviewSource(eventId));
}

function updateEventCoordinatesButton() {
    const button = document.getElementById('eventCoordinatesBtn');
    const row = document.getElementById('eventCoordinatesRow');
    if (!button) {
        return;
    }
    const hasDraftMap = Boolean(eventDraftMapDataUrl);
    const hasSavedMap = !eventDraftMapRemoved && isEventMapAvailable(eventEditorCurrentId);
    const showButton = hasDraftMap || hasSavedMap;
    if (row) {
        row.classList.toggle('hidden', !showButton);
    }
    button.classList.toggle('hidden', !showButton);
    button.disabled = !showButton;
}

function updateEventMapActionButtons(readOnly) {
    const uploadBtn = document.getElementById('eventMapUploadBtn');
    const removeBtn = document.getElementById('eventMapRemoveBtn');
    const hasDraftMap = Boolean(eventDraftMapDataUrl);
    const hasSavedMap = !eventDraftMapRemoved && isEventMapAvailable(eventEditorCurrentId);
    const hasMap = hasDraftMap || hasSavedMap;
    const canEditMap = !readOnly;

    if (uploadBtn) {
        const showUpload = canEditMap && !hasMap;
        uploadBtn.classList.toggle('hidden', !showUpload);
        uploadBtn.disabled = !showUpload;
    }
    if (removeBtn) {
        const showRemove = canEditMap && hasMap;
        removeBtn.classList.toggle('hidden', !showRemove);
        removeBtn.disabled = !showRemove;
    }
}

function updateEventEditorState() {
    const isNewDraft = !eventEditorCurrentId;
    const readOnly = !isNewDraft && !eventEditorIsEditMode;

    const eventNameInput = document.getElementById('eventNameInput');
    if (eventNameInput) {
        eventNameInput.disabled = readOnly;
    }

    ['eventLogoUploadBtn', 'eventLogoRandomBtn', 'eventAddBuildingBtn', 'eventSaveBtn', 'eventCancelEditBtn', 'eventAssignmentAlgorithmInput'].forEach((id) => {
        const element = document.getElementById(id);
        if (element) {
            element.disabled = readOnly;
        }
    });

    ['eventLogoInput', 'eventMapInput'].forEach((id) => {
        const input = document.getElementById(id);
        if (input) {
            input.disabled = readOnly;
        }
    });

    const rows = document.querySelectorAll(
        '#eventBuildingsEditorBody input, #eventBuildingsEditorBody button[data-action="remove-row"], #eventBuildingsEditorBody .display-toggle-btn'
    );
    rows.forEach((element) => {
        element.disabled = readOnly;
    });

    const deleteBtn = document.getElementById('eventDeleteBtn');
    if (deleteBtn) {
        deleteBtn.disabled = readOnly || !eventEditorCurrentId || PROTECTED_EVENT_IDS.has(eventEditorCurrentId);
    }

    const editBtn = document.getElementById('eventEditModeBtn');
    if (editBtn) {
        const showEditBtn = !isNewDraft && !eventEditorIsEditMode;
        editBtn.classList.toggle('hidden', !showEditBtn);
        editBtn.disabled = !showEditBtn;
        editBtn.title = t('events_manager_edit_action');
        editBtn.setAttribute('aria-label', t('events_manager_edit_action'));
    }

    const cancelBtn = document.getElementById('eventCancelEditBtn');
    if (cancelBtn) {
        const showCancelBtn = eventEditorIsEditMode;
        cancelBtn.classList.toggle('hidden', !showCancelBtn);
        cancelBtn.disabled = !showCancelBtn;
        cancelBtn.title = t('settings_cancel');
        cancelBtn.setAttribute('aria-label', t('settings_cancel'));
    }

    const logoUploadBtn = document.getElementById('eventLogoUploadBtn');
    const logoRandomBtn = document.getElementById('eventLogoRandomBtn');
    const addBuildingBtn = document.getElementById('eventAddBuildingBtn');
    if (addBuildingBtn) {
        addBuildingBtn.title = t('events_manager_add_building');
        addBuildingBtn.setAttribute('aria-label', t('events_manager_add_building'));
    }
    if (logoUploadBtn) {
        logoUploadBtn.title = t('events_manager_logo_upload');
        logoUploadBtn.setAttribute('aria-label', t('events_manager_logo_upload'));
        logoUploadBtn.classList.toggle('hidden', readOnly);
    }
    if (logoRandomBtn) {
        logoRandomBtn.title = t('events_manager_logo_randomize');
        logoRandomBtn.setAttribute('aria-label', t('events_manager_logo_randomize'));
        logoRandomBtn.classList.toggle('hidden', readOnly);
    }

    const mapUploadBtn = document.getElementById('eventMapUploadBtn');
    const mapRemoveBtn = document.getElementById('eventMapRemoveBtn');
    if (mapUploadBtn) {
        mapUploadBtn.title = t('events_manager_map_upload');
        mapUploadBtn.setAttribute('aria-label', t('events_manager_map_upload'));
    }
    if (mapRemoveBtn) {
        mapRemoveBtn.title = t('events_manager_map_remove');
        mapRemoveBtn.setAttribute('aria-label', t('events_manager_map_remove'));
    }

    updateEventMapActionButtons(readOnly);
    updateEventCoordinatesButton();
    updateEventEditorTitle();
}

function enterEventEditMode() {
    if (!eventEditorCurrentId) {
        return;
    }
    eventEditorIsEditMode = true;
    updateEventEditorState();
}

function cancelEventEditing() {
    if (!eventEditorIsEditMode) {
        return;
    }
    if (!eventEditorCurrentId) {
        const fallbackEventId = (currentEvent && window.DSCoreEvents.getEvent(currentEvent))
            ? currentEvent
            : (getEventIds()[0] || '');
        eventEditorCurrentId = fallbackEventId;
    }

    if (!eventEditorCurrentId || !window.DSCoreEvents.getEvent(eventEditorCurrentId)) {
        startNewEventDraft();
        return;
    }

    eventEditorIsEditMode = false;
    applySelectedEventToEditor();
    renderEventsList();
    refreshEventEditorDeleteState();
    const statusEl = document.getElementById('eventsStatus');
    if (statusEl) {
        statusEl.replaceChildren();
    }
}

function openCoordinatesPickerFromEditor() {
    if (!eventEditorCurrentId) {
        showMessage('eventsStatus', t('events_manager_coordinates_save_first'), 'warning');
        return;
    }
    if ((!isEventMapAvailable(eventEditorCurrentId) || eventDraftMapRemoved) && !eventDraftMapDataUrl) {
        showMessage('eventsStatus', t('events_manager_coordinates_missing_map'), 'warning');
        return;
    }
    if (currentEvent !== eventEditorCurrentId) {
        switchEvent(eventEditorCurrentId);
    }
    openCoordinatesPicker();
}

function createEditorBuildingRow(rowData) {
    if (window.DSEventBuildingsEditorUI && typeof window.DSEventBuildingsEditorUI.createEditorBuildingRow === 'function') {
        return window.DSEventBuildingsEditorUI.createEditorBuildingRow({
            rowData: rowData,
            translate: t,
            escapeAttribute: escapeAttribute,
            clampSlots: clampSlots,
            clampPriority: clampPriority,
            minSlots: MIN_BUILDING_SLOTS,
            maxSlots: MAX_BUILDING_SLOTS_TOTAL,
        });
    }
    return document.createElement('tr');
}

function renderEventBuildingsEditor(buildings) {
    const tbody = document.getElementById('eventBuildingsEditorBody');
    if (window.DSEventBuildingsEditorUI && typeof window.DSEventBuildingsEditorUI.renderEventBuildingsEditor === 'function') {
        window.DSEventBuildingsEditorUI.renderEventBuildingsEditor({
            tbody: tbody,
            buildings: buildings,
            defaultRows: [{ name: '', slots: 0, priority: 1, showOnMap: true }],
            createRow: createEditorBuildingRow,
        });
        return;
    }
    if (tbody) {
        tbody.innerHTML = '';
        tbody.appendChild(createEditorBuildingRow({ name: '', slots: 0, priority: 1, showOnMap: true }));
    }
}

function addEventBuildingRow() {
    const tbody = document.getElementById('eventBuildingsEditorBody');
    if (window.DSEventBuildingsEditorUI && typeof window.DSEventBuildingsEditorUI.addEventBuildingRow === 'function') {
        window.DSEventBuildingsEditorUI.addEventBuildingRow({
            tbody: tbody,
            canEdit: eventEditorIsEditMode,
            createRow: createEditorBuildingRow,
            rowData: { name: '', slots: 0, priority: 1, showOnMap: true },
        });
        return;
    }
    if (!eventEditorIsEditMode || !tbody) {
        return;
    }
    tbody.appendChild(createEditorBuildingRow({ name: '', slots: 0, priority: 1, showOnMap: true }));
}

function readEventBuildingsEditor() {
    const tbody = document.getElementById('eventBuildingsEditorBody');
    if (window.DSEventBuildingsEditorUI && typeof window.DSEventBuildingsEditorUI.readEventBuildingsEditor === 'function') {
        return window.DSEventBuildingsEditorUI.readEventBuildingsEditor({
            tbody: tbody,
            translate: t,
            clampSlots: clampSlots,
            clampPriority: clampPriority,
        });
    }
    if (!tbody) {
        return { buildings: [], error: t('events_manager_buildings_required') };
    }
    return { buildings: [], error: null };
}

function bindEventEditorTableActions() {
    const tbody = document.getElementById('eventBuildingsEditorBody');
    if (window.DSEventBuildingsEditorUI && typeof window.DSEventBuildingsEditorUI.bindEventEditorTableActions === 'function') {
        window.DSEventBuildingsEditorUI.bindEventEditorTableActions({
            tbody: tbody,
            canEdit: () => eventEditorIsEditMode,
            ensureAtLeastOneRow: () => addEventBuildingRow(),
        });
        return;
    }
}

function setEditorName(value) {
    const input = document.getElementById('eventNameInput');
    if (input) {
        input.value = value || '';
    }
}

function getEventAlgorithmSelectElement() {
    return document.getElementById('eventAssignmentAlgorithmInput');
}

function listSelectableAssignmentAlgorithmsForActiveGame() {
    const gameplayContext = getGameplayContext();
    const gameId = gameplayContext ? gameplayContext.gameId : '';
    if (window.DSAssignmentRegistry && typeof window.DSAssignmentRegistry.listAlgorithmsForGame === 'function') {
        const algorithms = window.DSAssignmentRegistry.listAlgorithmsForGame(gameId);
        if (Array.isArray(algorithms) && algorithms.length > 0) {
            return algorithms
                .filter((entry) => entry && typeof entry.id === 'string')
                .map((entry) => ({
                    id: normalizeAssignmentAlgorithmId(entry.id),
                    name: typeof entry.name === 'string' && entry.name.trim() ? entry.name.trim() : entry.id,
                }))
                .filter((entry) => !!entry.id);
        }
    }
    return [{
        id: DEFAULT_ASSIGNMENT_ALGORITHM_ID,
        name: 'Balanced Round Robin',
    }];
}

function renderEventAssignmentAlgorithmOptions(selectedAlgorithmId) {
    const select = getEventAlgorithmSelectElement();
    if (!select) {
        return;
    }
    const algorithms = listSelectableAssignmentAlgorithmsForActiveGame();
    const fallbackId = algorithms[0] ? algorithms[0].id : DEFAULT_ASSIGNMENT_ALGORITHM_ID;
    const selectedId = normalizeAssignmentAlgorithmId(selectedAlgorithmId) || fallbackId;
    select.innerHTML = '';
    algorithms.forEach((algorithm) => {
        const option = document.createElement('option');
        option.value = algorithm.id;
        option.textContent = algorithm.name;
        select.appendChild(option);
    });
    const hasSelected = algorithms.some((algorithm) => algorithm.id === selectedId);
    select.value = hasSelected ? selectedId : fallbackId;
}

function getSelectedEventAssignmentAlgorithmId() {
    const select = getEventAlgorithmSelectElement();
    const selected = select && typeof select.value === 'string' ? normalizeAssignmentAlgorithmId(select.value) : '';
    if (selected) {
        return selected;
    }
    const algorithms = listSelectableAssignmentAlgorithmsForActiveGame();
    return algorithms[0] ? algorithms[0].id : DEFAULT_ASSIGNMENT_ALGORITHM_ID;
}

function applySelectedEventToEditor() {
    if (!eventEditorCurrentId) {
        eventEditorCurrentId = currentEvent;
    }
    const event = window.DSCoreEvents.getEvent(eventEditorCurrentId);
    if (!event) {
        startNewEventDraft();
        return;
    }
    setEditorName(event.name || eventEditorCurrentId);
    eventDraftLogoDataUrl = event.logoDataUrl || generateEventAvatarDataUrl(event.name || eventEditorCurrentId, eventEditorCurrentId);
    eventDraftMapDataUrl = event.mapDataUrl || '';
    eventDraftMapRemoved = false;
    renderEventAssignmentAlgorithmOptions(event.assignmentAlgorithmId);
    updateEventLogoPreview();
    updateEventMapPreview();
    renderEventBuildingsEditor(Array.isArray(event.buildings) ? event.buildings : []);
    updateEventEditorState();
}

function renderEventsList() {
    if (window.DSEventListUI && typeof window.DSEventListUI.renderEventsList === 'function') {
        window.DSEventListUI.renderEventsList({
            listElement: document.getElementById('eventsList'),
            eventIds: getEventIds(),
            getEventById: (eventId) => window.DSCoreEvents.getEvent(eventId),
            currentEventId: currentEvent,
            eventEditorCurrentId: eventEditorCurrentId,
            generateAvatarDataUrl: generateEventAvatarDataUrl,
            translate: t,
            onSelectEvent: (eventId) => {
                eventEditorCurrentId = eventId;
                switchEvent(eventId);
            },
            onStartNewEvent: () => {
                startNewEventDraft();
                renderEventsList();
            },
        });
        return;
    }

    const listEl = document.getElementById('eventsList');
    if (!listEl) {
        return;
    }
}

function startNewEventDraft() {
    eventEditorCurrentId = '';
    eventEditorIsEditMode = true;
    setEditorName('');
    renderEventAssignmentAlgorithmOptions(resolveDefaultAssignmentAlgorithmId(getGameplayContext() ? getGameplayContext().gameId : ''));
    eventDraftLogoDataUrl = '';
    eventDraftMapDataUrl = '';
    eventDraftMapRemoved = false;
    updateEventLogoPreview();
    updateEventMapPreview();
    renderEventBuildingsEditor([{ name: 'Bomb Squad', slots: 4, priority: 1, showOnMap: true }]);
    updateEventEditorState();
    const deleteBtn = document.getElementById('eventDeleteBtn');
    if (deleteBtn) {
        deleteBtn.disabled = true;
    }
}

function refreshEventEditorDeleteState() {
    const deleteBtn = document.getElementById('eventDeleteBtn');
    if (!deleteBtn) {
        return;
    }
    deleteBtn.disabled = !eventEditorCurrentId || PROTECTED_EVENT_IDS.has(eventEditorCurrentId) || !eventEditorIsEditMode;
}

function triggerEventLogoUpload() {
    if (!eventEditorIsEditMode) {
        return;
    }
    const input = document.getElementById('eventLogoInput');
    if (input) {
        input.click();
    }
}

function triggerEventMapUpload() {
    if (!eventEditorIsEditMode) {
        return;
    }
    const input = document.getElementById('eventMapInput');
    if (input) {
        input.click();
    }
}

function removeEventLogo() {
    if (!eventEditorIsEditMode) {
        return;
    }
    eventDraftLogoDataUrl = '';
    const input = document.getElementById('eventLogoInput');
    if (input) {
        input.value = '';
    }
    updateEventLogoPreview();
}

function removeEventMap() {
    if (!eventEditorIsEditMode) {
        return;
    }
    eventDraftMapDataUrl = '';
    eventDraftMapRemoved = true;
    const input = document.getElementById('eventMapInput');
    if (input) {
        input.value = '';
    }
    updateEventMapPreview();
    updateEventEditorState();
}

async function createEventImageDataUrl(file, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const maxBytes = Number(opts.maxBytes) || AVATAR_MAX_UPLOAD_BYTES;
    const minDimension = Number(opts.minDimension) || AVATAR_MIN_DIMENSION;
    const maxSide = Number(opts.maxSide) || 512;
    const maxDataUrlLength = Number(opts.maxDataUrlLength) || EVENT_MAP_DATA_URL_LIMIT;
    const tooLargeMessage = opts.tooLargeMessage || t('events_manager_image_too_large');
    const tooSmallMessage = opts.tooSmallMessage || t('events_manager_image_too_small', { min: minDimension });

    if (!isAllowedAvatarFile(file)) {
        throw new Error(t('events_manager_invalid_image'));
    }
    if (typeof file.size === 'number' && file.size > maxBytes) {
        throw new Error(tooLargeMessage);
    }
    const rawDataUrl = await readFileAsDataUrl(file);
    const img = await loadImageFromDataUrl(rawDataUrl);
    if ((img.width || 0) < minDimension || (img.height || 0) < minDimension) {
        throw new Error(tooSmallMessage);
    }

    const longestSide = Math.max(img.width || 1, img.height || 1);
    const scale = Math.min(1, maxSide / longestSide);
    const width = Math.max(1, Math.round((img.width || 1) * scale));
    const height = Math.max(1, Math.round((img.height || 1) * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error(t('events_manager_image_process_failed'));
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    const qualities = [0.9, 0.8, 0.7, 0.6];
    for (const quality of qualities) {
        const jpegDataUrl = canvas.toDataURL('image/jpeg', quality);
        if (jpegDataUrl.length <= maxDataUrlLength) {
            return jpegDataUrl;
        }
    }
    const pngDataUrl = canvas.toDataURL('image/png');
    if (pngDataUrl.length <= maxDataUrlLength) {
        return pngDataUrl;
    }
    throw new Error(t('events_manager_image_data_too_large'));
}

async function createContainedSquareImageDataUrl(sourceDataUrl, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const sideRaw = Number(opts.side);
    const side = Number.isFinite(sideRaw) && sideRaw > 0 ? Math.round(sideRaw) : 320;
    const maxDataUrlLength = Number(opts.maxDataUrlLength) || EVENT_LOGO_DATA_URL_LIMIT;
    const img = await loadImageFromDataUrl(sourceDataUrl);
    const canvas = document.createElement('canvas');
    canvas.width = side;
    canvas.height = side;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error(t('events_manager_image_process_failed'));
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, side, side);

    const sourceWidth = Math.max(1, Number(img.width) || 1);
    const sourceHeight = Math.max(1, Number(img.height) || 1);
    const drawScale = Math.min(side / sourceWidth, side / sourceHeight);
    const drawWidth = Math.max(1, Math.round(sourceWidth * drawScale));
    const drawHeight = Math.max(1, Math.round(sourceHeight * drawScale));
    const offsetX = Math.round((side - drawWidth) / 2);
    const offsetY = Math.round((side - drawHeight) / 2);
    ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

    const qualities = [0.9, 0.8, 0.7, 0.6];
    for (const quality of qualities) {
        const jpegDataUrl = canvas.toDataURL('image/jpeg', quality);
        if (jpegDataUrl.length <= maxDataUrlLength) {
            return jpegDataUrl;
        }
    }
    const pngDataUrl = canvas.toDataURL('image/png');
    if (pngDataUrl.length <= maxDataUrlLength) {
        return pngDataUrl;
    }
    throw new Error(t('events_manager_image_data_too_large'));
}

async function createGameMetadataLogoDataUrl(file) {
    const resized = await createEventImageDataUrl(file, {
        maxBytes: AVATAR_MAX_UPLOAD_BYTES,
        minDimension: AVATAR_MIN_DIMENSION,
        maxSide: 320,
        maxDataUrlLength: EVENT_LOGO_DATA_URL_LIMIT,
        tooLargeMessage: t('events_manager_logo_too_large'),
    });
    return createContainedSquareImageDataUrl(resized, {
        side: 320,
        maxDataUrlLength: EVENT_LOGO_DATA_URL_LIMIT,
    });
}

async function handleEventLogoChange(event) {
    const input = event && event.target ? event.target : document.getElementById('eventLogoInput');
    const file = input && input.files ? input.files[0] : null;
    if (!file) {
        return;
    }
    try {
        eventDraftLogoDataUrl = await createEventImageDataUrl(file, {
            maxBytes: AVATAR_MAX_UPLOAD_BYTES,
            minDimension: AVATAR_MIN_DIMENSION,
            maxSide: 320,
            maxDataUrlLength: EVENT_LOGO_DATA_URL_LIMIT,
            tooLargeMessage: t('events_manager_logo_too_large'),
        });
        updateEventLogoPreview();
        showMessage('eventsStatus', t('events_manager_logo_saved'), 'success');
    } catch (error) {
        showMessage('eventsStatus', error.message || t('events_manager_image_process_failed'), 'error');
    } finally {
        if (input) {
            input.value = '';
        }
    }
}

async function handleEventMapChange(event) {
    const input = event && event.target ? event.target : document.getElementById('eventMapInput');
    const file = input && input.files ? input.files[0] : null;
    if (!file) {
        return;
    }
    try {
        eventDraftMapDataUrl = await createEventImageDataUrl(file, {
            maxBytes: 4 * 1024 * 1024,
            minDimension: 320,
            maxSide: MAP_UPLOAD_MAX_SIDE,
            maxDataUrlLength: EVENT_MAP_DATA_URL_LIMIT,
            tooLargeMessage: t('events_manager_map_too_large'),
        });
        eventDraftMapRemoved = false;
        updateEventMapPreview();
        updateEventEditorState();
        showMessage('eventsStatus', t('events_manager_map_saved'), 'success');
    } catch (error) {
        showMessage('eventsStatus', error.message || t('events_manager_image_process_failed'), 'error');
    } finally {
        if (input) {
            input.value = '';
        }
    }
}

function buildEventDefinition(eventId, name, buildings, assignmentAlgorithmId) {
    const existing = window.DSCoreEvents.getEvent(eventId) || {};
    const mapDataUrl = eventDraftMapDataUrl || '';
    const logoDataUrl = eventDraftLogoDataUrl || generateEventAvatarDataUrl(name, eventId);
    const normalizedAssignmentAlgorithmId = normalizeAssignmentAlgorithmId(assignmentAlgorithmId)
        || normalizeAssignmentAlgorithmId(existing.assignmentAlgorithmId)
        || resolveDefaultAssignmentAlgorithmId(getGameplayContext() ? getGameplayContext().gameId : '');
    const validNames = new Set(buildings.map((item) => item.name));
    const currentPositions = buildingPositionsMap[eventId] || (existing.defaultPositions || {});
    const normalizedPositions = window.DSCoreBuildings.normalizeBuildingPositions(currentPositions, validNames);
    return {
        id: eventId,
        name: name,
        titleKey: existing.titleKey || '',
        mapFile: mapDataUrl || '',
        previewMapFile: mapDataUrl || '',
        exportMapFile: mapDataUrl || '',
        mapTitle: name.toUpperCase().slice(0, 50),
        excelPrefix: normalizeEventId(existing.excelPrefix || eventId) || eventId,
        logoDataUrl: logoDataUrl,
        mapDataUrl: mapDataUrl,
        assignmentAlgorithmId: normalizedAssignmentAlgorithmId,
        buildings: buildings,
        defaultPositions: normalizedPositions,
        buildingAnchors: existing.buildingAnchors || {},
    };
}

async function saveEventDefinition() {
    const gameplayContext = getGameplayContext('eventsStatus');
    if (!gameplayContext) {
        return;
    }
    if (!eventEditorIsEditMode) {
        showMessage('eventsStatus', t('events_manager_edit_first'), 'warning');
        return;
    }
    const nameInput = document.getElementById('eventNameInput');
    const rawName = nameInput && typeof nameInput.value === 'string' ? nameInput.value.trim() : '';
    const eventName = rawName.slice(0, EVENT_NAME_LIMIT);
    if (!eventName) {
        showMessage('eventsStatus', t('events_manager_name_required'), 'error');
        return;
    }

    const { buildings, error } = readEventBuildingsEditor();
    if (error) {
        showMessage('eventsStatus', error, 'error');
        return;
    }

    const existingIds = getEventIds();
    const eventId = eventEditorCurrentId || window.DSCoreEvents.slugifyEventId(eventName, existingIds);
    const eventContext = { gameId: gameplayContext.gameId, eventId: eventId };
    const assignmentAlgorithmId = getSelectedEventAssignmentAlgorithmId();
    const definition = buildEventDefinition(eventId, eventName, buildings, assignmentAlgorithmId);
    const isNewEvent = !eventEditorCurrentId;

    window.DSCoreEvents.upsertEvent(eventId, definition);
    ensureEventRuntimeState(eventId);
    buildingConfigs[eventId] = normalizeBuildingConfig(buildings, buildings);
    const validNames = new Set(buildings.map((item) => item.name));
    buildingPositionsMap[eventId] = window.DSCoreBuildings.normalizeBuildingPositions(
        buildingPositionsMap[eventId] || definition.defaultPositions || {},
        validNames
    );
    resetMapStateForEvent(eventId);

    if (typeof FirebaseService !== 'undefined') {
        if (FirebaseService.upsertEvent) {
            FirebaseService.upsertEvent(eventId, {
                id: eventId,
                name: definition.name,
                logoDataUrl: definition.logoDataUrl,
                mapDataUrl: definition.mapDataUrl,
                assignmentAlgorithmId: definition.assignmentAlgorithmId,
                buildingConfig: buildingConfigs[eventId],
                buildingPositions: buildingPositionsMap[eventId],
            }, eventContext);
        }
        FirebaseService.setBuildingConfig(eventId, buildingConfigs[eventId], eventContext);
        FirebaseService.setBuildingConfigVersion(eventId, getTargetBuildingConfigVersion(), eventContext);
        FirebaseService.setBuildingPositions(eventId, buildingPositionsMap[eventId], eventContext);
        FirebaseService.setBuildingPositionsVersion(eventId, getTargetBuildingPositionsVersion(), eventContext);
        const saveResult = await FirebaseService.saveUserData(undefined, gameplayContext);
        if (!saveResult || !saveResult.success) {
            showMessage('eventsStatus', t('events_manager_save_failed', { error: (saveResult && saveResult.error) || 'unknown' }), 'error');
            return;
        }
    }

    eventEditorCurrentId = eventId;
    currentEvent = eventId;
    eventEditorIsEditMode = false;
    syncRuntimeStateWithRegistry();
    renderAllEventSelectors();
    renderEventsList();
    refreshEventEditorDeleteState();
    updateEventEditorState();
    updateGenerateEventLabels();
    loadBuildingConfig();
    loadBuildingPositions();
    renderBuildingsTable();
    showMessage('eventsStatus', t('events_manager_saved'), 'success');

    if (isNewEvent && definition.mapDataUrl) {
        openCoordinatesPicker();
    }
}

async function deleteSelectedEvent() {
    const gameplayContext = getGameplayContext('eventsStatus');
    if (!gameplayContext) {
        return;
    }
    if (!eventEditorIsEditMode) {
        showMessage('eventsStatus', t('events_manager_edit_first'), 'warning');
        return;
    }
    if (!eventEditorCurrentId) {
        showMessage('eventsStatus', t('events_manager_delete_pick_event'), 'error');
        return;
    }
    if (PROTECTED_EVENT_IDS.has(eventEditorCurrentId)) {
        showMessage('eventsStatus', t('events_manager_delete_protected'), 'warning');
        return;
    }
    if (!confirm(t('events_manager_delete_confirm'))) {
        return;
    }

    const eventId = eventEditorCurrentId;
    const eventContext = { gameId: gameplayContext.gameId, eventId: eventId };
    const removed = window.DSCoreEvents.removeEvent(eventId);
    if (!removed) {
        showMessage('eventsStatus', t('events_manager_delete_failed'), 'error');
        return;
    }

    delete buildingConfigs[eventId];
    delete buildingPositionsMap[eventId];
    deleteMapRuntimeStateForEvent(eventId);
    delete coordMapWarningShown[eventId];

    if (typeof FirebaseService !== 'undefined' && FirebaseService.removeEvent) {
        FirebaseService.removeEvent(eventId, eventContext);
        const result = await FirebaseService.saveUserData(undefined, gameplayContext);
        if (!result || !result.success) {
            showMessage('eventsStatus', t('events_manager_delete_failed'), 'error');
            return;
        }
    }

    syncRuntimeStateWithRegistry();
    const firstEvent = getEventIds()[0] || '';
    if (firstEvent) {
        currentEvent = firstEvent;
    }
    startNewEventDraft();
    renderAllEventSelectors();
    renderEventsList();
    updateGenerateEventLabels();
    loadBuildingConfig();
    loadBuildingPositions();
    renderBuildingsTable();
    showMessage('eventsStatus', t('events_manager_deleted'), 'success');
}

// ============================================================
// FIREBASE INTEGRATION
// ============================================================
// Callback wiring moved to js/app-init.js

function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(String(str)));
    return div.innerHTML;
}

function escapeAttribute(str) {
    return escapeHtml(str).replace(/"/g, '&quot;');
}

function getTroopLabel(troop) {
    switch (troop) {
        case 'Tank':
            return t('troops_filter_tank');
        case 'Aero':
            return t('troops_filter_aero');
        case 'Missile':
            return t('troops_filter_missile');
        default:
            return troop;
    }
}

let googleSignInInProgress = false;

async function handleGoogleSignIn() {
    if (googleSignInInProgress) {
        return;
    }
    if (typeof FirebaseService === 'undefined') {
        alert(t('error_firebase_not_loaded'));
        return;
    }
    const btn = document.getElementById('googleSignInBtn');
    googleSignInInProgress = true;
    if (btn) {
        btn.disabled = true;
    }
    try {
        const result = await FirebaseService.signInWithGoogle();
        if (!result.success) {
            alert(t('error_sign_in_failed', { error: result.error }));
        }
    } finally {
        googleSignInInProgress = false;
        if (btn) {
            btn.disabled = false;
        }
    }
}

async function handleEmailSignIn() {
    if (typeof FirebaseService === 'undefined') {
        alert(t('error_firebase_not_loaded'));
        return;
    }
    const email = document.getElementById('emailInput').value;
    const password = document.getElementById('passwordInput').value;
    if (!email || !password) {
        alert(t('error_enter_email_password'));
        return;
    }
    const result = await FirebaseService.signInWithEmail(email, password);
    if (!result.success) {
        alert(t('error_sign_in_failed', { error: result.error }));
    }
}

function showSignUpForm() {
    if (typeof FirebaseService === 'undefined') {
        alert(t('error_firebase_not_loaded'));
        return;
    }
    const email = document.getElementById('emailInput').value;
    const password = document.getElementById('passwordInput').value;
    if (!email || !password) {
        alert(t('error_enter_email_password'));
        return;
    }
    if (password.length < 6) {
        alert(t('error_password_length'));
        return;
    }
    if (confirm(t('confirm_create_account', { email: email }))) {
        handleSignUp(email, password);
    }
}

async function handleSignUp(email, password) {
    if (typeof FirebaseService === 'undefined') {
        alert(t('error_firebase_not_loaded'));
        return;
    }
    const result = await FirebaseService.signUpWithEmail(email, password);
    if (result.success) {
        alert(t('success_account_created'));
    } else {
        alert(t('error_sign_up_failed', { error: result.error }));
    }
}

async function handlePasswordReset() {
    if (typeof FirebaseService === 'undefined') {
        alert(t('error_firebase_not_loaded'));
        return;
    }
    const email = document.getElementById('emailInput').value;
    if (!email) {
        alert(t('error_enter_email'));
        return;
    }
    const result = await FirebaseService.resetPassword(email);
    if (result.success) {
        alert(t('success_password_reset'));
    } else {
        alert(t('error_failed', { error: result.error }));
    }
}

async function handleSignOut() {
    if (typeof FirebaseService === 'undefined') {
        alert(t('error_firebase_not_loaded'));
        return;
    }
    if (confirm(t('confirm_sign_out'))) {
        await FirebaseService.signOut();
    }
}

// ============================================================
// COLLAPSIBLE PANEL
// ============================================================

function toggleUploadPanel() {
    uploadPanelExpanded = !uploadPanelExpanded;
    const content = document.getElementById('uploadContent');
    const icon = document.getElementById('uploadExpandIcon');
    
    if (uploadPanelExpanded) {
        content.classList.remove('collapsed');
        icon.classList.add('rotated');
    } else {
        content.classList.add('collapsed');
        icon.classList.remove('rotated');
    }
}

function togglePlayersListPanel() {
    playersListPanelExpanded = !playersListPanelExpanded;
    const content = document.getElementById('playersListContent');
    const icon = document.getElementById('playersListExpandIcon');
    if (!content || !icon) {
        return;
    }

    if (playersListPanelExpanded) {
        content.classList.remove('collapsed');
        icon.classList.add('rotated');
    } else {
        content.classList.add('collapsed');
        icon.classList.remove('rotated');
    }
}

function togglePlayersManagementAddPanel(forceExpanded) {
    if (typeof forceExpanded === 'boolean') {
        playersManagementAddPanelExpanded = forceExpanded;
    } else {
        playersManagementAddPanelExpanded = !playersManagementAddPanelExpanded;
    }

    const content = document.getElementById('playersMgmtAddPanelContent');
    const icon = document.getElementById('playersMgmtAddExpandIcon');
    if (!content || !icon) {
        return;
    }

    content.classList.toggle('collapsed', !playersManagementAddPanelExpanded);
    icon.classList.toggle('rotated', playersManagementAddPanelExpanded);
}

function renderPlayersManagementAddPanel() {
    const content = document.getElementById('playersMgmtAddPanelContent');
    const icon = document.getElementById('playersMgmtAddExpandIcon');
    if (!content || !icon) {
        return;
    }

    if (!playersManagementAddPanelInit) {
        playersManagementAddPanelExpanded = window.innerWidth >= 900;
        playersManagementAddPanelInit = true;
    }
    togglePlayersManagementAddPanel(playersManagementAddPanelExpanded);
}

function translatePlayersManagementError(result) {
    if (result && result.errorKey) {
        return t(result.errorKey, result.errorParams || {});
    }
    if (result && result.error) {
        return result.error;
    }
    return t('error_generic', { error: 'unknown' });
}

function getPlayersManagementActiveSource() {
    if (typeof FirebaseService === 'undefined' || typeof FirebaseService.getPlayerSource !== 'function') {
        return 'personal';
    }
    const gameplayContext = getGameplayContext();
    return FirebaseService.getPlayerSource(gameplayContext || undefined) === 'alliance' ? 'alliance' : 'personal';
}

async function refreshPlayersDataAfterMutation(source) {
    if (typeof FirebaseService === 'undefined') {
        return;
    }
    const gameplayContext = getGameplayContext();

    if (source === 'alliance' && typeof FirebaseService.loadAllianceData === 'function') {
        await FirebaseService.loadAllianceData(gameplayContext || undefined);
    } else if (
        source === 'personal'
        && typeof FirebaseService.getCurrentUser === 'function'
        && typeof FirebaseService.loadUserData === 'function'
    ) {
        const user = FirebaseService.getCurrentUser();
        if (user && user.uid) {
            await FirebaseService.loadUserData(user, gameplayContext || undefined);
        }
    }

    loadPlayerData();
}

function getPlayersDatabaseBySource(source) {
    if (typeof FirebaseService === 'undefined') {
        return {};
    }
    const gameplayContext = getGameplayContext();
    if (!gameplayContext) {
        return {};
    }
    if (source === 'alliance') {
        if (typeof FirebaseService.getAlliancePlayerDatabase === 'function') {
            const allianceDb = FirebaseService.getAlliancePlayerDatabase(gameplayContext);
            return allianceDb && typeof allianceDb === 'object' ? allianceDb : {};
        }
        return {};
    }
    if (typeof FirebaseService.getPlayerDatabase === 'function') {
        const personalDb = FirebaseService.getPlayerDatabase(gameplayContext);
        return personalDb && typeof personalDb === 'object' ? personalDb : {};
    }
    return {};
}

function normalizePlayerRecordForUi(name, entry) {
    if (
        window.DSFeaturePlayersManagementCore
        && typeof window.DSFeaturePlayersManagementCore.normalizePlayerRecordForUi === 'function'
    ) {
        return window.DSFeaturePlayersManagementCore.normalizePlayerRecordForUi(name, entry);
    }

    const raw = entry && typeof entry === 'object' ? entry : {};
    const power = Number(raw.power);
    const thp = Number(raw.thp);
    return {
        name: String(name || ''),
        power: Number.isFinite(power) ? power : 0,
        troops: typeof raw.troops === 'string' && raw.troops.trim() ? raw.troops.trim() : 'Unknown',
        thp: Number.isFinite(thp) ? thp : 0,
    };
}

function buildPlayersManagementRows(source) {
    const db = getPlayersDatabaseBySource(source);
    if (
        window.DSFeaturePlayersManagementCore
        && typeof window.DSFeaturePlayersManagementCore.buildRowsFromDatabase === 'function'
    ) {
        return window.DSFeaturePlayersManagementCore.buildRowsFromDatabase(db);
    }
    return Object.keys(db).map((name) => normalizePlayerRecordForUi(name, db[name]));
}

function hasActivePlayersManagementFilters() {
    if (
        window.DSAppStateStore
        && window.DSAppStateStore.selectors
        && typeof window.DSAppStateStore.selectors.selectPlayersManagementFilters === 'function'
    ) {
        const filters = window.DSAppStateStore.selectors.selectPlayersManagementFilters(getAppRuntimeState());
        return filters.searchTerm.length > 0
            || filters.troopsFilter !== ''
            || filters.sortFilter !== PLAYERS_MANAGEMENT_DEFAULT_SORT;
    }

    if (
        window.DSFeaturePlayersManagementCore
        && typeof window.DSFeaturePlayersManagementCore.hasActiveFilters === 'function'
    ) {
        return window.DSFeaturePlayersManagementCore.hasActiveFilters({
            searchTerm: playersManagementSearchTerm,
            troopsFilter: playersManagementTroopsFilter,
            sortFilter: playersManagementSortFilter,
        });
    }
    return playersManagementSearchTerm.length > 0
        || playersManagementTroopsFilter !== ''
        || playersManagementSortFilter !== PLAYERS_MANAGEMENT_DEFAULT_SORT;
}

function syncPlayersManagementFilterStateFromUi() {
    const searchInput = document.getElementById('playersMgmtSearchFilter');
    const troopsSelect = document.getElementById('playersMgmtTroopsFilter');
    const sortSelect = document.getElementById('playersMgmtSortFilter');

    const nextFilterState = {
        searchTerm: searchInput ? String(searchInput.value || '').trim() : '',
        troopsFilter: troopsSelect ? String(troopsSelect.value || '').trim() : '',
        sortFilter: sortSelect ? String(sortSelect.value || '').trim() : '',
    };

    if (
        window.DSFeaturePlayersManagementCore
        && typeof window.DSFeaturePlayersManagementCore.normalizeFilterState === 'function'
    ) {
        const normalized = window.DSFeaturePlayersManagementCore.normalizeFilterState(nextFilterState);
        playersManagementSearchTerm = normalized.searchTerm;
        playersManagementTroopsFilter = normalized.troopsFilter;
        playersManagementSortFilter = normalized.sortFilter;
        syncPlayersManagementFilterState();
        return;
    }

    playersManagementSearchTerm = nextFilterState.searchTerm;
    playersManagementTroopsFilter = nextFilterState.troopsFilter;
    playersManagementSortFilter = nextFilterState.sortFilter || PLAYERS_MANAGEMENT_DEFAULT_SORT;
    syncPlayersManagementFilterState();
}

function updatePlayersManagementClearFiltersButton() {
    const clearButton = document.getElementById('playersMgmtClearFiltersBtn');
    if (!clearButton) {
        return;
    }
    clearButton.hidden = !hasActivePlayersManagementFilters();
}

function applyPlayersManagementFilters(rows) {
    if (
        window.DSFeaturePlayersManagementCore
        && typeof window.DSFeaturePlayersManagementCore.applyFilters === 'function'
    ) {
        return window.DSFeaturePlayersManagementCore.applyFilters(rows, {
            searchTerm: playersManagementSearchTerm,
            troopsFilter: playersManagementTroopsFilter,
            sortFilter: playersManagementSortFilter,
        });
    }

    const filtered = Array.isArray(rows) ? rows.slice() : [];
    const term = playersManagementSearchTerm;
    const termLower = term.toLowerCase();
    const troops = playersManagementTroopsFilter;
    const sort = playersManagementSortFilter;

    const termFiltered = term
        ? filtered.filter((player) => String(player.name || '').toLowerCase().includes(termLower))
        : filtered;
    const troopsFiltered = troops
        ? termFiltered.filter((player) => String(player.troops || '').trim() === troops)
        : termFiltered;

    troopsFiltered.sort((a, b) => {
        if (sort === 'power-asc') {
            if (a.power !== b.power) {
                return a.power - b.power;
            }
            return a.name.localeCompare(b.name);
        }
        if (sort === 'name-asc') {
            return a.name.localeCompare(b.name);
        }
        if (sort === 'name-desc') {
            return b.name.localeCompare(a.name);
        }
        if (b.power !== a.power) {
            return b.power - a.power;
        }
        return a.name.localeCompare(b.name);
    });

    return troopsFiltered;
}

function renderPlayersManagementFilters() {
    const searchInput = document.getElementById('playersMgmtSearchFilter');
    const troopsSelect = document.getElementById('playersMgmtTroopsFilter');
    const sortSelect = document.getElementById('playersMgmtSortFilter');
    if (searchInput) {
        searchInput.value = playersManagementSearchTerm;
    }
    if (troopsSelect) {
        troopsSelect.value = playersManagementTroopsFilter;
    }
    if (sortSelect) {
        sortSelect.value = playersManagementSortFilter;
    }
    updatePlayersManagementClearFiltersButton();
}

function handlePlayersManagementFilterChange() {
    syncPlayersManagementFilterStateFromUi();
    renderPlayersManagementTable();
}

function clearPlayersManagementFilters() {
    const searchInput = document.getElementById('playersMgmtSearchFilter');
    const troopsSelect = document.getElementById('playersMgmtTroopsFilter');
    const sortSelect = document.getElementById('playersMgmtSortFilter');
    if (searchInput) {
        searchInput.value = '';
    }
    if (troopsSelect) {
        troopsSelect.value = '';
    }
    if (sortSelect) {
        sortSelect.value = PLAYERS_MANAGEMENT_DEFAULT_SORT;
    }
    playersManagementSearchTerm = '';
    playersManagementTroopsFilter = '';
    playersManagementSortFilter = PLAYERS_MANAGEMENT_DEFAULT_SORT;
    syncPlayersManagementFilterState();
    renderPlayersManagementTable();
}

function renderPlayersManagementSourceControls() {
    const controls = document.getElementById('playersMgmtSourceControls');
    const personalBtn = document.getElementById('playersMgmtSourcePersonalBtn');
    const allianceBtn = document.getElementById('playersMgmtSourceAllianceBtn');
    if (!controls || !personalBtn || !allianceBtn || typeof FirebaseService === 'undefined') {
        return;
    }

    const gameplayContext = getGameplayContext();
    const hasAlliance = !!(FirebaseService.getAllianceId && FirebaseService.getAllianceId(gameplayContext || undefined));
    if (!hasAlliance) {
        controls.classList.add('hidden');
        return;
    }

    controls.classList.remove('hidden');
    const source = getPlayersManagementActiveSource();
    const personalActive = source !== 'alliance';
    const allianceActive = source === 'alliance';
    personalBtn.classList.toggle('secondary', !personalActive);
    allianceBtn.classList.toggle('secondary', !allianceActive);
    personalBtn.disabled = personalActive;
    allianceBtn.disabled = allianceActive;
}

function renderPlayersManagementTable() {
    const tbody = document.getElementById('playersMgmtTableBody');
    if (!tbody) {
        return;
    }

    syncPlayersManagementFilterStateFromUi();
    updatePlayersManagementClearFiltersButton();

    const source = getPlayersManagementActiveSource();
    const allRows = buildPlayersManagementRows(source);
    const rows = applyPlayersManagementFilters(allRows);
    const summaryEl = document.getElementById('playersMgmtFilterSummary');
    if (summaryEl) {
        summaryEl.textContent = t('players_list_showing_count', {
            shown: rows.length,
            total: allRows.length,
        });
    }
    tbody.innerHTML = '';

    if (rows.length === 0) {
        const emptyRow = document.createElement('tr');
        emptyRow.classList.add('players-mgmt-empty-row');
        emptyRow.innerHTML = `<td colspan="5" style="opacity: 0.7;">${escapeHtml(t('players_list_empty'))}</td>`;
        tbody.appendChild(emptyRow);
        return;
    }

    const playerNameHeader = escapeAttribute(t('table_header_player_name'));
    const powerHeader = escapeAttribute(t('table_header_power'));
    const thpHeader = escapeAttribute(t('table_header_thp'));
    const troopHeader = escapeAttribute(t('table_header_troop'));
    const actionsHeader = escapeAttribute(t('players_list_actions_header'));
    const fragment = document.createDocumentFragment();
    rows.forEach((player) => {
        const row = document.createElement('tr');
        row.dataset.player = player.name;
        if (playersManagementEditingName === player.name) {
            row.classList.add('players-mgmt-edit-row');
            const troopsValue = player.troops;
            row.innerHTML = `
                <td data-label="${playerNameHeader}"><input type="text" data-field="name" value="${escapeAttribute(player.name)}"></td>
                <td data-label="${powerHeader}"><input type="number" data-field="power" min="0" step="0.1" value="${escapeAttribute(String(player.power))}"></td>
                <td data-label="${thpHeader}"><input type="number" data-field="thp" min="0" step="0.1" value="${escapeAttribute(String(player.thp))}"></td>
                <td data-label="${troopHeader}">
                    <select data-field="troops">
                        <option value="Tank" ${troopsValue === 'Tank' ? 'selected' : ''}>${escapeHtml(t('troops_filter_tank'))}</option>
                        <option value="Aero" ${troopsValue === 'Aero' ? 'selected' : ''}>${escapeHtml(t('troops_filter_aero'))}</option>
                        <option value="Missile" ${troopsValue === 'Missile' ? 'selected' : ''}>${escapeHtml(t('troops_filter_missile'))}</option>
                        <option value="Unknown" ${troopsValue !== 'Tank' && troopsValue !== 'Aero' && troopsValue !== 'Missile' ? 'selected' : ''}>Unknown</option>
                    </select>
                </td>
                <td data-label="${actionsHeader}">
                    <div class="players-mgmt-actions players-mgmt-actions--edit">
                        <button type="button" class="players-mgmt-save-btn" data-pm-action="save" data-player="${escapeAttribute(player.name)}">${escapeHtml(t('players_list_save_button'))}</button>
                        <button type="button" class="secondary players-mgmt-cancel-btn" data-pm-action="cancel" data-player="${escapeAttribute(player.name)}">${escapeHtml(t('players_list_cancel_button'))}</button>
                    </div>
                </td>
            `;
        } else {
            row.innerHTML = `
                <td data-label="${playerNameHeader}"><strong>${escapeHtml(player.name)}</strong></td>
                <td data-label="${powerHeader}">${escapeHtml(String(player.power))}M</td>
                <td data-label="${thpHeader}">${escapeHtml(String(player.thp))}</td>
                <td data-label="${troopHeader}">${escapeHtml(getTroopLabel(player.troops))}</td>
                <td data-label="${actionsHeader}">
                    <div class="players-mgmt-actions players-mgmt-actions--default">
                        <button type="button" class="secondary players-mgmt-edit-btn" data-pm-action="edit" data-player="${escapeAttribute(player.name)}">${escapeHtml(t('players_list_edit_button'))}</button>
                        <button type="button" class="clear-btn players-mgmt-danger-btn" data-pm-action="delete" data-player="${escapeAttribute(player.name)}">${escapeHtml(t('players_list_delete_button'))}</button>
                    </div>
                </td>
            `;
        }
        fragment.appendChild(row);
    });

    tbody.appendChild(fragment);
}

function renderPlayersManagementPanel() {
    const section = document.getElementById('playersListSection');
    if (!section) {
        return;
    }

    const content = document.getElementById('playersListContent');
    const icon = document.getElementById('playersListExpandIcon');
    if (content && icon) {
        content.classList.toggle('collapsed', !playersListPanelExpanded);
        icon.classList.toggle('rotated', playersListPanelExpanded);
    }

    renderPlayersManagementSourceControls();
    renderPlayersManagementAddPanel();
    renderPlayersManagementFilters();
    renderPlayersManagementTable();

    const source = getPlayersManagementActiveSource();
    const count = buildPlayersManagementRows(source).length;
    const sourceLabel = source === 'alliance' ? t('player_source_alliance') : t('player_source_personal');
    const countEl = document.getElementById('playersListCount');
    if (countEl) {
        countEl.textContent = t('player_count_with_source', { count: count, source: sourceLabel });
    }
    const hintEl = document.getElementById('playersListHint');
    if (hintEl) {
        hintEl.textContent = t('players_list_hint');
    }
}

async function switchPlayersManagementSource(source) {
    const returnToPlayersPage = getCurrentPageViewState() === 'players';
    await switchPlayerSource(source, 'playersMgmtSourceStatus');
    if (returnToPlayersPage) {
        showPlayersManagementPage();
    }
    renderPlayersManagementPanel();
}

function resetPlayersManagementAddForm() {
    const nameInput = document.getElementById('playersMgmtNewName');
    const powerInput = document.getElementById('playersMgmtNewPower');
    const thpInput = document.getElementById('playersMgmtNewThp');
    const troopsSelect = document.getElementById('playersMgmtNewTroops');
    if (nameInput) {
        nameInput.value = '';
    }
    if (powerInput) {
        powerInput.value = '';
    }
    if (thpInput) {
        thpInput.value = '';
    }
    if (troopsSelect) {
        troopsSelect.value = 'Tank';
    }
}

async function handlePlayersManagementAddPlayer() {
    if (typeof FirebaseService === 'undefined') {
        showMessage('playersMgmtStatus', t('error_firebase_not_loaded'), 'error');
        return;
    }

    const nameInput = document.getElementById('playersMgmtNewName');
    const powerInput = document.getElementById('playersMgmtNewPower');
    const thpInput = document.getElementById('playersMgmtNewThp');
    const troopsSelect = document.getElementById('playersMgmtNewTroops');
    const source = getPlayersManagementActiveSource();
    const gameplayContext = getGameplayContext('playersMgmtStatus');
    if (!gameplayContext) {
        return;
    }
    const payload = {
        name: nameInput ? nameInput.value : '',
        power: powerInput ? powerInput.value : 0,
        thp: thpInput ? thpInput.value : 0,
        troops: troopsSelect ? troopsSelect.value : 'Unknown',
    };

    const result = await FirebaseService.upsertPlayerEntry(source, '', payload, gameplayContext);
    if (result && result.success) {
        playersManagementEditingName = '';
        showMessage('playersMgmtStatus', t('players_list_added'), 'success');
        resetPlayersManagementAddForm();
        if (window.matchMedia && window.matchMedia('(max-width: 700px)').matches) {
            togglePlayersManagementAddPanel(false);
        }
        const returnToPlayersPage = getCurrentPageViewState() === 'players';
        await refreshPlayersDataAfterMutation(source);
        if (returnToPlayersPage) {
            showPlayersManagementPage();
        }
        renderPlayersManagementPanel();
        const controller = getPlayersManagementFeatureController();
        if (controller && typeof controller.focusAddNameField === 'function') {
            controller.focusAddNameField();
        } else if (nameInput) {
            nameInput.focus();
        }
        return;
    }

    showMessage('playersMgmtStatus', translatePlayersManagementError(result), 'error');
}

async function handlePlayersManagementTableAction(event) {
    if (typeof FirebaseService === 'undefined') {
        showMessage('playersMgmtStatus', t('error_firebase_not_loaded'), 'error');
        return;
    }

    const button = event.target.closest('button[data-pm-action]');
    if (!button) {
        return;
    }

    const action = button.getAttribute('data-pm-action');
    const originalName = button.getAttribute('data-player') || '';
    const source = getPlayersManagementActiveSource();
    const gameplayContext = getGameplayContext('playersMgmtStatus');
    if (!gameplayContext) {
        return;
    }
    if (!action || !originalName) {
        return;
    }

    if (action === 'edit') {
        playersManagementEditingName = originalName;
        renderPlayersManagementTable();
        return;
    }

    if (action === 'cancel') {
        playersManagementEditingName = '';
        renderPlayersManagementTable();
        return;
    }

    if (action === 'save') {
        const row = button.closest('tr');
        if (!row) {
            return;
        }
        const nameInput = row.querySelector('input[data-field="name"]');
        const powerInput = row.querySelector('input[data-field="power"]');
        const thpInput = row.querySelector('input[data-field="thp"]');
        const troopsSelect = row.querySelector('select[data-field="troops"]');
        const payload = {
            name: nameInput ? nameInput.value : '',
            power: powerInput ? powerInput.value : 0,
            thp: thpInput ? thpInput.value : 0,
            troops: troopsSelect ? troopsSelect.value : 'Unknown',
        };
        const result = await FirebaseService.upsertPlayerEntry(source, originalName, payload, gameplayContext);
        if (result && result.success) {
            playersManagementEditingName = '';
            showMessage('playersMgmtStatus', t('players_list_saved'), 'success');
            const returnToPlayersPage = getCurrentPageViewState() === 'players';
            await refreshPlayersDataAfterMutation(source);
            if (returnToPlayersPage) {
                showPlayersManagementPage();
            }
            renderPlayersManagementPanel();
            return;
        }
        showMessage('playersMgmtStatus', translatePlayersManagementError(result), 'error');
        return;
    }

    if (action === 'delete') {
        if (!confirm(t('players_list_delete_confirm', { name: originalName }))) {
            return;
        }
        const result = await FirebaseService.removePlayerEntry(source, originalName, gameplayContext);
        if (result && result.success) {
            playersManagementEditingName = '';
            const returnToPlayersPage = getCurrentPageViewState() === 'players';
            await refreshPlayersDataAfterMutation(source);
            if (returnToPlayersPage) {
                showPlayersManagementPage();
            }
            renderPlayersManagementPanel();
            showMessage('playersMgmtStatus', t('players_list_deleted'), 'success');
            return;
        }
        showMessage('playersMgmtStatus', translatePlayersManagementError(result), 'error');
    }
}

// ============================================================
// TEMPLATE GENERATION
// ============================================================

function getActivePlayerImportSchema() {
    const defaultSchema = {
        templateFileName: 'player_database_template.xlsx',
        sheetName: 'Players',
        headerRowIndex: 9,
        columns: [
            { key: 'name', header: 'Player Name', required: true },
            { key: 'power', header: 'E1 Total Power(M)', required: true },
            { key: 'troops', header: 'E1 Troops', required: true },
        ],
    };
    const gameplayContext = getGameplayContext();
    const gameId = gameplayContext ? gameplayContext.gameId : '';
    if (window.DSCoreGames && typeof window.DSCoreGames.getGame === 'function') {
        const game = window.DSCoreGames.getGame(gameId);
        if (game && game.playerImportSchema && typeof game.playerImportSchema === 'object') {
            const schema = game.playerImportSchema;
            const columns = Array.isArray(schema.columns) && schema.columns.length > 0
                ? schema.columns
                    .map((column) => ({
                        key: typeof column.key === 'string' ? column.key.trim() : '',
                        header: typeof column.header === 'string' ? column.header.trim() : '',
                        required: column.required !== false,
                    }))
                    .filter((column) => column.key && column.header)
                : defaultSchema.columns;
            return {
                templateFileName: typeof schema.templateFileName === 'string' && schema.templateFileName.trim()
                    ? schema.templateFileName.trim()
                    : defaultSchema.templateFileName,
                sheetName: typeof schema.sheetName === 'string' && schema.sheetName.trim()
                    ? schema.sheetName.trim()
                    : defaultSchema.sheetName,
                headerRowIndex: Number.isFinite(Number(schema.headerRowIndex)) && Number(schema.headerRowIndex) >= 0
                    ? Math.floor(Number(schema.headerRowIndex))
                    : defaultSchema.headerRowIndex,
                columns: columns.length > 0 ? columns : defaultSchema.columns,
            };
        }
    }
    return defaultSchema;
}

async function downloadPlayerTemplate() {
    try {
        await ensureXLSXLoaded();
    } catch (error) {
        console.error(error);
        showMessage('uploadMessage', t('error_xlsx_missing'), 'error');
        return;
    }

    const wb = XLSX.utils.book_new();
    const schema = getActivePlayerImportSchema();
    const headerRowIndex = Number.isFinite(Number(schema.headerRowIndex)) ? Math.max(0, Math.floor(Number(schema.headerRowIndex))) : 9;
    const headers = Array.isArray(schema.columns) && schema.columns.length > 0
        ? schema.columns.map((column) => column.header)
        : [t('template_header_player_name'), t('template_header_power'), t('template_header_troops')];
    
    const instructions = [
        [t('template_title')],
        [''],
        [t('template_instructions')],
        [t('template_step1')],
        [t('template_step2')],
        [t('template_step3')],
        ['THP (Total Hero Power): numeric value (e.g., 120.5). Leave empty to default to 0.'],
        [t('template_step4')],
        [t('template_step5')]
    ];
    while (instructions.length < headerRowIndex) {
        instructions.push(['']);
    }
    instructions.push(headers);
    
    const exampleValueByKey = {
        name: 'Player1',
        power: 65.0,
        troops: 'Tank',
    };
    const createExampleRow = (overrides) => schema.columns.map((column) => {
        if (!column || !column.key) {
            return '';
        }
        if (overrides && Object.prototype.hasOwnProperty.call(overrides, column.key)) {
            return overrides[column.key];
        }
        return Object.prototype.hasOwnProperty.call(exampleValueByKey, column.key) ? exampleValueByKey[column.key] : '';
    });
    const examples = [
        createExampleRow({ name: 'Player1', power: 65.0, troops: 'Tank' }),
        createExampleRow({ name: 'Player2', power: 68.0, troops: 'Aero' }),
        createExampleRow({ name: 'Player3', power: 64.0, troops: 'Missile' }),
        createExampleRow({}),
        createExampleRow({}),
    ];
    
    const data = [...instructions, ...examples];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = headers.map((header) => ({
        wch: Math.max(15, String(header || '').length + 4),
    }));
    
    XLSX.utils.book_append_sheet(wb, ws, schema.sheetName || t('template_sheet_name'));
    XLSX.writeFile(wb, schema.templateFileName || 'player_database_template.xlsx');
    
    showMessage('uploadMessage', t('message_template_downloaded'), 'success');
}

// ============================================================
// ALLIANCE MANAGEMENT
// ============================================================

function toggleAlliancePanel() {
    showAlliancePage();
}

function openAlliancePanel() {
    showAlliancePage();
}

function closeAlliancePanel() {
    showGeneratorPage();
}

function renderAlliancePanel() {
    const content = document.getElementById('alliancePanelContent');
    if (!content) {
        return;
    }
    const gameplayContext = getGameplayContext();
    const hasAllianceMembership = !!(typeof FirebaseService !== 'undefined'
        && FirebaseService.getAllianceId
        && gameplayContext
        && FirebaseService.getAllianceId(gameplayContext));
    if (window.DSAlliancePanelUI && typeof window.DSAlliancePanelUI.renderAlliancePanel === 'function') {
        window.DSAlliancePanelUI.renderAlliancePanel({
            contentElement: content,
            hasAllianceMembership: hasAllianceMembership,
            getAllianceMembers: () => {
                const ctx = getGameplayContext();
                return ctx ? FirebaseService.getAllianceMembers(ctx) : {};
            },
            getAllianceName: () => {
                const ctx = getGameplayContext();
                return ctx ? FirebaseService.getAllianceName(ctx) : null;
            },
            getPendingInvitations: getPendingInvitationsList,
            getSentInvitations: getSentInvitationsList,
            getInvitationSenderDisplay: getInvitationSenderDisplay,
            formatInvitationCreatedAt: formatInvitationCreatedAt,
            getPendingInviteFocusId: () => pendingAllianceInviteFocusId,
            setPendingInviteFocusId: (value) => {
                pendingAllianceInviteFocusId = typeof value === 'string' ? value : '';
            },
            onCreateAlliance: () => {
                const controller = getAllianceFeatureController();
                if (controller && typeof controller.createAlliance === 'function') {
                    controller.createAlliance();
                    return;
                }
                handleCreateAlliance();
            },
            onSendInvitation: () => {
                const controller = getAllianceFeatureController();
                if (controller && typeof controller.sendInvitation === 'function') {
                    controller.sendInvitation();
                    return;
                }
                handleSendInvitation();
            },
            onLeaveAlliance: () => {
                const controller = getAllianceFeatureController();
                if (controller && typeof controller.leaveAlliance === 'function') {
                    controller.leaveAlliance();
                    return;
                }
                handleLeaveAlliance();
            },
            onAcceptInvitation: (invitationId, statusElementId) => {
                const controller = getAllianceFeatureController();
                if (controller && typeof controller.acceptInvitation === 'function') {
                    controller.acceptInvitation(invitationId, statusElementId);
                    return;
                }
                handleAcceptInvitation(invitationId, statusElementId);
            },
            onRejectInvitation: (invitationId, statusElementId) => {
                const controller = getAllianceFeatureController();
                if (controller && typeof controller.rejectInvitation === 'function') {
                    controller.rejectInvitation(invitationId, statusElementId);
                    return;
                }
                handleRejectInvitation(invitationId, statusElementId);
            },
            onResendInvitation: (invitationId, statusElementId) => {
                const controller = getAllianceFeatureController();
                if (controller && typeof controller.resendInvitation === 'function') {
                    controller.resendInvitation(invitationId, statusElementId);
                    return;
                }
                handleResendInvitation(invitationId, statusElementId);
            },
            onRevokeInvitation: (invitationId, statusElementId) => {
                const controller = getAllianceFeatureController();
                if (controller && typeof controller.revokeInvitation === 'function') {
                    controller.revokeInvitation(invitationId, statusElementId);
                    return;
                }
                handleRevokeInvitation(invitationId, statusElementId);
            },
            translate: t,
        });
        return;
    }
    content.innerHTML = '';
}

function getPendingInvitationsList() {
    if (typeof FirebaseService === 'undefined' || !FirebaseService.getPendingInvitations) {
        return [];
    }
    const gameplayContext = getGameplayContext();
    if (!gameplayContext) {
        return [];
    }
    const invitations = FirebaseService.getPendingInvitations(gameplayContext);
    return Array.isArray(invitations) ? invitations : [];
}

function getSentInvitationsList() {
    if (typeof FirebaseService === 'undefined' || !FirebaseService.getSentInvitations) {
        return [];
    }
    const gameplayContext = getGameplayContext();
    if (!gameplayContext) {
        return [];
    }
    const invitations = FirebaseService.getSentInvitations(gameplayContext);
    return Array.isArray(invitations) ? invitations : [];
}

function getInvitationSenderDisplay(invitation) {
    if (
        window.DSFeatureNotificationsCore
        && typeof window.DSFeatureNotificationsCore.getInvitationSenderDisplay === 'function'
    ) {
        return window.DSFeatureNotificationsCore.getInvitationSenderDisplay(invitation);
    }

    if (!invitation || typeof invitation !== 'object') {
        return '';
    }
    if (typeof invitation.inviterName === 'string' && invitation.inviterName.trim()) {
        return invitation.inviterName.trim();
    }
    if (typeof invitation.inviterEmail === 'string' && invitation.inviterEmail.trim()) {
        return invitation.inviterEmail.trim();
    }
    return '';
}

function formatInvitationCreatedAt(createdAt) {
    if (
        window.DSFeatureNotificationsCore
        && typeof window.DSFeatureNotificationsCore.formatInvitationCreatedAt === 'function'
    ) {
        return window.DSFeatureNotificationsCore.formatInvitationCreatedAt(createdAt);
    }

    if (!createdAt) {
        return '';
    }
    try {
        if (createdAt && typeof createdAt.toDate === 'function') {
            return createdAt.toDate().toLocaleString();
        }
        if (createdAt instanceof Date) {
            return createdAt.toLocaleString();
        }
        const value = new Date(createdAt);
        if (!Number.isNaN(value.getTime())) {
            return value.toLocaleString();
        }
    } catch (error) {
        return '';
    }
    return '';
}

function translateAllianceError(result, fallbackText) {
    if (result && result.errorKey) {
        return t(result.errorKey, result.errorParams || {});
    }
    if (result && result.error) {
        return result.error;
    }
    return fallbackText || t('error_generic', { error: 'unknown' });
}

let pendingAllianceInviteFocusId = '';

async function handleCreateAlliance() {
    const name = document.getElementById('newAllianceName').value.trim();

    if (!name || name.length > 40) {
        showMessage('allianceCreateStatus', t('alliance_error_invalid_name'), 'error');
        return;
    }

    showMessage('allianceCreateStatus', t('message_upload_processing'), 'processing');
    const gameplayContext = getGameplayContext('allianceCreateStatus');
    if (!gameplayContext) {
        return;
    }
    const result = await FirebaseService.createAlliance(name, gameplayContext);

    if (result.success) {
        showMessage('allianceCreateStatus', t('alliance_created'), 'success');
        renderAlliancePanel();
        updateAllianceHeaderDisplay();
    } else {
        showMessage('allianceCreateStatus', result.error, 'error');
    }
}

async function handleSendInvitation() {
    const email = document.getElementById('inviteEmail').value.trim();
    if (!email) {
        showMessage('inviteStatus', t('alliance_error_invalid_name'), 'error');
        return;
    }

    const gameplayContext = getGameplayContext('inviteStatus');
    if (!gameplayContext) {
        return;
    }
    const result = await FirebaseService.sendInvitation(email, gameplayContext);
    if (result.success) {
        showMessage('inviteStatus', t('alliance_invite_sent_in_app'), 'success');
        document.getElementById('inviteEmail').value = '';
        await checkAndDisplayNotifications();
        renderNotifications();
        renderAlliancePanel();
    } else {
        showMessage('inviteStatus', translateAllianceError(result), 'error');
    }
}

async function handleLeaveAlliance() {
    if (!confirm(t('alliance_confirm_leave'))) return;

    const gameplayContext = getGameplayContext();
    if (!gameplayContext) {
        return;
    }
    const result = await FirebaseService.leaveAlliance(gameplayContext);
    if (result.success) {
        renderAlliancePanel();
        updateAllianceHeaderDisplay();
        loadPlayerData();
    }
}

async function switchPlayerSource(source, statusElementId) {
    const gameplayContext = getGameplayContext(statusElementId);
    if (!gameplayContext) {
        return;
    }
    if (typeof FirebaseService === 'undefined') {
        return;
    }
    const hasAlliance = !!(FirebaseService.getAllianceId && FirebaseService.getAllianceId(gameplayContext));
    if (source === 'alliance' && !hasAlliance) {
        showMessage(statusElementId || 'playerSourceStatus', 'Join an alliance first.', 'error');
        return;
    }

    let switchResult = null;
    try {
        if (source === 'alliance' && typeof FirebaseService.loadAllianceData === 'function') {
            await FirebaseService.loadAllianceData(gameplayContext);
        }
        switchResult = await FirebaseService.setPlayerSource(source, gameplayContext);
    } catch (error) {
        switchResult = { success: false, error: error && error.message ? error.message : 'unknown' };
    }
    loadPlayerData();
    renderAlliancePanel();

    if (switchResult && switchResult.success === false) {
        showMessage(statusElementId || 'playerSourceStatus', switchResult.error || t('error_generic', { error: 'unknown' }), 'error');
        return;
    }

    const sourceLabels = {
        personal: t('alliance_source_personal'),
        alliance: t('alliance_source_alliance'),
    };
    const sourceLabel = Object.prototype.hasOwnProperty.call(sourceLabels, source)
        ? sourceLabels[source]
        : source;
    if (switchResult && switchResult.persisted === false) {
        const fallbackMessage = switchResult.warningMessage
            || 'Player source changed locally, but cloud sync is blocked by Firestore rules.';
        showMessage(statusElementId || 'playerSourceStatus', fallbackMessage, 'warning');
        return;
    }
    showMessage(statusElementId || 'playerSourceStatus', t('alliance_source_switched', { source: sourceLabel }), 'success');
}

function updateAllianceHeaderDisplay() {
    if (typeof FirebaseService === 'undefined') return;
    const gameplayContext = getGameplayContext();
    const aid = gameplayContext ? FirebaseService.getAllianceId(gameplayContext) : null;
    const aName = gameplayContext ? FirebaseService.getAllianceName(gameplayContext) : null;
    const display = document.getElementById('allianceDisplay');
    const createBtn = document.getElementById('allianceCreateBtn');

    if (aid) {
        if (display) {
            display.textContent = '(' + (aName || aid) + ')';
            display.style.display = 'inline';
        }
        if (createBtn) createBtn.style.display = 'none';
    } else {
        if (display) display.style.display = 'none';
        if (createBtn) createBtn.style.display = 'inline-flex';
    }
}

// ============================================================
// NOTIFICATION SYSTEM
// ============================================================

let notificationPollInterval = null;

async function checkAndDisplayNotifications() {
    if (typeof FirebaseService === 'undefined' || !FirebaseService.isSignedIn()) return;
    const gameplayContext = getGameplayContext();
    if (!gameplayContext) {
        return;
    }
    const notifications = await FirebaseService.checkInvitations(gameplayContext);
    const badgeState = (
        window.DSFeatureNotificationsCore
        && typeof window.DSFeatureNotificationsCore.getNotificationBadgeState === 'function'
    )
        ? window.DSFeatureNotificationsCore.getNotificationBadgeState(notifications)
        : {
            count: Array.isArray(notifications) ? notifications.length : 0,
            hasNotifications: Array.isArray(notifications) && notifications.length > 0,
        };
    const badge = document.getElementById('notificationBadge');
    const notificationBtn = document.getElementById('notificationBtn');
    if (badge) {
        badge.textContent = badgeState.count;
        badge.style.display = badgeState.hasNotifications ? 'flex' : 'none';
    }
    if (notificationBtn) {
        notificationBtn.classList.toggle('has-notifications', badgeState.hasNotifications);
    }
}

function startNotificationPolling() {
    if (notificationPollInterval) return;
    notificationPollInterval = setInterval(() => {
        if (document.visibilityState === 'visible' && typeof FirebaseService !== 'undefined' && FirebaseService.isSignedIn()) {
            checkAndDisplayNotifications();
        }
    }, 60000);
}

function stopNotificationPolling() {
    if (notificationPollInterval) {
        clearInterval(notificationPollInterval);
        notificationPollInterval = null;
    }
}

async function toggleNotificationsPanel() {
    const panel = document.getElementById('notificationsPanel');
    const triggerBtn = document.getElementById('notificationBtn');
    if (!panel) {
        return;
    }
    const isOpen = panel.classList.contains('hidden') || !panel.classList.contains('ui-open');
    if (
        window.DSShellNotificationsSheetController
        && typeof window.DSShellNotificationsSheetController.setSheetState === 'function'
    ) {
        window.DSShellNotificationsSheetController.setSheetState({
            panel: panel,
            triggerButton: triggerBtn,
            body: document.body,
            isOpen: isOpen,
            setPanelVisibility: setPanelVisibility,
        });
    } else {
        setPanelVisibility(panel, isOpen);
        if (triggerBtn) {
            triggerBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        }
        document.body.classList.toggle('notifications-sheet-open', isOpen);
    }
    if (isOpen) {
        await checkAndDisplayNotifications();
        renderNotifications();
    }
}

function closeNotificationsPanel() {
    const panel = document.getElementById('notificationsPanel');
    const triggerBtn = document.getElementById('notificationBtn');
    if (!panel || (panel.classList.contains('hidden') && !panel.classList.contains('ui-open'))) {
        return;
    }
    if (
        window.DSShellNotificationsSheetController
        && typeof window.DSShellNotificationsSheetController.setSheetState === 'function'
    ) {
        window.DSShellNotificationsSheetController.setSheetState({
            panel: panel,
            triggerButton: triggerBtn,
            body: document.body,
            isOpen: false,
            setPanelVisibility: setPanelVisibility,
        });
    } else {
        setPanelVisibility(panel, false);
        if (triggerBtn) {
            triggerBtn.setAttribute('aria-expanded', 'false');
        }
        document.body.classList.remove('notifications-sheet-open');
    }
}

function getNotificationItems() {
    if (typeof FirebaseService === 'undefined') {
        return [];
    }
    const gameplayContext = getGameplayContext();
    if (!gameplayContext) {
        return [];
    }
    if (FirebaseService.getInvitationNotifications) {
        const items = FirebaseService.getInvitationNotifications(gameplayContext);
        return Array.isArray(items) ? items : [];
    }

    const invitations = FirebaseService.getPendingInvitations ? FirebaseService.getPendingInvitations(gameplayContext) : [];
    if (!Array.isArray(invitations)) {
        return [];
    }

    return invitations.map((inv) => ({
        id: inv && inv.id ? `invite:${inv.id}` : '',
        invitationId: inv && inv.id ? inv.id : '',
        notificationType: 'invitation_pending',
        allianceId: inv && inv.allianceId ? inv.allianceId : '',
        allianceName: inv && inv.allianceName ? inv.allianceName : '',
        inviterEmail: inv && inv.inviterEmail ? inv.inviterEmail : '',
        inviterName: inv && inv.inviterName ? inv.inviterName : '',
        createdAt: inv && inv.createdAt ? inv.createdAt : null,
    }));
}

function renderNotifications() {
    const container = document.getElementById('notificationsList');
    const notifications = getNotificationItems();

    if (notifications.length === 0) {
        const emptyState = document.createElement('p');
        emptyState.className = 'notifications-empty';
        emptyState.textContent = t('notifications_empty');
        container.replaceChildren(emptyState);
        return;
    }

    container.replaceChildren();
    notifications.forEach((item) => {
        const card = document.createElement('div');
        card.className = 'notification-card';
        card.tabIndex = 0;
        card.setAttribute('role', 'button');

        const heading = document.createElement('div');
        heading.className = 'notification-card-heading';
        const allianceLabel = (typeof item.allianceName === 'string' && item.allianceName.trim())
            ? item.allianceName.trim()
            : String(item.allianceId || '');
        const title = document.createElement('strong');
        title.textContent = t('notification_alliance_label', { alliance: allianceLabel || '-' });
        heading.appendChild(title);

        const detail = document.createElement('div');
        detail.className = 'notification-card-detail';
        if (
            window.DSFeatureNotificationsCore
            && typeof window.DSFeatureNotificationsCore.getNotificationDetailText === 'function'
        ) {
            detail.textContent = window.DSFeatureNotificationsCore.getNotificationDetailText(item, t);
        } else {
            const notificationType = item && typeof item.notificationType === 'string'
                ? item.notificationType
                : 'invitation_pending';
            if (notificationType === 'invite_reminder_day1') {
                detail.textContent = t('notification_invite_reminder_day1');
            } else if (notificationType === 'invite_reminder_day3') {
                detail.textContent = t('notification_invite_reminder_day3');
            } else {
                detail.textContent = t('notification_invited_by', { email: getInvitationSenderDisplay(item) || '-' });
            }
        }

        const cta = document.createElement('div');
        cta.className = 'notification-card-cta';
        cta.textContent = t('notification_open_alliance');

        card.appendChild(heading);
        card.appendChild(detail);
        card.appendChild(cta);
        card.addEventListener('click', () => openAllianceInvitesFromNotification(item.invitationId || item.id));
        card.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openAllianceInvitesFromNotification(item.invitationId || item.id);
            }
        });
        container.appendChild(card);
    });
}

function openAllianceInvitesFromNotification(invitationId) {
    pendingAllianceInviteFocusId = invitationId || '';
    closeNotificationsPanel();
    closeNavigationMenu();
    openAlliancePanel();
}

async function handleAcceptInvitation(invitationId, statusElementId) {
    const gameplayContext = getGameplayContext(statusElementId);
    if (!gameplayContext) {
        return;
    }
    const invitation = getPendingInvitationsList().find((item) => item && item.id === invitationId);
    const currentAllianceId = typeof FirebaseService !== 'undefined' && FirebaseService.getAllianceId
        ? FirebaseService.getAllianceId(gameplayContext)
        : null;
    if (currentAllianceId && invitation && invitation.allianceId && currentAllianceId !== invitation.allianceId) {
        showMessage(statusElementId || 'allianceInvitesStatus', t('alliance_error_already_in_alliance'), 'error');
        return;
    }
    const allianceName = invitation && (invitation.allianceName || invitation.allianceId)
        ? String(invitation.allianceName || invitation.allianceId)
        : '';
    if (!confirm(t('alliance_confirm_join_invite', { alliance: allianceName || '-' }))) {
        return;
    }

    const result = await FirebaseService.acceptInvitation(invitationId, gameplayContext);
    if (result.success) {
        await checkAndDisplayNotifications();
        renderNotifications();
        renderAlliancePanel();
        updateAllianceHeaderDisplay();
        loadPlayerData();
    } else {
        showMessage(statusElementId || 'allianceInvitesStatus', translateAllianceError(result), 'error');
    }
}

async function handleRejectInvitation(invitationId, statusElementId) {
    const gameplayContext = getGameplayContext(statusElementId);
    if (!gameplayContext) {
        return;
    }
    const result = await FirebaseService.rejectInvitation(invitationId, gameplayContext);
    if (result.success) {
        await checkAndDisplayNotifications();
        renderNotifications();
        renderAlliancePanel();
        showMessage(statusElementId || 'allianceInvitesStatus', t('success_generic'), 'success');
    } else {
        showMessage(statusElementId || 'allianceInvitesStatus', translateAllianceError(result), 'error');
    }
}

async function handleRevokeInvitation(invitationId, statusElementId) {
    const gameplayContext = getGameplayContext(statusElementId);
    if (!gameplayContext) {
        return;
    }
    const result = await FirebaseService.revokeInvitation(invitationId, gameplayContext);
    if (result.success) {
        await checkAndDisplayNotifications();
        renderNotifications();
        renderAlliancePanel();
        showMessage(statusElementId || 'allianceSentInvitesStatus', t('alliance_invite_revoke_success'), 'success');
    } else {
        showMessage(statusElementId || 'allianceSentInvitesStatus', translateAllianceError(result), 'error');
    }
}

async function handleResendInvitation(invitationId, statusElementId) {
    const gameplayContext = getGameplayContext(statusElementId);
    if (!gameplayContext) {
        return;
    }
    const result = await FirebaseService.resendInvitation(invitationId, gameplayContext);
    if (result.success) {
        await checkAndDisplayNotifications();
        renderNotifications();
        renderAlliancePanel();
        showMessage(statusElementId || 'allianceSentInvitesStatus', t('alliance_invite_resend_success'), 'success');
    } else {
        showMessage(statusElementId || 'allianceSentInvitesStatus', translateAllianceError(result), 'error');
    }
}

// ============================================================
// PLAYER DATA MANAGEMENT
// ============================================================

let pendingUploadFile = null;

async function uploadPlayerData() {
    const activeGameId = enforceGameplayContext('uploadMessage');
    if (!activeGameId) {
        return;
    }
    if (typeof FirebaseService === 'undefined') {
        showMessage('uploadMessage', t('error_firebase_not_loaded'), 'error');
        return;
    }

    const fileInput = document.getElementById('playerFileInput');
    const file = fileInput.files[0];

    if (!file) return;

    try {
        await ensureXLSXLoaded();
    } catch (error) {
        console.error(error);
        showMessage('uploadMessage', t('error_xlsx_missing'), 'error');
        fileInput.value = '';
        return;
    }

    const gameplayContext = getGameplayContext('uploadMessage');
    if (FirebaseService.getAllianceId(gameplayContext || undefined)) {
        pendingUploadFile = file;
        openUploadTargetModal();
    } else {
        await performUpload(file, 'personal');
    }

    fileInput.value = '';
}

function closeUploadTargetModal() {
    pendingUploadFile = null;
    const modal = document.getElementById('uploadTargetModal');
    if (modal) {
        closeModalOverlay(modal);
    }
}

function openUploadTargetModal() {
    const modal = document.getElementById('uploadTargetModal');
    if (!modal) {
        return;
    }
    const gameplayContext = getGameplayContext();
    const hasAlliance = !!(typeof FirebaseService !== 'undefined' && FirebaseService.getAllianceId && FirebaseService.getAllianceId(gameplayContext || undefined));
    const personalBtn = document.getElementById('uploadPersonalBtn');
    const allianceBtn = document.getElementById('uploadAllianceBtn');
    const bothBtn = document.getElementById('uploadBothBtn');
    if (personalBtn) personalBtn.classList.remove('hidden');
    if (allianceBtn) allianceBtn.classList.toggle('hidden', !hasAlliance);
    if (bothBtn) bothBtn.classList.toggle('hidden', !hasAlliance);
    openModalOverlay(modal, { initialFocusSelector: '#uploadPersonalBtn' });
}

async function uploadToPersonal() {
    const file = pendingUploadFile;
    closeUploadTargetModal();
    if (file) await performUpload(file, 'personal');
}

async function uploadToAlliance() {
    const file = pendingUploadFile;
    closeUploadTargetModal();
    if (file) await performUpload(file, 'alliance');
}

async function uploadToBoth() {
    const file = pendingUploadFile;
    closeUploadTargetModal();
    if (file) await performUpload(file, 'both');
}

function getUploadErrorMessage(resultOrError) {
    if (resultOrError && typeof resultOrError === 'object') {
        if (resultOrError.errorKey) {
            return t(resultOrError.errorKey, resultOrError.errorParams || {});
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

async function performUpload(file, target) {
    try {
        await ensureXLSXLoaded();
    } catch (error) {
        console.error(error);
        showMessage('uploadMessage', t('error_xlsx_missing'), 'error');
        return;
    }

    showMessage('uploadMessage', t('message_upload_processing'), 'processing');
    const gameplayContext = getGameplayContext('uploadMessage');
    if (!gameplayContext) {
        return;
    }

    try {
        if (target === 'both') {
            let personalResult = null;
            let allianceResult = null;
            let personalError = '';
            let allianceError = '';

            try {
                personalResult = await FirebaseService.uploadPlayerDatabase(file, gameplayContext);
            } catch (error) {
                personalError = getUploadErrorMessage(error);
            }

            try {
                allianceResult = await FirebaseService.uploadAlliancePlayerDatabase(file, gameplayContext);
            } catch (error) {
                allianceError = getUploadErrorMessage(error);
            }

            const personalOk = !!(personalResult && personalResult.success);
            const allianceOk = !!(allianceResult && allianceResult.success);
            if (personalOk && allianceOk) {
                showMessage('uploadMessage', `${personalResult.message} | ${allianceResult.message}`, 'success');
                loadPlayerData();
                return;
            }

            if (personalOk || allianceOk) {
                const personalStatus = personalOk ? t('success_generic') : t('message_upload_failed', { error: personalError || getUploadErrorMessage(personalResult) });
                const allianceStatus = allianceOk ? t('success_generic') : t('message_upload_failed', { error: allianceError || getUploadErrorMessage(allianceResult) });
                showMessage('uploadMessage', `${t('upload_target_personal')}: ${personalStatus} | ${t('upload_target_alliance')}: ${allianceStatus}`, 'warning');
                loadPlayerData();
                return;
            }

            const mergedError = [personalError || getUploadErrorMessage(personalResult), allianceError || getUploadErrorMessage(allianceResult)]
                .filter(Boolean)
                .join(' | ');
            showMessage('uploadMessage', t('message_upload_failed', { error: mergedError || 'unknown' }), 'error');
            return;
        }

        const result = target === 'alliance'
            ? await FirebaseService.uploadAlliancePlayerDatabase(file, gameplayContext)
            : await FirebaseService.uploadPlayerDatabase(file, gameplayContext);

        if (!result || !result.success) {
            showMessage('uploadMessage', t('message_upload_failed', { error: getUploadErrorMessage(result) }), 'error');
            return;
        }
        showMessage('uploadMessage', result.message, 'success');
        loadPlayerData();
    } catch (error) {
        showMessage('uploadMessage', t('message_upload_failed', { error: getUploadErrorMessage(error) }), 'error');
    }
}

function syncPlayersFromActiveDatabase(options) {
    if (typeof FirebaseService === 'undefined') {
        return;
    }

    const config = options && typeof options === 'object' ? options : {};
    const gameplayContext = getGameplayContext();
    if (!gameplayContext) {
        return;
    }
    const playerDB = FirebaseService.getActivePlayerDatabase(gameplayContext);
    const source = FirebaseService.getPlayerSource(gameplayContext);
    const sourceLabel = source === 'alliance' ? t('player_source_alliance') : t('player_source_personal');
    const count = playerDB && typeof playerDB === 'object' ? Object.keys(playerDB).length : 0;

    allPlayers = Object.keys(playerDB || {}).map((name) => ({
        ...normalizePlayerRecordForUi(name, playerDB[name]),
    }));

    const playerCountEl = document.getElementById('playerCount');
    if (playerCountEl) {
        playerCountEl.textContent = t('player_count_with_source', { count: count, source: sourceLabel });
    }

    const uploadHintEl = document.getElementById('uploadHint');
    if (uploadHintEl) {
        uploadHintEl.textContent = count > 0 ? t('upload_hint') : '';
    }

    renderSelectionSourceControls();
    renderPlayersManagementPanel();

    if (config.renderGeneratorViews !== false) {
        renderPlayersTable();
        updateTeamCounters();
    }
}

function handleAllianceDataRealtimeUpdate() {
    if (typeof FirebaseService === 'undefined') {
        return;
    }

    if (getCurrentPageViewState() === 'alliance') {
        renderAlliancePanel();
    }

    const gameplayContext = getGameplayContext();
    const source = FirebaseService.getPlayerSource ? FirebaseService.getPlayerSource(gameplayContext || undefined) : 'personal';
    if (source === 'alliance') {
        syncPlayersFromActiveDatabase({ renderGeneratorViews: true });
    } else {
        renderPlayersManagementPanel();
    }

    updateAllianceHeaderDisplay();
    updateFloatingButtonsVisibility();
}

function loadPlayerData() {
    const gameplayContext = getGameplayContext('uploadMessage');
    if (!gameplayContext) {
        console.error('missing-active-game');
        return;
    }
    if (typeof FirebaseService === 'undefined') {
        console.error('FirebaseService not available');
        return;
    }

    buildRegistryFromStorage();
    syncRuntimeStateWithRegistry();
    renderAllEventSelectors();
    renderEventsList();
    updateGenerateEventLabels();
    if (!eventEditorCurrentId || !window.DSCoreEvents.getEvent(eventEditorCurrentId)) {
        applySelectedEventToEditor();
    }
    updateEventEditorState();
    
    const playerDB = FirebaseService.getActivePlayerDatabase(gameplayContext);
    const count = Object.keys(playerDB).length;
    const source = FirebaseService.getPlayerSource(gameplayContext);
    const sourceLabel = source === 'alliance' ? t('player_source_alliance') : t('player_source_personal');
    renderSelectionSourceControls();

    document.getElementById('playerCount').textContent = t('player_count_with_source', { count: count, source: sourceLabel });
    
    if (count > 0) {
        allPlayers = Object.keys(playerDB).map((name) => normalizePlayerRecordForUi(name, playerDB[name]));
        
        // Collapse upload panel and show selection
        uploadPanelExpanded = false;
        document.getElementById('uploadContent').classList.add('collapsed');
        document.getElementById('uploadExpandIcon').classList.remove('rotated');
        document.getElementById('uploadHint').textContent = t('upload_hint');
        
        showSelectionInterface();
    } else {
        allPlayers = [];
        teamSelections.teamA = [];
        teamSelections.teamB = [];
        assignmentsA = [];
        assignmentsB = [];
        substitutesA = [];
        substitutesB = [];

        // Keep upload panel expanded
        uploadPanelExpanded = true;
        document.getElementById('uploadContent').classList.remove('collapsed');
        document.getElementById('uploadExpandIcon').classList.add('rotated');
        document.getElementById('uploadHint').textContent = '';
        document.getElementById('selectionSection').classList.remove('hidden');
        renderPlayersTable();
        updateTeamCounters();
        showPlayersManagementPage();
    }

    renderPlayersManagementPanel();
}

function showSelectionInterface() {
    document.getElementById('selectionSection').classList.remove('hidden');
    showGeneratorPage();
    renderSelectionSourceControls();
    renderPlayersTable();
    updateTeamCounters();
}

function renderSelectionSourceControls() {
    const controls = document.getElementById('selectionSourceControls');
    const personalBtn = document.getElementById('selectionSourcePersonalBtn');
    const allianceBtn = document.getElementById('selectionSourceAllianceBtn');
    if (!controls || !personalBtn || !allianceBtn || typeof FirebaseService === 'undefined') {
        return;
    }

    const gameplayContext = getGameplayContext();
    const hasAlliance = !!(FirebaseService.getAllianceId && FirebaseService.getAllianceId(gameplayContext || undefined));
    if (!hasAlliance) {
        controls.classList.add('hidden');
        return;
    }
    controls.classList.remove('hidden');

    const source = FirebaseService.getPlayerSource ? FirebaseService.getPlayerSource(gameplayContext || undefined) : 'personal';
    const personalActive = source !== 'alliance';
    const allianceActive = source === 'alliance';
    personalBtn.classList.toggle('secondary', !personalActive);
    allianceBtn.classList.toggle('secondary', !allianceActive);
    personalBtn.disabled = personalActive;
    allianceBtn.disabled = allianceActive;
}

function toggleBuildingsPanel() {
    showConfigurationPage();
}

function getDefaultBuildings() {
    const defaults = window.DSCoreEvents.cloneEventBuildings(currentEvent);
    return Array.isArray(defaults) ? defaults : [];
}

function toggleEventsPanel() {
    eventsPanelExpanded = !eventsPanelExpanded;
    const content = document.getElementById('eventsContent');
    const icon = document.getElementById('eventsExpandIcon');
    if (!content || !icon) {
        return;
    }

    if (eventsPanelExpanded) {
        content.classList.remove('collapsed');
        icon.classList.add('rotated');
    } else {
        content.classList.add('collapsed');
        icon.classList.remove('rotated');
    }
}

function getBuildingConfig() {
    ensureEventRuntimeState(currentEvent);
    if (!buildingConfigs[currentEvent]) {
        buildingConfigs[currentEvent] = getDefaultBuildings();
    }
    return buildingConfigs[currentEvent];
}

function getBuildingDisplayName(internalName) {
    const building = getBuildingConfig().find((b) => b.name === internalName);
    if (!building) {
        return internalName;
    }
    return (typeof building.label === 'string' && building.label.trim()) ? building.label.trim() : internalName;
}

function isBuildingShownOnMap(internalName) {
    const building = getBuildingConfig().find((b) => b.name === internalName);
    if (!building) {
        return true;
    }
    return building.showOnMap !== false;
}

function getBuildingEditIcon(editing) {
    if (editing) {
        return `
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"/>
            </svg>
        `;
    }
    return `
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 20h9"/>
            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>
        </svg>
    `;
}

function toggleBuildingFieldEdit(buttonEl) {
    const row = buttonEl.closest('tr');
    const field = buttonEl.getAttribute('data-field');
    if (!row || !field) return;
    const input = row.querySelector(`input[data-field="${field}"]`);
    if (!input) return;

    const nextEditing = input.disabled;
    input.disabled = !nextEditing;
    buttonEl.classList.toggle('is-editing', nextEditing);
    buttonEl.setAttribute('aria-label', nextEditing ? `Lock ${field}` : `Edit ${field}`);
    buttonEl.title = nextEditing ? `Lock ${field}` : `Edit ${field}`;
    buttonEl.innerHTML = getBuildingEditIcon(nextEditing);

    if (nextEditing) {
        input.focus();
        if (typeof input.select === 'function' && input.type === 'text') {
            input.select();
        }
    }
}

function setBuildingConfig(config) {
    ensureEventRuntimeState(currentEvent);
    buildingConfigs[currentEvent] = config;
}

function getBuildingPositions() {
    ensureEventRuntimeState(currentEvent);
    return buildingPositionsMap[currentEvent];
}

function setBuildingPositionsLocal(positions) {
    ensureEventRuntimeState(currentEvent);
    buildingPositionsMap[currentEvent] = positions;
}

function clampPriority(value, fallback) {
    return window.DSCoreBuildings.clampPriority(value, fallback);
}

function clampSlots(value, fallback) {
    return window.DSCoreBuildings.clampSlots(value, fallback, MIN_BUILDING_SLOTS, MAX_BUILDING_SLOTS_TOTAL);
}

function getBuildingSlotsTotal(config) {
    return window.DSCoreBuildings.getBuildingSlotsTotal(config);
}

function normalizeBuildingConfig(config, defaultsOverride) {
    const defaults = Array.isArray(defaultsOverride) ? defaultsOverride : getDefaultBuildings();
    return window.DSCoreBuildings.normalizeBuildingConfig(
        config,
        defaults,
        MIN_BUILDING_SLOTS,
        MAX_BUILDING_SLOTS_TOTAL
    );
}

function getDefaultBuildingPositions() {
    return window.DSCoreEvents.cloneDefaultPositions(currentEvent);
}

function normalizeBuildingPositions(positions) {
    const activeEvent = getActiveEvent();
    const validNames = new Set((activeEvent && Array.isArray(activeEvent.buildings) ? activeEvent.buildings : []).map((b) => b.name));
    return window.DSCoreBuildings.normalizeBuildingPositions(positions, validNames);
}

function getGlobalDefaultBuildingPositions() {
    if (typeof FirebaseService === 'undefined' || typeof FirebaseService.getGlobalDefaultBuildingPositions !== 'function') {
        return {};
    }
    return normalizeBuildingPositions(FirebaseService.getGlobalDefaultBuildingPositions(currentEvent));
}

function getResolvedDefaultBuildingPositions() {
    return {
        ...getDefaultBuildingPositions(),
        ...getGlobalDefaultBuildingPositions(),
    };
}

function getTargetBuildingPositionsVersion() {
    let targetVersion = BUILDING_POSITIONS_VERSION;
    if (typeof FirebaseService !== 'undefined' && typeof FirebaseService.getGlobalDefaultBuildingPositionsVersion === 'function') {
        const sharedVersion = Number(FirebaseService.getGlobalDefaultBuildingPositionsVersion());
        if (Number.isFinite(sharedVersion) && sharedVersion > targetVersion) {
            targetVersion = sharedVersion;
        }
    }
    return targetVersion;
}

function getEffectiveBuildingPositions() {
    return { ...getResolvedDefaultBuildingPositions(), ...getBuildingPositions() };
}

function getEffectiveBuildingConfig() {
    return normalizeBuildingConfig(getBuildingConfig(), getResolvedDefaultBuildingConfig());
}

function getGlobalDefaultBuildingConfig() {
    if (typeof FirebaseService === 'undefined' || typeof FirebaseService.getGlobalDefaultBuildingConfig !== 'function') {
        return null;
    }
    const config = FirebaseService.getGlobalDefaultBuildingConfig(currentEvent);
    return Array.isArray(config) ? config : null;
}

function getResolvedDefaultBuildingConfig() {
    const baseDefaults = getDefaultBuildings();
    const globalDefaults = getGlobalDefaultBuildingConfig();
    if (!Array.isArray(globalDefaults) || globalDefaults.length === 0) {
        return baseDefaults;
    }
    return normalizeBuildingConfig(globalDefaults, baseDefaults);
}

function getTargetBuildingConfigVersion() {
    let targetVersion = BUILDING_CONFIG_VERSION;
    if (typeof FirebaseService !== 'undefined' && typeof FirebaseService.getGlobalDefaultBuildingConfigVersion === 'function') {
        const sharedVersion = Number(FirebaseService.getGlobalDefaultBuildingConfigVersion());
        if (Number.isFinite(sharedVersion) && sharedVersion > targetVersion) {
            targetVersion = sharedVersion;
        }
    }
    return targetVersion;
}

function loadBuildingConfig() {
    if (typeof FirebaseService === 'undefined') {
        setBuildingConfig(getResolvedDefaultBuildingConfig());
        renderBuildingsTable();
        return;
    }
    const eventContext = getEventGameplayContext(currentEvent);
    const stored = FirebaseService.getBuildingConfig(currentEvent, eventContext || undefined);
    const defaultConfig = getResolvedDefaultBuildingConfig();
    const targetVersion = getTargetBuildingConfigVersion();
    const shouldResetToDefaults = !Array.isArray(stored) || stored.length === 0;
    const normalized = shouldResetToDefaults
        ? normalizeBuildingConfig(defaultConfig, defaultConfig)
        : normalizeBuildingConfig(stored, stored);
    setBuildingConfig(normalized);
    const totalSlots = getBuildingSlotsTotal(normalized);
    const slotsOverLimit = totalSlots > MAX_BUILDING_SLOTS_TOTAL;
    if (slotsOverLimit) {
        setBuildingConfig(normalizeBuildingConfig(defaultConfig, defaultConfig));
        showMessage('buildingsStatus', t('buildings_slots_exceeded_saved', { max: MAX_BUILDING_SLOTS_TOTAL }), 'error');
    }

    const config = getBuildingConfig();
    const needsSave = shouldResetToDefaults || slotsOverLimit || !Array.isArray(stored) || stored.length !== config.length || stored.some((item) => {
        if (!item || !item.name) {
            return true;
        }
        const match = config.find((b) => b.name === item.name);
        if (!match) {
            return true;
        }
        const priority = Number(item.priority);
        const slots = Number(item.slots);
        if (!Number.isFinite(priority) || priority !== match.priority) {
            return true;
        }
        if (!Number.isFinite(slots) || slots !== match.slots) {
            return true;
        }
        const storedLabel = (typeof item.label === 'string' && item.label.trim()) ? item.label.trim() : item.name;
        if (storedLabel !== match.label) {
            return true;
        }
        const storedShowOnMap = !Object.prototype.hasOwnProperty.call(item, 'showOnMap') || item.showOnMap !== false;
        const matchShowOnMap = !Object.prototype.hasOwnProperty.call(match, 'showOnMap') || match.showOnMap !== false;
        if (storedShowOnMap !== matchShowOnMap) {
            return true;
        }
        return false;
    });

    if (needsSave) {
        FirebaseService.setBuildingConfig(currentEvent, config, eventContext || undefined);
        FirebaseService.setBuildingConfigVersion(currentEvent, targetVersion, eventContext || undefined);
    }

    renderBuildingsTable();
    return needsSave;
}

function loadBuildingPositions() {
    if (typeof FirebaseService === 'undefined') {
        setBuildingPositionsLocal({});
        return false;
    }
    const eventContext = getEventGameplayContext(currentEvent);
    const stored = FirebaseService.getBuildingPositions(currentEvent, eventContext || undefined);
    const targetVersion = getTargetBuildingPositionsVersion();
    const targetDefaults = getResolvedDefaultBuildingPositions();
    setBuildingPositionsLocal(normalizeBuildingPositions(stored));
    if (Object.keys(getBuildingPositions()).length === 0) {
        setBuildingPositionsLocal(targetDefaults);
        FirebaseService.setBuildingPositions(currentEvent, getBuildingPositions(), eventContext || undefined);
        FirebaseService.setBuildingPositionsVersion(currentEvent, targetVersion, eventContext || undefined);
        return true;
    }
    return false;
}

function renderBuildingsTable() {
    const tbody = document.getElementById('buildingsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    getBuildingConfig().forEach((b, index) => {
        const row = document.createElement('tr');
        const labelEditing = false;
        const slotsEditing = false;
        const priorityEditing = false;
        row.innerHTML = `
            <td>
                <div class="building-field-cell">
                    <input type="text" value="${escapeAttribute((b.label || b.name))}" data-index="${index}" data-field="label" class="building-label-input" ${labelEditing ? '' : 'disabled'}>
                    <button type="button" class="building-edit-btn ${labelEditing ? 'is-editing' : ''}" data-action="toggle-edit" data-field="label" title="${labelEditing ? 'Lock name' : 'Edit name'}" aria-label="${labelEditing ? 'Lock name' : 'Edit name'}">${getBuildingEditIcon(labelEditing)}</button>
                </div>
            </td>
            <td data-label="${t('slots_label')}">
                <div class="building-field-cell">
                    <input type="number" min="${MIN_BUILDING_SLOTS}" max="${MAX_BUILDING_SLOTS_TOTAL}" value="${b.slots}" data-index="${index}" data-field="slots" class="building-slots-input" ${slotsEditing ? '' : 'disabled'}>
                    <button type="button" class="building-edit-btn ${slotsEditing ? 'is-editing' : ''}" data-action="toggle-edit" data-field="slots" title="${slotsEditing ? 'Lock slots' : 'Edit slots'}" aria-label="${slotsEditing ? 'Lock slots' : 'Edit slots'}">${getBuildingEditIcon(slotsEditing)}</button>
                </div>
            </td>
            <td data-label="${t('priority_label')}">
                <div class="building-field-cell">
                    <input type="number" min="1" max="6" value="${b.priority}" data-index="${index}" data-field="priority" class="building-priority-input" ${priorityEditing ? '' : 'disabled'}>
                    <button type="button" class="building-edit-btn ${priorityEditing ? 'is-editing' : ''}" data-action="toggle-edit" data-field="priority" title="${priorityEditing ? 'Lock priority' : 'Edit priority'}" aria-label="${priorityEditing ? 'Lock priority' : 'Edit priority'}">${getBuildingEditIcon(priorityEditing)}</button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function readBuildingConfigFromTable() {
    const tbody = document.getElementById('buildingsTableBody');
    const updated = getBuildingConfig().map((b) => ({ ...b }));
    if (!tbody) {
        return { updated, totalSlots: getBuildingSlotsTotal(updated) };
    }
    const inputs = tbody.querySelectorAll('input[data-index][data-field]');
    inputs.forEach((input) => {
        const index = Number(input.getAttribute('data-index'));
        if (!Number.isFinite(index) || !updated[index]) {
            return;
        }
        const field = input.getAttribute('data-field');
        if (field === 'label') {
            const raw = String(input.value || '').trim();
            updated[index].label = raw || updated[index].name;
            return;
        }

        const value = Number(input.value);
        if (!Number.isFinite(value)) {
            return;
        }
        if (field === 'priority') {
            updated[index].priority = clampPriority(value, updated[index].priority);
        } else if (field === 'slots') {
            updated[index].slots = clampSlots(value, updated[index].slots);
        }
    });
    return { updated, totalSlots: getBuildingSlotsTotal(updated) };
}

const buildingsTableBodyEl = document.getElementById('buildingsTableBody');
if (buildingsTableBodyEl) {
    buildingsTableBodyEl.addEventListener('click', (event) => {
        const btn = event.target.closest('button[data-action="toggle-edit"]');
        if (!btn) return;
        toggleBuildingFieldEdit(btn);
    });
}

function resetBuildingsToDefault() {
    setBuildingConfig(getResolvedDefaultBuildingConfig());
    renderBuildingsTable();
}

async function saveBuildingConfig() {
    const { updated, totalSlots } = readBuildingConfigFromTable();
    if (totalSlots > MAX_BUILDING_SLOTS_TOTAL) {
        showMessage('buildingsStatus', t('buildings_slots_exceeded', { max: MAX_BUILDING_SLOTS_TOTAL, total: totalSlots }), 'error');
        return;
    }

    setBuildingConfig(normalizeBuildingConfig(updated, getResolvedDefaultBuildingConfig()));
    renderBuildingsTable();

    if (typeof FirebaseService === 'undefined') {
        showMessage('buildingsStatus', t('buildings_changes_not_saved'), 'error');
        return;
    }
    const gameplayContext = getGameplayContext('buildingsStatus');
    if (!gameplayContext) {
        return;
    }
    const eventContext = { gameId: gameplayContext.gameId, eventId: normalizeEventId(currentEvent) };

    FirebaseService.setBuildingConfig(currentEvent, getBuildingConfig(), eventContext);
    FirebaseService.setBuildingConfigVersion(currentEvent, getTargetBuildingConfigVersion(), eventContext);
    const result = await FirebaseService.saveUserData(undefined, gameplayContext);
    if (result.success) {
        showMessage('buildingsStatus', t('buildings_saved'), 'success');
    } else {
        showMessage('buildingsStatus', t('buildings_save_failed', { error: result.error }), 'error');
    }
}

function refreshBuildingConfigForAssignments() {
    if (isConfigurationPageVisible()) {
        return syncBuildingConfigFromTable();
    }
    loadBuildingConfig();
    return true;
}

function syncBuildingConfigFromTable() {
    const tbody = document.getElementById('buildingsTableBody');
    if (!tbody || !isConfigurationPageVisible()) {
        return true;
    }
    const { updated, totalSlots } = readBuildingConfigFromTable();
    if (totalSlots > MAX_BUILDING_SLOTS_TOTAL) {
        showMessage('buildingsStatus', t('buildings_slots_exceeded', { max: MAX_BUILDING_SLOTS_TOTAL, total: totalSlots }), 'error');
        return false;
    }
    setBuildingConfig(normalizeBuildingConfig(updated, getResolvedDefaultBuildingConfig()));
    return true;
}

let coordBuildingIndex = 0;
let coordBuildings = [];
let coordCanvasMapHeight = 0;

function getCoordinatePickerBuildingNames() {
    const event = getActiveEvent();
    if (!event) {
        return [];
    }

    const sourceBuildings = Array.isArray(event.buildings) ? event.buildings : [];
    const names = [];
    const seen = new Set();

    sourceBuildings.forEach((building) => {
        if (!building || typeof building.name !== 'string') {
            return;
        }
        const name = building.name.trim();
        if (!name || seen.has(name)) {
            return;
        }
        if (building.showOnMap === false) {
            return;
        }
        seen.add(name);
        names.push(name);
    });

    if (names.length > 0) {
        return names;
    }

    return getBuildingConfig()
        .filter((building) => building && building.showOnMap !== false && typeof building.name === 'string' && building.name.trim())
        .map((building) => building.name.trim());
}

function getCoordinatePickerTeamBuildings() {
    const event = getActiveEvent();
    const teamBuildings = [];
    const seen = new Set();

    const collect = (sourceBuildings) => {
        if (!Array.isArray(sourceBuildings)) {
            return;
        }
        sourceBuildings.forEach((building) => {
            if (!building || typeof building.name !== 'string') {
                return;
            }
            const name = building.name.trim();
            if (!name || seen.has(name)) {
                return;
            }
            if (building.showOnMap !== false) {
                return;
            }
            const label = typeof building.label === 'string' && building.label.trim()
                ? building.label.trim()
                : name;
            seen.add(name);
            teamBuildings.push({ name, label });
        });
    };

    collect(event && Array.isArray(event.buildings) ? event.buildings : []);
    if (teamBuildings.length > 0) {
        return teamBuildings;
    }

    collect(getBuildingConfig());
    return teamBuildings;
}

function fitCoordText(ctx, text, maxWidth, font) {
    const value = String(text || '');
    if (!value) {
        return value;
    }
    if (!ctx || !Number.isFinite(maxWidth) || maxWidth <= 0) {
        return value;
    }
    ctx.save();
    if (font) {
        ctx.font = font;
    }
    if (ctx.measureText(value).width <= maxWidth) {
        ctx.restore();
        return value;
    }
    const suffix = '...';
    let trimmed = value;
    while (trimmed.length > 1 && ctx.measureText(trimmed + suffix).width > maxWidth) {
        trimmed = trimmed.slice(0, -1);
    }
    ctx.restore();
    return trimmed + suffix;
}

function refreshCoordinatesPickerForCurrentEvent() {
    if (!getActiveEvent()) {
        showMessage('coordStatus', t('events_manager_no_events'), 'error');
        return false;
    }
    loadBuildingConfig();
    loadBuildingPositions();
    coordBuildings = getCoordinatePickerBuildingNames();

    if (coordBuildings.length === 0) {
        showMessage('coordStatus', t('coord_no_mapped_buildings'), 'error');
        return false;
    }

    coordBuildingIndex = 0;
    drawCoordCanvas();
    return true;
}

function openCoordinatesPicker() {
    if (!getActiveEvent()) {
        showMessage('coordStatus', t('events_manager_no_events'), 'error');
        return;
    }
    const overlay = document.getElementById('coordPickerOverlay');
    if (!overlay) {
        return;
    }
    openModalOverlay(overlay, { initialFocusSelector: '#coordCloseBtn' });
    refreshCoordinatesPickerForCurrentEvent();
}

function openCoordinatesPickerForEvent(eventId) {
    if (EVENT_REGISTRY[eventId]) {
        switchEvent(eventId);
    }
    openCoordinatesPicker();
}

function closeCoordinatesPicker() {
    const overlay = document.getElementById('coordPickerOverlay');
    if (overlay) {
        closeModalOverlay(overlay);
    }
}

function updateCoordLabel() {
    const name = coordBuildings[coordBuildingIndex];
    const displayName = name || '';
    const pos = getBuildingPositions()[name];
    const eventNameEl = document.getElementById('coordEventName');
    if (eventNameEl) {
        eventNameEl.textContent = getEventDisplayName(currentEvent);
    }
    document.getElementById('coordBuildingLabel').textContent = displayName || '';
    document.getElementById('coordBuildingIndex').textContent = `(${coordBuildingIndex + 1}/${coordBuildings.length})`;
    document.getElementById('coordBuildingValue').textContent = pos
        ? t('coord_current', { x: pos[0], y: pos[1] })
        : t('coord_current_not_set');
    document.getElementById('coordPrompt').textContent = t('coord_select_prompt', { name: displayName });
}

function drawCoordCanvas() {
    const canvas = document.getElementById('coordCanvas');
    if (!canvas) return;

    updateCoordLabel();

    // Coordinate picker uses export map dimensions so picker/export coordinates stay identical.
    const activeMapPurpose = MAP_EXPORT;
    const activeMapState = getMapRuntimeState(currentEvent, activeMapPurpose);
    const activeMapImage = activeMapState ? activeMapState.image : null;
    const activeMapLoaded = activeMapState ? activeMapState.loaded : false;
    const activeMapUnavailable = activeMapState ? activeMapState.unavailable : false;
    const statusEl = document.getElementById('coordStatus');

    if (!activeMapLoaded && !activeMapUnavailable) {
        loadMapImage(currentEvent, activeMapPurpose)
            .then(() => drawCoordCanvas())
            .catch(() => {
                drawCoordCanvas();
            });
        return;
    }

    const ctx = canvas.getContext('2d');
    const hasMapBackground = !!(activeMapLoaded && activeMapImage && activeMapImage.width > 0 && activeMapImage.height > 0);
    const mapWidth = MAP_CANVAS_WIDTH;
    const mapHeight = hasMapBackground
        ? Math.max(1, Math.floor(activeMapImage.height * (mapWidth / activeMapImage.width)))
        : MAP_CANVAS_FALLBACK_HEIGHT;
    const coordTeamBuildings = getCoordinatePickerTeamBuildings();
    const hasTeamReservedArea = coordTeamBuildings.length > 0;
    const teamAreaTopGap = hasTeamReservedArea ? 12 : 0;
    const teamAreaHeaderHeight = hasTeamReservedArea ? 24 : 0;
    const teamTagHeight = hasTeamReservedArea ? 28 : 0;
    const teamTagGap = hasTeamReservedArea ? 8 : 0;
    const teamTagColumns = hasTeamReservedArea ? Math.min(3, coordTeamBuildings.length) : 0;
    const teamTagRows = hasTeamReservedArea ? Math.ceil(coordTeamBuildings.length / teamTagColumns) : 0;
    const teamAreaHeight = hasTeamReservedArea
        ? 12 + teamAreaHeaderHeight + (teamTagRows * teamTagHeight) + (Math.max(0, teamTagRows - 1) * teamTagGap) + 12
        : 0;

    coordCanvasMapHeight = mapHeight;
    canvas.width = mapWidth;
    canvas.height = mapHeight + teamAreaTopGap + teamAreaHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (hasMapBackground) {
        ctx.drawImage(activeMapImage, 0, 0, mapWidth, mapHeight);
        coordMapWarningShown[currentEvent] = false;
        if (statusEl) {
            statusEl.innerHTML = '';
        }
    } else {
        const grad = ctx.createLinearGradient(0, 0, mapWidth, mapHeight);
        grad.addColorStop(0, '#1f2238');
        grad.addColorStop(1, '#2b2f4a');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, mapWidth, mapHeight);

        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 1;
        for (let x = 0; x <= mapWidth; x += MAP_GRID_STEP) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, mapHeight);
            ctx.stroke();
        }
        for (let y = 0; y <= mapHeight; y += MAP_GRID_STEP) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(mapWidth, y);
            ctx.stroke();
        }

        ctx.fillStyle = 'rgba(253, 200, 48, 0.9)';
        ctx.font = 'bold 28px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('MAP PREVIEW UNAVAILABLE', mapWidth / 2, 52);
        ctx.font = '16px Arial';
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fillText(t('events_manager_map_placeholder'), mapWidth / 2, 80);

        if (!coordMapWarningShown[currentEvent]) {
            showMessage('coordStatus', t('coord_map_not_loaded'), 'warning');
            coordMapWarningShown[currentEvent] = true;
        }
    }

    const coordBuildingSet = new Set(coordBuildings);
    Object.entries(getBuildingPositions()).forEach(([name, pos]) => {
        if (!pos) return;
        if (!coordBuildingSet.has(name)) return;
        const isActive = name === coordBuildings[coordBuildingIndex];
        ctx.beginPath();
        ctx.arc(pos[0], pos[1], isActive ? 8 : 5, 0, Math.PI * 2);
        ctx.fillStyle = isActive ? '#FDC830' : 'rgba(255,255,255,0.7)';
        ctx.fill();
        ctx.strokeStyle = isActive ? '#000' : 'rgba(0,0,0,0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();
    });

    if (hasTeamReservedArea) {
        const panelX = 12;
        const panelY = mapHeight + teamAreaTopGap;
        const panelWidth = mapWidth - 24;
        const panelHeight = teamAreaHeight;

        const panelGrad = ctx.createLinearGradient(0, panelY, 0, panelY + panelHeight);
        panelGrad.addColorStop(0, 'rgba(22, 27, 40, 0.93)');
        panelGrad.addColorStop(1, 'rgba(18, 22, 34, 0.98)');
        ctx.fillStyle = panelGrad;
        ctx.beginPath();
        ctx.roundRect(panelX, panelY, panelWidth, panelHeight, 12);
        ctx.fill();
        ctx.strokeStyle = 'rgba(253, 200, 48, 0.72)';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        ctx.font = 'bold 13px Arial';
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const teamHeader = `${t('building_type_team')} ${t('coord_label_building')}`;
        ctx.fillText(teamHeader, panelX + 12, panelY + 18);

        ctx.font = '11px Arial';
        ctx.fillStyle = 'rgba(255,255,255,0.72)';
        ctx.textAlign = 'right';
        ctx.fillText(String(coordTeamBuildings.length), panelX + panelWidth - 12, panelY + 18);

        const cardsTop = panelY + 12 + teamAreaHeaderHeight;
        const cardGap = 8;
        const cardWidth = Math.floor((panelWidth - 24 - ((teamTagColumns - 1) * cardGap)) / teamTagColumns);

        coordTeamBuildings.forEach((building, index) => {
            const row = Math.floor(index / teamTagColumns);
            const col = index % teamTagColumns;
            const cardX = panelX + 12 + (col * (cardWidth + cardGap));
            const cardY = cardsTop + (row * (teamTagHeight + teamTagGap));

            const cardGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardWidth, cardY);
            cardGrad.addColorStop(0, 'rgba(255,255,255,0.08)');
            cardGrad.addColorStop(1, 'rgba(255,255,255,0.03)');
            ctx.fillStyle = cardGrad;
            ctx.beginPath();
            ctx.roundRect(cardX, cardY, cardWidth, teamTagHeight, 8);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.28)';
            ctx.lineWidth = 1;
            ctx.stroke();

            const tagText = `${t('building_type_team')}: ${building.label}`;
            ctx.font = 'bold 12px Arial';
            ctx.fillStyle = 'rgba(253, 200, 48, 0.95)';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(
                fitCoordText(ctx, tagText, cardWidth - 16, 'bold 12px Arial'),
                cardX + 8,
                cardY + (teamTagHeight / 2) + 0.5
            );
        });
    }
}

function coordCanvasClick(event) {
    const canvas = document.getElementById('coordCanvas');
    if (!canvas) return;
    if (event && event.type === 'pointerdown' && event.button !== 0) return;
    if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
    }
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.round((event.clientX - rect.left) * scaleX);
    const y = Math.round((event.clientY - rect.top) * scaleY);
    if (y > coordCanvasMapHeight) return;
    const name = coordBuildings[coordBuildingIndex];
    if (!name) return;
    getBuildingPositions()[name] = [x, y];
    updateCoordLabel();
    drawCoordCanvas();
    if (coordBuildingIndex < coordBuildings.length - 1) {
        coordBuildingIndex += 1;
        updateCoordLabel();
        drawCoordCanvas();
    }
}

function prevCoordBuilding() {
    if (coordBuildingIndex > 0) {
        coordBuildingIndex -= 1;
        drawCoordCanvas();
    }
}

function nextCoordBuilding() {
    if (coordBuildingIndex < coordBuildings.length - 1) {
        coordBuildingIndex += 1;
        drawCoordCanvas();
    }
}

async function saveBuildingPositions() {
    if (typeof FirebaseService === 'undefined') {
        showMessage('coordStatus', t('coord_changes_not_saved'), 'error');
        return;
    }
    const gameplayContext = getGameplayContext('coordStatus');
    if (!gameplayContext) {
        return;
    }
    const eventContext = { gameId: gameplayContext.gameId, eventId: normalizeEventId(currentEvent) };
    FirebaseService.setBuildingPositions(currentEvent, getBuildingPositions(), eventContext);
    FirebaseService.setBuildingPositionsVersion(currentEvent, getTargetBuildingPositionsVersion(), eventContext);
    const result = await FirebaseService.saveUserData(undefined, gameplayContext);
    if (result.success) {
        showMessage('coordStatus', t('coord_saved'), 'success');
    } else {
        showMessage('coordStatus', t('coord_save_failed', { error: result.error }), 'error');
    }
}

function reserveSpaceForFooter() {
    const bar = document.getElementById('floatingButtons');
    const mobileNav = document.getElementById('mobileBottomNav');
    const barVisible = !!bar && bar.style.display !== 'none';
    const mobileNavVisible = !!mobileNav && window.matchMedia('(max-width: 768px)').matches;
    const barHeight = barVisible ? bar.getBoundingClientRect().height : 0;
    const navHeight = mobileNavVisible ? mobileNav.getBoundingClientRect().height : 0;
    const root = document.documentElement;
    if (root) {
        root.style.setProperty('--mobile-nav-runtime-height', `${Math.ceil(navHeight)}px`);
    }
    const safeAreaInset = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-area-inset-bottom')) || 0;
    const totalHeight = barHeight + navHeight;
    document.body.style.paddingBottom = totalHeight > 0 ? `${Math.ceil(totalHeight + 18 + safeAreaInset)}px` : '';
}

window.addEventListener('resize', reserveSpaceForFooter);
if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', reserveSpaceForFooter);
    window.visualViewport.addEventListener('scroll', reserveSpaceForFooter);
}

// ============================================================
// PLAYER SELECTION INTERFACE
// ============================================================

let currentTroopsFilter = '';
let currentSortFilter = 'power-desc';
const playerRowCache = new Map();

function hasActivePlayerFilters() {
    const searchTerm = (document.getElementById('searchFilter')?.value || '').trim();
    return searchTerm.length > 0
        || currentTroopsFilter !== ''
        || currentSortFilter !== 'power-desc';
}

function hasAnySelectedPlayers() {
    if (
        window.DSAppStateStore
        && window.DSAppStateStore.selectors
        && typeof window.DSAppStateStore.selectors.selectTeamSelections === 'function'
    ) {
        const selected = window.DSAppStateStore.selectors.selectTeamSelections(getAppRuntimeState());
        const teamASelected = Array.isArray(selected.teamA) ? selected.teamA.length : 0;
        const teamBSelected = Array.isArray(selected.teamB) ? selected.teamB.length : 0;
        return (teamASelected + teamBSelected) > 0;
    }

    if (
        window.DSFeatureGeneratorTeamSelection
        && typeof window.DSFeatureGeneratorTeamSelection.hasAnySelectedPlayers === 'function'
    ) {
        return window.DSFeatureGeneratorTeamSelection.hasAnySelectedPlayers(teamSelections);
    }
    const teamASelected = Array.isArray(teamSelections?.teamA) ? teamSelections.teamA.length : 0;
    const teamBSelected = Array.isArray(teamSelections?.teamB) ? teamSelections.teamB.length : 0;
    return (teamASelected + teamBSelected) > 0;
}

function updateClearAllButtonVisibility() {
    const clearAllBtn = document.getElementById('clearAllBtn');
    if (!clearAllBtn) {
        return;
    }
    clearAllBtn.hidden = !(hasActivePlayerFilters() || hasAnySelectedPlayers());
}

function getCurrentTeamCounts() {
    if (
        window.DSAppStateStore
        && window.DSAppStateStore.selectors
        && typeof window.DSAppStateStore.selectors.selectTeamCounts === 'function'
    ) {
        syncGeneratorTeamSelectionsState();
        return window.DSAppStateStore.selectors.selectTeamCounts(getAppRuntimeState());
    }

    if (
        window.DSFeatureGeneratorTeamSelection
        && typeof window.DSFeatureGeneratorTeamSelection.getCurrentTeamCounts === 'function'
    ) {
        return window.DSFeatureGeneratorTeamSelection.getCurrentTeamCounts(teamSelections);
    }
    return {
        teamAStarterCount: getStarterCount('teamA'),
        teamASubCount: getSubstituteCount('teamA'),
        teamBStarterCount: getStarterCount('teamB'),
        teamBSubCount: getSubstituteCount('teamB'),
    };
}

function buildTeamSelectionMaps() {
    if (
        window.DSFeatureGeneratorTeamSelection
        && typeof window.DSFeatureGeneratorTeamSelection.buildTeamSelectionMaps === 'function'
    ) {
        return window.DSFeatureGeneratorTeamSelection.buildTeamSelectionMaps(teamSelections);
    }
    return {
        teamA: new Map(teamSelections.teamA.map((item) => [item.name, item])),
        teamB: new Map(teamSelections.teamB.map((item) => [item.name, item])),
    };
}

function getFilteredAndSortedPlayers() {
    const searchTerm = (document.getElementById('searchFilter').value || '').toLowerCase();
    if (window.DSPlayerTableUI && typeof window.DSPlayerTableUI.getFilteredAndSortedPlayers === 'function') {
        return window.DSPlayerTableUI.getFilteredAndSortedPlayers({
            allPlayers: allPlayers,
            searchTerm: searchTerm,
            troopsFilter: currentTroopsFilter,
            sortFilter: currentSortFilter,
        });
    }

    return allPlayers;
}

function refreshVisiblePlayerRows() {
    if (!(window.DSPlayerTableUI && typeof window.DSPlayerTableUI.refreshVisiblePlayerRows === 'function')) {
        return;
    }

    const tbody = document.getElementById('playersTableBody');
    window.DSPlayerTableUI.refreshVisiblePlayerRows({
        tbody: tbody,
        allPlayers: allPlayers,
        counts: getCurrentTeamCounts(),
        selectionMaps: buildTeamSelectionMaps(),
        translate: t,
    });
}

function renderPlayersTable() {
    if (!(window.DSPlayerTableUI && typeof window.DSPlayerTableUI.renderPlayersTable === 'function')) {
        return;
    }

    const tbody = document.getElementById('playersTableBody');
    const searchTerm = (document.getElementById('searchFilter').value || '').toLowerCase();
    window.DSPlayerTableUI.renderPlayersTable({
        tbody: tbody,
        allPlayers: allPlayers,
        rowCache: playerRowCache,
        getTroopLabel: getTroopLabel,
        counts: getCurrentTeamCounts(),
        selectionMaps: buildTeamSelectionMaps(),
        searchTerm: searchTerm,
        troopsFilter: currentTroopsFilter,
        sortFilter: currentSortFilter,
        translate: t,
    });
    updateClearAllButtonVisibility();
}

function toggleTeam(playerName, team) {
    if (
        window.DSFeatureGeneratorTeamSelection
        && typeof window.DSFeatureGeneratorTeamSelection.toggleTeamSelection === 'function'
    ) {
        const result = window.DSFeatureGeneratorTeamSelection.toggleTeamSelection(teamSelections, playerName, team, {
            maxTotal: 30,
            maxStarters: 20,
            maxSubstitutes: 10,
        });
        if (!result || !result.changed) {
            return;
        }
        teamSelections.teamA = Array.isArray(result.teamA) ? result.teamA : [];
        teamSelections.teamB = Array.isArray(result.teamB) ? result.teamB : [];
    } else {
        const teamKey = team === 'A' ? 'teamA' : 'teamB';
        const otherTeamKey = team === 'A' ? 'teamB' : 'teamA';

        const existingIndex = teamSelections[teamKey].findIndex(p => p.name === playerName);

        if (existingIndex > -1) {
            // Player is already on this team - remove them
            teamSelections[teamKey].splice(existingIndex, 1);
        } else {
            // Remove from other team if present
            const otherIndex = teamSelections[otherTeamKey].findIndex(p => p.name === playerName);
            if (otherIndex > -1) {
                teamSelections[otherTeamKey].splice(otherIndex, 1);
            }

            // Check total limit (30 players)
            if (teamSelections[teamKey].length >= 30) {
                return;
            }

            // Determine default role: starter if < 20 starters, otherwise substitute
            const starterCount = getStarterCount(teamKey);
            const subCount = getSubstituteCount(teamKey);

            let defaultRole;
            if (starterCount < 20) {
                defaultRole = 'starter';
            } else if (subCount < 10) {
                defaultRole = 'substitute';
            } else {
                // Both full - shouldn't happen if UI disables correctly
                return;
            }

            teamSelections[teamKey].push({
                name: playerName,
                role: defaultRole
            });
        }
    }

    updateTeamCounters();
    refreshVisiblePlayerRows();
}

function togglePlayerRole(playerName, newRole) {
    if (
        window.DSFeatureGeneratorTeamSelection
        && typeof window.DSFeatureGeneratorTeamSelection.setPlayerRole === 'function'
    ) {
        const result = window.DSFeatureGeneratorTeamSelection.setPlayerRole(teamSelections, playerName, newRole, {
            maxStarters: 20,
            maxSubstitutes: 10,
        });
        if (!result || !result.changed) {
            if (result && result.reason === 'starters_full') {
                alert(t('alert_starters_full'));
            } else if (result && result.reason === 'substitutes_full') {
                alert(t('alert_subs_full'));
            }
            return;
        }
        teamSelections.teamA = Array.isArray(result.teamA) ? result.teamA : [];
        teamSelections.teamB = Array.isArray(result.teamB) ? result.teamB : [];
    } else {
        // Find which team the player is on
        let teamKey = null;
        let playerIndex = teamSelections.teamA.findIndex(p => p.name === playerName);

        if (playerIndex > -1) {
            teamKey = 'teamA';
        } else {
            playerIndex = teamSelections.teamB.findIndex(p => p.name === playerName);
            if (playerIndex > -1) {
                teamKey = 'teamB';
            }
        }

        if (!teamKey || playerIndex === -1) return;

        const currentRole = teamSelections[teamKey][playerIndex].role;
        if (currentRole === newRole) return; // No change needed

        // Check if switching is allowed
        if (newRole === 'starter') {
            if (getStarterCount(teamKey) >= 20) {
                alert(t('alert_starters_full'));
                return;
            }
        } else {
            if (getSubstituteCount(teamKey) >= 10) {
                alert(t('alert_subs_full'));
                return;
            }
        }

        // Update role
        teamSelections[teamKey][playerIndex].role = newRole;
    }

    updateTeamCounters();
    refreshVisiblePlayerRows();
}

function clearPlayerSelection(playerName) {
    if (
        window.DSFeatureGeneratorTeamSelection
        && typeof window.DSFeatureGeneratorTeamSelection.clearPlayerSelection === 'function'
    ) {
        const result = window.DSFeatureGeneratorTeamSelection.clearPlayerSelection(teamSelections, playerName);
        if (!result || !result.changed) {
            return;
        }
        teamSelections.teamA = Array.isArray(result.teamA) ? result.teamA : [];
        teamSelections.teamB = Array.isArray(result.teamB) ? result.teamB : [];
    } else {
        const aIndex = teamSelections.teamA.findIndex(p => p.name === playerName);
        if (aIndex > -1) teamSelections.teamA.splice(aIndex, 1);

        const bIndex = teamSelections.teamB.findIndex(p => p.name === playerName);
        if (bIndex > -1) teamSelections.teamB.splice(bIndex, 1);
    }

    updateTeamCounters();
    refreshVisiblePlayerRows();
}

function clearAllSelections() {
    if (confirm(t('confirm_clear_all'))) {
        resetTransientPlanningState({ renderPlayersTable: true });
    }
}

function filterPlayers() {
    renderPlayersTable();
    updateClearAllButtonVisibility();
}

// Filter dropdown toggle & selection
(function() {
    const dropdowns = document.querySelectorAll('.filter-dropdown');
    dropdowns.forEach(wrapper => {
        const btn = wrapper.querySelector('.filter-icon-btn');
        const panel = wrapper.querySelector('.filter-dropdown-panel');
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdowns.forEach(other => {
                if (other !== wrapper) other.querySelector('.filter-dropdown-panel').classList.remove('open');
            });
            panel.classList.toggle('open');
        });
    });
    document.querySelectorAll('.filter-option').forEach(option => {
        option.addEventListener('click', () => {
            const panel = option.closest('.filter-dropdown-panel');
            const wrapper = panel.closest('.filter-dropdown');
            const btn = wrapper.querySelector('.filter-icon-btn');
            const value = option.dataset.value;

            if (wrapper.id === 'troopsFilterWrapper') {
                currentTroopsFilter = value;
                btn.classList.toggle('active', value !== '');
            } else {
                currentSortFilter = value;
            }

            panel.querySelectorAll('.filter-option').forEach(o => o.classList.remove('selected'));
            option.classList.add('selected');
            panel.classList.remove('open');
            filterPlayers();
        });
    });
    document.addEventListener('click', () => {
        dropdowns.forEach(wrapper => {
            wrapper.querySelector('.filter-dropdown-panel').classList.remove('open');
        });
    });
})();

// Delegated listener for team A / team B / clear buttons in player rows
document.getElementById('playersTableBody').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const name = btn.closest('tr')?.dataset.player;
    if (!name) return;
    const controller = getGeneratorFeatureController();
    if (btn.classList.contains('team-a-btn')) {
        if (controller && typeof controller.toggleTeamSelection === 'function') {
            controller.toggleTeamSelection(name, 'A');
        } else {
            toggleTeam(name, 'A');
        }
    }
    else if (btn.classList.contains('team-b-btn')) {
        if (controller && typeof controller.toggleTeamSelection === 'function') {
            controller.toggleTeamSelection(name, 'B');
        } else {
            toggleTeam(name, 'B');
        }
    }
    else if (btn.classList.contains('clear-btn')) {
        if (controller && typeof controller.clearPlayerSelection === 'function') {
            controller.clearPlayerSelection(name);
        } else {
            clearPlayerSelection(name);
        }
    }
    else if (btn.classList.contains('role-btn')) {
        const newRole = btn.dataset.role;
        if (newRole) {
            if (controller && typeof controller.setPlayerRole === 'function') {
                controller.setPlayerRole(name, newRole);
            } else {
                togglePlayerRole(name, newRole);
            }
        }
    }
});

const playersMgmtTableBody = document.getElementById('playersMgmtTableBody');
if (playersMgmtTableBody) {
    playersMgmtTableBody.addEventListener('click', (event) => {
        const controller = getPlayersManagementFeatureController();
        if (controller && typeof controller.handleTableAction === 'function') {
            controller.handleTableAction(event);
            return;
        }
        handlePlayersManagementTableAction(event);
    });
}

function updateTeamCounters() {
    syncGeneratorTeamSelectionsState();

    const teamAStarterCount = getStarterCount('teamA');
    const teamASubCount = getSubstituteCount('teamA');
    const teamBStarterCount = getStarterCount('teamB');
    const teamBSubCount = getSubstituteCount('teamB');

    // Update counter displays
    document.getElementById('teamAStarterCount').textContent = teamAStarterCount;
    document.getElementById('teamASubCount').textContent = teamASubCount;
    document.getElementById('teamBStarterCount').textContent = teamBStarterCount;
    document.getElementById('teamBSubCount').textContent = teamBSubCount;

    // Update floating button counts
    document.getElementById('teamAFloatStarterCount').textContent = teamAStarterCount;
    document.getElementById('teamAFloatSubCount').textContent = teamASubCount;
    document.getElementById('teamBFloatStarterCount').textContent = teamBStarterCount;
    document.getElementById('teamBFloatSubCount').textContent = teamBSubCount;

    const teamACounter = document.querySelector('.counter.team-a');
    const teamBCounter = document.querySelector('.counter.team-b');
    const generateBtnA = document.getElementById('generateBtnA');
    const generateBtnB = document.getElementById('generateBtnB');

    // Team A "full" state: starters at 20
    if (teamAStarterCount === 20) {
        teamACounter.classList.add('full');
    } else {
        teamACounter.classList.remove('full');
    }

    // Enable generate button if at least 1 starter
    generateBtnA.disabled = teamAStarterCount === 0;

    // Team B handling
    if (teamBStarterCount === 20) {
        teamBCounter.classList.add('full');
    } else {
        teamBCounter.classList.remove('full');
    }

    generateBtnB.disabled = teamBStarterCount === 0;
    updateClearAllButtonVisibility();
}

// ============================================================
// ASSIGNMENT GENERATION
// ============================================================

function resolveCurrentEventAssignmentSelection(activeGameId) {
    const gameId = normalizeGameId(activeGameId);
    const activeEvent = getActiveEvent();
    const requestedAlgorithmId = normalizeAssignmentAlgorithmId(activeEvent && activeEvent.assignmentAlgorithmId);
    if (window.DSAssignmentRegistry && typeof window.DSAssignmentRegistry.resolveAlgorithmSelection === 'function') {
        return window.DSAssignmentRegistry.resolveAlgorithmSelection(gameId, requestedAlgorithmId);
    }
    if (window.DSAssignmentRegistry && typeof window.DSAssignmentRegistry.resolveAlgorithmForEvent === 'function') {
        const algorithm = window.DSAssignmentRegistry.resolveAlgorithmForEvent(gameId, requestedAlgorithmId);
        if (!algorithm) {
            return {
                success: false,
                error: 'unknown-assignment-algorithm',
                algorithmId: requestedAlgorithmId || '',
                gameId: gameId,
            };
        }
        return {
            success: true,
            algorithmId: normalizeAssignmentAlgorithmId(algorithm.id) || resolveDefaultAssignmentAlgorithmId(gameId),
            gameId: gameId,
            algorithm: algorithm,
        };
    }
    return {
        success: true,
        algorithmId: resolveDefaultAssignmentAlgorithmId(gameId),
        gameId: gameId,
        algorithm: {
            id: resolveDefaultAssignmentAlgorithmId(gameId),
            name: 'Balanced Round Robin',
        },
    };
}

function generateTeamAssignments(team) {
    const activeGameId = enforceGameplayContext();
    if (!activeGameId) {
        alert('missing-active-game');
        return;
    }
    if (typeof FirebaseService === 'undefined') {
        alert(t('error_firebase_not_loaded'));
        return;
    }

    const buildingConfigOk = refreshBuildingConfigForAssignments();
    if (!buildingConfigOk) {
        alert(t('alert_total_slots_exceed', { max: MAX_BUILDING_SLOTS_TOTAL }));
        return;
    }

    const selections = team === 'A' ? teamSelections.teamA : teamSelections.teamB;
    const starters = selections.filter(p => p.role === 'starter');
    const substitutes = selections.filter(p => p.role === 'substitute');

    if (starters.length === 0) {
        alert(t('alert_select_at_least_one_starter', { team: team }));
        return;
    }

    if (starters.length > 20) {
        alert(t('alert_max_starters', { count: starters.length }));
        return;
    }

    const gameplayContext = getGameplayContext();
    if (!gameplayContext) {
        return;
    }
    const playerDB = FirebaseService.getActivePlayerDatabase(gameplayContext);

    const assignmentCore = window.DSCoreGeneratorAssignment;
    const prepared = assignmentCore && typeof assignmentCore.preparePlayersForAssignment === 'function'
        ? assignmentCore.preparePlayersForAssignment(selections, playerDB)
        : {
            starters: starters
                .map((selection) => ({
                    name: selection.name,
                    power: Number(playerDB[selection.name] && playerDB[selection.name].power) || 0,
                    troops: playerDB[selection.name] && playerDB[selection.name].troops,
                    thp: Number(playerDB[selection.name] && playerDB[selection.name].thp) || 0,
                }))
                .sort((a, b) => Number(b.power || 0) - Number(a.power || 0)),
            substitutes: substitutes
                .map((selection) => ({
                    name: selection.name,
                    power: Number(playerDB[selection.name] && playerDB[selection.name].power) || 0,
                    troops: playerDB[selection.name] && playerDB[selection.name].troops,
                    thp: Number(playerDB[selection.name] && playerDB[selection.name].thp) || 0,
                }))
                .sort((a, b) => Number(b.power || 0) - Number(a.power || 0)),
        };
    const starterPlayers = prepared.starters;
    const substitutePlayers = prepared.substitutes;

    const algorithmSelection = resolveCurrentEventAssignmentSelection(activeGameId);
    if (!algorithmSelection || !algorithmSelection.success) {
        const errorCode = algorithmSelection && algorithmSelection.error ? algorithmSelection.error : 'unknown-assignment-algorithm';
        const algorithmId = algorithmSelection && algorithmSelection.algorithmId ? algorithmSelection.algorithmId : '';
        const statusMessage = t('assignment_algorithm_unknown', { id: algorithmId || 'unknown' });
        showMessage('eventsStatus', statusMessage, 'error');
        console.error('Assignment generation failed:', {
            error: errorCode,
            algorithmId: algorithmId,
            gameId: activeGameId,
            eventId: currentEvent,
        });
        alert(errorCode);
        return;
    }

    let assignments = [];
    try {
        assignments = assignTeamToBuildings(starterPlayers, algorithmSelection.algorithm);
    } catch (error) {
        const errorCode = error && error.code ? error.code : 'unknown-assignment-algorithm';
        showMessage('eventsStatus', t('assignment_algorithm_unknown', {
            id: (error && error.algorithmId) || algorithmSelection.algorithmId || 'unknown',
        }), 'error');
        console.error('Assignment execution failed:', error);
        alert(errorCode);
        return;
    }

    // Store both assignments and substitutes
    if (team === 'A') {
        assignmentsA = assignments;
        substitutesA = substitutePlayers;
    } else {
        assignmentsB = assignments;
        substitutesB = substitutePlayers;
    }

    openDownloadModal(team);

    console.log(`Team ${team} assignments generated for ${starters.length} starters, ${substitutes.length} substitutes using ${algorithmSelection.algorithmId}`);
}

function assignTeamToBuildings(players, algorithm) {
    const algorithmId = normalizeAssignmentAlgorithmId(algorithm && algorithm.id) || DEFAULT_ASSIGNMENT_ALGORITHM_ID;
    if (algorithmId === 'balanced_round_robin') {
        return window.DSCoreAssignment.assignTeamToBuildings(players, getEffectiveBuildingConfig());
    }
    throw Object.assign(new Error('unknown-assignment-algorithm'), {
        code: 'unknown-assignment-algorithm',
        algorithmId: algorithmId,
    });
}
// ============================================================
// DOWNLOAD MODAL
// ============================================================

function openDownloadModal(team) {
    const isA = team === 'A';
    activeDownloadTeam = team;

    const modalCard = document.querySelector('#downloadModalOverlay .download-modal-card');
    if (modalCard) {
        modalCard.classList.toggle('download-modal-card--team-a', isA);
        modalCard.classList.toggle('download-modal-card--team-b', !isA);
    }
    document.getElementById('downloadModalTitle').textContent = t('download_modal_title', { team: team });
    document.getElementById('downloadModalSubtitle').textContent = t('download_modal_subtitle', { team: team });
    document.getElementById('downloadMapBtn').onclick = () => downloadTeamMap(team);
    document.getElementById('downloadExcelBtn').onclick = () => downloadTeamExcel(team);
    document.getElementById('downloadStatus').innerHTML = '';
    const overlay = document.getElementById('downloadModalOverlay');
    if (overlay) {
        openModalOverlay(overlay, { initialFocusSelector: '#downloadModalCloseBtn' });
    }
}

function closeDownloadModal() {
    activeDownloadTeam = null;
    const overlay = document.getElementById('downloadModalOverlay');
    if (overlay) {
        closeModalOverlay(overlay);
    }
}

// ============================================================
// DOWNLOAD FUNCTIONS
// ============================================================

async function downloadTeamExcel(team) {
    try {
        await ensureXLSXLoaded();
    } catch (error) {
        console.error(error);
        showMessage('downloadStatus', t('error_xlsx_missing'), 'error');
        return;
    }

    const wb = XLSX.utils.book_new();
    const assignments = team === 'A' ? assignmentsA : assignmentsB;
    
    if (assignments.length === 0) {
        alert(t('alert_no_assignments', { team: team }));
        return;
    }
    
    const data = assignments.map(a => ({
        [t('excel_header_building')]: a.building,
        [t('excel_header_priority')]: a.priority,
        [t('excel_header_player')]: a.player
    }));
    
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), t('excel_sheet_name', { team: team }));
    XLSX.writeFile(wb, `${getActiveEvent().excelPrefix}_team_${team}_assignments.xlsx`);
    
    const statusId = 'downloadStatus';
    showMessage(statusId, t('message_excel_downloaded'), 'success');
}

async function downloadTeamMap(team) {
    const assignments = team === 'A' ? assignmentsA : assignmentsB;
    
    if (assignments.length === 0) {
        alert(t('alert_no_assignments', { team: team }));
        return;
    }
    
    const statusId = 'downloadStatus';
    const uploadedMapSource = getEventMapFile(currentEvent, MAP_EXPORT);
    if (!uploadedMapSource) {
        await generateMapWithoutBackground(team, assignments, statusId);
        return;
    }
    
    const exportMapState = getMapRuntimeState(currentEvent, MAP_EXPORT);
    if (!exportMapState || !exportMapState.loaded) {
        showMessage(statusId, t('message_map_wait'), 'processing');
        try {
            await Promise.race([
                loadMapImage(currentEvent, MAP_EXPORT),
                new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000)),
            ]);
        } catch (error) {
            await generateMapWithoutBackground(team, assignments, statusId);
            return;
        }
    }
    
    await generateMap(team, assignments, statusId);
}

function getMapHeaderTitle(team) {
    const normalizedTeam = team === 'B' ? 'B' : 'A';
    const eventName = getEventDisplayName(currentEvent);
    return `TEAM ${normalizedTeam} ASSIGNMENTS - ${eventName}`;
}

function getActiveEventAvatarDataUrl() {
    const activeEvent = getActiveEvent();
    if (!activeEvent || typeof activeEvent.logoDataUrl !== 'string') {
        return '';
    }
    const logoDataUrl = activeEvent.logoDataUrl.trim();
    if (!logoDataUrl) {
        return '';
    }
    return isImageDataUrl(logoDataUrl, EVENT_LOGO_DATA_URL_LIMIT) ? logoDataUrl : '';
}

async function loadActiveEventAvatarForHeader() {
    const avatarDataUrl = getActiveEventAvatarDataUrl();
    if (!avatarDataUrl) {
        return null;
    }

    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = avatarDataUrl;
    });
}

function fitCanvasHeaderText(ctx, text, maxWidth, font) {
    const value = String(text || '');
    const width = Number(maxWidth);
    if (!Number.isFinite(width) || width <= 0) {
        return value;
    }

    ctx.save();
    ctx.font = font;
    if (ctx.measureText(value).width <= width) {
        ctx.restore();
        return value;
    }

    let output = value;
    while (output.length > 1 && ctx.measureText(output + '...').width > width) {
        output = output.slice(0, -1);
    }
    ctx.restore();
    return output + '...';
}

function drawGeneratedMapHeader(ctx, options) {
    const cfg = options && typeof options === 'object' ? options : {};
    const totalWidth = Number(cfg.totalWidth) || MAP_CANVAS_WIDTH;
    const titleHeight = Number(cfg.titleHeight) || 100;
    const teamPrimary = cfg.teamPrimary || '#4169E1';
    const teamSecondary = cfg.teamSecondary || '#1E90FF';
    const titleText = String(cfg.titleText || '');
    const avatarImage = cfg.avatarImage || null;

    const grad = ctx.createLinearGradient(0, 0, totalWidth, titleHeight);
    grad.addColorStop(0, teamPrimary);
    grad.addColorStop(1, teamSecondary);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, totalWidth, titleHeight);

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, titleHeight - 1);
    ctx.lineTo(totalWidth, titleHeight - 1);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    const paddingX = 24;
    let textStartX = paddingX;

    if (avatarImage && avatarImage.width > 0 && avatarImage.height > 0) {
        const avatarSize = Math.max(36, Math.min(64, titleHeight - 24));
        const avatarX = paddingX;
        const avatarY = Math.floor((titleHeight - avatarSize) / 2);
        const avatarCenterX = avatarX + (avatarSize / 2);
        const avatarCenterY = avatarY + (avatarSize / 2);
        const avatarRadius = avatarSize / 2;

        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarCenterX, avatarCenterY, avatarRadius, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatarImage, avatarX, avatarY, avatarSize, avatarSize);
        ctx.restore();

        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarCenterX, avatarCenterY, avatarRadius + 1, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.92)';
        ctx.lineWidth = 2.2;
        ctx.stroke();
        ctx.restore();

        textStartX = avatarX + avatarSize + 16;
    }

    const textMaxWidth = Math.max(120, totalWidth - textStartX - paddingX);
    const fittedTitle = fitCanvasHeaderText(ctx, titleText, textMaxWidth, 'bold 40px Arial');

    ctx.save();
    ctx.font = 'bold 40px Arial';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(fittedTitle, textStartX, titleHeight / 2);
    ctx.restore();
}

async function generateMapWithoutBackground(team, assignments, statusId) {
    showMessage(statusId, t('message_generating_map_no_bg', { team: team }), 'processing');
    
    try {
        const headerAvatar = await loadActiveEventAvatarForHeader();
        const headerTitle = getMapHeaderTitle(team);
        const mappedAssignments = {};
        const unmappedAssignments = {};
        const effectivePositions = getEffectiveBuildingPositions();

        assignments.forEach((a) => {
            if (!a.player) return;
            const buildingKey = a.buildingKey || a.building;
            const showOnMap = isBuildingShownOnMap(buildingKey);
            const hasCoordinates = Array.isArray(effectivePositions[buildingKey]);
            if (showOnMap && hasCoordinates) {
                if (!mappedAssignments[buildingKey]) mappedAssignments[buildingKey] = [];
                mappedAssignments[buildingKey].push(a);
                return;
            }
            if (!unmappedAssignments[buildingKey]) unmappedAssignments[buildingKey] = [];
            unmappedAssignments[buildingKey].push(a);
        });

        const orderedBuildingKeys = getBuildingConfig().map((building) => building.name);
        const orderedUnmappedKeys = [
            ...orderedBuildingKeys.filter((key) => Array.isArray(unmappedAssignments[key]) && unmappedAssignments[key].length > 0),
            ...Object.keys(unmappedAssignments).filter((key) => !orderedBuildingKeys.includes(key)),
        ];
        const unmappedGroups = orderedUnmappedKeys
            .map((key) => {
                const players = Array.isArray(unmappedAssignments[key])
                    ? unmappedAssignments[key].filter((entry) => entry && entry.player)
                    : [];
                if (players.length === 0) {
                    return null;
                }
                return {
                    key: key,
                    label: getBuildingDisplayName(key),
                    players: players,
                };
            })
            .filter(Boolean);
        const unmappedPlayers = unmappedGroups.flatMap((group) => group.players);
        
        // Create simplified version without map
        const canvas = document.createElement('canvas');
        canvas.width = MAP_CANVAS_WIDTH;
        canvas.height = 800;
        const ctx = canvas.getContext('2d');
        
        // Background
        ctx.fillStyle = team === 'A' ? '#E8F4FF' : '#FFE8E8';
        ctx.fillRect(0, 0, MAP_CANVAS_WIDTH, 800);
        
        // Title
        drawGeneratedMapHeader(ctx, {
            totalWidth: MAP_CANVAS_WIDTH,
            titleHeight: 100,
            teamPrimary: team === 'A' ? '#4169E1' : '#DC143C',
            teamSecondary: team === 'A' ? '#1E90FF' : '#FF6347',
            titleText: headerTitle,
            avatarImage: headerAvatar,
        });

        // List assignments
        ctx.fillStyle = '#333';
        ctx.font = '16px Arial';
        ctx.textAlign = 'left';
        let y = 150;
        
        assignments.forEach((a, i) => {
            if (a.player) {
                ctx.fillText(`${i+1}. ${a.player} → ${a.building}`, 50, y);
                y += 30;
            }
        });
        
        // Download
        const dataURL = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = dataURL;
        a.download = `team_${team}_${getActiveEvent().excelPrefix}_nomap.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        showMessage(statusId, t('message_team_downloaded_list', { team: team }), 'success');
    } catch (error) {
        console.error(error);
        showMessage(statusId, t('error_generic', { error: error.message }), 'error');
    }
}

async function generateMap(team, assignments, statusId) {
    showMessage(statusId, t('message_generating_map', { team: team }), 'processing');

    try {
        const headerAvatar = await loadActiveEventAvatarForHeader();
        const headerTitle = getMapHeaderTitle(team);
        const teamPrimary = team === 'A' ? '#4169E1' : '#DC143C';
        const teamSecondary = team === 'A' ? '#1E90FF' : '#FF6347';
        const teamSoft = team === 'A' ? 'rgba(65, 105, 225, 0.25)' : 'rgba(220, 20, 60, 0.25)';
        const gameplayContext = getGameplayContext();
        const activePlayerDB = (typeof FirebaseService !== 'undefined' && FirebaseService.getActivePlayerDatabase && gameplayContext)
            ? FirebaseService.getActivePlayerDatabase(gameplayContext)
            : {};

        const mappedAssignments = {};
        const unmappedAssignments = {};
        const effectivePositions = getEffectiveBuildingPositions();

        assignments.forEach((a) => {
            if (!a.player) return;
            const buildingKey = a.buildingKey || a.building;
            const showOnMap = isBuildingShownOnMap(buildingKey);
            const hasCoordinates = Array.isArray(effectivePositions[buildingKey]);
            if (showOnMap && hasCoordinates) {
                if (!mappedAssignments[buildingKey]) mappedAssignments[buildingKey] = [];
                mappedAssignments[buildingKey].push(a);
                return;
            }
            if (!unmappedAssignments[buildingKey]) unmappedAssignments[buildingKey] = [];
            unmappedAssignments[buildingKey].push(a);
        });

        const orderedBuildingKeys = getBuildingConfig().map((building) => building.name);
        const orderedUnmappedKeys = [
            ...orderedBuildingKeys.filter((key) => Array.isArray(unmappedAssignments[key]) && unmappedAssignments[key].length > 0),
            ...Object.keys(unmappedAssignments).filter((key) => !orderedBuildingKeys.includes(key)),
        ];
        const unmappedGroups = orderedUnmappedKeys
            .map((key) => {
                const players = Array.isArray(unmappedAssignments[key])
                    ? unmappedAssignments[key].filter((entry) => entry && entry.player)
                    : [];
                if (players.length === 0) {
                    return null;
                }
                return {
                    key: key,
                    label: getBuildingDisplayName(key),
                    players: players,
                };
            })
            .filter(Boolean);
        const unmappedPlayers = unmappedGroups.flatMap((group) => group.players);

        // Get substitutes for this team
        const substitutes = team === 'A' ? substitutesA : substitutesB;

        const titleHeight = 100;
        const unmappedHeight = 280;
        const exportMapState = getMapRuntimeState(currentEvent, MAP_EXPORT);
        const activeMapImage = exportMapState ? exportMapState.image : null;
        if (!activeMapImage || activeMapImage.width <= 0) {
            throw new Error('Map image not loaded for export');
        }
        const mapHeight = Math.max(1, Math.floor(activeMapImage.height * (MAP_CANVAS_WIDTH / activeMapImage.width)));
        const totalHeight = titleHeight + mapHeight + unmappedHeight;

        // Add substitutes panel width if there are substitutes
        const subsPanelWidth = substitutes.length > 0 ? 260 : 0;
        const totalWidth = MAP_CANVAS_WIDTH + subsPanelWidth;

        const canvas = document.createElement('canvas');
        canvas.width = totalWidth;
        canvas.height = totalHeight;
        const ctx = canvas.getContext('2d');

        function drawCrosshairIcon(cx, cy, size, color) {
            const radius = Math.max(8, Math.floor(size / 2));
            ctx.save();
            ctx.strokeStyle = color;
            ctx.lineWidth = 2.2;
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(cx - radius - 6, cy);
            ctx.lineTo(cx + radius + 6, cy);
            ctx.moveTo(cx, cy - radius - 6);
            ctx.lineTo(cx, cy + radius + 6);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(cx, cy, 3.2, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.restore();
        }

        function drawShieldIcon(x, y, width, height, color) {
            ctx.save();
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(x + width / 2, y);
            ctx.lineTo(x + width, y + height * 0.25);
            ctx.lineTo(x + width * 0.88, y + height * 0.78);
            ctx.lineTo(x + width / 2, y + height);
            ctx.lineTo(x + width * 0.12, y + height * 0.78);
            ctx.lineTo(x, y + height * 0.25);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.55)';
            ctx.lineWidth = 1.2;
            ctx.stroke();
            ctx.restore();
        }

        function fitText(text, maxWidth, font) {
            ctx.save();
            ctx.font = font;
            if (ctx.measureText(text).width <= maxWidth) {
                ctx.restore();
                return text;
            }
            let output = text;
            while (output.length > 1 && ctx.measureText(output + '...').width > maxWidth) {
                output = output.slice(0, -1);
            }
            ctx.restore();
            return output + '...';
        }

        // Coordinates always represent the top-left start point of the first label,
        // consistently for every event.
        function getStarterCardStartX(anchorX, cardWidth) {
            return anchorX;
        }

        function getTroopKind(troops) {
            const val = String(troops || '').trim().toLowerCase();
            if (val.startsWith('tank')) return 'tank';
            if (val.startsWith('aero') || val.startsWith('air')) return 'aero';
            if (val.startsWith('missile')) return 'missile';
            return 'unknown';
        }

        function drawTankIcon(cx, cy, color) {
            ctx.save();
            ctx.strokeStyle = color;
            ctx.fillStyle = color;
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.roundRect(cx - 6.5, cy - 2.8, 12, 5.6, 1.8);
            ctx.fill();
            ctx.beginPath();
            ctx.roundRect(cx - 1.8, cy - 5.4, 4.6, 2.8, 1);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(cx + 2.6, cy - 4);
            ctx.lineTo(cx + 7.5, cy - 4);
            ctx.stroke();
            ctx.restore();
        }

        function drawJetIcon(cx, cy, color) {
            ctx.save();
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(cx - 7, cy + 1.2);
            ctx.lineTo(cx + 5.8, cy - 2.8);
            ctx.lineTo(cx + 2, cy + 0.3);
            ctx.lineTo(cx + 5.8, cy + 3.2);
            ctx.closePath();
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(cx - 1.6, cy - 1.1);
            ctx.lineTo(cx - 3.8, cy - 4.6);
            ctx.lineTo(cx - 0.8, cy - 3);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }

        function drawMissileLauncherIcon(cx, cy, color) {
            ctx.save();
            ctx.strokeStyle = color;
            ctx.fillStyle = color;
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.roundRect(cx - 6, cy + 0.8, 8.8, 4.2, 1.3);
            ctx.fill();
            ctx.beginPath();
            ctx.roundRect(cx - 5.2, cy - 3.8, 8.8, 2.5, 1);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(cx + 3.8, cy - 3.4);
            ctx.lineTo(cx + 7, cy - 5.1);
            ctx.lineTo(cx + 7.8, cy - 3.7);
            ctx.lineTo(cx + 4.6, cy - 2.3);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }

        function drawFunFallbackIcon(cx, cy, color, variant) {
            ctx.save();
            ctx.strokeStyle = color;
            ctx.fillStyle = color;
            ctx.lineWidth = 1.3;
            if (variant % 2 === 0) {
                // Star
                const r1 = 5.5;
                const r2 = 2.5;
                ctx.beginPath();
                for (let p = 0; p < 10; p += 1) {
                    const angle = (-Math.PI / 2) + (p * Math.PI / 5);
                    const r = p % 2 === 0 ? r1 : r2;
                    const x = cx + Math.cos(angle) * r;
                    const y = cy + Math.sin(angle) * r;
                    if (p === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.closePath();
                ctx.stroke();
            } else {
                // Smiley
                ctx.beginPath();
                ctx.arc(cx, cy, 5.4, 0, Math.PI * 2);
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(cx - 1.8, cy - 1.2, 0.7, 0, Math.PI * 2);
                ctx.arc(cx + 1.8, cy - 1.2, 0.7, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(cx, cy + 0.8, 2.4, 0.2 * Math.PI, 0.8 * Math.PI);
                ctx.stroke();
            }
            ctx.restore();
        }

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, totalWidth, totalHeight);

        // Title bar (spans full width)
        drawGeneratedMapHeader(ctx, {
            totalWidth: totalWidth,
            titleHeight: titleHeight,
            teamPrimary: teamPrimary,
            teamSecondary: teamSecondary,
            titleText: headerTitle,
            avatarImage: headerAvatar,
        });

        ctx.drawImage(activeMapImage, 0, titleHeight, MAP_CANVAS_WIDTH, mapHeight);

        let drawnCount = 0;
        const priorityPalette = {
            1: '#FF4D5A',
            2: '#FF8A3D',
            3: '#F7C948',
            4: '#40C9A2',
            5: '#6BA8FF',
        };
        Object.keys(mappedAssignments).forEach((building) => {
            const [x, y_base] = effectivePositions[building];
            const y = y_base + titleHeight;
            const players = mappedAssignments[building];
            const starterCardWidth = 182;
            const starterCardHeight = 28;
            const starterGapY = 34;
            const firstLabelStartX = x;
            const firstLabelStartY = y;
            const starterCardX = getStarterCardStartX(firstLabelStartX, starterCardWidth);

            players.forEach((player, i) => {
                const name = player.player;
                const priorityColor = priorityPalette[player.priority] || teamPrimary;
                const cardY = firstLabelStartY + (i * starterGapY);
                const yPos = cardY + (starterCardHeight / 2);
                const troopValue = player.troops || (activePlayerDB[name] && activePlayerDB[name].troops);
                const troopKind = getTroopKind(troopValue);
                const fittedName = fitText(name, starterCardWidth - 62, 'bold 13px Arial');
                const cardX = starterCardX;

                // Tactical starter card.
                const cardGrad = ctx.createLinearGradient(cardX, cardY, cardX + starterCardWidth, cardY);
                cardGrad.addColorStop(0, 'rgba(26, 31, 44, 0.95)');
                cardGrad.addColorStop(1, 'rgba(18, 22, 32, 0.95)');
                ctx.fillStyle = cardGrad;
                ctx.beginPath();
                ctx.roundRect(cardX, cardY, starterCardWidth, starterCardHeight, 8);
                ctx.fill();

                ctx.strokeStyle = 'rgba(255,255,255,0.44)';
                ctx.lineWidth = 1;
                ctx.stroke();

                // Priority accent strip.
                ctx.fillStyle = priorityColor;
                ctx.beginPath();
                ctx.roundRect(cardX + 1.4, cardY + 1.4, 6, starterCardHeight - 2.8, 4);
                ctx.fill();

                // Index chip.
                const chipX = cardX + 16;
                ctx.beginPath();
                ctx.arc(chipX, yPos, 8, 0, Math.PI * 2);
                ctx.fillStyle = teamPrimary;
                ctx.fill();
                ctx.strokeStyle = 'rgba(255,255,255,0.8)';
                ctx.lineWidth = 1;
                ctx.stroke();
                ctx.font = 'bold 9px Arial';
                ctx.fillStyle = '#FFFFFF';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(String(i + 1), chipX, yPos + 0.5);

                // Name.
                ctx.font = 'bold 13px Arial';
                ctx.fillStyle = '#F3F6FF';
                ctx.textAlign = 'left';
                ctx.fillText(fittedName, cardX + 30, yPos + 0.5);

                const badgeW = 20;
                const badgeH = 18;
                const badgeX = cardX + starterCardWidth - badgeW - 6;
                const badgeY = yPos - (badgeH / 2);
                ctx.fillStyle = 'rgba(255,255,255,0.12)';
                ctx.beginPath();
                ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 5);
                ctx.fill();
                ctx.strokeStyle = 'rgba(255,255,255,0.38)';
                ctx.lineWidth = 1;
                ctx.stroke();

                const iconColor = troopKind === 'unknown' ? '#FFE28A' : priorityColor;
                const iconCx = badgeX + (badgeW / 2);
                const iconCy = badgeY + (badgeH / 2) + 0.4;
                if (troopKind === 'tank') {
                    drawTankIcon(iconCx, iconCy, iconColor);
                } else if (troopKind === 'aero') {
                    drawJetIcon(iconCx, iconCy, iconColor);
                } else if (troopKind === 'missile') {
                    drawMissileLauncherIcon(iconCx, iconCy, iconColor);
                } else {
                    drawFunFallbackIcon(iconCx, iconCy, iconColor, i);
                }

                drawnCount++;
            });
        });

        // Bottom area for buildings that are not rendered on the map itself.
        // Each building gets its own panel.
        const unmappedArea = {
            x: 24,
            y: titleHeight + mapHeight + 22,
            width: 1032,
            height: 236,
        };
        const panelGapX = 14;
        const panelGapY = 12;
        const groupCount = unmappedGroups.length;
        const panelColumns = groupCount <= 1 ? 1 : Math.min(3, groupCount);
        const panelRows = groupCount > 0 ? Math.ceil(groupCount / panelColumns) : 0;
        const panelWidth = panelRows > 0
            ? Math.floor((unmappedArea.width - ((panelColumns - 1) * panelGapX)) / panelColumns)
            : 0;
        const panelHeight = panelRows > 0
            ? Math.floor((unmappedArea.height - ((panelRows - 1) * panelGapY)) / panelRows)
            : 0;

        unmappedGroups.forEach((group, groupIndex) => {
            const row = Math.floor(groupIndex / panelColumns);
            const col = groupIndex % panelColumns;
            const panelX = unmappedArea.x + (col * (panelWidth + panelGapX));
            const panelY = unmappedArea.y + (row * (panelHeight + panelGapY));
            const panelRadius = 16;

            const panelGrad = ctx.createLinearGradient(0, panelY, 0, panelY + panelHeight);
            panelGrad.addColorStop(0, '#2A3344');
            panelGrad.addColorStop(1, '#1A202C');
            ctx.fillStyle = panelGrad;
            ctx.beginPath();
            ctx.roundRect(panelX, panelY, panelWidth, panelHeight, panelRadius);
            ctx.fill();
            ctx.strokeStyle = teamPrimary;
            ctx.lineWidth = 1.8;
            ctx.stroke();

            ctx.save();
            ctx.beginPath();
            ctx.roundRect(panelX + 1, panelY + 1, panelWidth - 2, panelHeight - 2, panelRadius);
            ctx.clip();
            ctx.strokeStyle = 'rgba(255,255,255,0.05)';
            ctx.lineWidth = 1;
            for (let gx = panelX + 14; gx < panelX + panelWidth; gx += 20) {
                ctx.beginPath();
                ctx.moveTo(gx, panelY);
                ctx.lineTo(gx, panelY + panelHeight);
                ctx.stroke();
            }
            for (let gy = panelY + 14; gy < panelY + panelHeight; gy += 20) {
                ctx.beginPath();
                ctx.moveTo(panelX, gy);
                ctx.lineTo(panelX + panelWidth, gy);
                ctx.stroke();
            }
            ctx.restore();

            drawCrosshairIcon(panelX + 20, panelY + 24, 16, '#FFB84C');
            ctx.font = 'bold 15px Arial';
            ctx.fillStyle = '#F6F7FB';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(fitText(group.label, panelWidth - 132, 'bold 15px Arial'), panelX + 36, panelY + 24);

            ctx.font = '11px Arial';
            ctx.fillStyle = 'rgba(255,255,255,0.75)';
            ctx.textAlign = 'right';
            ctx.fillText(`${group.players.length} ${t('map_unmapped_count_suffix')}`, panelX + panelWidth - 12, panelY + 24);

            const cardsTop = panelY + 44;
            const cardGapX = 10;
            const cardGapY = 8;
            const cardColumns = panelWidth >= 340 ? 2 : 1;
            const cardWidth = Math.floor((panelWidth - 20 - ((cardColumns - 1) * cardGapX)) / cardColumns);
            const cardHeight = 28;
            const rowsCapacity = Math.max(1, Math.floor((panelHeight - (cardsTop - panelY) - 10) / (cardHeight + cardGapY)));
            const cardCapacity = rowsCapacity * cardColumns;
            const visiblePlayers = group.players.slice(0, cardCapacity);

            visiblePlayers.forEach((player, playerIndex) => {
                const rowIndex = Math.floor(playerIndex / cardColumns);
                const colIndex = playerIndex % cardColumns;
                const cardX = panelX + 10 + (colIndex * (cardWidth + cardGapX));
                const cardY = cardsTop + (rowIndex * (cardHeight + cardGapY));
                const troopValue = player.troops || (activePlayerDB[player.player] && activePlayerDB[player.player].troops);
                const troopKind = getTroopKind(troopValue);
                const displayName = fitText(player.player, cardWidth - 56, 'bold 12px Arial');

                const cardGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardWidth, cardY);
                cardGrad.addColorStop(0, 'rgba(255,255,255,0.94)');
                cardGrad.addColorStop(1, 'rgba(236,240,248,0.98)');
                ctx.fillStyle = cardGrad;
                ctx.beginPath();
                ctx.roundRect(cardX, cardY, cardWidth, cardHeight, 7);
                ctx.fill();

                ctx.strokeStyle = teamPrimary;
                ctx.lineWidth = 1.2;
                ctx.stroke();

                ctx.fillStyle = teamPrimary;
                ctx.beginPath();
                ctx.arc(cardX + 10, cardY + (cardHeight / 2), 3.6, 0, Math.PI * 2);
                ctx.fill();

                ctx.font = 'bold 12px Arial';
                ctx.fillStyle = '#1A1E29';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText(displayName, cardX + 19, cardY + (cardHeight / 2) + 0.5);

                const badgeW = 18;
                const badgeH = 16;
                const badgeX = cardX + cardWidth - badgeW - 6;
                const badgeY = cardY + ((cardHeight - badgeH) / 2);
                const iconColor = troopKind === 'unknown' ? '#7F5A00' : teamPrimary;
                const iconCx = badgeX + (badgeW / 2);
                const iconCy = badgeY + (badgeH / 2) + 0.3;

                ctx.fillStyle = 'rgba(255,255,255,0.88)';
                ctx.beginPath();
                ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 4);
                ctx.fill();
                ctx.strokeStyle = 'rgba(32, 38, 52, 0.5)';
                ctx.lineWidth = 1;
                ctx.stroke();

                if (troopKind === 'tank') {
                    drawTankIcon(iconCx, iconCy, iconColor);
                } else if (troopKind === 'aero') {
                    drawJetIcon(iconCx, iconCy, iconColor);
                } else if (troopKind === 'missile') {
                    drawMissileLauncherIcon(iconCx, iconCy, iconColor);
                } else {
                    drawFunFallbackIcon(iconCx, iconCy, iconColor, groupIndex + playerIndex);
                }
            });

            if (group.players.length > cardCapacity) {
                ctx.font = '11px Arial';
                ctx.fillStyle = 'rgba(255,255,255,0.82)';
                ctx.textAlign = 'right';
                ctx.textBaseline = 'alphabetic';
                ctx.fillText(`+${group.players.length - cardCapacity} more`, panelX + panelWidth - 10, panelY + panelHeight - 8);
            }
        });

        // Substitutes Panel (right side)
        if (substitutes.length > 0) {
            const panelX = MAP_CANVAS_WIDTH;
            const panelY = titleHeight;
            const panelHeight = mapHeight + unmappedHeight;

            // Panel background
            const subsGrad = ctx.createLinearGradient(panelX, panelY, panelX + subsPanelWidth, panelY + panelHeight);
            subsGrad.addColorStop(0, '#1D2330');
            subsGrad.addColorStop(1, '#141925');
            ctx.fillStyle = subsGrad;
            ctx.fillRect(panelX, panelY, subsPanelWidth, panelHeight);

            // Tactical texture.
            ctx.strokeStyle = 'rgba(255,255,255,0.05)';
            ctx.lineWidth = 1;
            for (let sy = panelY + 14; sy < panelY + panelHeight; sy += 20) {
                ctx.beginPath();
                ctx.moveTo(panelX + 8, sy);
                ctx.lineTo(panelX + subsPanelWidth - 8, sy);
                ctx.stroke();
            }

            // Panel border
            ctx.strokeStyle = teamPrimary;
            ctx.lineWidth = 1.8;
            ctx.strokeRect(panelX + 0.9, panelY + 0.9, subsPanelWidth - 1.8, panelHeight - 1.8);

            const subsHeaderH = 72;
            const headGrad = ctx.createLinearGradient(panelX, panelY, panelX, panelY + subsHeaderH);
            headGrad.addColorStop(0, teamSoft);
            headGrad.addColorStop(1, 'rgba(255,255,255,0.02)');
            ctx.fillStyle = headGrad;
            ctx.fillRect(panelX, panelY, subsPanelWidth, subsHeaderH);
            ctx.strokeStyle = 'rgba(255,255,255,0.12)';
            ctx.beginPath();
            ctx.moveTo(panelX + 10, panelY + subsHeaderH);
            ctx.lineTo(panelX + subsPanelWidth - 10, panelY + subsHeaderH);
            ctx.stroke();

            drawShieldIcon(panelX + 14, panelY + 16, 20, 24, teamSecondary);
            ctx.font = 'bold 16px Arial';
            ctx.fillStyle = '#F6F7FB';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(t('map_substitutes_title'), panelX + 42, panelY + 30);

            ctx.font = '13px Arial';
            ctx.fillStyle = 'rgba(255,255,255,0.72)';
            ctx.fillText('♞ ' + t('map_substitutes_subtitle'), panelX + 42, panelY + 50);

            // Draw substitute roster rows (single or double column if many rows).
            const rowStartY = panelY + subsHeaderH + 14;
            const rowHeight = 28;
            const rowGap = 8;
            const availableRowsHeight = panelHeight - (rowStartY - panelY) - 18;
            const rowsPerColumn = Math.max(1, Math.floor(availableRowsHeight / (rowHeight + rowGap)));
            const useTwoCols = substitutes.length > rowsPerColumn;
            const colCount = useTwoCols ? 2 : 1;
            const colGap = 10;
            const rowWidth = Math.floor((subsPanelWidth - 20 - ((colCount - 1) * colGap)) / colCount);

            substitutes.forEach((sub, index) => {
                const col = Math.floor(index / rowsPerColumn);
                if (col >= colCount) {
                    return;
                }
                const row = index % rowsPerColumn;
                const rowX = panelX + 10 + col * (rowWidth + colGap);
                const rowY = rowStartY + row * (rowHeight + rowGap);
                const reserveTag = 'R' + String(index + 1);
                const troopValue = sub.troops || (activePlayerDB[sub.name] && activePlayerDB[sub.name].troops);
                const troopKind = getTroopKind(troopValue);
                const name = fitText(sub.name, rowWidth - 70, 'bold 12px Arial');

                ctx.fillStyle = 'rgba(255,255,255,0.92)';
                ctx.beginPath();
                ctx.roundRect(rowX, rowY, rowWidth, rowHeight, 7);
                ctx.fill();
                ctx.strokeStyle = teamPrimary;
                ctx.lineWidth = 1.2;
                ctx.stroke();

                ctx.fillStyle = teamPrimary;
                ctx.beginPath();
                ctx.roundRect(rowX + 3, rowY + 3, 28, rowHeight - 6, 5);
                ctx.fill();

                ctx.font = 'bold 11px Arial';
                ctx.fillStyle = '#FFFFFF';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(reserveTag, rowX + 17, rowY + rowHeight / 2 + 0.5);

                ctx.font = 'bold 12px Arial';
                ctx.fillStyle = '#1B2230';
                ctx.textAlign = 'left';
                ctx.fillText(name, rowX + 36, rowY + rowHeight / 2 + 0.5);

                const badgeW = 18;
                const badgeH = 16;
                const badgeX = rowX + rowWidth - badgeW - 6;
                const badgeY = rowY + ((rowHeight - badgeH) / 2);
                const iconColor = troopKind === 'unknown' ? '#8A6400' : teamPrimary;
                const iconCx = badgeX + (badgeW / 2);
                const iconCy = badgeY + (badgeH / 2) + 0.3;

                ctx.fillStyle = 'rgba(255,255,255,0.9)';
                ctx.beginPath();
                ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 4);
                ctx.fill();
                ctx.strokeStyle = 'rgba(32, 38, 52, 0.45)';
                ctx.lineWidth = 1;
                ctx.stroke();

                if (troopKind === 'tank') {
                    drawTankIcon(iconCx, iconCy, iconColor);
                } else if (troopKind === 'aero') {
                    drawJetIcon(iconCx, iconCy, iconColor);
                } else if (troopKind === 'missile') {
                    drawMissileLauncherIcon(iconCx, iconCy, iconColor);
                } else {
                    drawFunFallbackIcon(iconCx, iconCy, iconColor, index);
                }
            });
        }

        ctx.font = '12px Arial';
        ctx.fillStyle = 'rgba(90,90,90,0.95)';
        ctx.textAlign = 'center';
        ctx.fillText(t('map_footer_text'), 540, totalHeight - 14);

        const dataURL = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = dataURL;
        a.download = `team_${team}_${getActiveEvent().excelPrefix}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        showMessage(statusId, t('message_team_map_downloaded', { team: team, drawnCount: drawnCount, bombSquad: unmappedPlayers.length, substitutes: substitutes.length }), 'success');
    } catch (error) {
        console.error(error);
        showMessage(statusId, t('error_generic', { error: error.message }), 'error');
    }
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function showMessage(elementId, message, type) {
    const element = document.getElementById(elementId);
    if (!element) {
        return;
    }
    const wrapper = document.createElement('div');
    wrapper.className = `message ${type}`;
    wrapper.textContent = String(message ?? '');
    element.replaceChildren(wrapper);
    
    if (type === 'success') {
        setTimeout(() => {
            element.replaceChildren();
        }, 5000);
    }
}

document.addEventListener('click', (event) => {
    const navMenu = document.getElementById('navMenu');
    if (navMenu && !navMenu.contains(event.target)) {
        closeNavigationMenu();
    }
    const notificationsPanel = document.getElementById('notificationsPanel');
    const notificationBtn = document.getElementById('notificationBtn');
    if (
        notificationsPanel &&
        notificationBtn &&
        !notificationsPanel.classList.contains('hidden') &&
        !notificationsPanel.contains(event.target) &&
        !notificationBtn.contains(event.target)
    ) {
        closeNotificationsPanel();
    }
});



