const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const translationsPath = path.resolve(__dirname, '../translations.js');
const i18nPath = path.resolve(__dirname, '../js/core/i18n.js');

function reset(modulePath) {
  delete require.cache[require.resolve(modulePath)];
}

test.afterEach(() => {
  reset(translationsPath);
  reset(i18nPath);
  delete global.window;
  delete global.document;
  delete global.localStorage;
  delete global.translations;
  delete global.DSI18N;
});

test('translations script exposes translations on window', () => {
  global.window = global;
  require(translationsPath);
  assert.ok(global.translations);
  assert.ok(global.translations.en);
  assert.ok(global.translations.en.app_title);
});

test('i18n renders translated values when translations are loaded from script', () => {
  global.window = global;
  global.document = {
    documentElement: { lang: 'en' },
    title: '',
    querySelectorAll(selector) {
      if (selector === '[data-i18n]') return [{ dataset: { i18n: 'app_title' }, textContent: '' }];
      if (selector === '[data-i18n-placeholder]') return [];
      if (selector === '#languageSelect, #loginLanguageSelect') return [];
      return [];
    },
  };
  global.localStorage = {
    getItem() { return 'en'; },
    setItem() {},
  };

  require(translationsPath);
  require(i18nPath);
  global.DSI18N.init({});

  assert.notEqual(global.DSI18N.t('buildings_button'), 'buildings_button');
  assert.notEqual(global.DSI18N.t('events_manager_title'), 'events_manager_title');
  assert.notEqual(global.DSI18N.t('onboarding_step7_title'), 'onboarding_step7_title');
});
