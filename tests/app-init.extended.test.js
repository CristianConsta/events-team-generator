const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const appInitPath = path.resolve(__dirname, '../js/app-init.js');

function resetModule() {
  delete require.cache[require.resolve(appInitPath)];
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
  delete global.updateActiveGameBadge;
  delete global.handleAllianceDataRealtimeUpdate;
  delete global.t;
  delete global.__APP_FEATURE_FLAGS;
  delete global.__ACTIVE_GAME_ID;
}

test.afterEach(() => {
  resetModule();
  resetGlobals();
});

// ── Helper to build a minimal but fully wired environment ─────────────────────

function buildEnv(overrides) {
  overrides = overrides || {};

  const loginScreen = { style: { display: 'block' }, innerHTML: '' };
  const mainApp    = { style: { display: 'none' } };

  global.window = global;
  global.document = {
    getElementById(id) {
      if (id === 'loginScreen') return loginScreen;
      if (id === 'mainApp')     return mainApp;
      return { style: {}, textContent: '' };
    },
  };

  global.t                           = (key) => key;
  global.initLanguage                = overrides.initLanguage || (() => {});
  global.updateGenerateEventLabels   = overrides.updateGenerateEventLabels || (() => {});
  global.applyTranslations           = () => {};
  global.loadPlayerData              = () => {};
  global.initOnboarding              = () => {};
  global.updateAllianceHeaderDisplay = () => {};
  global.checkAndDisplayNotifications = () => {};
  global.startNotificationPolling    = overrides.startNotificationPolling || (() => {});
  global.stopNotificationPolling     = overrides.stopNotificationPolling  || (() => {});
  global.loadBuildingConfig          = () => false;
  global.loadBuildingPositions       = () => false;
  global.updateUserHeaderIdentity    = overrides.updateUserHeaderIdentity || (() => {});
  global.updateActiveGameBadge       = overrides.updateActiveGameBadge || (() => {});

  return { loginScreen, mainApp };
}

// ── initLanguage & updateGenerateEventLabels called on load ───────────────────

test('app-init calls initLanguage exactly once on load', () => {
  const calls = [];
  buildEnv({ initLanguage: () => calls.push('initLanguage') });

  let authCb;
  global.FirebaseService = {
    isAvailable: () => true,
    setAuthCallback:         (cb) => { authCb = cb; },
    setDataLoadCallback:     () => {},
    setAllianceDataCallback: () => {},
    saveUserData:            () => {},
  };

  require(appInitPath);
  assert.equal(calls.filter((c) => c === 'initLanguage').length, 1);
});

test('app-init calls updateGenerateEventLabels exactly once on load', () => {
  const calls = [];
  buildEnv({ updateGenerateEventLabels: () => calls.push('updateGenerateEventLabels') });

  global.FirebaseService = {
    isAvailable: () => true,
    setAuthCallback:         () => {},
    setDataLoadCallback:     () => {},
    setAllianceDataCallback: () => {},
  };

  require(appInitPath);
  assert.equal(calls.filter((c) => c === 'updateGenerateEventLabels').length, 1);
});

test('app-init caches startup feature flags when available', () => {
  buildEnv();
  global.FirebaseService = {
    isAvailable: () => true,
    getFeatureFlags: () => ({
      MULTIGAME_ENABLED: true,
      MULTIGAME_READ_FALLBACK_ENABLED: true,
      MULTIGAME_DUAL_WRITE_ENABLED: false,
      MULTIGAME_GAME_SELECTOR_ENABLED: true,
    }),
    setAuthCallback:         () => {},
    setDataLoadCallback:     () => {},
    setAllianceDataCallback: () => {},
  };

  require(appInitPath);
  assert.deepEqual(global.__APP_FEATURE_FLAGS, {
    MULTIGAME_ENABLED: true,
    MULTIGAME_READ_FALLBACK_ENABLED: true,
    MULTIGAME_DUAL_WRITE_ENABLED: false,
    MULTIGAME_GAME_SELECTOR_ENABLED: true,
  });
});

// ── Auth callback — signed-in path ────────────────────────────────────────────

test('auth callback shows mainApp and hides loginScreen on sign-in', () => {
  const { loginScreen, mainApp } = buildEnv();

  let authCb;
  global.FirebaseService = {
    isAvailable: () => true,
    setAuthCallback:         (cb) => { authCb = cb; },
    setDataLoadCallback:     () => {},
    setAllianceDataCallback: () => {},
  };

  require(appInitPath);
  authCb(true, { email: 'user@example.com', uid: 'uid1' });

  assert.equal(loginScreen.style.display, 'none');
  assert.equal(mainApp.style.display, 'block');
});

