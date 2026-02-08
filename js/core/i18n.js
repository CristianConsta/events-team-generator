(function initI18nCore(global) {
    const supportedLanguages = ['en', 'fr', 'de', 'it', 'ko', 'ro'];
    let currentLanguage = 'en';
    let hooks = {
        onApply: null,
    };

    function interpolateText(text, params) {
        return String(text).replace(/\{(\w+)\}/g, (match, key) => {
            if (params && Object.prototype.hasOwnProperty.call(params, key)) {
                return params[key];
            }
            return match;
        });
    }

    function getTranslations() {
        if (typeof global.translations === 'object' && global.translations) {
            return global.translations;
        }
        if (typeof translations === 'object' && translations) {
            return translations;
        }
        return {};
    }

    function t(key, params) {
        const all = getTranslations();
        const langPack = all[currentLanguage] || all.en || {};
        const fallback = (all.en && all.en[key]) || key;
        const template = langPack[key] || fallback;
        return interpolateText(template, params);
    }

    function applyTranslations() {
        global.document.documentElement.lang = currentLanguage;
        global.document.title = t('app_title');

        global.document.querySelectorAll('[data-i18n]').forEach((element) => {
            element.textContent = t(element.dataset.i18n);
        });

        global.document.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
            element.setAttribute('placeholder', t(element.dataset.i18nPlaceholder));
        });

        if (hooks.onApply) {
            hooks.onApply(currentLanguage);
        }
    }

    function setLanguage(lang) {
        if (!supportedLanguages.includes(lang)) {
            return;
        }
        currentLanguage = lang;
        try {
            global.localStorage.setItem('ds_language', lang);
        } catch (error) {
            console.warn('Unable to persist language preference', error);
        }
        applyTranslations();

        global.document.querySelectorAll('#languageSelect, #loginLanguageSelect').forEach((select) => {
            select.value = lang;
        });
    }

    function init(options) {
        hooks = {
            onApply: options && typeof options.onApply === 'function' ? options.onApply : null,
        };

        let stored = null;
        try {
            stored = global.localStorage.getItem('ds_language');
        } catch (error) {
            stored = null;
        }

        currentLanguage = supportedLanguages.includes(stored) ? stored : 'en';
        applyTranslations();

        global.document.querySelectorAll('#languageSelect, #loginLanguageSelect').forEach((select) => {
            select.value = currentLanguage;
            select.addEventListener('change', (event) => {
                setLanguage(event.target.value);
            });
        });
    }

    function getLanguage() {
        return currentLanguage;
    }

    global.DSI18N = {
        init: init,
        t: t,
        setLanguage: setLanguage,
        applyTranslations: applyTranslations,
        getLanguage: getLanguage,
        supportedLanguages: supportedLanguages.slice(),
    };
})(window);
