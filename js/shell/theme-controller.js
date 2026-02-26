(function initThemeController(global) {
    'use strict';

    var THEME_STORAGE_KEY = 'ds_theme';
    var THEME_STANDARD = 'standard';
    var THEME_LAST_WAR = 'last-war';
    var THEME_LIGHT = 'light';
    var THEME_SYSTEM = 'system';
    var SUPPORTED_THEMES = new Set([THEME_STANDARD, THEME_LAST_WAR, THEME_LIGHT, THEME_SYSTEM]);

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

    function resolveSystemTheme() {
        if (typeof window !== 'undefined' && window.matchMedia &&
            window.matchMedia('(prefers-color-scheme: light)').matches) {
            return THEME_LIGHT;
        }
        return THEME_STANDARD;
    }

    function applyPlatformTheme(theme, options) {
        var normalized = normalizeThemePreference(theme);
        var resolvedTheme = normalized === THEME_SYSTEM ? resolveSystemTheme() : normalized;
        var root = document.documentElement;
        if (root) {
            root.setAttribute('data-theme', resolvedTheme);
        }
        if (document.body) {
            document.body.setAttribute('data-theme', resolvedTheme);
        }
        if (!options || options.skipPersist !== true) {
            // Persist the user's intent (e.g. 'system'), not the resolved value
            try {
                localStorage.setItem(THEME_STORAGE_KEY, normalized);
            } catch (e) {
                // Ignore local storage write failures.
            }
        }
        return resolvedTheme;
    }

    if (typeof window !== 'undefined' && window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', function() {
            if (getStoredThemePreference() === THEME_SYSTEM) {
                applyPlatformTheme(THEME_SYSTEM, { skipPersist: true });
            }
        });
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
        THEME_LIGHT: THEME_LIGHT,
        THEME_SYSTEM: THEME_SYSTEM,
        normalizeThemePreference: normalizeThemePreference,
        getStoredThemePreference: getStoredThemePreference,
        persistThemePreference: persistThemePreference,
        applyPlatformTheme: applyPlatformTheme,
        getCurrentAppliedTheme: getCurrentAppliedTheme,
    };
})(window);