test('auth callback calls updateUserHeaderIdentity with user on sign-in', () => {
  const received = [];
  buildEnv({ updateUserHeaderIdentity: (u) => received.push(u) });

  let authCb;
  global.FirebaseService = {
    isAvailable: () => true,
    setAuthCallback:         (cb) => { authCb = cb; },
    setDataLoadCallback:     () => {},
    setAllianceDataCallback: () => {},
  };

  require(appInitPath);
  const user = { email: 'user@example.com', uid: 'uid1' };
  authCb(true, user);

  assert.ok(received.length >= 1);
  assert.deepEqual(received[0], user);
});

test('auth callback calls startNotificationPolling on sign-in', () => {
  const calls = [];
  buildEnv({ startNotificationPolling: () => calls.push('start') });

  let authCb;
  global.FirebaseService = {
    isAvailable: () => true,
    setAuthCallback:         (cb) => { authCb = cb; },
    setDataLoadCallback:     () => {},
    setAllianceDataCallback: () => {},
  };

  require(appInitPath);
  authCb(true, { email: 'x@y.com' });

  assert.ok(calls.includes('start'));
});

test('auth callback ensures active game context on sign-in', () => {
  buildEnv();
  let authCb;
  let ensureCalls = 0;
  global.FirebaseService = {
    isAvailable: () => true,
    ensureActiveGame: () => {
      ensureCalls += 1;
      return { gameId: 'last_war', source: 'default' };
    },
    setAuthCallback:         (cb) => { authCb = cb; },
    setDataLoadCallback:     () => {},
    setAllianceDataCallback: () => {},
  };

  require(appInitPath);
  authCb(true, { email: 'user@example.com' });

  assert.equal(ensureCalls, 1);
  assert.equal(global.__ACTIVE_GAME_ID, 'last_war');
});

// ── Auth callback — signed-out path ──────────────────────────────────────────

test('auth callback shows loginScreen and hides mainApp on sign-out', () => {
  const { loginScreen, mainApp } = buildEnv();

  // First sign in, then sign out
  mainApp.style.display    = 'block';
  loginScreen.style.display = 'none';

  let authCb;
  global.FirebaseService = {
    isAvailable: () => true,
    setAuthCallback:         (cb) => { authCb = cb; },
    setDataLoadCallback:     () => {},
    setAllianceDataCallback: () => {},
  };

  require(appInitPath);
  authCb(false, null);

  assert.equal(loginScreen.style.display, 'block');
  assert.equal(mainApp.style.display, 'none');
});

test('auth callback calls updateUserHeaderIdentity with null on sign-out', () => {
  const received = [];
  buildEnv({ updateUserHeaderIdentity: (u) => received.push(u) });

  let authCb;
  global.FirebaseService = {
    isAvailable: () => true,
    setAuthCallback:         (cb) => { authCb = cb; },
    setDataLoadCallback:     () => {},
    setAllianceDataCallback: () => {},
  };

  require(appInitPath);
  authCb(false, null);

  assert.ok(received.includes(null));
});

test('auth callback calls stopNotificationPolling on sign-out', () => {
  const calls = [];
  buildEnv({ stopNotificationPolling: () => calls.push('stop') });

  let authCb;
  global.FirebaseService = {
    isAvailable: () => true,
    setAuthCallback:         (cb) => { authCb = cb; },
    setDataLoadCallback:     () => {},
    setAllianceDataCallback: () => {},
  };

  require(appInitPath);
  authCb(false, null);

  assert.ok(calls.includes('stop'));
});

test('auth callback clears active game context on sign-out', () => {
  buildEnv();
  let authCb;
  let clearCalls = 0;
  global.FirebaseService = {
    isAvailable: () => true,
    clearActiveGame: () => { clearCalls += 1; },
    setAuthCallback:         (cb) => { authCb = cb; },
    setDataLoadCallback:     () => {},
    setAllianceDataCallback: () => {},
  };

  require(appInitPath);
  global.__ACTIVE_GAME_ID = 'last_war';
  authCb(false, null);

  assert.equal(clearCalls, 1);
  assert.equal(global.__ACTIVE_GAME_ID, '');
});

// ── Data load callback ────────────────────────────────────────────────────────

