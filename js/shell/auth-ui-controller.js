(function initAuthUiController(global) {
    'use strict';

    var PROFILE_TEXT_LIMIT = 60;
    var PROFILE_AVATAR_DATA_URL_LIMIT = 400000;
    var AVATAR_ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
    var AVATAR_ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
    var AVATAR_MIN_DIMENSION = 96;
    var AVATAR_MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
    var DELETE_ACCOUNT_CONFIRM_WORD = 'delete';

    var deps = null;
    var settingsDraftAvatarDataUrl = '';
    var settingsDraftTheme = 'standard';
    var googleSignInInProgress = false;

    function t(key, params) {
        return deps && typeof deps.t === 'function' ? deps.t(key, params) : key;
    }

    function getFirebaseService() {
        return deps && typeof deps.getFirebaseService === 'function' ? deps.getFirebaseService() : null;
    }

    // ---- file / image helpers ----

    function readFileAsDataUrl(file) {
        return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function (event) { resolve(event.target.result); };
            reader.onerror = function () { reject(new Error(t('settings_avatar_processing_failed'))); };
            reader.readAsDataURL(file);
        });
    }

    function loadImageFromDataUrl(dataUrl) {
        return new Promise(function (resolve, reject) {
            var img = new Image();
            img.onload = function () { resolve(img); };
            img.onerror = function () { reject(new Error(t('settings_avatar_processing_failed'))); };
            img.src = dataUrl;
        });
    }

    function getFileExtension(name) {
        if (typeof name !== 'string') {
            return '';
        }
        var normalized = name.trim().toLowerCase();
        var dotIndex = normalized.lastIndexOf('.');
        if (dotIndex <= 0) {
            return '';
        }
        return normalized.slice(dotIndex);
    }

    function isAllowedAvatarFile(file) {
        if (!file) {
            return false;
        }
        var type = typeof file.type === 'string' ? file.type.trim().toLowerCase() : '';
        var extension = getFileExtension(file.name);

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
        var rawDataUrl = await readFileAsDataUrl(file);
        var img = await loadImageFromDataUrl(rawDataUrl);
        if ((img.width || 0) < AVATAR_MIN_DIMENSION || (img.height || 0) < AVATAR_MIN_DIMENSION) {
            throw new Error(t('settings_avatar_too_small', { min: AVATAR_MIN_DIMENSION }));
        }
        var maxSide = 256;
        var longestSide = Math.max(img.width || 1, img.height || 1);
        var scale = Math.min(1, maxSide / longestSide);
        var width = Math.max(1, Math.round((img.width || 1) * scale));
        var height = Math.max(1, Math.round((img.height || 1) * scale));
        var canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        var ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error(t('settings_avatar_processing_failed'));
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        var jpegQualities = [0.9, 0.8, 0.7, 0.6, 0.5];
        for (var i = 0; i < jpegQualities.length; i++) {
            var jpegDataUrl = canvas.toDataURL('image/jpeg', jpegQualities[i]);
            if (jpegDataUrl.length <= PROFILE_AVATAR_DATA_URL_LIMIT) {
                return jpegDataUrl;
            }
        }

        var pngDataUrl = canvas.toDataURL('image/png');
        if (pngDataUrl.length <= PROFILE_AVATAR_DATA_URL_LIMIT) {
            return pngDataUrl;
        }
        throw new Error(t('settings_avatar_too_large'));
    }

    // ---- header identity ----

    function updateUserHeaderIdentity(user) {
        if (typeof user !== 'undefined') {
            deps.setCurrentAuthUser(user);
        }
        var currentAuthUser = deps.getCurrentAuthUser();
        var profile = deps.getProfileFromService();
        var resolvedTheme = currentAuthUser ? profile.theme : deps.getStoredThemePreference();
        deps.applyPlatformTheme(resolvedTheme);
        var nickname = profile.nickname || '';
        var displayName = profile.displayName || '';
        var visibleLabel = nickname || displayName;

        var labelEl = document.getElementById('userIdentityLabel');
        if (labelEl) {
            labelEl.textContent = visibleLabel;
        }
        var userTextEl = document.getElementById('headerUserText');
        if (userTextEl) {
            userTextEl.classList.toggle('hidden', !visibleLabel);
        }

        var avatarImageEl = document.getElementById('headerAvatarImage');
        var avatarInitialsEl = document.getElementById('headerAvatarInitials');
        var initialsSource = visibleLabel || deps.getSignInDisplayName(currentAuthUser);
        deps.applyAvatar(profile.avatarDataUrl, avatarImageEl, avatarInitialsEl, deps.getAvatarInitials(initialsSource, ''));
        deps.syncGameMetadataMenuAvailability();
    }

    // ---- settings modal ----

    function updateSettingsAvatarPreview() {
        var displayInput = document.getElementById('settingsDisplayNameInput');
        var nicknameInput = document.getElementById('settingsNicknameInput');
        var currentAuthUser = deps.getCurrentAuthUser();
        var name = displayInput && displayInput.value ? displayInput.value.trim() : deps.getSignInDisplayName(currentAuthUser);
        var nickname = nicknameInput && nicknameInput.value ? nicknameInput.value.trim().replace(/^@+/, '') : '';
        var previewImg = document.getElementById('settingsAvatarImage');
        var previewInitials = document.getElementById('settingsAvatarInitials');
        deps.applyAvatar(settingsDraftAvatarDataUrl, previewImg, previewInitials, deps.getAvatarInitials(name, nickname));
    }

    function openSettingsModal() {
        deps.closeNavigationMenu();
        var modal = document.getElementById('settingsModal');
        if (!modal) {
            return;
        }
        var profile = deps.getProfileFromService();
        var displayInput = document.getElementById('settingsDisplayNameInput');
        var nicknameInput = document.getElementById('settingsNicknameInput');
        var languageSelect = document.getElementById('languageSelect');
        var themeSelect = document.getElementById('settingsThemeSelect');
        var currentAuthUser = deps.getCurrentAuthUser();
        var signInName = deps.getSignInDisplayName(currentAuthUser);
        if (displayInput) {
            displayInput.value = profile.displayName || signInName || '';
        }
        if (nicknameInput) {
            nicknameInput.value = profile.nickname || '';
        }
        if (languageSelect && global.DSI18N && global.DSI18N.getLanguage) {
            languageSelect.value = global.DSI18N.getLanguage();
        }
        settingsDraftTheme = deps.normalizeThemePreference(profile.theme || deps.getCurrentAppliedTheme());
        if (themeSelect) {
            themeSelect.value = settingsDraftTheme;
        }
        settingsDraftAvatarDataUrl = profile.avatarDataUrl || '';
        var statusEl = document.getElementById('settingsStatus');
        if (statusEl) {
            statusEl.innerHTML = '';
        }
        var deleteConfirmInput = document.getElementById('settingsDeleteConfirmInput');
        if (deleteConfirmInput) {
            deleteConfirmInput.value = '';
        }
        var deleteBtn = document.getElementById('settingsDeleteBtn');
        if (deleteBtn) {
            deleteBtn.disabled = false;
        }
        updateSettingsAvatarPreview();
        deps.openModalOverlay(modal, { initialFocusSelector: '#settingsDisplayNameInput' });
    }

    function closeSettingsModal() {
        var modal = document.getElementById('settingsModal');
        if (modal) {
            deps.closeModalOverlay(modal);
        }
    }

    function triggerSettingsAvatarUpload() {
        var input = document.getElementById('settingsAvatarInput');
        if (input) {
            input.click();
        }
    }

    function removeSettingsAvatar() {
        settingsDraftAvatarDataUrl = '';
        var input = document.getElementById('settingsAvatarInput');
        if (input) {
            input.value = '';
        }
        updateSettingsAvatarPreview();
    }

    async function handleSettingsAvatarChange(event) {
        var input = event && event.target ? event.target : document.getElementById('settingsAvatarInput');
        var file = input && input.files ? input.files[0] : null;
        if (!file) {
            return;
        }
        try {
            settingsDraftAvatarDataUrl = await createAvatarDataUrl(file);
            var statusEl = document.getElementById('settingsStatus');
            if (statusEl) {
                statusEl.innerHTML = '';
            }
            updateSettingsAvatarPreview();
        } catch (error) {
            deps.showMessage('settingsStatus', error.message || t('settings_avatar_processing_failed'), 'error');
        } finally {
            if (input) {
                input.value = '';
            }
        }
    }

    async function saveSettings() {
        var FirebaseService = getFirebaseService();
        if (!FirebaseService) {
            deps.showMessage('settingsStatus', t('error_firebase_not_loaded'), 'error');
            return;
        }
        var gameplayContext = deps.getGameplayContext('settingsStatus');
        if (!gameplayContext) {
            return;
        }
        var displayInput = document.getElementById('settingsDisplayNameInput');
        var nicknameInput = document.getElementById('settingsNicknameInput');
        var displayName = displayInput && typeof displayInput.value === 'string'
            ? displayInput.value.trim().slice(0, PROFILE_TEXT_LIMIT)
            : '';
        var nickname = nicknameInput && typeof nicknameInput.value === 'string'
            ? nicknameInput.value.trim().replace(/^@+/, '').slice(0, PROFILE_TEXT_LIMIT)
            : '';
        var themeSelect = document.getElementById('settingsThemeSelect');
        var selectedTheme = deps.normalizeThemePreference(
            themeSelect && typeof themeSelect.value === 'string' ? themeSelect.value : settingsDraftTheme
        );

        if (FirebaseService.setUserProfile) {
            FirebaseService.setUserProfile({
                displayName: displayName,
                nickname: nickname,
                avatarDataUrl: settingsDraftAvatarDataUrl || '',
                theme: selectedTheme,
            }, gameplayContext);
        }

        var result = await FirebaseService.saveUserData(undefined, gameplayContext);
        if (result && result.success) {
            settingsDraftTheme = selectedTheme;
            deps.applyPlatformTheme(selectedTheme);
            updateUserHeaderIdentity(deps.getCurrentAuthUser());
            deps.showMessage('settingsStatus', t('settings_saved'), 'success');
            setTimeout(function () {
                closeSettingsModal();
            }, 600);
        } else {
            var errorText = result && result.error ? result.error : t('settings_avatar_processing_failed');
            deps.showMessage('settingsStatus', t('settings_save_failed', { error: errorText }), 'error');
        }
    }

    async function deleteAccountFromSettings() {
        var FirebaseService = getFirebaseService();
        if (!FirebaseService || typeof FirebaseService.deleteUserAccountAndData !== 'function') {
            deps.showMessage('settingsStatus', t('error_firebase_not_loaded'), 'error');
            return;
        }

        var inputEl = document.getElementById('settingsDeleteConfirmInput');
        var typedValue = inputEl && typeof inputEl.value === 'string' ? inputEl.value.trim().toLowerCase() : '';
        if (typedValue !== DELETE_ACCOUNT_CONFIRM_WORD) {
            deps.showMessage('settingsStatus', t('settings_delete_account_word_error', { word: DELETE_ACCOUNT_CONFIRM_WORD }), 'error');
            return;
        }

        if (!confirm(t('settings_delete_account_confirm_final'))) {
            return;
        }

        var deleteBtn = document.getElementById('settingsDeleteBtn');
        if (deleteBtn) {
            deleteBtn.disabled = true;
        }
        deps.showMessage('settingsStatus', t('settings_delete_account_processing'), 'processing');

        try {
            var result = await FirebaseService.deleteUserAccountAndData();
            if (result && (result.success || result.accountDeleted)) {
                deps.showMessage('settingsStatus', t('settings_delete_account_success'), 'success');
                return;
            }

            if (result && result.dataDeleted && result.reauthRequired) {
                deps.showMessage('settingsStatus', t('settings_delete_account_reauth'), 'warning');
                return;
            }

            var errorText = result && result.error ? result.error : t('error_generic', { error: 'unknown' });
            deps.showMessage('settingsStatus', t('settings_delete_account_failed', { error: errorText }), 'error');
        } catch (error) {
            deps.showMessage('settingsStatus', t('settings_delete_account_failed', { error: error.message || 'unknown' }), 'error');
        } finally {
            if (FirebaseService && typeof FirebaseService.signOut === 'function') {
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

    // ---- auth action handlers ----

    async function handleGoogleSignIn() {
        if (googleSignInInProgress) {
            return;
        }
        var FirebaseService = getFirebaseService();
        if (!FirebaseService) {
            alert(t('error_firebase_not_loaded'));
            return;
        }
        var btn = document.getElementById('googleSignInBtn');
        googleSignInInProgress = true;
        if (btn) {
            btn.disabled = true;
        }
        try {
            var result = await FirebaseService.signInWithGoogle();
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
        var FirebaseService = getFirebaseService();
        if (!FirebaseService) {
            alert(t('error_firebase_not_loaded'));
            return;
        }
        var email = document.getElementById('emailInput').value;
        var password = document.getElementById('passwordInput').value;
        if (!email || !password) {
            alert(t('error_enter_email_password'));
            return;
        }
        var result = await FirebaseService.signInWithEmail(email, password);
        if (!result.success) {
            alert(t('error_sign_in_failed', { error: result.error }));
        }
    }

    function showSignUpForm() {
        var FirebaseService = getFirebaseService();
        if (!FirebaseService) {
            alert(t('error_firebase_not_loaded'));
            return;
        }
        var email = document.getElementById('emailInput').value;
        var password = document.getElementById('passwordInput').value;
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
        var FirebaseService = getFirebaseService();
        if (!FirebaseService) {
            alert(t('error_firebase_not_loaded'));
            return;
        }
        var result = await FirebaseService.signUpWithEmail(email, password);
        if (result.success) {
            alert(t('success_account_created'));
        } else {
            alert(t('error_sign_up_failed', { error: result.error }));
        }
    }

    async function handlePasswordReset() {
        var FirebaseService = getFirebaseService();
        if (!FirebaseService) {
            alert(t('error_firebase_not_loaded'));
            return;
        }
        var email = document.getElementById('emailInput').value;
        if (!email) {
            alert(t('error_enter_email'));
            return;
        }
        var result = await FirebaseService.resetPassword(email);
        if (result.success) {
            alert(t('success_password_reset'));
        } else {
            alert(t('error_failed', { error: result.error }));
        }
    }

    async function handleSignOut() {
        var FirebaseService = getFirebaseService();
        if (!FirebaseService) {
            alert(t('error_firebase_not_loaded'));
            return;
        }
        if (confirm(t('confirm_sign_out'))) {
            await FirebaseService.signOut();
        }
    }

    global.DSAuthUiController = {
        // constants
        PROFILE_TEXT_LIMIT: PROFILE_TEXT_LIMIT,
        PROFILE_AVATAR_DATA_URL_LIMIT: PROFILE_AVATAR_DATA_URL_LIMIT,
        AVATAR_MIN_DIMENSION: AVATAR_MIN_DIMENSION,
        AVATAR_MAX_UPLOAD_BYTES: AVATAR_MAX_UPLOAD_BYTES,

        // init
        init: function (dependencies) {
            deps = dependencies;
        },

        // file/image helpers (shared with events registry)
        readFileAsDataUrl: readFileAsDataUrl,
        loadImageFromDataUrl: loadImageFromDataUrl,
        getFileExtension: getFileExtension,
        isAllowedAvatarFile: isAllowedAvatarFile,
        createAvatarDataUrl: createAvatarDataUrl,

        // header identity
        updateUserHeaderIdentity: updateUserHeaderIdentity,

        // settings modal
        openSettingsModal: openSettingsModal,
        closeSettingsModal: closeSettingsModal,
        triggerSettingsAvatarUpload: triggerSettingsAvatarUpload,
        removeSettingsAvatar: removeSettingsAvatar,
        updateSettingsAvatarPreview: updateSettingsAvatarPreview,
        handleSettingsAvatarChange: handleSettingsAvatarChange,
        saveSettings: saveSettings,
        deleteAccountFromSettings: deleteAccountFromSettings,

        // auth actions
        handleGoogleSignIn: handleGoogleSignIn,
        handleEmailSignIn: handleEmailSignIn,
        showSignUpForm: showSignUpForm,
        handleSignUp: handleSignUp,
        handlePasswordReset: handlePasswordReset,
        handleSignOut: handleSignOut,
    };
})(window);
