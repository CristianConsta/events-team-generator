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
            const source = FirebaseService.getPlayerSource && FirebaseService.getPlayerSource();
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
    renderPlayersTable();
    renderBuildingsTable();
    updateTeamCounters();
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

// ============================================================
// ONBOARDING TOUR
// ============================================================
const ONBOARDING_STEPS = [
    { titleKey: 'onboarding_step1_title', descKey: 'onboarding_step1_desc', targetSelector: '#navMenuBtn',           position: 'bottom' },
    { titleKey: 'onboarding_step2_title', descKey: 'onboarding_step2_desc', targetSelector: '#navConfigBtn',         position: 'bottom' },
    { titleKey: 'onboarding_step3_title', descKey: 'onboarding_step3_desc', targetSelector: '#downloadTemplateBtn',  position: 'bottom' },
    { titleKey: 'onboarding_step4_title', descKey: 'onboarding_step4_desc', targetSelector: '#uploadPlayerBtn',      position: 'bottom' },
    { titleKey: 'onboarding_step5_title', descKey: 'onboarding_step5_desc', targetSelector: '#eventsPanel',          position: 'top'    },
    { titleKey: 'onboarding_step6_title', descKey: 'onboarding_step6_desc', targetSelector: '#navGeneratorBtn',      position: 'bottom' },
    { titleKey: 'onboarding_step7_title', descKey: 'onboarding_step7_desc', targetSelector: '#generatorPage',        position: 'top'    }
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
    if (step.targetSelector === '#navConfigBtn' || step.targetSelector === '#navGeneratorBtn') {
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

// ── Dismiss event wiring (runs once DOM is ready) ──
document.addEventListener('DOMContentLoaded', () => {
    // Step 1 - Open menu button
    document.getElementById('navMenuBtn').addEventListener('click', () => {
        if (onboardingActive && currentOnboardingStep === 0) dismissOnboardingStep();
    });
    // Step 2 - Configuration menu item
    document.getElementById('navConfigBtn').addEventListener('click', () => {
        if (onboardingActive && currentOnboardingStep === 1) dismissOnboardingStep();
    });
    // Step 3 - Download Template button
    document.getElementById('downloadTemplateBtn').addEventListener('click', () => {
        if (onboardingActive && currentOnboardingStep === 2) dismissOnboardingStep();
    });
    // Step 4 - Upload Player Data button
    document.getElementById('uploadPlayerBtn').addEventListener('click', () => {
        if (onboardingActive && currentOnboardingStep === 3) dismissOnboardingStep();
    });
    // Step 5 - Generator menu item
    document.getElementById('eventsPanel').addEventListener('click', () => {
        if (onboardingActive && currentOnboardingStep === 4) dismissOnboardingStep();
    });
    // Step 6 - Generator menu item
    document.getElementById('navGeneratorBtn').addEventListener('click', () => {
        if (onboardingActive && currentOnboardingStep === 5) dismissOnboardingStep();
    });
    // Step 7 - Generator page
    document.getElementById('generatorPage').addEventListener('click', () => {
        if (onboardingActive && currentOnboardingStep === 6) dismissOnboardingStep();
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
});

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
let eventEditorCurrentId = '';
let eventDraftLogoDataUrl = '';
let eventDraftMapDataUrl = '';
let eventEditorIsEditMode = false;
// Helper functions for starter/substitute counts
function getStarterCount(teamKey) {
    return teamSelections[teamKey].filter(p => p.role === 'starter').length;
}

function getSubstituteCount(teamKey) {
    return teamSelections[teamKey].filter(p => p.role === 'substitute').length;
}
let uploadPanelExpanded = true;
let eventsPanelExpanded = true;
let activeDownloadTeam = null;
let currentPageView = 'generator';

function isConfigurationPageVisible() {
    return currentPageView === 'configuration';
}

function closeNavigationMenu() {
    const panel = document.getElementById('navMenuPanel');
    const menuBtn = document.getElementById('navMenuBtn');
    if (panel) {
        panel.classList.add('hidden');
    }
    if (menuBtn) {
        menuBtn.setAttribute('aria-expanded', 'false');
    }
}

function openNavigationMenu() {
    const panel = document.getElementById('navMenuPanel');
    const menuBtn = document.getElementById('navMenuBtn');
    if (panel) {
        panel.classList.remove('hidden');
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
    if (panel.classList.contains('hidden')) {
        openNavigationMenu();
    } else {
        closeNavigationMenu();
    }
}

function syncNavigationMenuState() {
    const generatorBtn = document.getElementById('navGeneratorBtn');
    const configBtn = document.getElementById('navConfigBtn');
    if (generatorBtn) {
        const isActive = currentPageView === 'generator';
        generatorBtn.classList.toggle('active', isActive);
        generatorBtn.setAttribute('aria-current', isActive ? 'page' : 'false');
    }
    if (configBtn) {
        const isActive = currentPageView === 'configuration';
        configBtn.classList.toggle('active', isActive);
        configBtn.setAttribute('aria-current', isActive ? 'page' : 'false');
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
    const shouldShow = currentPageView === 'generator' && !selectionSection.classList.contains('hidden') && hasPlayers;
    bar.style.display = shouldShow ? 'flex' : 'none';
    reserveSpaceForFooter();
}

function setPageView(view) {
    const generatorPage = document.getElementById('generatorPage');
    const configurationPage = document.getElementById('configurationPage');
    if (!generatorPage || !configurationPage) {
        return;
    }

    currentPageView = view === 'configuration' ? 'configuration' : 'generator';
    generatorPage.classList.toggle('hidden', currentPageView !== 'generator');
    configurationPage.classList.toggle('hidden', currentPageView !== 'configuration');
    syncNavigationMenuState();
    closeNavigationMenu();

    if (currentPageView === 'configuration') {
        loadBuildingConfig();
        loadBuildingPositions();
        renderBuildingsTable();
        renderEventsList();
        refreshEventEditorDeleteState();
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

function getSignInDisplayName(user) {
    if (!user || typeof user.displayName !== 'string') {
        return '';
    }
    return user.displayName.trim().slice(0, PROFILE_TEXT_LIMIT);
}

function getProfileFromService() {
    if (typeof FirebaseService === 'undefined' || !FirebaseService.getUserProfile) {
        return { displayName: '', nickname: '', avatarDataUrl: '' };
    }
    const profile = FirebaseService.getUserProfile();
    if (!profile || typeof profile !== 'object') {
        return { displayName: '', nickname: '', avatarDataUrl: '' };
    }
    return {
        displayName: typeof profile.displayName === 'string' ? profile.displayName.trim().slice(0, PROFILE_TEXT_LIMIT) : '',
        nickname: typeof profile.nickname === 'string' ? profile.nickname.trim().replace(/^@+/, '').slice(0, PROFILE_TEXT_LIMIT) : '',
        avatarDataUrl: typeof profile.avatarDataUrl === 'string' ? profile.avatarDataUrl.trim().slice(0, PROFILE_AVATAR_DATA_URL_LIMIT) : '',
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
    modal.classList.remove('hidden');
}

function closeSettingsModal() {
    const modal = document.getElementById('settingsModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

function handleSettingsOverlayClick(event) {
    if (event && event.target && event.target.id === 'settingsModal') {
        closeSettingsModal();
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
    const displayInput = document.getElementById('settingsDisplayNameInput');
    const nicknameInput = document.getElementById('settingsNicknameInput');
    const displayName = displayInput && typeof displayInput.value === 'string'
        ? displayInput.value.trim().slice(0, PROFILE_TEXT_LIMIT)
        : '';
    const nickname = nicknameInput && typeof nicknameInput.value === 'string'
        ? nicknameInput.value.trim().replace(/^@+/, '').slice(0, PROFILE_TEXT_LIMIT)
        : '';

    if (FirebaseService.setUserProfile) {
        FirebaseService.setUserProfile({
            displayName: displayName,
            nickname: nickname,
            avatarDataUrl: settingsDraftAvatarDataUrl || '',
        });
    }

    const result = await FirebaseService.saveUserData();
    if (result && result.success) {
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
function getEventIds() {
    return window.DSCoreEvents.getEventIds();
}

let currentEvent = getEventIds()[0] || 'desert_storm';

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

// Per-event map images, split by purpose so preview can stay lightweight.
const mapImages = {
    [MAP_PREVIEW]: {},
    [MAP_EXPORT]: {},
};
let mapLoadedFlags = {
    [MAP_PREVIEW]: {},
    [MAP_EXPORT]: {},
};
let mapLoadRetries = {
    [MAP_PREVIEW]: {},
    [MAP_EXPORT]: {},
};
let mapUnavailableFlags = {
    [MAP_PREVIEW]: {},
    [MAP_EXPORT]: {},
};
let mapLoadPromises = {
    [MAP_PREVIEW]: {},
    [MAP_EXPORT]: {},
};
let coordMapWarningShown = {};
const mapSourceCache = {
    [MAP_PREVIEW]: {},
    [MAP_EXPORT]: {},
};
const maxRetries = 3;

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
        if (!mapImages[purpose][event]) {
            mapImages[purpose][event] = new Image();
        }
        if (!Object.prototype.hasOwnProperty.call(mapLoadedFlags[purpose], event)) {
            mapLoadedFlags[purpose][event] = false;
        }
        if (!Object.prototype.hasOwnProperty.call(mapLoadRetries[purpose], event)) {
            mapLoadRetries[purpose][event] = 0;
        }
        if (!Object.prototype.hasOwnProperty.call(mapUnavailableFlags[purpose], event)) {
            mapUnavailableFlags[purpose][event] = false;
        }
        if (!Object.prototype.hasOwnProperty.call(mapLoadPromises[purpose], event)) {
            mapLoadPromises[purpose][event] = null;
        }
        if (!Object.prototype.hasOwnProperty.call(mapSourceCache[purpose], event)) {
            mapSourceCache[purpose][event] = '';
        }
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
        mapLoadedFlags[purpose][event] = false;
        mapLoadRetries[purpose][event] = 0;
        mapUnavailableFlags[purpose][event] = false;
        mapLoadPromises[purpose][event] = null;
        mapSourceCache[purpose][event] = '';
        if (mapImages[purpose][event]) {
            mapImages[purpose][event].src = '';
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
    [MAP_PREVIEW, MAP_EXPORT].forEach((purpose) => {
        [mapImages, mapLoadedFlags, mapLoadRetries, mapUnavailableFlags, mapLoadPromises, mapSourceCache].forEach((bucket) => {
            Object.keys(bucket[purpose]).forEach((eventId) => {
                if (!eventIdSet.has(eventId)) {
                    delete bucket[purpose][eventId];
                }
            });
        });
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
    const button = document.createElement('button');
    button.className = `event-btn${eventId === currentEvent ? ' active' : ''}`;
    button.type = 'button';
    button.dataset.event = eventId;
    button.textContent = getEventDisplayName(eventId);
    button.addEventListener('click', () => switchEvent(eventId));
    return button;
}

function renderEventSelector(containerId) {
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

    const storedEvents = (typeof FirebaseService !== 'undefined' && FirebaseService.getAllEventData)
        ? normalizeStoredEventsData(FirebaseService.getAllEventData())
        : {};

    Object.keys(storedEvents).forEach((eventId) => {
        const stored = storedEvents[eventId];
        const base = nextRegistry[eventId] || {};
        const baseBuildings = Array.isArray(base.buildings) ? base.buildings : [];
        const storedBuildings = Array.isArray(stored.buildingConfig)
            ? normalizeBuildingConfig(stored.buildingConfig, baseBuildings)
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
        const preserveTitleKey = !stored.name || !base.name || stored.name === base.name;

        nextRegistry[eventId] = {
            ...base,
            id: eventId,
            name: nextName,
            titleKey: preserveTitleKey ? (base.titleKey || '') : '',
            mapFile: mapDataUrl || base.mapFile || '',
            previewMapFile: mapDataUrl || base.previewMapFile || base.mapFile || '',
            exportMapFile: mapDataUrl || base.exportMapFile || base.mapFile || '',
            mapTitle: nextName.toUpperCase().slice(0, 50),
            excelPrefix: normalizeEventId(base.excelPrefix || eventId) || eventId,
            logoDataUrl: stored.logoDataUrl || '',
            mapDataUrl: mapDataUrl,
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
    if (purpose === MAP_EXPORT) {
        return evt.exportMapFile || evt.mapFile || evt.previewMapFile || null;
    }
    return evt.previewMapFile || evt.mapFile || evt.exportMapFile || null;
}

function getEventMapFallbackFile(eventId, purpose) {
    const evt = window.DSCoreEvents.getEvent(eventId);
    if (!evt) return null;
    if (purpose === MAP_EXPORT) {
        if (evt.mapFile && evt.mapFile !== evt.exportMapFile) {
            return evt.mapFile;
        }
        return null;
    }
    return evt.mapFile || evt.exportMapFile || null;
}

function loadMapImage(eventId, purpose) {
    const eid = eventId || currentEvent;
    const mapPurpose = purpose === MAP_EXPORT ? MAP_EXPORT : MAP_PREVIEW;
    ensureEventRuntimeState(eid);
    if (mapLoadedFlags[mapPurpose][eid]) {
        return Promise.resolve(true);
    }
    if (mapLoadPromises[mapPurpose][eid]) {
        return mapLoadPromises[mapPurpose][eid];
    }

    const primaryFile = getEventMapFile(eid, mapPurpose);
    const fallbackFile = getEventMapFallbackFile(eid, mapPurpose);
    const candidateFiles = [...new Set([primaryFile, fallbackFile].filter(Boolean))];
    const mapSourceSignature = candidateFiles.join('|');

    if (mapSourceCache[mapPurpose][eid] !== mapSourceSignature) {
        mapLoadedFlags[mapPurpose][eid] = false;
        mapUnavailableFlags[mapPurpose][eid] = false;
        mapLoadRetries[mapPurpose][eid] = 0;
        mapLoadPromises[mapPurpose][eid] = null;
        mapSourceCache[mapPurpose][eid] = mapSourceSignature;
    }

    mapLoadPromises[mapPurpose][eid] = new Promise((resolve, reject) => {
        const imageEl = mapImages[mapPurpose][eid];
        let candidateIndex = 0;

        const tryLoadCandidate = () => {
            const src = candidateFiles[candidateIndex];
            if (!src) {
                mapUnavailableFlags[mapPurpose][eid] = true;
                mapLoadPromises[mapPurpose][eid] = null;
                reject(new Error(`No map source available for ${eid}/${mapPurpose}`));
                return;
            }
            const bust = src.includes('?') ? '&' : '?';
            imageEl.src = `${src}${bust}v=${Date.now()}`;
        };

        imageEl.onload = () => {
            mapLoadedFlags[mapPurpose][eid] = true;
            mapUnavailableFlags[mapPurpose][eid] = false;
            mapLoadRetries[mapPurpose][eid] = 0;
            mapLoadPromises[mapPurpose][eid] = null;
            console.log(`Map loaded for ${eid}/${mapPurpose}`);
            resolve(true);
        };

        imageEl.onerror = () => {
            if (candidateIndex < candidateFiles.length - 1) {
                candidateIndex += 1;
                tryLoadCandidate();
                return;
            }

            const retry = mapLoadRetries[mapPurpose][eid] + 1;
            console.error(`Map failed to load for ${eid}/${mapPurpose}, attempt: ${retry}`);
            if (mapLoadRetries[mapPurpose][eid] < maxRetries) {
                mapLoadRetries[mapPurpose][eid] += 1;
                setTimeout(() => {
                    candidateIndex = 0;
                    tryLoadCandidate();
                }, 700 * mapLoadRetries[mapPurpose][eid]);
            } else {
                console.error(`Map loading failed for ${eid}/${mapPurpose} after ${maxRetries} attempts`);
                mapUnavailableFlags[mapPurpose][eid] = true;
                mapLoadPromises[mapPurpose][eid] = null;
                reject(new Error(`Map failed to load: ${eid}/${mapPurpose}`));
            }
        };

        tryLoadCandidate();
    });

    return mapLoadPromises[mapPurpose][eid];
}

const BUILDING_POSITIONS_VERSION = 2;
const BUILDING_CONFIG_VERSION = 2;

const textColors = { 1: '#8B0000', 2: '#B85C00', 3: '#006464', 4: '#006699', 5: '#226644', 6: '#556B2F' };
const bgColors = { 1: 'rgba(255,230,230,0.9)', 2: 'rgba(255,240,220,0.9)', 3: 'rgba(230,255,250,0.9)',
                  4: 'rgba(230,245,255,0.9)', 5: 'rgba(240,255,240,0.9)', 6: 'rgba(245,255,235,0.9)' };

const MAX_BUILDING_SLOTS_TOTAL = 20;
const MIN_BUILDING_SLOTS = 0;

function switchEvent(eventId) {
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
    if (coordOverlayVisible && !mapLoadedFlags[MAP_EXPORT][targetEventId]) {
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
    return event.mapDataUrl || event.previewMapFile || event.mapFile || event.exportMapFile || '';
}

function updateEventMapPreview() {
    const image = document.getElementById('eventMapPreviewImage');
    const placeholder = document.getElementById('eventMapPreviewPlaceholder');
    if (!image || !placeholder) {
        return;
    }
    const fallbackMapSource = getEventMapPreviewSource(eventEditorCurrentId);
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
    const hasSavedMap = isEventMapAvailable(eventEditorCurrentId);
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
    const hasSavedMap = isEventMapAvailable(eventEditorCurrentId);
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

    ['eventLogoUploadBtn', 'eventLogoRandomBtn', 'eventAddBuildingBtn', 'eventSaveBtn'].forEach((id) => {
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

    const rows = document.querySelectorAll('#eventBuildingsEditorBody input, #eventBuildingsEditorBody button[data-action="remove-row"]');
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

    const logoUploadBtn = document.getElementById('eventLogoUploadBtn');
    const logoRandomBtn = document.getElementById('eventLogoRandomBtn');
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

function openCoordinatesPickerFromEditor() {
    if (!eventEditorCurrentId) {
        showMessage('eventsStatus', t('events_manager_coordinates_save_first'), 'warning');
        return;
    }
    if (!isEventMapAvailable(eventEditorCurrentId) && !eventDraftMapDataUrl) {
        showMessage('eventsStatus', t('events_manager_coordinates_missing_map'), 'warning');
        return;
    }
    if (currentEvent !== eventEditorCurrentId) {
        switchEvent(eventEditorCurrentId);
    }
    openCoordinatesPicker();
}

function createEditorBuildingRow(rowData) {
    const source = rowData && typeof rowData === 'object' ? rowData : {};
    const name = typeof source.name === 'string' ? source.name : '';
    const slots = Number(source.slots);
    const priority = Number(source.priority);

    const row = document.createElement('tr');
    row.innerHTML = `
        <td><input type="text" data-field="name" maxlength="50" value="${escapeAttribute(name)}"></td>
        <td><input type="number" data-field="slots" min="${MIN_BUILDING_SLOTS}" max="${MAX_BUILDING_SLOTS_TOTAL}" value="${Number.isFinite(slots) ? Math.max(MIN_BUILDING_SLOTS, Math.min(MAX_BUILDING_SLOTS_TOTAL, Math.round(slots))) : 0}"></td>
        <td><input type="number" data-field="priority" min="1" max="6" value="${Number.isFinite(priority) ? clampPriority(priority, 1) : 1}"></td>
        <td><button class="clear-btn" type="button" data-action="remove-row">${t('events_manager_remove')}</button></td>
    `;
    return row;
}

function renderEventBuildingsEditor(buildings) {
    const tbody = document.getElementById('eventBuildingsEditorBody');
    if (!tbody) {
        return;
    }
    tbody.innerHTML = '';
    const source = Array.isArray(buildings) && buildings.length > 0
        ? buildings
        : [{ name: '', slots: 0, priority: 1 }];
    source.forEach((building) => {
        tbody.appendChild(createEditorBuildingRow(building));
    });
}

function addEventBuildingRow() {
    if (!eventEditorIsEditMode) {
        return;
    }
    const tbody = document.getElementById('eventBuildingsEditorBody');
    if (!tbody) {
        return;
    }
    tbody.appendChild(createEditorBuildingRow({ name: '', slots: 0, priority: 1 }));
}

function readEventBuildingsEditor() {
    const tbody = document.getElementById('eventBuildingsEditorBody');
    if (!tbody) {
        return { buildings: [], error: t('events_manager_buildings_required') };
    }
    const rows = Array.from(tbody.querySelectorAll('tr'));
    const buildings = [];
    const seenNames = new Set();

    for (const row of rows) {
        const nameInput = row.querySelector('input[data-field="name"]');
        const slotsInput = row.querySelector('input[data-field="slots"]');
        const priorityInput = row.querySelector('input[data-field="priority"]');
        const name = nameInput && typeof nameInput.value === 'string' ? nameInput.value.trim() : '';
        if (!name) {
            continue;
        }
        if (seenNames.has(name.toLowerCase())) {
            return { buildings: [], error: t('events_manager_duplicate_building', { name: name }) };
        }
        seenNames.add(name.toLowerCase());
        const slots = clampSlots(Number(slotsInput ? slotsInput.value : 0), 0);
        const priority = clampPriority(Number(priorityInput ? priorityInput.value : 1), 1);
        buildings.push({
            name: name,
            label: name,
            slots: slots,
            priority: priority,
        });
    }
    if (buildings.length === 0) {
        return { buildings: [], error: t('events_manager_buildings_required') };
    }
    return { buildings: buildings, error: null };
}

function setEditorName(value) {
    const input = document.getElementById('eventNameInput');
    if (input) {
        input.value = value || '';
    }
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
    updateEventLogoPreview();
    updateEventMapPreview();
    renderEventBuildingsEditor(Array.isArray(event.buildings) ? event.buildings : []);
    updateEventEditorState();
}

function renderEventsList() {
    const listEl = document.getElementById('eventsList');
    if (!listEl) {
        return;
    }
    const eventIds = getEventIds();
    listEl.innerHTML = '';
    eventIds.forEach((eventId) => {
        const event = window.DSCoreEvents.getEvent(eventId);
        if (!event) {
            return;
        }
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `events-list-item${eventId === currentEvent ? ' active' : ''}`;
        button.addEventListener('click', () => {
            eventEditorCurrentId = eventId;
            switchEvent(eventId);
        });

        const avatar = document.createElement('img');
        avatar.className = 'events-list-avatar';
        avatar.alt = `${event.name || eventId} avatar`;
        avatar.src = event.logoDataUrl || generateEventAvatarDataUrl(event.name || eventId, eventId);

        const textWrap = document.createElement('span');
        textWrap.className = 'events-list-text';
        const title = document.createElement('span');
        title.className = 'events-list-title';
        title.textContent = event.name || eventId;
        const meta = document.createElement('span');
        meta.className = 'events-list-meta';
        meta.textContent = t('events_manager_building_count', { count: Array.isArray(event.buildings) ? event.buildings.length : 0 });
        textWrap.appendChild(title);
        textWrap.appendChild(meta);

        button.appendChild(avatar);
        button.appendChild(textWrap);
        listEl.appendChild(button);
    });

    const newEventBtn = document.createElement('button');
    newEventBtn.type = 'button';
    newEventBtn.className = `events-list-item events-list-new${!eventEditorCurrentId ? ' active' : ''}`;
    newEventBtn.addEventListener('click', () => {
        startNewEventDraft();
        renderEventsList();
    });

    const newAvatar = document.createElement('span');
    newAvatar.className = 'events-list-avatar events-list-avatar-add';
    newAvatar.textContent = '+';

    const newTextWrap = document.createElement('span');
    newTextWrap.className = 'events-list-text';
    const newTitle = document.createElement('span');
    newTitle.className = 'events-list-title';
    newTitle.textContent = t('events_manager_new_event');
    const newMeta = document.createElement('span');
    newMeta.className = 'events-list-meta';
    newMeta.textContent = t('events_manager_new_event_hint');
    newTextWrap.appendChild(newTitle);
    newTextWrap.appendChild(newMeta);

    newEventBtn.appendChild(newAvatar);
    newEventBtn.appendChild(newTextWrap);
    listEl.appendChild(newEventBtn);
}

function startNewEventDraft() {
    eventEditorCurrentId = '';
    eventEditorIsEditMode = true;
    setEditorName('');
    eventDraftLogoDataUrl = '';
    eventDraftMapDataUrl = '';
    updateEventLogoPreview();
    updateEventMapPreview();
    renderEventBuildingsEditor([{ name: 'Bomb Squad', slots: 4, priority: 1 }]);
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
            maxSide: 1920,
            maxDataUrlLength: EVENT_MAP_DATA_URL_LIMIT,
            tooLargeMessage: t('events_manager_map_too_large'),
        });
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

function buildEventDefinition(eventId, name, buildings) {
    const existing = window.DSCoreEvents.getEvent(eventId) || {};
    const mapDataUrl = eventDraftMapDataUrl || '';
    const logoDataUrl = eventDraftLogoDataUrl || generateEventAvatarDataUrl(name, eventId);
    const validNames = new Set(buildings.map((item) => item.name));
    const currentPositions = buildingPositionsMap[eventId] || (existing.defaultPositions || {});
    const normalizedPositions = window.DSCoreBuildings.normalizeBuildingPositions(currentPositions, validNames);
    return {
        id: eventId,
        name: name,
        titleKey: existing.titleKey || '',
        mapFile: mapDataUrl || existing.mapFile || '',
        previewMapFile: mapDataUrl || existing.previewMapFile || existing.mapFile || '',
        exportMapFile: mapDataUrl || existing.exportMapFile || existing.mapFile || '',
        mapTitle: name.toUpperCase().slice(0, 50),
        excelPrefix: normalizeEventId(existing.excelPrefix || eventId) || eventId,
        logoDataUrl: logoDataUrl,
        mapDataUrl: mapDataUrl,
        buildings: buildings,
        defaultPositions: normalizedPositions,
        buildingAnchors: existing.buildingAnchors || {},
    };
}

async function saveEventDefinition() {
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
    const definition = buildEventDefinition(eventId, eventName, buildings);
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
                buildingConfig: buildingConfigs[eventId],
                buildingPositions: buildingPositionsMap[eventId],
            });
        }
        FirebaseService.setBuildingConfig(eventId, buildingConfigs[eventId]);
        FirebaseService.setBuildingConfigVersion(eventId, getTargetBuildingConfigVersion());
        FirebaseService.setBuildingPositions(eventId, buildingPositionsMap[eventId]);
        FirebaseService.setBuildingPositionsVersion(eventId, getTargetBuildingPositionsVersion());
        const saveResult = await FirebaseService.saveUserData();
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
    const removed = window.DSCoreEvents.removeEvent(eventId);
    if (!removed) {
        showMessage('eventsStatus', t('events_manager_delete_failed'), 'error');
        return;
    }

    delete buildingConfigs[eventId];
    delete buildingPositionsMap[eventId];
    [MAP_PREVIEW, MAP_EXPORT].forEach((purpose) => {
        delete mapImages[purpose][eventId];
        delete mapLoadedFlags[purpose][eventId];
        delete mapLoadRetries[purpose][eventId];
        delete mapUnavailableFlags[purpose][eventId];
        delete mapLoadPromises[purpose][eventId];
        delete mapSourceCache[purpose][eventId];
    });
    delete coordMapWarningShown[eventId];

    if (typeof FirebaseService !== 'undefined' && FirebaseService.removeEvent) {
        FirebaseService.removeEvent(eventId);
        const result = await FirebaseService.saveUserData();
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

function bindEventEditorTableActions() {
    const tbody = document.getElementById('eventBuildingsEditorBody');
    if (!tbody) {
        return;
    }
    tbody.addEventListener('click', (event) => {
        if (!eventEditorIsEditMode) {
            return;
        }
        const btn = event.target.closest('button[data-action="remove-row"]');
        if (!btn) {
            return;
        }
        const row = btn.closest('tr');
        if (!row) {
            return;
        }
        row.remove();
        const remainingRows = tbody.querySelectorAll('tr').length;
        if (remainingRows === 0) {
            addEventBuildingRow();
        }
    });
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

// ============================================================
// TEMPLATE GENERATION
// ============================================================

async function downloadPlayerTemplate() {
    try {
        await ensureXLSXLoaded();
    } catch (error) {
        console.error(error);
        showMessage('uploadMessage', t('error_xlsx_missing'), 'error');
        return;
    }

    const wb = XLSX.utils.book_new();
    
    const instructions = [
        [t('template_title')],
        [''],
        [t('template_instructions')],
        [t('template_step1')],
        [t('template_step2')],
        [t('template_step3')],
        [t('template_step4')],
        [t('template_step5')],
        [''],
        [t('template_header_player_name'), t('template_header_power'), t('template_header_troops')]
    ];
    
    const examples = [
        ['Player1', 65.0, 'Tank'],
        ['Player2', 68.0, 'Aero'],
        ['Player3', 64.0, 'Missile'],
        ['', '', ''],
        ['', '', '']
    ];
    
    const data = [...instructions, ...examples];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{wch: 25}, {wch: 20}, {wch: 15}];
    
    XLSX.utils.book_append_sheet(wb, ws, t('template_sheet_name'));
    XLSX.writeFile(wb, 'player_database_template.xlsx');
    
    showMessage('uploadMessage', t('message_template_downloaded'), 'success');
}

// ============================================================
// ALLIANCE MANAGEMENT
// ============================================================

function toggleAlliancePanel() {
    const panel = document.getElementById('alliancePanel');
    panel.classList.toggle('hidden');
    if (!panel.classList.contains('hidden')) {
        renderAlliancePanel();
    }
}

function renderAlliancePanel() {
    const aid = typeof FirebaseService !== 'undefined' ? FirebaseService.getAllianceId() : null;
    const content = document.getElementById('alliancePanelContent');
    if (aid) {
        renderAllianceMemberView(content);
    } else {
        renderAllianceJoinView(content);
    }
}

function renderAllianceJoinView(container) {
    container.innerHTML = `
        <div style="margin-top: 15px;">
            <h3 style="color: var(--gold); margin: 0 0 10px;">${t('alliance_create_title')}</h3>
            <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 10px;">
                <input type="text" id="newAllianceName" placeholder="${t('alliance_name_placeholder')}"
                       maxlength="40" style="flex: 1; min-width: 150px; padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.3); background: rgba(255,255,255,0.1); color: white; font-size: 14px;">
                <button onclick="handleCreateAlliance()">${t('alliance_create_button')}</button>
            </div>
            <div id="allianceCreateStatus"></div>
        </div>
    `;
}

function renderAllianceMemberView(container) {
    const members = FirebaseService.getAllianceMembers();
    const memberCount = Object.keys(members).length;
    const aName = FirebaseService.getAllianceName();
    const source = FirebaseService.getPlayerSource();

    let membersHtml = '';
    Object.entries(members).forEach(([uid, member]) => {
        membersHtml += `<div style="padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">${escapeHtml(member.email)}</div>`;
    });

    container.innerHTML = `
        <div style="margin-top: 15px; margin-bottom: 15px;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                <div>
                    <strong style="color: var(--gold);">${escapeHtml(aName || '')}</strong>
                </div>
                <span style="opacity: 0.7;">${t('alliance_member_count', { count: memberCount })}</span>
            </div>
        </div>
        <div style="margin-bottom: 20px;">
            <h3 style="color: var(--gold); margin: 0 0 10px;">${t('alliance_members_title')}</h3>
            <div style="max-height: 150px; overflow-y: auto;">${membersHtml}</div>
        </div>
        <div style="margin-bottom: 20px;">
            <h3 style="color: var(--gold); margin: 0 0 10px;">${t('alliance_invite_title')}</h3>
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                <input type="email" id="inviteEmail" placeholder="${t('alliance_invite_placeholder')}"
                       style="flex: 1; min-width: 200px; padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.3); background: rgba(255,255,255,0.1); color: white; font-size: 14px;">
                <button onclick="handleSendInvitation()">${t('alliance_invite_button')}</button>
            </div>
            <div id="inviteStatus"></div>
        </div>
        <div style="margin-bottom: 20px;">
            <h3 style="color: var(--gold); margin: 0 0 10px;">${t('alliance_player_source_title')}</h3>
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                <button class="${source === 'personal' ? '' : 'secondary'}" onclick="switchPlayerSource('personal')">${t('alliance_source_personal')}</button>
                <button class="${source === 'alliance' ? '' : 'secondary'}" onclick="switchPlayerSource('alliance')">${t('alliance_source_alliance')}</button>
            </div>
            <div id="playerSourceStatus"></div>
        </div>
        <button class="clear-btn" onclick="handleLeaveAlliance()" style="color: #FF6B35; border-color: #FF6B35;">${t('alliance_leave_button')}</button>
        <div id="allianceActionStatus"></div>
    `;
}

async function handleCreateAlliance() {
    const name = document.getElementById('newAllianceName').value.trim();

    if (!name || name.length > 40) {
        showMessage('allianceCreateStatus', t('alliance_error_invalid_name'), 'error');
        return;
    }

    showMessage('allianceCreateStatus', t('message_upload_processing'), 'processing');
    const result = await FirebaseService.createAlliance(name);

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

    const result = await FirebaseService.sendInvitation(email);
    if (result.success) {
        showMessage('inviteStatus', t('alliance_invite_sent'), 'success');
        document.getElementById('inviteEmail').value = '';
    } else {
        showMessage('inviteStatus', result.error, 'error');
    }
}

async function handleLeaveAlliance() {
    if (!confirm(t('alliance_confirm_leave'))) return;

    const result = await FirebaseService.leaveAlliance();
    if (result.success) {
        renderAlliancePanel();
        updateAllianceHeaderDisplay();
        loadPlayerData();
    }
}

async function switchPlayerSource(source) {
    await FirebaseService.setPlayerSource(source);
    loadPlayerData();
    renderAlliancePanel();
    showMessage('playerSourceStatus', t('alliance_source_switched', { source: t('alliance_source_' + source) }), 'success');
}

function updateAllianceHeaderDisplay() {
    if (typeof FirebaseService === 'undefined') return;
    const aid = FirebaseService.getAllianceId();
    const aName = FirebaseService.getAllianceName();
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

    const invitations = await FirebaseService.checkInvitations();
    const badge = document.getElementById('notificationBadge');
    if (badge) {
        badge.textContent = invitations.length;
        badge.style.display = invitations.length > 0 ? 'flex' : 'none';
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

function toggleNotificationsPanel() {
    const panel = document.getElementById('notificationsPanel');
    panel.classList.toggle('hidden');
    if (!panel.classList.contains('hidden')) {
        renderNotifications();
    }
}

function renderNotifications() {
    const container = document.getElementById('notificationsList');
    const invitations = typeof FirebaseService !== 'undefined' ? FirebaseService.getPendingInvitations() : [];

    if (invitations.length === 0) {
        const emptyState = document.createElement('p');
        emptyState.style.opacity = '0.6';
        emptyState.style.textAlign = 'center';
        emptyState.textContent = t('notifications_empty');
        container.replaceChildren(emptyState);
        return;
    }

    container.replaceChildren();
    invitations.forEach((inv) => {
        const card = document.createElement('div');
        card.style.padding = '12px';
        card.style.background = 'rgba(255,255,255,0.05)';
        card.style.borderRadius = '8px';
        card.style.marginBottom = '10px';
        card.style.border = '1px solid rgba(255,255,255,0.1)';

        const heading = document.createElement('div');
        heading.style.marginBottom = '8px';
        const title = document.createElement('strong');
        title.textContent = String(inv.allianceName || '');
        const idMeta = document.createElement('span');
        idMeta.style.opacity = '0.6';
        idMeta.textContent = ` (ID: ${String(inv.allianceId || '')})`;
        heading.appendChild(title);
        heading.appendChild(idMeta);

        const detail = document.createElement('div');
        detail.style.opacity = '0.7';
        detail.style.fontSize = '13px';
        detail.style.marginBottom = '10px';
        detail.textContent = t('notification_invited_by', { email: String(inv.inviterEmail || '') });

        const actions = document.createElement('div');
        actions.style.display = 'flex';
        actions.style.gap = '10px';

        const acceptBtn = document.createElement('button');
        acceptBtn.style.flex = '1';
        acceptBtn.style.padding = '8px';
        acceptBtn.textContent = t('notification_accept');
        acceptBtn.addEventListener('click', () => handleAcceptInvitation(inv.id));

        const rejectBtn = document.createElement('button');
        rejectBtn.className = 'clear-btn';
        rejectBtn.style.flex = '1';
        rejectBtn.style.padding = '8px';
        rejectBtn.textContent = t('notification_reject');
        rejectBtn.addEventListener('click', () => handleRejectInvitation(inv.id));

        actions.appendChild(acceptBtn);
        actions.appendChild(rejectBtn);

        card.appendChild(heading);
        card.appendChild(detail);
        card.appendChild(actions);
        container.appendChild(card);
    });
}

async function handleAcceptInvitation(invitationId) {
    const result = await FirebaseService.acceptInvitation(invitationId);
    if (result.success) {
        await checkAndDisplayNotifications();
        renderNotifications();
        renderAlliancePanel();
        updateAllianceHeaderDisplay();
        loadPlayerData();
    } else {
        alert(result.error);
    }
}

async function handleRejectInvitation(invitationId) {
    const result = await FirebaseService.rejectInvitation(invitationId);
    if (result.success) {
        await checkAndDisplayNotifications();
        renderNotifications();
    }
}

// ============================================================
// PLAYER DATA MANAGEMENT
// ============================================================

async function uploadPlayerData() {
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

    if (FirebaseService.getAllianceId()) {
        window._pendingUploadFile = file;
        document.getElementById('uploadTargetModal').classList.remove('hidden');
    } else {
        await performUpload(file, 'personal');
    }

    fileInput.value = '';
}

function closeUploadTargetModal() {
    window._pendingUploadFile = null;
    document.getElementById('uploadTargetModal').classList.add('hidden');
}

async function uploadToPersonal() {
    const file = window._pendingUploadFile;
    closeUploadTargetModal();
    if (file) await performUpload(file, 'personal');
}

async function uploadToAlliance() {
    const file = window._pendingUploadFile;
    closeUploadTargetModal();
    if (file) await performUpload(file, 'alliance');
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

    try {
        let result;
        if (target === 'alliance') {
            result = await FirebaseService.uploadAlliancePlayerDatabase(file);
        } else {
            result = await FirebaseService.uploadPlayerDatabase(file);
        }

        if (result.success) {
            showMessage('uploadMessage', result.message, 'success');
            loadPlayerData();
        } else {
            showMessage('uploadMessage', t('message_upload_failed', { error: result.error }), 'error');
        }
    } catch (error) {
        showMessage('uploadMessage', t('message_upload_failed', { error: error.error || error.message }), 'error');
    }
}

function loadPlayerData() {
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
    
    const playerDB = FirebaseService.getActivePlayerDatabase();
    const count = Object.keys(playerDB).length;
    const source = FirebaseService.getPlayerSource();
    const sourceLabel = source === 'alliance' ? t('player_source_alliance') : t('player_source_personal');

    document.getElementById('playerCount').textContent = t('player_count_with_source', { count: count, source: sourceLabel });
    
    if (count > 0) {
        allPlayers = Object.keys(playerDB).map(name => ({
            name: name,
            power: playerDB[name].power,
            troops: playerDB[name].troops
        }));
        
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
        showConfigurationPage();
    }
}

function showSelectionInterface() {
    document.getElementById('selectionSection').classList.remove('hidden');
    showGeneratorPage();
    renderPlayersTable();
    updateTeamCounters();
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
    const stored = FirebaseService.getBuildingConfig(currentEvent);
    const defaultConfig = getResolvedDefaultBuildingConfig();
    const targetVersion = getTargetBuildingConfigVersion();
    const shouldResetToDefaults = !Array.isArray(stored) || stored.length === 0;
    const normalized = shouldResetToDefaults
        ? normalizeBuildingConfig(defaultConfig, defaultConfig)
        : normalizeBuildingConfig(stored, defaultConfig);
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
        return false;
    });

    if (needsSave) {
        FirebaseService.setBuildingConfig(currentEvent, config);
        FirebaseService.setBuildingConfigVersion(currentEvent, targetVersion);
    }

    renderBuildingsTable();
    return needsSave;
}

function loadBuildingPositions() {
    if (typeof FirebaseService === 'undefined') {
        setBuildingPositionsLocal({});
        return false;
    }
    const storedVersion = FirebaseService.getBuildingPositionsVersion(currentEvent);
    const stored = FirebaseService.getBuildingPositions(currentEvent);
    const targetDefaults = getResolvedDefaultBuildingPositions();
    const targetVersion = getTargetBuildingPositionsVersion();
    setBuildingPositionsLocal(normalizeBuildingPositions(stored));
    if (Object.keys(getBuildingPositions()).length === 0 || storedVersion < targetVersion) {
        setBuildingPositionsLocal(targetDefaults);
        FirebaseService.setBuildingPositions(currentEvent, getBuildingPositions());
        FirebaseService.setBuildingPositionsVersion(currentEvent, targetVersion);
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

    FirebaseService.setBuildingConfig(currentEvent, getBuildingConfig());
    FirebaseService.setBuildingConfigVersion(currentEvent, getTargetBuildingConfigVersion());
    const result = await FirebaseService.saveUserData();
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

function refreshCoordinatesPickerForCurrentEvent() {
    if (!getActiveEvent()) {
        showMessage('coordStatus', t('events_manager_no_events'), 'error');
        return false;
    }
    loadBuildingConfig();
    loadBuildingPositions();
    coordBuildings = getBuildingConfig()
        .filter((b) => b.name !== 'Bomb Squad')
        .map((b) => b.name);

    if (coordBuildings.length === 0) {
        showMessage('coordStatus', t('coord_no_buildings'), 'error');
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
    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    refreshCoordinatesPickerForCurrentEvent();
}

function openCoordinatesPickerForEvent(eventId) {
    if (EVENT_REGISTRY[eventId]) {
        switchEvent(eventId);
    }
    openCoordinatesPicker();
}

function closeCoordinatesPicker() {
    document.getElementById('coordPickerOverlay').classList.add('hidden');
    document.body.style.overflow = '';
}

function updateCoordLabel() {
    const name = coordBuildings[coordBuildingIndex];
    const displayName = getBuildingDisplayName(name);
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
    const activeMapImage = mapImages[activeMapPurpose][currentEvent];
    const activeMapLoaded = mapLoadedFlags[activeMapPurpose][currentEvent];
    const activeMapUnavailable = mapUnavailableFlags[activeMapPurpose][currentEvent];
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
    const hasMapBackground = activeMapLoaded && activeMapImage.width > 0 && activeMapImage.height > 0;
    const mapHeight = hasMapBackground ? Math.floor(activeMapImage.height * (1080 / activeMapImage.width)) : 720;

    canvas.width = 1080;
    canvas.height = mapHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (hasMapBackground) {
        ctx.drawImage(activeMapImage, 0, 0, 1080, mapHeight);
        coordMapWarningShown[currentEvent] = false;
        if (statusEl) {
            statusEl.innerHTML = '';
        }
    } else {
        const grad = ctx.createLinearGradient(0, 0, 1080, mapHeight);
        grad.addColorStop(0, '#1f2238');
        grad.addColorStop(1, '#2b2f4a');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 1080, mapHeight);

        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 1;
        for (let x = 0; x <= 1080; x += 90) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, mapHeight);
            ctx.stroke();
        }
        for (let y = 0; y <= mapHeight; y += 90) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(1080, y);
            ctx.stroke();
        }

        ctx.fillStyle = 'rgba(253, 200, 48, 0.9)';
        ctx.font = 'bold 28px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('MAP PREVIEW UNAVAILABLE', 540, 52);
        ctx.font = '16px Arial';
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fillText(getEventMapFile(currentEvent, activeMapPurpose) || '', 540, 80);

        if (!coordMapWarningShown[currentEvent]) {
            showMessage('coordStatus', `${t('coord_map_not_loaded')} (${getEventMapFile(currentEvent, activeMapPurpose)})`, 'warning');
            coordMapWarningShown[currentEvent] = true;
        }
    }

    Object.entries(getBuildingPositions()).forEach(([name, pos]) => {
        if (!pos) return;
        const isActive = name === coordBuildings[coordBuildingIndex];
        ctx.beginPath();
        ctx.arc(pos[0], pos[1], isActive ? 8 : 5, 0, Math.PI * 2);
        ctx.fillStyle = isActive ? '#FDC830' : 'rgba(255,255,255,0.7)';
        ctx.fill();
        ctx.strokeStyle = isActive ? '#000' : 'rgba(0,0,0,0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();
    });
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
    FirebaseService.setBuildingPositions(currentEvent, getBuildingPositions());
    FirebaseService.setBuildingPositionsVersion(currentEvent, BUILDING_POSITIONS_VERSION);
    const result = await FirebaseService.saveUserData();
    if (result.success) {
        showMessage('coordStatus', t('coord_saved'), 'success');
    } else {
        showMessage('coordStatus', t('coord_save_failed', { error: result.error }), 'error');
    }
}

function reserveSpaceForFooter() {
    const bar = document.getElementById('floatingButtons');
    if (!bar) return;
    const visible = bar.style.display !== 'none';
    const barHeight = visible ? bar.getBoundingClientRect().height : 0;
    const safeAreaInset = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-area-inset-bottom')) || 0;
    document.body.style.paddingBottom = visible ? `${Math.ceil(barHeight + 18 + safeAreaInset)}px` : '';
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

function renderPlayersTable() {
    const tbody = document.getElementById('playersTableBody');
    tbody.innerHTML = '';
    
    let displayPlayers = [...allPlayers];
    
    // Apply filters
    const searchTerm = document.getElementById('searchFilter').value.toLowerCase();
    const troopsFilter = currentTroopsFilter;
    const sortFilter = currentSortFilter;
    
    if (searchTerm) {
        displayPlayers = displayPlayers.filter(p => 
            p.name.toLowerCase().includes(searchTerm)
        );
    }
    
    if (troopsFilter) {
        displayPlayers = displayPlayers.filter(p => p.troops === troopsFilter);
    }
    
    switch(sortFilter) {
        case 'power-desc':
            displayPlayers.sort((a, b) => b.power - a.power);
            break;
        case 'power-asc':
            displayPlayers.sort((a, b) => a.power - b.power);
            break;
        case 'name-asc':
            displayPlayers.sort((a, b) => a.name.localeCompare(b.name));
            break;
        case 'name-desc':
            displayPlayers.sort((a, b) => b.name.localeCompare(a.name));
            break;
    }
    
    // Calculate current counts for disable logic
    const teamAStarterCount = getStarterCount('teamA');
    const teamASubCount = getSubstituteCount('teamA');
    const teamBStarterCount = getStarterCount('teamB');
    const teamBSubCount = getSubstituteCount('teamB');

    displayPlayers.forEach(player => {
        const row = document.createElement('tr');

        const selectionA = teamSelections.teamA.find(p => p.name === player.name);
        const selectionB = teamSelections.teamB.find(p => p.name === player.name);
        const isTeamA = !!selectionA;
        const isTeamB = !!selectionB;

        if (isTeamA) row.classList.add('selected-a');
        if (isTeamB) row.classList.add('selected-b');

        let buttonsHtml;

        if (isTeamA) {
            const role = selectionA.role;
            const starterDisabled = role === 'substitute' && teamAStarterCount >= 20;
            const subDisabled = role === 'starter' && teamASubCount >= 10;

            buttonsHtml = `
                <div class="role-toggle team-a-selected">
                    <button class="role-btn starter ${role === 'starter' ? 'active' : ''}"
                            ${starterDisabled ? 'disabled' : ''}
                            data-role="starter">${t('role_starter')}</button>
                    <button class="role-btn substitute ${role === 'substitute' ? 'active' : ''}"
                            ${subDisabled ? 'disabled' : ''}
                            data-role="substitute">${t('role_substitute')}</button>
                </div>
                <button class="clear-btn">${t('clear_button')}</button>
            `;
        } else if (isTeamB) {
            const role = selectionB.role;
            const starterDisabled = role === 'substitute' && teamBStarterCount >= 20;
            const subDisabled = role === 'starter' && teamBSubCount >= 10;

            buttonsHtml = `
                <div class="role-toggle team-b-selected">
                    <button class="role-btn starter ${role === 'starter' ? 'active' : ''}"
                            ${starterDisabled ? 'disabled' : ''}
                            data-role="starter">${t('role_starter')}</button>
                    <button class="role-btn substitute ${role === 'substitute' ? 'active' : ''}"
                            ${subDisabled ? 'disabled' : ''}
                            data-role="substitute">${t('role_substitute')}</button>
                </div>
                <button class="clear-btn">${t('clear_button')}</button>
            `;
        } else {
            // Disable if both starter and sub slots are full
            const teamAFullyDisabled = teamAStarterCount >= 20 && teamASubCount >= 10;
            const teamBFullyDisabled = teamBStarterCount >= 20 && teamBSubCount >= 10;

            buttonsHtml = `
                <button class="team-btn team-a-btn" ${teamAFullyDisabled ? 'disabled' : ''}>
                    <span class="team-label-full">${t('team_a_button')}</span>
                    <span class="team-label-short">${t('team_a_short')}</span>
                </button>
                <button class="team-btn team-b-btn" ${teamBFullyDisabled ? 'disabled' : ''}>
                    <span class="team-label-full">${t('team_b_button')}</span>
                    <span class="team-label-short">${t('team_b_short')}</span>
                </button>
            `;
        }

        row.innerHTML = `
            <td><strong>${escapeHtml(player.name)}</strong></td>
            <td>${player.power}M</td>
            <td>${escapeHtml(getTroopLabel(player.troops))}</td>
            <td>
                <div class="team-buttons">
                    ${buttonsHtml}
                </div>
            </td>
        `;

        row.dataset.player = player.name;

        tbody.appendChild(row);
    });
}

function toggleTeam(playerName, team) {
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

    updateTeamCounters();
    renderPlayersTable();
}

function togglePlayerRole(playerName, newRole) {
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

    updateTeamCounters();
    renderPlayersTable();
}

function clearPlayerSelection(playerName) {
    const aIndex = teamSelections.teamA.findIndex(p => p.name === playerName);
    if (aIndex > -1) teamSelections.teamA.splice(aIndex, 1);

    const bIndex = teamSelections.teamB.findIndex(p => p.name === playerName);
    if (bIndex > -1) teamSelections.teamB.splice(bIndex, 1);

    updateTeamCounters();
    renderPlayersTable();
}

function clearAllSelections() {
    if (confirm(t('confirm_clear_all'))) {
        teamSelections.teamA = [];
        teamSelections.teamB = [];
        assignmentsA = [];
        assignmentsB = [];
        substitutesA = [];
        substitutesB = [];
        closeDownloadModal();
        document.getElementById('searchFilter').value = '';
        currentTroopsFilter = '';
        currentSortFilter = 'power-desc';
        document.getElementById('troopsFilterBtn').classList.remove('active');
        document.querySelectorAll('.filter-dropdown-panel').forEach(panel => {
            const defaultVal = panel.id === 'troopsFilterPanel' ? '' : 'power-desc';
            panel.querySelectorAll('.filter-option').forEach(opt => {
                opt.classList.toggle('selected', opt.dataset.value === defaultVal);
            });
        });
        updateTeamCounters();
        renderPlayersTable();
    }
}

function filterPlayers() {
    renderPlayersTable();
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
    if (btn.classList.contains('team-a-btn')) toggleTeam(name, 'A');
    else if (btn.classList.contains('team-b-btn')) toggleTeam(name, 'B');
    else if (btn.classList.contains('clear-btn')) clearPlayerSelection(name);
    else if (btn.classList.contains('role-btn')) {
        const newRole = btn.dataset.role;
        if (newRole) togglePlayerRole(name, newRole);
    }
});

function updateTeamCounters() {
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
}

// ============================================================
// ASSIGNMENT GENERATION
// ============================================================

function generateTeamAssignments(team) {
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

    const playerDB = FirebaseService.getActivePlayerDatabase();

    const starterPlayers = starters.map(s => ({
        name: s.name,
        power: playerDB[s.name].power,
        troops: playerDB[s.name].troops
    })).sort((a, b) => b.power - a.power);

    const substitutePlayers = substitutes.map(s => ({
        name: s.name,
        power: playerDB[s.name].power,
        troops: playerDB[s.name].troops
    })).sort((a, b) => b.power - a.power);

    const assignments = assignTeamToBuildings(starterPlayers);

    // Store both assignments and substitutes
    if (team === 'A') {
        assignmentsA = assignments;
        substitutesA = substitutePlayers;
    } else {
        assignmentsB = assignments;
        substitutesB = substitutePlayers;
    }

    openDownloadModal(team);

    console.log(`Team ${team} assignments generated for ${starters.length} starters, ${substitutes.length} substitutes`);
}

function assignTeamToBuildings(players) {
    return window.DSCoreAssignment.assignTeamToBuildings(players, getEffectiveBuildingConfig());
}

// Searches the next 3 available players by power for a different
// troop type than the given player. Falls back to next by power.
function findMixPartner(player, available) {
    return window.DSCoreAssignment.findMixPartner(player, available);
}

// ============================================================
// DOWNLOAD MODAL
// ============================================================

function openDownloadModal(team) {
    const isA = team === 'A';
    const gradient = isA ? 'linear-gradient(135deg, #4169E1, #1E90FF)' : 'linear-gradient(135deg, #DC143C, #FF6347)';
    const color = isA ? '#4169E1' : '#DC143C';
    activeDownloadTeam = team;

    document.getElementById('downloadModalTitle').textContent = t('download_modal_title', { team: team });
    document.getElementById('downloadModalTitle').style.color = color;
    document.getElementById('downloadModalSubtitle').textContent = t('download_modal_subtitle', { team: team });
    document.getElementById('downloadMapBtn').style.background = gradient;
    document.getElementById('downloadMapBtn').onclick = () => downloadTeamMap(team);
    document.getElementById('downloadExcelBtn').style.background = gradient;
    document.getElementById('downloadExcelBtn').onclick = () => downloadTeamExcel(team);
    document.getElementById('downloadStatus').innerHTML = '';
    document.getElementById('downloadModalOverlay').classList.remove('hidden');
}

function closeDownloadModal() {
    activeDownloadTeam = null;
    document.getElementById('downloadModalOverlay').classList.add('hidden');
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
    
    if (!mapLoadedFlags[MAP_EXPORT][currentEvent]) {
        showMessage(statusId, t('message_map_wait'), 'processing');
        try {
            await Promise.race([
                loadMapImage(currentEvent, MAP_EXPORT),
                new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000)),
            ]);
        } catch (error) {
            if (confirm(t('confirm_map_without_background'))) {
                generateMapWithoutBackground(team, assignments, statusId);
            } else {
                showMessage(statusId, t('message_map_cancelled'), 'warning');
            }
            return;
        }
    }
    
    generateMap(team, assignments, statusId);
}

function generateMapWithoutBackground(team, assignments, statusId) {
    showMessage(statusId, t('message_generating_map_no_bg', { team: team }), 'processing');
    
    try {
        const grouped = {};
        const bombSquad = [];
        
        assignments.forEach(a => {
            if (!a.player) return;
            const buildingKey = a.buildingKey || a.building;
            if (buildingKey === 'Bomb Squad') {
                bombSquad.push(a);
            } else {
                if (!grouped[buildingKey]) grouped[buildingKey] = [];
                grouped[buildingKey].push(a);
            }
        });
        
        // Create simplified version without map
        const canvas = document.createElement('canvas');
        canvas.width = 1080;
        canvas.height = 800;
        const ctx = canvas.getContext('2d');
        
        // Background
        ctx.fillStyle = team === 'A' ? '#E8F4FF' : '#FFE8E8';
        ctx.fillRect(0, 0, 1080, 800);
        
        // Title
        const grad = ctx.createLinearGradient(0, 0, 1080, 100);
        grad.addColorStop(0, team === 'A' ? '#4169E1' : '#DC143C');
        grad.addColorStop(1, team === 'A' ? '#1E90FF' : '#FF6347');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 1080, 100);
        
        ctx.font = 'bold 48px Arial';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.fillText(`TEAM ${team} - ${getActiveEvent().mapTitle}`, 540, 60);

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

function generateMap(team, assignments, statusId) {
    showMessage(statusId, t('message_generating_map', { team: team }), 'processing');

    try {
        const teamPrimary = team === 'A' ? '#4169E1' : '#DC143C';
        const teamSecondary = team === 'A' ? '#1E90FF' : '#FF6347';
        const teamSoft = team === 'A' ? 'rgba(65, 105, 225, 0.25)' : 'rgba(220, 20, 60, 0.25)';
        const activePlayerDB = (typeof FirebaseService !== 'undefined' && FirebaseService.getActivePlayerDatabase)
            ? FirebaseService.getActivePlayerDatabase()
            : {};

        const grouped = {};
        const bombSquad = [];

        assignments.forEach(a => {
            if (!a.player) return;
            const buildingKey = a.buildingKey || a.building;
            if (buildingKey === 'Bomb Squad') {
                bombSquad.push(a);
            } else {
                if (!grouped[buildingKey]) grouped[buildingKey] = [];
                grouped[buildingKey].push(a);
            }
        });

        // Get substitutes for this team
        const substitutes = team === 'A' ? substitutesA : substitutesB;

        const titleHeight = 100;
        const bombHeight = 280;
        const activeMapImage = mapImages[MAP_EXPORT][currentEvent];
        const mapHeight = Math.floor(activeMapImage.height * (1080 / activeMapImage.width));
        const totalHeight = titleHeight + mapHeight + bombHeight;

        // Add substitutes panel width if there are substitutes
        const subsPanelWidth = substitutes.length > 0 ? 260 : 0;
        const totalWidth = 1080 + subsPanelWidth;

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

        // Coordinates pick the first card's start X. If it overflows right,
        // use picked X as right edge to keep labels inside the map.
        function getStarterCardStartX(anchorX, cardWidth) {
            const mapLeftBound = 0;
            const mapRightBound = 1080;
            const startX = anchorX;
            const startRight = startX + cardWidth;
            if (startX >= mapLeftBound && startRight <= mapRightBound) {
                return startX;
            }

            const rightAlignedX = anchorX - cardWidth;
            const rightAlignedRight = rightAlignedX + cardWidth;
            if (rightAlignedX >= mapLeftBound && rightAlignedRight <= mapRightBound) {
                return rightAlignedX;
            }

            return Math.max(mapLeftBound, Math.min(mapRightBound - cardWidth, startX));
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
        const grad = ctx.createLinearGradient(0, 0, totalWidth, titleHeight);
        grad.addColorStop(0, teamPrimary);
        grad.addColorStop(1, teamSecondary);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, totalWidth, titleHeight);

        ctx.font = 'bold 48px Arial';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`TEAM ${team} - ${getActiveEvent().mapTitle}`, 540, titleHeight / 2);

        ctx.drawImage(activeMapImage, 0, titleHeight, 1080, mapHeight);

        let drawnCount = 0;
        const priorityPalette = {
            1: '#FF4D5A',
            2: '#FF8A3D',
            3: '#F7C948',
            4: '#40C9A2',
            5: '#6BA8FF',
        };
        const effectivePositions = getEffectiveBuildingPositions();
        Object.keys(grouped).forEach(building => {
            if (!effectivePositions[building]) return;

            const [x, y_base] = effectivePositions[building];
            const y = y_base + titleHeight;
            const players = grouped[building];
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

        // Bomb Squad panel (war card style)
        const bombY = titleHeight + mapHeight + 26;
        const bombPanel = {
            x: 190,
            y: bombY,
            width: 700,
            height: 200,
            radius: 18,
        };

        const bombGrad = ctx.createLinearGradient(0, bombPanel.y, 0, bombPanel.y + bombPanel.height);
        bombGrad.addColorStop(0, '#2A3344');
        bombGrad.addColorStop(1, '#1A202C');
        ctx.fillStyle = bombGrad;
        ctx.beginPath();
        ctx.roundRect(bombPanel.x, bombPanel.y, bombPanel.width, bombPanel.height, bombPanel.radius);
        ctx.fill();
        ctx.strokeStyle = teamPrimary;
        ctx.lineWidth = 2.2;
        ctx.stroke();

        // Subtle tactical grid texture.
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(bombPanel.x + 1, bombPanel.y + 1, bombPanel.width - 2, bombPanel.height - 2, bombPanel.radius);
        ctx.clip();
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 1;
        for (let gx = bombPanel.x + 18; gx < bombPanel.x + bombPanel.width; gx += 22) {
            ctx.beginPath();
            ctx.moveTo(gx, bombPanel.y);
            ctx.lineTo(gx, bombPanel.y + bombPanel.height);
            ctx.stroke();
        }
        for (let gy = bombPanel.y + 18; gy < bombPanel.y + bombPanel.height; gy += 22) {
            ctx.beginPath();
            ctx.moveTo(bombPanel.x, gy);
            ctx.lineTo(bombPanel.x + bombPanel.width, gy);
            ctx.stroke();
        }
        ctx.restore();

        // Hazard stripe bar.
        const hazardY = bombPanel.y + 8;
        const hazardX = bombPanel.x + 14;
        const hazardW = bombPanel.width - 28;
        const hazardH = 12;
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(hazardX, hazardY, hazardW, hazardH, 5);
        ctx.clip();
        for (let sx = hazardX - 22; sx < hazardX + hazardW + 22; sx += 16) {
            ctx.fillStyle = 'rgba(255,190,64,0.95)';
            ctx.fillRect(sx, hazardY, 8, hazardH);
            ctx.fillStyle = 'rgba(35,38,48,0.95)';
            ctx.fillRect(sx + 8, hazardY, 8, hazardH);
        }
        ctx.restore();

        drawCrosshairIcon(bombPanel.x + 30, bombPanel.y + 37, 20, '#FFB84C');
        ctx.font = 'bold 21px Arial';
        ctx.fillStyle = '#F6F7FB';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('BOMB SQUAD', bombPanel.x + 52, bombPanel.y + 37);

        ctx.font = '12px Arial';
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.textAlign = 'right';
        ctx.fillText(`${bombSquad.length} OPERATORS`, bombPanel.x + bombPanel.width - 22, bombPanel.y + 37);

        const bombCardsTop = bombPanel.y + 58;
        const bombCardGapX = 16;
        const bombCardGapY = 10;
        const bombCardColumns = 2;
        const bombCardWidth = Math.floor((bombPanel.width - 30 - bombCardGapX) / bombCardColumns);
        const bombCardHeight = 30;
        const bombRowsCapacity = Math.max(1, Math.floor((bombPanel.height - (bombCardsTop - bombPanel.y) - 12) / (bombCardHeight + bombCardGapY)));
        const bombCardCapacity = bombRowsCapacity * bombCardColumns;
        const visibleBombPlayers = bombSquad.slice(0, bombCardCapacity);

        visibleBombPlayers.forEach((player, index) => {
            const col = index % bombCardColumns;
            const row = Math.floor(index / bombCardColumns);
            const cardX = bombPanel.x + 14 + col * (bombCardWidth + bombCardGapX);
            const cardY = bombCardsTop + row * (bombCardHeight + bombCardGapY);
            const troopValue = player.troops || (activePlayerDB[player.player] && activePlayerDB[player.player].troops);
            const troopKind = getTroopKind(troopValue);
            const displayName = fitText(player.player, bombCardWidth - 68, 'bold 13px Arial');

            const cardGrad = ctx.createLinearGradient(cardX, cardY, cardX + bombCardWidth, cardY);
            cardGrad.addColorStop(0, 'rgba(255,255,255,0.94)');
            cardGrad.addColorStop(1, 'rgba(236,240,248,0.98)');
            ctx.fillStyle = cardGrad;
            ctx.beginPath();
            ctx.roundRect(cardX, cardY, bombCardWidth, bombCardHeight, 8);
            ctx.fill();

            ctx.strokeStyle = teamPrimary;
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.fillStyle = teamPrimary;
            ctx.beginPath();
            ctx.arc(cardX + 12, cardY + bombCardHeight / 2, 4, 0, Math.PI * 2);
            ctx.fill();

            ctx.font = 'bold 13px Arial';
            ctx.fillStyle = '#1A1E29';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(displayName, cardX + 22, cardY + bombCardHeight / 2 + 0.5);

            const badgeW = 18;
            const badgeH = 16;
            const badgeX = cardX + bombCardWidth - badgeW - 7;
            const badgeY = cardY + ((bombCardHeight - badgeH) / 2);
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
                drawFunFallbackIcon(iconCx, iconCy, iconColor, index);
            }
        });

        if (bombSquad.length > bombCardCapacity) {
            ctx.font = '12px Arial';
            ctx.fillStyle = 'rgba(255,255,255,0.82)';
            ctx.textAlign = 'right';
            ctx.fillText(`+${bombSquad.length - bombCardCapacity} more`, bombPanel.x + bombPanel.width - 16, bombPanel.y + bombPanel.height - 12);
        }

        // Substitutes Panel (right side)
        if (substitutes.length > 0) {
            const panelX = 1080;
            const panelY = titleHeight;
            const panelHeight = mapHeight + bombHeight;

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

        showMessage(statusId, t('message_team_map_downloaded', { team: team, drawnCount: drawnCount, bombSquad: bombSquad.length, substitutes: substitutes.length }), 'success');
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
});



