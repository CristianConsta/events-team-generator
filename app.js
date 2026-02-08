// ============================================================
// I18N
// ============================================================

const supportedLanguages = ['en', 'fr', 'de', 'it', 'ko', 'ro'];
let currentLanguage = 'en';

function interpolateText(text, params = {}) {
    return text.replace(/\{(\w+)\}/g, (match, key) => {
        if (Object.prototype.hasOwnProperty.call(params, key)) {
            return params[key];
        }
        return match;
    });
}

function t(key, params) {
    const langPack = translations[currentLanguage] || translations.en;
    const fallback = translations.en[key] || key;
    const template = langPack[key] || fallback;
    return interpolateText(template, params);
}

function applyTranslations() {
    document.documentElement.lang = currentLanguage;
    document.title = t('app_title');
    document.querySelectorAll('[data-i18n]').forEach((element) => {
        element.textContent = t(element.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
        element.setAttribute('placeholder', t(element.dataset.i18nPlaceholder));
    });
    refreshLanguageDependentText();
}

function refreshLanguageDependentText() {
    const playerCountEl = document.getElementById('playerCount');
    if (playerCountEl && typeof allPlayers !== 'undefined') {
        playerCountEl.textContent = t('player_count', { count: allPlayers.length });
    }
    const uploadHintEl = document.getElementById('uploadHint');
    if (uploadHintEl && typeof allPlayers !== 'undefined') {
        uploadHintEl.textContent = allPlayers.length > 0 ? t('upload_hint') : '';
    }
}

function setLanguage(lang) {
    if (!supportedLanguages.includes(lang)) {
        return;
    }
    currentLanguage = lang;
    try {
        localStorage.setItem('ds_language', lang);
    } catch (error) {
        console.warn('Unable to persist language preference', error);
    }
    applyTranslations();
    document.querySelectorAll('#languageSelect, #loginLanguageSelect').forEach((sel) => { sel.value = lang; });
    renderPlayersTable();
    renderBuildingsTable();
    updateTeamCounters();
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

function initLanguage() {
    let stored = null;
    try {
        stored = localStorage.getItem('ds_language');
    } catch (error) {
        stored = null;
    }
    currentLanguage = supportedLanguages.includes(stored) ? stored : 'en';
    applyTranslations();
    document.querySelectorAll('#languageSelect, #loginLanguageSelect').forEach((sel) => {
        sel.value = currentLanguage;
        sel.addEventListener('change', (event) => {
            setLanguage(event.target.value);
        });
    });
}

// ============================================================
// ONBOARDING TOUR
// ============================================================
const ONBOARDING_STEPS = [
    { titleKey: 'onboarding_step1_title', descKey: 'onboarding_step1_desc', targetSelector: '#downloadTemplateBtn',  position: 'bottom' },
    { titleKey: 'onboarding_step2_title', descKey: 'onboarding_step2_desc', targetSelector: '#uploadPlayerBtn',      position: 'bottom' },
    { titleKey: 'onboarding_step3_title', descKey: 'onboarding_step3_desc', targetSelector: '.counter.team-a',       position: 'bottom' },
    { titleKey: 'onboarding_step4_title', descKey: 'onboarding_step4_desc', targetSelector: '.counter.team-b',       position: 'bottom' },
    { titleKey: 'onboarding_step5_title', descKey: 'onboarding_step5_desc', targetSelector: '#floatingButtons',      position: 'top'    }
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
    // Step 1 — Download Template button
    document.getElementById('downloadTemplateBtn').addEventListener('click', () => {
        if (onboardingActive && currentOnboardingStep === 0) dismissOnboardingStep();
    });
    // Step 2 — Upload Player Data button
    document.getElementById('uploadPlayerBtn').addEventListener('click', () => {
        if (onboardingActive && currentOnboardingStep === 1) dismissOnboardingStep();
    });
    // Steps 3 & 4 — delegated on players table body
    document.getElementById('playersTableBody').addEventListener('click', (e) => {
        if (!onboardingActive) return;
        const btn = e.target.closest('button');
        if (!btn) return;
        if (currentOnboardingStep === 2 && btn.classList.contains('team-a-btn')) dismissOnboardingStep();
        if (currentOnboardingStep === 3 && btn.classList.contains('team-b-btn')) dismissOnboardingStep();
    });
    // Step 5 — floating generate buttons area
    document.getElementById('floatingButtons').addEventListener('click', () => {
        if (onboardingActive && currentOnboardingStep === 4) dismissOnboardingStep();
    });
    // Skip link
    document.getElementById('onboardingSkip').addEventListener('click', completeOnboarding);
});

// ============================================================
// INITIALIZATION CHECK
// ============================================================

// Check if Firebase modules are loaded
if (typeof firebase === 'undefined') {
    alert(t('error_firebase_sdk_missing'));
    console.error('Firebase SDK failed to load from CDN');
}

if (typeof XLSX === 'undefined') {
    alert(t('error_xlsx_missing'));
    console.error('XLSX library failed to load from CDN');
}

if (typeof FirebaseManager === 'undefined') {
    alert(t('error_firebase_module_missing'));
    console.error('FirebaseManager not defined - firebase-module.js not loaded');
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

// Helper functions for starter/substitute counts
function getStarterCount(teamKey) {
    return teamSelections[teamKey].filter(p => p.role === 'starter').length;
}

function getSubstituteCount(teamKey) {
    return teamSelections[teamKey].filter(p => p.role === 'substitute').length;
}
let mapLoaded = false;
let uploadPanelExpanded = true;
let activeDownloadTeam = null;

// Load desert storm map
// IMPORTANT: Put 'desert-storm-map.png' in the same folder as this HTML file
const mapImage = new Image();
let mapLoadRetries = 0;
const maxRetries = 3;

function loadMapImage() {
    return new Promise((resolve, reject) => {
        mapImage.onload = () => { 
            mapLoaded = true; 
            console.log('✅ Map loaded successfully');
            resolve(true);
        };
        
        mapImage.onerror = () => {
            console.error('❌ Map failed to load, attempt:', mapLoadRetries + 1);
            
            if (mapLoadRetries < maxRetries) {
                mapLoadRetries++;
                console.log('Retrying map load...');
                setTimeout(() => {
                    mapImage.src = 'desert-storm-map.png?' + Date.now();
                }, 1000 * mapLoadRetries);
            } else {
                alert(t('coord_map_not_loaded'));
                console.error('Map loading failed after', maxRetries, 'attempts');
                reject(false);
            }
        };
        
        // Load local map file (no CORS issues!)
        mapImage.src = 'desert-storm-map.png';
    });
}

// Start loading map immediately
loadMapImage().catch(() => {
    console.warn('Map failed to load, continuing without it');
});

// Building positions on the map (scaled for 1080px width from 2048x1446 original)
const BUILDING_POSITIONS_VERSION = 1;
const defaultBuildingPositions = {
    'Info Center': [366, 38],
    'Field Hospital 4': [785, 139],
    'Oil Refinery 1': [194, 260],
    'Field Hospital 2': [951, 247],
    'Oil Refinery 2': [914, 472],
    'Field Hospital 1': [161, 458],
    'Field Hospital 3': [314, 654],
    'Science Hub': [774, 656],
};

const buildingAnchors = {
    'Info Center': 'left',
    'Field Hospital 4': 'right',
    'Oil Refinery 1': 'left',
    'Field Hospital 2': 'right',
    'Oil Refinery 2': 'right',
    'Field Hospital 1': 'left',
    'Field Hospital 3': 'left',
    'Science Hub': 'right',
};

const textColors = { 1: '#8B0000', 2: '#B85C00', 3: '#006464', 4: '#006699', 5: '#226644', 6: '#556B2F' };
const bgColors = { 1: 'rgba(255,230,230,0.9)', 2: 'rgba(255,240,220,0.9)', 3: 'rgba(230,255,250,0.9)', 
                  4: 'rgba(230,245,255,0.9)', 5: 'rgba(240,255,240,0.9)', 6: 'rgba(245,255,235,0.9)' };

// Building definitions with priorities (total slots max 20)
const defaultBuildings = [
    { name: 'Bomb Squad', priority: 1, slots: 4 },
    { name: 'Oil Refinery 1', priority: 3, slots: 2 },
    { name: 'Oil Refinery 2', priority: 3, slots: 2 },
    { name: 'Field Hospital 1', priority: 4, slots: 2 },
    { name: 'Field Hospital 2', priority: 4, slots: 2 },
    { name: 'Field Hospital 3', priority: 4, slots: 2 },
    { name: 'Field Hospital 4', priority: 4, slots: 2 },
    { name: 'Info Center', priority: 5, slots: 2 },
    { name: 'Science Hub', priority: 5, slots: 2 },
];
const MAX_BUILDING_SLOTS_TOTAL = 20;
const MIN_BUILDING_SLOTS = 0;

let buildingConfig = defaultBuildings.map((b) => ({ ...b }));
// Only store user-picked coordinates here; defaults are used as fallback for rendering.
let buildingPositions = {};

// ============================================================
// FIREBASE INTEGRATION
// ============================================================

// Initialize Firebase only if FirebaseManager is available
if (typeof FirebaseManager !== 'undefined') {
    FirebaseManager.setAuthCallback((isSignedIn, user) => {
        if (isSignedIn) {
            document.getElementById('loginScreen').style.display = 'none';
            document.getElementById('mainApp').style.display = 'block';
            document.getElementById('userEmail').textContent = user.email;
            applyTranslations();
            loadPlayerData();
            initOnboarding();
            updateAllianceHeaderDisplay();
            checkAndDisplayNotifications();
            startNotificationPolling();
        } else {
            document.getElementById('loginScreen').style.display = 'block';
            document.getElementById('mainApp').style.display = 'none';
            stopNotificationPolling();
        }
    });
    
    FirebaseManager.setDataLoadCallback((playerDatabase) => {
        console.log('Player database loaded:', Object.keys(playerDatabase).length, 'players');
        loadPlayerData();
        const configNeedsSave = loadBuildingConfig();
        const positionsNeedsSave = loadBuildingPositions();
        if (configNeedsSave || positionsNeedsSave) {
            FirebaseManager.saveUserData();
        }
        updateAllianceHeaderDisplay();
        checkAndDisplayNotifications();
    });
} else {
    console.error('FirebaseManager not available - cannot initialize callbacks');
    // Show error message to user
    setTimeout(() => {
        const loginScreen = document.getElementById('loginScreen');
        if (loginScreen) {
            loginScreen.innerHTML = `
                <div style="max-width: 600px; margin: 100px auto; padding: 40px; background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    <h1 style="text-align: center; color: #DC143C;">${t('error_loading_title')}</h1>
                    <p style="color: #333; text-align: center; margin: 20px 0;">${t('error_missing_firebase_line1')}</p>
                    <p style="color: #666; text-align: center; font-size: 14px;">${t('error_missing_firebase_line2')}</p>
                    <ul style="color: #666; margin: 20px 40px;">
                        <li>${t('error_missing_firebase_file1')}</li>
                        <li>${t('error_missing_firebase_file2')}</li>
                    </ul>
                    <p style="color: #666; text-align: center; font-size: 14px; margin-top: 20px;">${t('error_missing_firebase_line3')}</p>
                </div>
            `;
            loginScreen.style.display = 'block';
        }
    }, 100);
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(String(str)));
    return div.innerHTML;
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
    if (typeof FirebaseManager === 'undefined') {
        alert(t('error_firebase_not_loaded'));
        return;
    }
    const btn = document.getElementById('googleSignInBtn');
    googleSignInInProgress = true;
    if (btn) {
        btn.disabled = true;
    }
    try {
        const result = await FirebaseManager.signInWithGoogle();
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
    if (typeof FirebaseManager === 'undefined') {
        alert(t('error_firebase_not_loaded'));
        return;
    }
    const email = document.getElementById('emailInput').value;
    const password = document.getElementById('passwordInput').value;
    if (!email || !password) {
        alert(t('error_enter_email_password'));
        return;
    }
    const result = await FirebaseManager.signInWithEmail(email, password);
    if (!result.success) {
        alert(t('error_sign_in_failed', { error: result.error }));
    }
}

function showSignUpForm() {
    if (typeof FirebaseManager === 'undefined') {
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
    if (typeof FirebaseManager === 'undefined') {
        alert(t('error_firebase_not_loaded'));
        return;
    }
    const result = await FirebaseManager.signUpWithEmail(email, password);
    if (result.success) {
        alert(t('success_account_created'));
    } else {
        alert(t('error_sign_up_failed', { error: result.error }));
    }
}

async function handlePasswordReset() {
    if (typeof FirebaseManager === 'undefined') {
        alert(t('error_firebase_not_loaded'));
        return;
    }
    const email = document.getElementById('emailInput').value;
    if (!email) {
        alert(t('error_enter_email'));
        return;
    }
    const result = await FirebaseManager.resetPassword(email);
    if (result.success) {
        alert(t('success_password_reset'));
    } else {
        alert(t('error_failed', { error: result.error }));
    }
}

async function handleSignOut() {
    if (typeof FirebaseManager === 'undefined') {
        alert(t('error_firebase_not_loaded'));
        return;
    }
    if (confirm(t('confirm_sign_out'))) {
        await FirebaseManager.signOut();
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

function downloadPlayerTemplate() {
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
    const aid = typeof FirebaseManager !== 'undefined' ? FirebaseManager.getAllianceId() : null;
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
    const members = FirebaseManager.getAllianceMembers();
    const memberCount = Object.keys(members).length;
    const aName = FirebaseManager.getAllianceName();
    const source = FirebaseManager.getPlayerSource();

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
    const result = await FirebaseManager.createAlliance(name);

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

    const result = await FirebaseManager.sendInvitation(email);
    if (result.success) {
        showMessage('inviteStatus', t('alliance_invite_sent'), 'success');
        document.getElementById('inviteEmail').value = '';
    } else {
        showMessage('inviteStatus', result.error, 'error');
    }
}

async function handleLeaveAlliance() {
    if (!confirm(t('alliance_confirm_leave'))) return;

    const result = await FirebaseManager.leaveAlliance();
    if (result.success) {
        renderAlliancePanel();
        updateAllianceHeaderDisplay();
        loadPlayerData();
    }
}

async function switchPlayerSource(source) {
    await FirebaseManager.setPlayerSource(source);
    loadPlayerData();
    renderAlliancePanel();
    showMessage('playerSourceStatus', t('alliance_source_switched', { source: t('alliance_source_' + source) }), 'success');
}

function updateAllianceHeaderDisplay() {
    if (typeof FirebaseManager === 'undefined') return;
    const aid = FirebaseManager.getAllianceId();
    const aName = FirebaseManager.getAllianceName();
    const display = document.getElementById('allianceDisplay');

    if (aid && display) {
        display.textContent = aName || aid;
        display.style.display = 'inline';
    } else if (display) {
        display.style.display = 'none';
    }
}

// ============================================================
// NOTIFICATION SYSTEM
// ============================================================

let notificationPollInterval = null;

async function checkAndDisplayNotifications() {
    if (typeof FirebaseManager === 'undefined' || !FirebaseManager.isSignedIn()) return;

    const invitations = await FirebaseManager.checkInvitations();
    const badge = document.getElementById('notificationBadge');
    if (badge) {
        badge.textContent = invitations.length;
        badge.style.display = invitations.length > 0 ? 'flex' : 'none';
    }
}

function startNotificationPolling() {
    if (notificationPollInterval) return;
    notificationPollInterval = setInterval(() => {
        if (document.visibilityState === 'visible' && typeof FirebaseManager !== 'undefined' && FirebaseManager.isSignedIn()) {
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
    const invitations = typeof FirebaseManager !== 'undefined' ? FirebaseManager.getPendingInvitations() : [];

    if (invitations.length === 0) {
        container.innerHTML = `<p style="opacity: 0.6; text-align: center;">${t('notifications_empty')}</p>`;
        return;
    }

    container.innerHTML = invitations.map(inv => `
        <div style="padding: 12px; background: rgba(255,255,255,0.05); border-radius: 8px; margin-bottom: 10px; border: 1px solid rgba(255,255,255,0.1);">
            <div style="margin-bottom: 8px;">
                <strong>${escapeHtml(inv.allianceName || '')}</strong>
                <span style="opacity: 0.6;"> (ID: ${escapeHtml(inv.allianceId || '')})</span>
            </div>
            <div style="opacity: 0.7; font-size: 13px; margin-bottom: 10px;">
                ${t('notification_invited_by', { email: escapeHtml(inv.inviterEmail || '') })}
            </div>
            <div style="display: flex; gap: 10px;">
                <button onclick="handleAcceptInvitation('${inv.id}')" style="flex: 1; padding: 8px;">${t('notification_accept')}</button>
                <button class="clear-btn" onclick="handleRejectInvitation('${inv.id}')" style="flex: 1; padding: 8px;">${t('notification_reject')}</button>
            </div>
        </div>
    `).join('');
}

async function handleAcceptInvitation(invitationId) {
    const result = await FirebaseManager.acceptInvitation(invitationId);
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
    const result = await FirebaseManager.rejectInvitation(invitationId);
    if (result.success) {
        await checkAndDisplayNotifications();
        renderNotifications();
    }
}

// ============================================================
// PLAYER DATA MANAGEMENT
// ============================================================

async function uploadPlayerData() {
    if (typeof FirebaseManager === 'undefined') {
        showMessage('uploadMessage', t('error_firebase_not_loaded'), 'error');
        return;
    }

    const fileInput = document.getElementById('playerFileInput');
    const file = fileInput.files[0];

    if (!file) return;

    if (FirebaseManager.getAllianceId()) {
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
    showMessage('uploadMessage', t('message_upload_processing'), 'processing');

    try {
        let result;
        if (target === 'alliance') {
            result = await FirebaseManager.uploadAlliancePlayerDatabase(file);
        } else {
            result = await FirebaseManager.uploadPlayerDatabase(file);
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
    if (typeof FirebaseManager === 'undefined') {
        console.error('FirebaseManager not available');
        return;
    }
    
    const playerDB = FirebaseManager.getActivePlayerDatabase();
    const count = Object.keys(playerDB).length;
    const source = FirebaseManager.getPlayerSource();
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
        // Keep upload panel expanded
        uploadPanelExpanded = true;
        document.getElementById('uploadContent').classList.remove('collapsed');
        document.getElementById('uploadExpandIcon').classList.add('rotated');
        document.getElementById('uploadHint').textContent = '';
    }
}

function showSelectionInterface() {
    document.getElementById('selectionSection').classList.remove('hidden');
    document.getElementById('floatingButtons').style.display = 'flex';
    reserveSpaceForFooter();
    renderPlayersTable();
    updateTeamCounters();
    if (pendingOnboardingStep !== null) {
        const pending = pendingOnboardingStep;
        pendingOnboardingStep = null;
        showOnboardingStep(pending);
    }
}

function toggleBuildingsPanel() {
    const panel = document.getElementById('buildingsPanel');
    const opening = panel.classList.contains('hidden');
    panel.classList.toggle('hidden');
    if (opening) {
        loadBuildingConfig();
        loadBuildingPositions();
    } else {
        renderBuildingsTable();
    }
}

function getDefaultBuildings() {
    return defaultBuildings.map((b) => ({ ...b }));
}

function clampPriority(value, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
        return fallback;
    }
    return Math.max(1, Math.min(6, Math.round(number)));
}

function clampSlots(value, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
        return fallback;
    }
    return Math.max(MIN_BUILDING_SLOTS, Math.min(MAX_BUILDING_SLOTS_TOTAL, Math.round(number)));
}

function getBuildingSlotsTotal(config) {
    if (!Array.isArray(config)) {
        return 0;
    }
    return config.reduce((sum, item) => {
        const slots = Number(item && item.slots);
        return sum + (Number.isFinite(slots) ? slots : 0);
    }, 0);
}

function normalizeBuildingConfig(config) {
    if (!Array.isArray(config)) {
        return getDefaultBuildings();
    }
    return defaultBuildings.map((def) => {
        const stored = config.find((b) => b && b.name === def.name);
        const priority = clampPriority(stored && stored.priority, def.priority);
        const slots = clampSlots(stored && stored.slots, def.slots);
        return { name: def.name, slots: slots, priority: priority };
    });
}

function getDefaultBuildingPositions() {
    return JSON.parse(JSON.stringify(defaultBuildingPositions));
}

function normalizeBuildingPositions(positions) {
    const normalized = {};
    if (!positions || typeof positions !== 'object') {
        return normalized;
    }
    const validNames = new Set(defaultBuildings.map((b) => b.name));
    Object.keys(positions).forEach((name) => {
        if (!validNames.has(name)) return;
        const value = positions[name];
        if (Array.isArray(value) && value.length === 2) {
            const x = Number(value[0]);
            const y = Number(value[1]);
            if (Number.isFinite(x) && Number.isFinite(y)) {
                normalized[name] = [Math.round(x), Math.round(y)];
            }
        }
    });
    return normalized;
}

function getEffectiveBuildingPositions() {
    return { ...getDefaultBuildingPositions(), ...buildingPositions };
}

function getEffectiveBuildingConfig() {
    return normalizeBuildingConfig(buildingConfig);
}

function loadBuildingConfig() {
    if (typeof FirebaseManager === 'undefined') {
        buildingConfig = getDefaultBuildings();
        renderBuildingsTable();
        return;
    }
    const stored = FirebaseManager.getBuildingConfig();
    buildingConfig = normalizeBuildingConfig(stored);
    const totalSlots = getBuildingSlotsTotal(buildingConfig);
    const slotsOverLimit = totalSlots > MAX_BUILDING_SLOTS_TOTAL;
    if (slotsOverLimit) {
        buildingConfig = getDefaultBuildings();
        showMessage('buildingsStatus', t('buildings_slots_exceeded_saved', { max: MAX_BUILDING_SLOTS_TOTAL }), 'error');
    }

    const needsSave = slotsOverLimit || !Array.isArray(stored) || stored.length !== buildingConfig.length || stored.some((item) => {
        if (!item || !item.name) {
            return true;
        }
        const match = buildingConfig.find((b) => b.name === item.name);
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
        return false;
    });

    if (needsSave) {
        FirebaseManager.setBuildingConfig(buildingConfig);
    }

    renderBuildingsTable();
    return needsSave;
}

function loadBuildingPositions() {
    if (typeof FirebaseManager === 'undefined') {
        buildingPositions = {};
        return false;
    }
    const storedVersion = FirebaseManager.getBuildingPositionsVersion();
    const stored = FirebaseManager.getBuildingPositions();
    buildingPositions = normalizeBuildingPositions(stored);
    if (Object.keys(buildingPositions).length === 0 || storedVersion < BUILDING_POSITIONS_VERSION) {
        buildingPositions = getDefaultBuildingPositions();
        FirebaseManager.setBuildingPositions(buildingPositions);
        FirebaseManager.setBuildingPositionsVersion(BUILDING_POSITIONS_VERSION);
        return true;
    }
    return false;
}

function renderBuildingsTable() {
    const tbody = document.getElementById('buildingsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    buildingConfig.forEach((b, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${b.name}</td>
            <td data-label="${t('slots_label')}">
                <input type="number" min="${MIN_BUILDING_SLOTS}" max="${MAX_BUILDING_SLOTS_TOTAL}" value="${b.slots}" data-index="${index}" data-field="slots" class="building-slots-input">
            </td>
            <td data-label="${t('priority_label')}">
                <input type="number" min="1" max="6" value="${b.priority}" data-index="${index}" data-field="priority" class="building-priority-input">
            </td>
        `;
        tbody.appendChild(row);
    });
}

function readBuildingConfigFromTable() {
    const tbody = document.getElementById('buildingsTableBody');
    const updated = buildingConfig.map((b) => ({ ...b }));
    if (!tbody) {
        return { updated, totalSlots: getBuildingSlotsTotal(updated) };
    }
    const inputs = tbody.querySelectorAll('input[data-index][data-field]');
    inputs.forEach((input) => {
        const index = Number(input.getAttribute('data-index'));
        if (!Number.isFinite(index) || !updated[index]) {
            return;
        }
        const value = Number(input.value);
        if (!Number.isFinite(value)) {
            return;
        }
        const field = input.getAttribute('data-field');
        if (field === 'priority') {
            updated[index].priority = clampPriority(value, updated[index].priority);
        } else if (field === 'slots') {
            updated[index].slots = clampSlots(value, updated[index].slots);
        }
    });
    return { updated, totalSlots: getBuildingSlotsTotal(updated) };
}

function resetBuildingsToDefault() {
    buildingConfig = getDefaultBuildings();
    renderBuildingsTable();
}

async function saveBuildingConfig() {
    const { updated, totalSlots } = readBuildingConfigFromTable();
    if (totalSlots > MAX_BUILDING_SLOTS_TOTAL) {
        showMessage('buildingsStatus', t('buildings_slots_exceeded', { max: MAX_BUILDING_SLOTS_TOTAL, total: totalSlots }), 'error');
        return;
    }

    buildingConfig = normalizeBuildingConfig(updated);
    renderBuildingsTable();

    if (typeof FirebaseManager === 'undefined') {
        showMessage('buildingsStatus', t('buildings_changes_not_saved'), 'error');
        return;
    }

    FirebaseManager.setBuildingConfig(buildingConfig);
    const result = await FirebaseManager.saveUserData();
    if (result.success) {
        showMessage('buildingsStatus', t('buildings_saved'), 'success');
    } else {
        showMessage('buildingsStatus', t('buildings_save_failed', { error: result.error }), 'error');
    }
}

function refreshBuildingConfigForAssignments() {
    const panel = document.getElementById('buildingsPanel');
    if (panel && !panel.classList.contains('hidden')) {
        return syncBuildingConfigFromTable();
    }
    loadBuildingConfig();
    return true;
}

function syncBuildingConfigFromTable() {
    const tbody = document.getElementById('buildingsTableBody');
    const panel = document.getElementById('buildingsPanel');
    if (!tbody || !panel || panel.classList.contains('hidden')) {
        return true;
    }
    const { updated, totalSlots } = readBuildingConfigFromTable();
    if (totalSlots > MAX_BUILDING_SLOTS_TOTAL) {
        showMessage('buildingsStatus', t('buildings_slots_exceeded', { max: MAX_BUILDING_SLOTS_TOTAL, total: totalSlots }), 'error');
        return false;
    }
    buildingConfig = normalizeBuildingConfig(updated);
    return true;
}

let coordBuildingIndex = 0;
let coordBuildings = [];

function openCoordinatesPicker() {
    loadBuildingPositions();
    coordBuildings = buildingConfig.filter((b) => b.name !== 'Bomb Squad').map((b) => b.name);
    if (coordBuildings.length === 0) {
        showMessage('coordStatus', t('coord_no_buildings'), 'error');
        return;
    }
    coordBuildingIndex = 0;
    const overlay = document.getElementById('coordPickerOverlay');
    overlay.classList.remove('hidden');
    drawCoordCanvas();
}

function closeCoordinatesPicker() {
    document.getElementById('coordPickerOverlay').classList.add('hidden');
}

function updateCoordLabel() {
    const name = coordBuildings[coordBuildingIndex];
    const pos = buildingPositions[name];
    document.getElementById('coordBuildingLabel').textContent = name || '';
    document.getElementById('coordBuildingIndex').textContent = `(${coordBuildingIndex + 1}/${coordBuildings.length})`;
    document.getElementById('coordBuildingValue').textContent = pos
        ? t('coord_current', { x: pos[0], y: pos[1] })
        : t('coord_current_not_set');
    document.getElementById('coordPrompt').textContent = t('coord_select_prompt', { name: name });
}

function drawCoordCanvas() {
    const canvas = document.getElementById('coordCanvas');
    if (!canvas) return;

    updateCoordLabel();

    if (!mapLoaded) {
        loadMapImage()
            .then(() => drawCoordCanvas())
            .catch(() => {
                showMessage('coordStatus', t('coord_map_not_loaded'), 'error');
            });
        return;
    }

    const ctx = canvas.getContext('2d');
    const mapHeight = Math.floor(mapImage.height * (1080 / mapImage.width));
    canvas.width = 1080;
    canvas.height = mapHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(mapImage, 0, 0, 1080, mapHeight);

    Object.entries(buildingPositions).forEach(([name, pos]) => {
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
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.round((event.clientX - rect.left) * scaleX);
    const y = Math.round((event.clientY - rect.top) * scaleY);
    const name = coordBuildings[coordBuildingIndex];
    if (!name) return;
    buildingPositions[name] = [x, y];
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
    if (typeof FirebaseManager === 'undefined') {
        showMessage('coordStatus', t('coord_changes_not_saved'), 'error');
        return;
    }
    FirebaseManager.setBuildingPositions(buildingPositions);
    FirebaseManager.setBuildingPositionsVersion(BUILDING_POSITIONS_VERSION);
    const result = await FirebaseManager.saveUserData();
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
    document.body.style.paddingBottom = visible ? (barHeight + 30) + 'px' : '';
}

window.addEventListener('resize', reserveSpaceForFooter);

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
    if (typeof FirebaseManager === 'undefined') {
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

    const playerDB = FirebaseManager.getActivePlayerDatabase();

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
    const assignments = [];
    let available = [...players]; // already sorted by power desc

    const sortedBuildings = [...getEffectiveBuildingConfig()].sort((a, b) => {
        if (a.priority !== b.priority) {
            return a.priority - b.priority;
        }
        return a.name.localeCompare(b.name);
    });

    // Group consecutive buildings by priority
    const groups = [];
    sortedBuildings.forEach(building => {
        const last = groups[groups.length - 1];
        if (last && last[0].priority === building.priority) {
            last.push(building);
        } else {
            groups.push([building]);
        }
    });

    groups.forEach(group => {
        const pairsNeeded = group.map(b => Math.floor(b.slots / 2));
        const maxPairs = Math.max(...pairsNeeded);

        // Phase 1: round-robin top player picks across the group.
        // Each building claims one top player per round until it has
        // enough (slots / 2). This ensures same-priority buildings
        // each get an equally strong anchor player.
        const topPicks = new Map();
        group.forEach(b => topPicks.set(b.name, []));

        for (let round = 0; round < maxPairs; round++) {
            group.forEach((building, idx) => {
                if (topPicks.get(building.name).length < pairsNeeded[idx] && available.length > 0) {
                    topPicks.get(building.name).push(available[0]);
                    available = available.slice(1);
                }
            });
        }

        // Phase 2: for each building, pair each top pick with a
        // mix partner (search next 3 by power for a different troop).
        group.forEach(building => {
            topPicks.get(building.name).forEach(top => {
                assignments.push({
                    building: building.name,
                    priority: building.priority,
                    player: top.name
                });

                const partner = findMixPartner(top, available);
                if (partner) {
                    assignments.push({
                        building: building.name,
                        priority: building.priority,
                        player: partner.name
                    });
                    available = available.filter(p => p.name !== partner.name);
                }
            });
        });
    });

    return assignments;
}

// Searches the next 3 available players by power for a different
// troop type than the given player. Falls back to next by power.
function findMixPartner(player, available) {
    if (available.length === 0) return null;
    const candidates = available.slice(0, 3);
    const mixIndex = candidates.findIndex(p => p.troops !== player.troops);
    return mixIndex !== -1 ? candidates[mixIndex] : available[0];
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

function downloadTeamExcel(team) {
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
    XLSX.writeFile(wb, `desert_storm_team_${team}_assignments.xlsx`);
    
    const statusId = 'downloadStatus';
    showMessage(statusId, t('message_excel_downloaded'), 'success');
}

function downloadTeamMap(team) {
    const assignments = team === 'A' ? assignmentsA : assignmentsB;
    
    if (assignments.length === 0) {
        alert(t('alert_no_assignments', { team: team }));
        return;
    }
    
    const statusId = 'downloadStatus';
    
    if (!mapLoaded) {
        showMessage(statusId, t('message_map_wait'), 'processing');
        // Wait up to 10 seconds for map to load
        let waitTime = 0;
        const checkInterval = setInterval(() => {
            waitTime += 500;
            if (mapLoaded) {
                clearInterval(checkInterval);
                generateMap(team, assignments, statusId);
            } else if (waitTime >= 10000) {
                clearInterval(checkInterval);
                if (confirm(t('confirm_map_without_background'))) {
                    generateMapWithoutBackground(team, assignments, statusId);
                } else {
                    showMessage(statusId, t('message_map_cancelled'), 'warning');
                }
            }
        }, 500);
        return;
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
            if (a.building === 'Bomb Squad') {
                bombSquad.push(a);
            } else {
                if (!grouped[a.building]) grouped[a.building] = [];
                grouped[a.building].push(a);
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
        ctx.fillText(`TEAM ${team} - DESERT STORM`, 540, 60);
        
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
        a.download = `team_${team}_desert_storm_nomap.png`;
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
        const grouped = {};
        const bombSquad = [];

        assignments.forEach(a => {
            if (!a.player) return;
            if (a.building === 'Bomb Squad') {
                bombSquad.push(a);
            } else {
                if (!grouped[a.building]) grouped[a.building] = [];
                grouped[a.building].push(a);
            }
        });

        // Get substitutes for this team
        const substitutes = team === 'A' ? substitutesA : substitutesB;

        const titleHeight = 100;
        const bombHeight = 250;
        const mapHeight = Math.floor(mapImage.height * (1080 / mapImage.width));
        const totalHeight = titleHeight + mapHeight + bombHeight;

        // Add substitutes panel width if there are substitutes
        const subsPanelWidth = substitutes.length > 0 ? 200 : 0;
        const totalWidth = 1080 + subsPanelWidth;

        const canvas = document.createElement('canvas');
        canvas.width = totalWidth;
        canvas.height = totalHeight;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, totalWidth, totalHeight);

        // Title bar (spans full width)
        const grad = ctx.createLinearGradient(0, 0, totalWidth, titleHeight);
        grad.addColorStop(0, team === 'A' ? '#4169E1' : '#DC143C');
        grad.addColorStop(1, team === 'A' ? '#1E90FF' : '#FF6347');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, totalWidth, titleHeight);

        ctx.font = 'bold 48px Arial';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`TEAM ${team} - DESERT STORM`, 540, titleHeight / 2);

        ctx.drawImage(mapImage, 0, titleHeight, 1080, mapHeight);

        let drawnCount = 0;
        const effectivePositions = getEffectiveBuildingPositions();
        Object.keys(grouped).forEach(building => {
            if (!effectivePositions[building]) return;

            const [x, y_base] = effectivePositions[building];
            const y = y_base + titleHeight;
            const players = grouped[building];
            const anchor = buildingAnchors[building] || 'left';

            players.slice(0, 2).forEach((player, i) => {
                const name = player.player;

                ctx.font = 'bold 14px Arial';
                const metrics = ctx.measureText(name);
                const pad = 8;
                const boxW = metrics.width + pad * 2;
                const boxH = 24;

                const yPos = y + (i * 35) - 15;
                let boxX = anchor === 'left' ? x - boxW - 15 : x + 15;
                const boxY = yPos - boxH / 2;

                if (boxX < 5) boxX = 5;
                else if (boxX + boxW > 1075) boxX = 1075 - boxW;

                ctx.fillStyle = bgColors[player.priority] || 'rgba(255,255,255,0.9)';
                ctx.beginPath();
                ctx.roundRect(boxX, boxY, boxW, boxH, 8);
                ctx.fill();

                ctx.strokeStyle = 'black';
                ctx.lineWidth = 2;
                ctx.stroke();

                ctx.fillStyle = textColors[player.priority] || '#000000';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText(name, boxX + pad, yPos);

                drawnCount++;
            });
        });

        // Bomb Squad
        const bombY = titleHeight + mapHeight + 30;
        ctx.fillStyle = 'rgba(240,240,240,0.9)';
        ctx.beginPath();
        ctx.roundRect(240, bombY, 600, 180, 15);
        ctx.fill();
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.font = 'bold 20px Arial';
        ctx.fillStyle = team === 'A' ? '#4169E1' : '#DC143C';
        ctx.textAlign = 'center';
        ctx.fillText('BOMB SQUAD', 540, bombY + 25);

        let pY = bombY + 60;
        bombSquad.forEach((player, i) => {
            const row = Math.floor(i / 2);
            const col = i % 2;
            const name = player.player;

            ctx.font = 'bold 14px Arial';
            const m = ctx.measureText(name);
            const bw = m.width + 12;
            const xPos = 540 - 140 + (col * 280);
            const yPos = pY + (row * 35);

            ctx.fillStyle = team === 'A' ? 'rgba(230,240,255,0.95)' : 'rgba(255,230,240,0.95)';
            ctx.beginPath();
            ctx.roundRect(xPos - bw/2, yPos - 10, bw, 20, 8);
            ctx.fill();

            ctx.strokeStyle = team === 'A' ? '#4169E1' : '#DC143C';
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.fillStyle = team === 'A' ? '#4169E1' : '#DC143C';
            ctx.textAlign = 'center';
            ctx.fillText(name, xPos, yPos);
        });

        // Substitutes Panel (right side)
        if (substitutes.length > 0) {
            const panelX = 1080;
            const panelY = titleHeight;
            const panelHeight = mapHeight + bombHeight;

            // Panel background
            ctx.fillStyle = 'rgba(245, 245, 250, 1)';
            ctx.fillRect(panelX, panelY, subsPanelWidth, panelHeight);

            // Panel border
            ctx.strokeStyle = 'rgba(0,0,0,0.2)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(panelX, panelY);
            ctx.lineTo(panelX, panelY + panelHeight);
            ctx.stroke();

            // Panel title
            ctx.font = 'bold 16px Arial';
            ctx.fillStyle = team === 'A' ? '#4169E1' : '#DC143C';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(t('map_substitutes_title'), panelX + subsPanelWidth / 2, panelY + 30);

            // Subtitle
            ctx.font = '12px Arial';
            ctx.fillStyle = '#666';
            ctx.fillText(t('map_substitutes_subtitle'), panelX + subsPanelWidth / 2, panelY + 50);

            // Draw substitute names
            ctx.font = 'bold 13px Arial';
            ctx.textAlign = 'left';
            let subY = panelY + 80;

            substitutes.forEach((sub) => {
                const text = sub.name;
                const metrics = ctx.measureText(text);
                const pillW = Math.min(metrics.width + 16, subsPanelWidth - 20);
                const pillX = panelX + 10;

                ctx.fillStyle = team === 'A' ? 'rgba(65, 105, 225, 0.1)' : 'rgba(220, 20, 60, 0.1)';
                ctx.beginPath();
                ctx.roundRect(pillX, subY - 10, pillW, 22, 6);
                ctx.fill();

                ctx.strokeStyle = team === 'A' ? 'rgba(65, 105, 225, 0.3)' : 'rgba(220, 20, 60, 0.3)';
                ctx.lineWidth = 1;
                ctx.stroke();

                ctx.fillStyle = team === 'A' ? '#4169E1' : '#DC143C';
                ctx.textBaseline = 'middle';
                ctx.fillText(text, pillX + 8, subY + 1);

                subY += 30;
            });
        }

        ctx.font = '12px Arial';
        ctx.fillStyle = 'gray';
        ctx.textAlign = 'center';
        ctx.fillText(t('map_footer_text'), 540, bombY + 160);

        const dataURL = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = dataURL;
        a.download = `team_${team}_desert_storm.png`;
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
    element.innerHTML = `<div class="message ${type}">${message}</div>`;
    
    if (type === 'success') {
        setTimeout(() => {
            element.innerHTML = '';
        }, 5000);
    }
}

initLanguage();

document.addEventListener('click', (event) => {
    if (event.target && event.target.id === 'coordCanvas') {
        coordCanvasClick(event);
    }
});
