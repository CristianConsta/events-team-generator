const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const modulePath = path.resolve(__dirname, '../js/core/i18n.js');

function makeLocalStorage(initial) {
  const store = Object.assign({}, initial);
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    setItem(key, value) {
      store[key] = String(value);
    },
    _store: store,
  };
}

function makeDocument(options) {
  options = options || {};
  const i18nNodes = options.i18nNodes || [];
  const placeholderNodes = options.placeholderNodes || [];
  const selects = options.selects || [];
  return {
    documentElement: { lang: 'en' },
    title: '',
    querySelectorAll(selector) {
      if (selector === '[data-i18n]') return i18nNodes;
      if (selector === '[data-i18n-placeholder]') return placeholderNodes;
      if (selector === '#languageSelect, #loginLanguageSelect') return selects;
      return [];
    },
  };
}

function loadModule() {
  global.window = global;
  delete global.DSI18N;
  delete require.cache[require.resolve(modulePath)];
  require(modulePath);
}

test.afterEach(() => {
  delete global.document;
  delete global.localStorage;
  delete global.translations;
  delete global.DSI18N;
  delete require.cache[require.resolve(modulePath)];
});

// ── t() — translation lookup ────────────────────────────────────────────────

test('t returns the key itself when translations are missing', () => {
  global.window = global;
  delete global.translations;
  loadModule();
  global.document = makeDocument();
  global.localStorage = makeLocalStorage({});
  global.DSI18N.init({});

  assert.equal(global.DSI18N.t('nonexistent_key'), 'nonexistent_key');
});

test('t returns key when key is missing from current language pack', () => {
  global.window = global;
  global.translations = { en: { known: 'Known Value' }, fr: {} };
  loadModule();
  global.document = makeDocument();
  global.localStorage = makeLocalStorage({ ds_language: 'fr' });
  global.DSI18N.init({});

  assert.equal(global.DSI18N.t('unknown_key'), 'unknown_key');
});

test('t falls back to English when current language is missing the key', () => {
  global.window = global;
  global.translations = {
    en: { greeting: 'Hello' },
    fr: {}, // greeting not in French
  };
  loadModule();
  global.document = makeDocument();
  global.localStorage = makeLocalStorage({ ds_language: 'fr' });
  global.DSI18N.init({});

  assert.equal(global.DSI18N.t('greeting'), 'Hello');
});

test('t performs parameter interpolation for single param', () => {
  global.window = global;
  global.translations = { en: { greet: 'Hello, {name}!' } };
  loadModule();
  global.document = makeDocument();
  global.localStorage = makeLocalStorage({});
  global.DSI18N.init({});

  assert.equal(global.DSI18N.t('greet', { name: 'Alice' }), 'Hello, Alice!');
});

test('t performs parameter interpolation for multiple params', () => {
  global.window = global;
  global.translations = { en: { msg: '{a} and {b}' } };
  loadModule();
  global.document = makeDocument();
  global.localStorage = makeLocalStorage({});
  global.DSI18N.init({});

  assert.equal(global.DSI18N.t('msg', { a: 'X', b: 'Y' }), 'X and Y');
});

test('t leaves unmatched placeholders intact when param is absent', () => {
  global.window = global;
  global.translations = { en: { greet: 'Hi {name}!' } };
  loadModule();
  global.document = makeDocument();
  global.localStorage = makeLocalStorage({});
  global.DSI18N.init({});

  assert.equal(global.DSI18N.t('greet', {}), 'Hi {name}!');
  assert.equal(global.DSI18N.t('greet'), 'Hi {name}!');
});

test('t works with numeric-like param values', () => {
  global.window = global;
  global.translations = { en: { count_msg: 'Count: {count}' } };
  loadModule();
  global.document = makeDocument();
  global.localStorage = makeLocalStorage({});
  global.DSI18N.init({});

  assert.equal(global.DSI18N.t('count_msg', { count: 42 }), 'Count: 42');
});

// ── setLanguage ──────────────────────────────────────────────────────────────

test('setLanguage ignores unsupported language codes', () => {
  global.window = global;
  global.translations = { en: { hello: 'Hello' }, fr: { hello: 'Bonjour' } };
  loadModule();
  global.document = makeDocument();
  global.localStorage = makeLocalStorage({});
  global.DSI18N.init({});

  global.DSI18N.setLanguage('zz'); // unsupported
  assert.equal(global.DSI18N.getLanguage(), 'en');
  assert.equal(global.DSI18N.t('hello'), 'Hello');
});

test('setLanguage accepts all listed supported languages', () => {
  global.window = global;
  global.translations = {
    en: { hello: 'Hello' }, fr: { hello: 'Bonjour' },
    de: { hello: 'Hallo' }, it: { hello: 'Ciao' },
    ko: { hello: '안녕' }, ro: { hello: 'Salut' },
  };
  loadModule();
  global.document = makeDocument();
  global.localStorage = makeLocalStorage({});
  global.DSI18N.init({});

  const supported = global.DSI18N.supportedLanguages;
  supported.forEach((lang) => {
    global.DSI18N.setLanguage(lang);
    assert.equal(global.DSI18N.getLanguage(), lang);
  });
});

