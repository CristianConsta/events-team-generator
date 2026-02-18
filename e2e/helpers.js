/**
 * E2E Test Helpers — Events Team Generator
 *
 * Shared utilities for all Playwright E2E tests.
 * The app uses file:// serving (no dev server), vanilla JS with deferred
 * scripts, and Firebase Auth. Tests that require authentication inject a
 * mock FirebaseManager so they can run without real credentials.
 */

const { expect } = require('@playwright/test');

// ─── App load helpers ─────────────────────────────────────────────────────────

/**
 * Navigate to index.html and wait for all deferred scripts to execute.
 * The app signals readiness when DSCoreEvents is defined on window.
 */
async function loadApp(page) {
  await page.goto('');
  // Wait for the last deferred script (app-init.js) to run
  await page.waitForFunction(() => typeof window.DSCoreEvents !== 'undefined', { timeout: 10000 });
  // Allow Firebase module to attempt initialisation
  await page.waitForTimeout(300);
}

/**
 * Inject a mock FirebaseManager that simulates a signed-in user with a
 * pre-populated player database. Bypasses real Firebase Auth entirely.
 * Must be called BEFORE loadApp (via page.addInitScript).
 */
async function injectMockFirebase(page, options) {
  const opts = Object.assign({
    isSignedIn: true,
    email: 'qa@test.com',
    displayName: 'QA Tester',
    uid: 'qa-uid-001',
    players: defaultPlayers(),
    playerSource: 'personal',
    events: {},
    allianceId: null,
    allianceName: null,
    games: [{ id: 'last_war', name: 'Last War: Survival', logo: '' }],
    featureFlags: {},
  }, options || {});

  await page.addInitScript((config) => {
    try {
      localStorage.setItem('ds_onboarding_done', 'true');
    } catch (_) {
      // Ignore localStorage restrictions in edge cases.
    }

    // Override FIREBASE_CONFIG to prevent real Firebase init errors
    window.FIREBASE_CONFIG = {
      apiKey: 'mock', authDomain: 'mock.firebaseapp.com',
      projectId: 'mock', storageBucket: 'mock',
      messagingSenderId: '000', appId: '1:000:web:000',
    };

    // Keep a stable mock manager even if firebase-module tries to overwrite it.
    let _managerInstalled = false;

    function installMockManager() {
      if (_managerInstalled) return;
      _managerInstalled = true;

      let _authCb = null;
      let _dataCb = null;
      let _allianceCb = null;
      const emitAuth = () => {
        if (!_authCb) return;
        if (config.isSignedIn) {
          _authCb(true, {
            email: config.email,
            displayName: config.displayName,
            uid: config.uid,
          });
          return;
        }
        _authCb(false, null);
      };
      const emitData = () => {
        if (_dataCb) {
          _dataCb(config.players || {});
        }
      };

      const mockManager = {
        __isPlaywrightMock: true,
        getFeatureFlags()           {
          return Object.assign({
            MULTIGAME_ENABLED: false,
            MULTIGAME_READ_FALLBACK_ENABLED: true,
            MULTIGAME_DUAL_WRITE_ENABLED: false,
            MULTIGAME_GAME_SELECTOR_ENABLED: false,
          }, config.featureFlags || {});
        },
        isFeatureFlagEnabled(flag) {
          return this.getFeatureFlags()[flag] === true;
        },
        listAvailableGames()       {
          return Array.isArray(config.games) ? config.games : [];
        },
        // Auth
        setAuthCallback(cb)          {
          _authCb = cb;
          setTimeout(emitAuth, 0);
        },
        setDataLoadCallback(cb)      {
          _dataCb = cb;
          if (config.isSignedIn) {
            setTimeout(emitData, 10);
          }
        },
        setAllianceDataCallback(cb)  { _allianceCb = cb; },
        isSignedIn()                 { return config.isSignedIn; },
        signInWithEmail(email, password) {
          if (!email || !password) {
            return Promise.resolve({ success: false, error: 'Missing email/password' });
          }
          config.isSignedIn = true;
          config.email = String(email);
          setTimeout(() => {
            emitAuth();
            setTimeout(emitData, 40);
          }, 0);
          return Promise.resolve({ success: true });
        },
        signInWithGoogle()           {
          config.isSignedIn = true;
          setTimeout(() => {
            emitAuth();
            setTimeout(emitData, 40);
          }, 0);
          return Promise.resolve({ success: true });
        },
        signUpWithEmail(email)       {
          config.isSignedIn = true;
          if (email) config.email = String(email);
          setTimeout(() => {
            emitAuth();
            setTimeout(emitData, 40);
          }, 0);
          return Promise.resolve({ success: true });
        },
        resetPassword()              { return Promise.resolve({ success: true }); },
        signOut()                    {
          config.isSignedIn = false;
          emitAuth();
          return Promise.resolve({ success: true });
        },
        deleteUserAccountAndData()   { return Promise.resolve({ success: true }); },

        // Player data
        getPlayerDatabase()          { return config.players; },
        getAlliancePlayerDatabase()   { return {}; },
        getActivePlayerDatabase()    { return config.players; },
        getPlayerSource()            { return config.playerSource; },
        setPlayerSource(src)         { config.playerSource = src; return Promise.resolve({ success: true }); },
        upsertPlayerEntry(src, orig, next) {
          config.players[next.name] = next;
          if (orig && orig !== next.name) delete config.players[orig];
          if (_dataCb) _dataCb(config.players);
          return Promise.resolve({ success: true });
        },
        removePlayerEntry(src, name) {
          delete config.players[name];
          if (_dataCb) _dataCb(config.players);
          return Promise.resolve({ success: true });
        },
        uploadPlayerDatabase()       { return Promise.resolve({ success: true, count: 0 }); },
        uploadAlliancePlayerDatabase() { return Promise.resolve({ success: true, count: 0 }); },

        // User profile
        getUserProfile()             {
          return { displayName: config.displayName, nickname: '', avatarDataUrl: '' };
        },
        setUserProfile(p)            { Object.assign(config, p); return Promise.resolve(); },
        saveUserData()               { return Promise.resolve({ success: true }); },

        // Events
        getAllEventData()             { return config.events; },
        getEventIds()                { return Object.keys(config.events); },
        getEventMeta(id)             { return config.events[id] || null; },
        upsertEvent(id, payload)     {
          config.events[id] = Object.assign({ id }, payload);
          return config.events[id];
        },
        removeEvent(id)              { delete config.events[id]; return true; },
        setEventMetadata(id, meta)   {
          config.events[id] = Object.assign(config.events[id] || { id }, meta);
          return config.events[id];
        },

        // Building config
        getBuildingConfig()          { return null; },
        setBuildingConfig()          {},
        getBuildingConfigVersion()   { return 0; },
        setBuildingConfigVersion()   {},
        getBuildingPositions()       { return null; },
        setBuildingPositions()       {},
        getBuildingPositionsVersion(){ return 0; },
        setBuildingPositionsVersion(){},
        getGlobalDefaultBuildingConfig()         { return null; },
        getGlobalDefaultBuildingConfigVersion()  { return 0; },
        getGlobalDefaultBuildingPositions()      { return {}; },
        getGlobalDefaultBuildingPositionsVersion(){ return 0; },

        // Alliance
        getAllianceId()               { return config.allianceId; },
        getAllianceName()             { return config.allianceName; },
        getAllianceData()             { return null; },
        getAllianceMembers()          { return {}; },
        getPendingInvitations()      { return []; },
        getSentInvitations()         { return []; },
        getInvitationNotifications() { return []; },
        createAlliance()             { return Promise.resolve({ success: true }); },
        leaveAlliance()              { return Promise.resolve({ success: true }); },
        loadAllianceData()           { return Promise.resolve({ success: true }); },
        sendInvitation()             { return Promise.resolve({ success: true }); },
        checkInvitations()           { return Promise.resolve([]); },
        acceptInvitation()           { return Promise.resolve({ success: true }); },
        rejectInvitation()           { return Promise.resolve({ success: true }); },
        revokeInvitation()           { return Promise.resolve({ success: true }); },
        resendInvitation()           { return Promise.resolve({ success: true }); },
      };

      try {
        Object.defineProperty(window, 'FirebaseManager', {
          configurable: true,
          enumerable: true,
          get() { return mockManager; },
          set() {},
        });
      } catch (_) {
        window.FirebaseManager = mockManager;
      }

      // Fire startup callbacks after a short delay (simulates async Firebase).
      setTimeout(() => {
        emitAuth();
        if (config.isSignedIn) {
          setTimeout(emitData, 100);
        }
      }, 200);
    }

    // Install mock immediately and also after DOMContentLoaded
    installMockManager();
    document.addEventListener('DOMContentLoaded', installMockManager);
  }, opts);
}

