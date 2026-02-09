const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const firebaseModulePath = path.resolve(__dirname, '../firebase-module.js');
const firebaseServicePath = path.resolve(__dirname, '../js/services/firebase-service.js');
const appInitPath = path.resolve(__dirname, '../js/app-init.js');

function resetModule(modulePath) {
  delete require.cache[require.resolve(modulePath)];
}

function resetGlobals() {
  delete global.window;
  delete global.document;
  delete global.alert;
  delete global.firebase;
  delete global.FIREBASE_CONFIG;
  delete global.FirebaseManager;
  delete global.FirebaseService;
  delete global.initLanguage;
  delete global.updateGenerateEventLabels;
  delete global.applyTranslations;
  delete global.loadPlayerData;
  delete global.initOnboarding;
  delete global.updateAllianceHeaderDisplay;
  delete global.checkAndDisplayNotifications;
  delete global.startNotificationPolling;
  delete global.stopNotificationPolling;
  delete global.loadBuildingConfig;
  delete global.loadBuildingPositions;
  delete global.updateUserHeaderIdentity;
  delete global.t;
}

test.afterEach(() => {
  resetModule(firebaseModulePath);
  resetModule(firebaseServicePath);
  resetModule(appInitPath);
  resetGlobals();
});

test('firebase module exposes FirebaseManager on window and adapter sees it', () => {
  global.window = global;
  global.alert = () => {};
  global.document = {
    addEventListener() {},
  };
  global.FIREBASE_CONFIG = {
    apiKey: 'x',
    authDomain: 'x',
    projectId: 'x',
    storageBucket: 'x',
    messagingSenderId: 'x',
    appId: 'x',
  };

  require(firebaseModulePath);
  require(firebaseServicePath);

  assert.ok(global.FirebaseManager, 'FirebaseManager should be exported to window');
  assert.equal(global.FirebaseService.isAvailable(), true);
});

test('app init wires auth/data callbacks when FirebaseService is available', () => {
  global.window = global;

  const loginScreen = { style: { display: 'none' } };
  const mainApp = { style: { display: 'none' } };
  const userDisplayName = { textContent: '' };

  global.document = {
    getElementById(id) {
      if (id === 'loginScreen') return loginScreen;
      if (id === 'mainApp') return mainApp;
      if (id === 'userDisplayName') return userDisplayName;
      return { style: {}, textContent: '' };
    },
  };

  let initLanguageCalls = 0;
  let updateLabelsCalls = 0;
  let authCb;
  let dataCb;

  global.initLanguage = () => { initLanguageCalls += 1; };
  global.updateGenerateEventLabels = () => { updateLabelsCalls += 1; };
  global.applyTranslations = () => {};
  global.loadPlayerData = () => {};
  global.initOnboarding = () => {};
  global.updateAllianceHeaderDisplay = () => {};
  global.checkAndDisplayNotifications = () => {};
  global.startNotificationPolling = () => {};
  global.stopNotificationPolling = () => {};
  global.loadBuildingConfig = () => false;
  global.loadBuildingPositions = () => false;
  global.updateUserHeaderIdentity = (user) => {
    userDisplayName.textContent = user && user.email ? user.email : '';
  };
  global.t = (key) => key;

  global.FirebaseService = {
    isAvailable: () => true,
    setAuthCallback: (callback) => { authCb = callback; },
    setDataLoadCallback: (callback) => { dataCb = callback; },
    saveUserData: () => {},
  };

  require(appInitPath);

  assert.equal(initLanguageCalls, 1);
  assert.equal(updateLabelsCalls, 1);
  assert.equal(typeof authCb, 'function');
  assert.equal(typeof dataCb, 'function');

  authCb(true, { email: 'user@example.com' });
  assert.equal(loginScreen.style.display, 'none');
  assert.equal(mainApp.style.display, 'block');
  assert.equal(userDisplayName.textContent, 'user@example.com');
});