test('setLanguage updates all matching select elements', () => {
  global.window = global;
  global.translations = { en: { app_title: 'App' }, fr: { app_title: 'App FR' } };
  loadModule();

  const select1 = { value: 'en', addEventListener() {} };
  const select2 = { value: 'en', addEventListener() {} };
  global.document = makeDocument({ selects: [select1, select2] });
  global.localStorage = makeLocalStorage({});
  global.DSI18N.init({});

  global.DSI18N.setLanguage('fr');
  assert.equal(select1.value, 'fr');
  assert.equal(select2.value, 'fr');
});

test('setLanguage persists choice to localStorage', () => {
  global.window = global;
  global.translations = { en: { app_title: 'App' }, de: { app_title: 'App DE' } };
  loadModule();
  global.document = makeDocument();
  const storage = makeLocalStorage({});
  global.localStorage = storage;
  global.DSI18N.init({});

  global.DSI18N.setLanguage('de');
  assert.equal(storage._store['ds_language'], 'de');
});

// ── init ─────────────────────────────────────────────────────────────────────

test('init defaults to English when nothing is stored in localStorage', () => {
  global.window = global;
  global.translations = { en: { app_title: 'App EN' } };
  loadModule();
  global.document = makeDocument();
  global.localStorage = makeLocalStorage({});
  global.DSI18N.init({});

  assert.equal(global.DSI18N.getLanguage(), 'en');
});

test('init defaults to English for unsupported stored language', () => {
  global.window = global;
  global.translations = { en: { app_title: 'App EN' } };
  loadModule();
  global.document = makeDocument();
  global.localStorage = makeLocalStorage({ ds_language: 'xx' });
  global.DSI18N.init({});

  assert.equal(global.DSI18N.getLanguage(), 'en');
});

test('init wires change listener on select elements', () => {
  global.window = global;
  global.translations = {
    en: { app_title: 'App EN', hello: 'Hello' },
    fr: { app_title: 'App FR', hello: 'Bonjour' },
  };
  loadModule();

  let changeHandler;
  const select = {
    value: 'en',
    addEventListener(type, cb) { changeHandler = cb; },
  };
  global.document = makeDocument({ selects: [select] });
  global.localStorage = makeLocalStorage({});
  global.DSI18N.init({});

  // Simulate user selecting French
  changeHandler({ target: { value: 'fr' } });
  assert.equal(global.DSI18N.getLanguage(), 'fr');
});

test('init survives when localStorage throws', () => {
  global.window = global;
  global.translations = { en: { app_title: 'App' } };
  loadModule();
  global.document = makeDocument();
  global.localStorage = {
    getItem() { throw new Error('storage denied'); },
    setItem() {},
  };

  assert.doesNotThrow(() => global.DSI18N.init({}));
  assert.equal(global.DSI18N.getLanguage(), 'en');
});

// ── applyTranslations ────────────────────────────────────────────────────────

test('applyTranslations updates document.lang and title', () => {
  global.window = global;
  global.translations = { en: { app_title: 'My App' }, fr: { app_title: 'Mon App' } };
  loadModule();
  global.document = makeDocument();
  global.localStorage = makeLocalStorage({ ds_language: 'fr' });
  global.DSI18N.init({});

  assert.equal(global.document.documentElement.lang, 'fr');
  assert.equal(global.document.title, 'Mon App');
});

test('applyTranslations renders all data-i18n elements', () => {
  global.window = global;
  global.translations = { en: { btn_label: 'Click Me', title_key: 'Hello World' } };
  loadModule();

  const node1 = { dataset: { i18n: 'btn_label' }, textContent: '' };
  const node2 = { dataset: { i18n: 'title_key' }, textContent: '' };
  global.document = makeDocument({ i18nNodes: [node1, node2] });
  global.localStorage = makeLocalStorage({});
  global.DSI18N.init({});

  assert.equal(node1.textContent, 'Click Me');
  assert.equal(node2.textContent, 'Hello World');
});

test('applyTranslations renders data-i18n-placeholder elements', () => {
  global.window = global;
  global.translations = { en: { search_placeholder: 'Search...' } };
  loadModule();

  const input = {
    dataset: { i18nPlaceholder: 'search_placeholder' },
    placeholder: '',
    setAttribute(name, value) { this[name] = value; },
  };
  global.document = makeDocument({ placeholderNodes: [input] });
  global.localStorage = makeLocalStorage({});
  global.DSI18N.init({});

  assert.equal(input.placeholder, 'Search...');
});

test('applyTranslations calls onApply hook with current language', () => {
  global.window = global;
  global.translations = { en: { app_title: 'App' }, fr: { app_title: 'App FR' } };
  loadModule();
  global.document = makeDocument();
  global.localStorage = makeLocalStorage({ ds_language: 'fr' });

  const calls = [];
  global.DSI18N.init({ onApply: (lang) => calls.push(lang) });

  assert.equal(calls.length, 1);
  assert.equal(calls[0], 'fr');
});

// ── supportedLanguages ───────────────────────────────────────────────────────

test('supportedLanguages is a copy — mutations do not affect module', () => {
  global.window = global;
  global.translations = { en: { app_title: 'App' } };
  loadModule();
  global.document = makeDocument();
  global.localStorage = makeLocalStorage({});
  global.DSI18N.init({});

  const langs = global.DSI18N.supportedLanguages;
  langs.push('xx');
  // 'xx' should NOT be accepted as valid after external mutation
  global.DSI18N.setLanguage('xx');
  assert.equal(global.DSI18N.getLanguage(), 'en');
});
