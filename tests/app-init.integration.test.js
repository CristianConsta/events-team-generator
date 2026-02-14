const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const appInitPath = path.resolve(__dirname, '../js/app-init.js');

function resetModule(modulePath) {
  delete require.cache[require.resolve(modulePath)];
}

function resetGlobals() {
  delete global.window;
  delete global.document;
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
  delete global.handleAllianceDataRealtimeUpdate;
  delete global.t;
}

test.afterEach(() => {
  resetModule(appInitPath);
  resetGlobals();
});

test('app init renders missing Firebase message when service is unavailable', () => {
  global.window = global;
  const loginScreen = {
    innerHTML: '',
    style: { display: 'none' },
  };
  global.document = {
    getElementById(id) {
      if (id === 'loginScreen') return loginScreen;
      return null;
    },
  };

  let initLanguageCalls = 0;
  let updateLabelsCalls = 0;
  global.initLanguage = () => { initLanguageCalls += 1; };
  global.updateGenerateEventLabels = () => { updateLabelsCalls += 1; };
  global.t = (key) => key;
  global.FirebaseService = { isAvailable: () => false };

  const originalError = console.error;
  const originalSetTimeout = global.setTimeout;
  const capturedErrors = [];
  let timeoutDelay = null;
  console.error = (...args) => capturedErrors.push(args.join(' '));
  global.setTimeout = (fn, delay) => {
    timeoutDelay = delay;
    fn();
    return 1;
  };

  try {
    require(appInitPath);
  } finally {
    console.error = originalError;
    global.setTimeout = originalSetTimeout;
  }

  assert.equal(initLanguageCalls, 1);
  assert.equal(updateLabelsCalls, 1);
  assert.equal(timeoutDelay, 100);
  assert.equal(loginScreen.style.display, 'block');
  assert.match(loginScreen.innerHTML, /error_loading_title/);
  assert.ok(capturedErrors.some((line) => line.includes('FirebaseService not available')));
});

test('app init executes auth, data-load, and alliance callback flows', () => {
  global.window = global;
  const loginScreen = { style: { display: 'block' } };
  const mainApp = { style: { display: 'none' } };
  global.document = {
    getElementById(id) {
      if (id === 'loginScreen') return loginScreen;
      if (id === 'mainApp') return mainApp;
      return { style: {} };
    },
  };

  let initLanguageCalls = 0;
  let updateLabelsCalls = 0;
  let applyTranslationsCalls = 0;
  let initOnboardingCalls = 0;
  let startPollingCalls = 0;
  let stopPollingCalls = 0;
  let loadPlayerDataCalls = 0;
  let loadBuildingConfigCalls = 0;
  let loadBuildingPositionsCalls = 0;
  let saveUserDataCalls = 0;
  let updateUserHeaderIdentityCalls = 0;
  let updateAllianceHeaderDisplayCalls = 0;
  let checkNotificationsCalls = 0;
  let allianceRealtimeCalls = 0;

  global.initLanguage = () => { initLanguageCalls += 1; };
  global.updateGenerateEventLabels = () => { updateLabelsCalls += 1; };
  global.applyTranslations = () => { applyTranslationsCalls += 1; };
  global.initOnboarding = () => { initOnboardingCalls += 1; };
  global.startNotificationPolling = () => { startPollingCalls += 1; };
  global.stopNotificationPolling = () => { stopPollingCalls += 1; };
  global.loadPlayerData = () => { loadPlayerDataCalls += 1; };
  global.loadBuildingConfig = () => {
    loadBuildingConfigCalls += 1;
    return loadBuildingConfigCalls === 1;
  };
  global.loadBuildingPositions = () => {
    loadBuildingPositionsCalls += 1;
    return false;
  };
  global.updateUserHeaderIdentity = () => { updateUserHeaderIdentityCalls += 1; };
  global.updateAllianceHeaderDisplay = () => { updateAllianceHeaderDisplayCalls += 1; };
  global.checkAndDisplayNotifications = () => { checkNotificationsCalls += 1; };
  global.handleAllianceDataRealtimeUpdate = () => { allianceRealtimeCalls += 1; };

  let authCallback = null;
  let dataLoadCallback = null;
  let allianceDataCallback = null;
  global.FirebaseService = {
    isAvailable: () => true,
    setAuthCallback: (callback) => { authCallback = callback; },
    setDataLoadCallback: (callback) => { dataLoadCallback = callback; },
    setAllianceDataCallback: (callback) => { allianceDataCallback = callback; },
    saveUserData: () => { saveUserDataCalls += 1; },
  };

  require(appInitPath);

  assert.equal(initLanguageCalls, 1);
  assert.equal(updateLabelsCalls, 1);
  assert.equal(typeof authCallback, 'function');
  assert.equal(typeof dataLoadCallback, 'function');
  assert.equal(typeof allianceDataCallback, 'function');

  authCallback(true, { email: 'user@example.com' });
  assert.equal(loginScreen.style.display, 'none');
  assert.equal(mainApp.style.display, 'block');
  assert.equal(applyTranslationsCalls, 1);
  assert.equal(initOnboardingCalls, 1);
  assert.equal(startPollingCalls, 1);

  authCallback(false, null);
  assert.equal(loginScreen.style.display, 'block');
  assert.equal(mainApp.style.display, 'none');
  assert.equal(stopPollingCalls, 1);

  dataLoadCallback({ Alice: { power: 200 } });
  assert.equal(loadPlayerDataCalls, 1);
  assert.equal(loadBuildingConfigCalls, 1);
  assert.equal(loadBuildingPositionsCalls, 1);
  assert.equal(saveUserDataCalls, 1);
  assert.equal(updateUserHeaderIdentityCalls, 3);
  assert.equal(updateAllianceHeaderDisplayCalls, 1);
  assert.equal(checkNotificationsCalls, 1);

  dataLoadCallback({});
  assert.equal(loadBuildingConfigCalls, 2);
  assert.equal(loadBuildingPositionsCalls, 2);
  assert.equal(saveUserDataCalls, 1);

  allianceDataCallback();
  assert.equal(allianceRealtimeCalls, 1);
});

test('app init skips alliance realtime callback wiring when API is unavailable', () => {
  global.window = global;
  global.document = {
    getElementById() {
      return { style: {}, innerHTML: '' };
    },
  };
  global.initLanguage = () => {};
  global.updateGenerateEventLabels = () => {};
  global.applyTranslations = () => {};
  global.loadPlayerData = () => {};
  global.initOnboarding = () => {};
  global.updateAllianceHeaderDisplay = () => {};
  global.checkAndDisplayNotifications = () => {};
  global.startNotificationPolling = () => {};
  global.stopNotificationPolling = () => {};
  global.loadBuildingConfig = () => false;
  global.loadBuildingPositions = () => false;
  global.t = (key) => key;

  let authCallback = null;
  let dataLoadCallback = null;
  global.FirebaseService = {
    isAvailable: () => true,
    setAuthCallback: (callback) => { authCallback = callback; },
    setDataLoadCallback: (callback) => { dataLoadCallback = callback; },
    saveUserData: () => {},
  };

  require(appInitPath);

  assert.equal(typeof authCallback, 'function');
  assert.equal(typeof dataLoadCallback, 'function');
});