/**
 * Wait for the app to finish auth and show the main app container.
 */
async function waitForMainApp(page, options) {
  const opts = Object.assign({ dismissGameSelector: true }, options || {});
  await expect(page.locator('#mainApp')).toBeVisible({ timeout: 8000 });
  // Wait for players table or generator page to appear
  await page.waitForTimeout(400);
  if (opts.dismissGameSelector) {
    const selectorOverlay = page.locator('#gameSelectorOverlay');
    if (await selectorOverlay.isVisible().catch(() => false)) {
      const firstGameRow = page.locator('#gameSelectorList .game-selector-option').first();
      if (await firstGameRow.isVisible().catch(() => false)) {
        await firstGameRow.click({ force: true });
        await expect(selectorOverlay).toBeHidden({ timeout: 3000 });
      }
    }
  }
}

/**
 * Open the navigation menu and click a nav button by its ID.
 */
async function navigateTo(page, navBtnId) {
  const menu = page.locator('#navMenuPanel');
  const isVisible = await menu.isVisible().catch(() => false);
  if (!isVisible) {
    await page.locator('#navMenuBtn').click();
    await expect(menu).toBeVisible({ timeout: 3000 });
  }
  const target = page.locator(`#${navBtnId}`);
  await expect(target).toBeVisible({ timeout: 3000 });
  await target.click({ force: true });
  await page.waitForTimeout(200);
}

