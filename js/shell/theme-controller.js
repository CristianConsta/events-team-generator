(function initThemeController(global) {
    'use strict';

    var THEME_STORAGE_KEY = 'ds_theme';
    var THEME_STANDARD = 'standard';
    var THEME_LAST_WAR = 'last-war';
    var SUPPORTED_THEMES = new Set([THEME_STANDARD, THEME_LAST_WAR]);

    function normalizeThemePreference(theme) {
        if (typeof theme !== 'string') {
            return THEME_STANDARD;
        }
        var normalized = theme.trim().toLowerCase();
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
        var nextTheme = normalizeThemePreference(theme);
        var root = document.documentElement;
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
        var root = document.documentElement;
        if (!root) {
            return THEME_STANDARD;
        }
        return normalizeThemePreference(root.getAttribute('data-theme'));
    }

    // Apply stored theme immediately on load
    applyPlatformTheme(getStoredThemePreference(), { skipPersist: true });

    global.DSThemeController = {
        THEME_STANDARD: THEME_STANDARD,
        THEME_LAST_WAR: THEME_LAST_WAR,
        normalizeThemePreference: normalizeThemePreference,
        getStoredThemePreference: getStoredThemePreference,
        persistThemePreference: persistThemePreference,
        applyPlatformTheme: applyPlatformTheme,
        getCurrentAppliedTheme: getCurrentAppliedTheme,
    };
})(window);
