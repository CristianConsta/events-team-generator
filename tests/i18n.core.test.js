const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const modulePath = path.resolve(__dirname, '../js/core/i18n.js');

function createSelect() {
  return {
    value: '',
    _handlers: {},
    addEventListener(type, cb) {
      this._handlers[type] = cb;
    },
    triggerChange(value) {
      this.value = value;
      if (this._handlers.change) {
        this._handlers.change({ target: { value } });
      }
    },
  };
}

function setupDom(storedLang) {
  const i18nNode = { dataset: { i18n: 'hello' }, textContent: '' };
  const placeholderNode = {
    dataset: { i18nPlaceholder: 'email_placeholder' },
    placeholder: '',
    setAttribute(name, value) {
      this[name] = value;
    },
  };
  const languageSelect = createSelect();
  const loginLanguageSelect = createSelect();

  global.document = {
    documentElement: { lang: 'en' },
    title: '',
    querySelectorAll(selector) {
      if (selector === '[data-i18n]') return [i18nNode];
      if (selector === '[data-i18n-placeholder]') return [placeholderNode];
      if (selector === '#languageSelect, #loginLanguageSelect') return [languageSelect, loginLanguageSelect];
      return [];
    },
  };

  const store = {};
  if (storedLang) {
    store.ds_language = storedLang;
  }

  global.localStorage = {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    setItem(key, value) {
      store[key] = String(value);
    },
  };

  return { i18nNode, placeholderNode, languageSelect, loginLanguageSelect, store };
}

function loadModule() {
  global.window = global;
  delete global.DSI18N;
  delete require.cache[require.resolve(modulePath)];
  require(modulePath);
}

test('i18n init applies stored language and updates text/placeholder', () => {
  global.translations = {
    en: { app_title: 'App EN', hello: 'Hello', email_placeholder: 'Email' },
    fr: { app_title: 'App FR', hello: 'Bonjour', email_placeholder: 'Courriel' },
  };
  const env = setupDom('fr');
  loadModule();

  let applyCount = 0;
  global.DSI18N.init({ onApply: () => { applyCount += 1; } });

  assert.equal(global.document.documentElement.lang, 'fr');
  assert.equal(global.document.title, 'App FR');
  assert.equal(env.i18nNode.textContent, 'Bonjour');
  assert.equal(env.placeholderNode.placeholder, 'Courriel');
  assert.equal(applyCount, 1);
});

test('setLanguage persists choice and re-renders content', () => {
  global.translations = {
    en: { app_title: 'App EN', hello: 'Hello', email_placeholder: 'Email', greet: 'Hi {name}' },
    fr: { app_title: 'App FR', hello: 'Bonjour', email_placeholder: 'Courriel', greet: 'Salut {name}' },
  };
  const env = setupDom('en');
  loadModule();
  global.DSI18N.init({});

  global.DSI18N.setLanguage('fr');

  assert.equal(global.document.title, 'App FR');
  assert.equal(env.store.ds_language, 'fr');
  assert.equal(global.DSI18N.t('greet', { name: 'Ana' }), 'Salut Ana');
});