// ─── Default test data ────────────────────────────────────────────────────────

function defaultPlayers() {
  return {
    Alpha:   { name: 'Alpha',   power: 5000000, troops: 'Tank' },
    Bravo:   { name: 'Bravo',   power: 4800000, troops: 'Aero' },
    Charlie: { name: 'Charlie', power: 4600000, troops: 'Missile' },
    Delta:   { name: 'Delta',   power: 4400000, troops: 'Tank' },
    Echo:    { name: 'Echo',    power: 4200000, troops: 'Aero' },
    Foxtrot: { name: 'Foxtrot', power: 4000000, troops: 'Missile' },
    Golf:    { name: 'Golf',    power: 3800000, troops: 'Tank' },
    Hotel:   { name: 'Hotel',   power: 3600000, troops: 'Aero' },
    India:   { name: 'India',   power: 3400000, troops: 'Missile' },
    Juliet:  { name: 'Juliet',  power: 3200000, troops: 'Tank' },
  };
}

// ─── Common assertions ────────────────────────────────────────────────────────

/**
 * Assert that only one page view is visible at a time.
 */
async function assertOnlyPageVisible(page, visiblePageId) {
  const pages = ['generatorPage', 'playersManagementPage', 'configurationPage', 'alliancePage'];
  for (const id of pages) {
    const el = page.locator(`#${id}`);
    if (id === visiblePageId) {
      await expect(el).not.toHaveClass(/\bhidden\b/, { timeout: 3000 });
    } else {
      await expect(el).toHaveClass(/\bhidden\b/, { timeout: 3000 });
    }
  }
}

module.exports = {
  loadApp,
  injectMockFirebase,
  waitForMainApp,
  navigateTo,
  defaultPlayers,
  assertOnlyPageVisible,
};