test('data callback triggers loadPlayerData', () => {
  const calls = [];
  buildEnv();
  global.loadPlayerData = () => calls.push('loadPlayerData');

  let dataCb;
  global.FirebaseService = {
    isAvailable: () => true,
    setAuthCallback:         () => {},
    setDataLoadCallback:     (cb) => { dataCb = cb; },
    setAllianceDataCallback: () => {},
    saveUserData:            () => {},
  };

  require(appInitPath);
  dataCb({});

  assert.ok(calls.includes('loadPlayerData'));
});

test('data callback calls saveUserData when loadBuildingConfig returns true', () => {
  buildEnv();
  global.loadBuildingConfig = () => true; // needs save
  global.loadBuildingPositions = () => false;

  const saveCalls = [];
  let dataCb;
  global.FirebaseService = {
    isAvailable: () => true,
    setAuthCallback:         () => {},
    setDataLoadCallback:     (cb) => { dataCb = cb; },
    setAllianceDataCallback: () => {},
    saveUserData:            () => saveCalls.push('save'),
  };

  require(appInitPath);
  dataCb({});

  assert.ok(saveCalls.length > 0);
});

test('data callback calls saveUserData when loadBuildingPositions returns true', () => {
  buildEnv();
  global.loadBuildingConfig    = () => false;
  global.loadBuildingPositions = () => true; // needs save

  const saveCalls = [];
  let dataCb;
  global.FirebaseService = {
    isAvailable: () => true,
    setAuthCallback:         () => {},
    setDataLoadCallback:     (cb) => { dataCb = cb; },
    setAllianceDataCallback: () => {},
    saveUserData:            () => saveCalls.push('save'),
  };

  require(appInitPath);
  dataCb({});

  assert.ok(saveCalls.length > 0);
});

test('data callback does NOT call saveUserData when neither config load needs saving', () => {
  buildEnv();
  global.loadBuildingConfig    = () => false;
  global.loadBuildingPositions = () => false;

  const saveCalls = [];
  let dataCb;
  global.FirebaseService = {
    isAvailable: () => true,
    setAuthCallback:         () => {},
    setDataLoadCallback:     (cb) => { dataCb = cb; },
    setAllianceDataCallback: () => {},
    saveUserData:            () => saveCalls.push('save'),
  };

  require(appInitPath);
  dataCb({});

  assert.equal(saveCalls.length, 0);
});

// ── Missing FirebaseService ───────────────────────────────────────────────────

test('app-init sets loginScreen visible when FirebaseService is unavailable', (_, done) => {
  const loginScreen = { style: { display: 'none' }, innerHTML: '' };
  global.window = global;
  global.document = {
    getElementById(id) {
      if (id === 'loginScreen') return loginScreen;
      return { style: {}, textContent: '' };
    },
  };
  global.t = (key) => key;
  global.initLanguage               = () => {};
  global.updateGenerateEventLabels  = () => {};
  global.applyTranslations          = () => {};
  global.loadPlayerData             = () => {};
  global.initOnboarding             = () => {};
  global.updateAllianceHeaderDisplay = () => {};
  global.checkAndDisplayNotifications = () => {};
  global.startNotificationPolling   = () => {};
  global.stopNotificationPolling    = () => {};
  global.loadBuildingConfig         = () => false;
  global.loadBuildingPositions      = () => false;

  global.FirebaseService = {
    isAvailable: () => false,
  };

  require(appInitPath);

  // renderMissingFirebaseError uses setTimeout(fn, 100)
  setTimeout(() => {
    assert.equal(loginScreen.style.display, 'block');
    done();
  }, 150);
});

// ── Alliance data callback ────────────────────────────────────────────────────

test('alliance data callback fires handleAllianceDataRealtimeUpdate when defined', () => {
  buildEnv();
  const calls = [];
  global.handleAllianceDataRealtimeUpdate = () => calls.push('alliance');

  let allianceCb;
  global.FirebaseService = {
    isAvailable: () => true,
    setAuthCallback:         () => {},
    setDataLoadCallback:     () => {},
    setAllianceDataCallback: (cb) => { allianceCb = cb; },
  };

  require(appInitPath);
  allianceCb();

  assert.ok(calls.includes('alliance'));
});

test('alliance data callback does not throw when handleAllianceDataRealtimeUpdate is undefined', () => {
  buildEnv();
  delete global.handleAllianceDataRealtimeUpdate;

  let allianceCb;
  global.FirebaseService = {
    isAvailable: () => true,
    setAuthCallback:         () => {},
    setDataLoadCallback:     () => {},
    setAllianceDataCallback: (cb) => { allianceCb = cb; },
  };

  require(appInitPath);
  assert.doesNotThrow(() => allianceCb());
});
