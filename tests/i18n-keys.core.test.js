const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const translationsPath = path.resolve(__dirname, '../translations.js');

function loadTranslations() {
    const window = {};
    delete require.cache[require.resolve(translationsPath)];
    const src = require('fs').readFileSync(translationsPath, 'utf8');
    const fn = new Function('window', src);
    fn(window);
    return window.translations;
}

const translations = loadTranslations();
const langs = Object.keys(translations);
const enKeys = Object.keys(translations.en).sort();

test('translations.js has all 6 expected languages', () => {
    const expected = ['en', 'fr', 'de', 'it', 'ko', 'ro'];
    for (const lang of expected) {
        assert.ok(translations[lang], `missing language: ${lang}`);
    }
});

for (const lang of langs) {
    if (lang === 'en') continue;

    test(`${lang.toUpperCase()} has every key that EN has`, () => {
        const langKeys = new Set(Object.keys(translations[lang]));
        const missing = enKeys.filter(k => !langKeys.has(k));
        assert.deepStrictEqual(missing, [],
            `${lang.toUpperCase()} is missing ${missing.length} key(s): ${missing.join(', ')}`);
    });

    test(`${lang.toUpperCase()} has no extra keys beyond EN`, () => {
        const enKeySet = new Set(enKeys);
        const langKeyList = Object.keys(translations[lang]);
        const extra = langKeyList.filter(k => !enKeySet.has(k));
        assert.deepStrictEqual(extra, [],
            `${lang.toUpperCase()} has ${extra.length} extra key(s): ${extra.join(', ')}`);
    });
}
