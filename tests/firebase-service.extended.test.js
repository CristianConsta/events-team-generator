const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const modulePath = path.resolve(__dirname, '../js/services/firebase-service.js');

function loadModule() {
  global.window = global;
  delete global.FirebaseService;
  delete require.cache[require.resolve(modulePath)];
  require(modulePath);
}

test.afterEach(() => {
  delete global.FirebaseManager;
  delete global.FirebaseService;
  delete require.cache[require.resolve(modulePath)];
});

// ── Fallbacks when FirebaseManager is absent ─────────────────────────────────

test('isAvailable returns false when FirebaseManager is missing', () => {
  delete global.FirebaseManager;
  loadModule();
  assert.equal(global.FirebaseService.isAvailable(), false);
});

test('auth fallbacks return not-loaded result', async () => {
  delete global.FirebaseManager;
  loadModule();
  const notLoaded = { success: false, error: 'Firebase not loaded' };
  assert.deepEqual(await global.FirebaseService.signInWithGoogle(), notLoaded);
  assert.deepEqual(await global.FirebaseService.signInWithEmail('a@b.com', 'pw'), notLoaded);
  assert.deepEqual(await global.FirebaseService.signUpWithEmail('a@b.com', 'pw'), notLoaded);
  assert.deepEqual(await global.FirebaseService.resetPassword('a@b.com'), notLoaded);
  assert.deepEqual(await global.FirebaseService.signOut(), notLoaded);
  assert.deepEqual(await global.FirebaseService.deleteUserAccountAndData(), notLoaded);
  assert.equal(global.FirebaseService.isSignedIn(), false);
});

test('player data fallbacks return safe empty values', () => {
  delete global.FirebaseManager;
  loadModule();
  assert.deepEqual(global.FirebaseService.getPlayerDatabase(), {});
  assert.deepEqual(global.FirebaseService.getAlliancePlayerDatabase(), {});
  assert.deepEqual(global.FirebaseService.getActivePlayerDatabase(), {});
  assert.equal(global.FirebaseService.getPlayerSource(), 'personal');
});

test('player mutation fallbacks return not-loaded result', async () => {
  delete global.FirebaseManager;
  loadModule();
  const notLoaded = { success: false, error: 'Firebase not loaded' };
  assert.deepEqual(await global.FirebaseService.upsertPlayerEntry('personal', 'Alice', {}), notLoaded);
  assert.deepEqual(await global.FirebaseService.removePlayerEntry('personal', 'Alice'), notLoaded);
  assert.deepEqual(await global.FirebaseService.setPlayerSource('alliance'), notLoaded);
  assert.deepEqual(await global.FirebaseService.saveUserData({}), notLoaded);
});

test('building config fallbacks return safe empty values', () => {
  delete global.FirebaseManager;
  loadModule();
  assert.equal(global.FirebaseService.getBuildingConfig('desert_storm'), null);
  assert.equal(global.FirebaseService.getBuildingConfigVersion('desert_storm'), 0);
  assert.equal(global.FirebaseService.getBuildingPositions('desert_storm'), null);
  assert.equal(global.FirebaseService.getBuildingPositionsVersion('desert_storm'), 0);
  assert.equal(global.FirebaseService.getGlobalDefaultBuildingConfig('desert_storm'), null);
  assert.equal(global.FirebaseService.getGlobalDefaultBuildingConfigVersion(), 0);
  assert.deepEqual(global.FirebaseService.getGlobalDefaultBuildingPositions('desert_storm'), {});
  assert.equal(global.FirebaseService.getGlobalDefaultBuildingPositionsVersion(), 0);
});

test('building setters return null when manager is absent', () => {
  delete global.FirebaseManager;
  loadModule();
  assert.equal(global.FirebaseService.setBuildingConfig('desert_storm', []), null);
  assert.equal(global.FirebaseService.setBuildingConfigVersion('desert_storm', 1), null);
  assert.equal(global.FirebaseService.setBuildingPositions('desert_storm', {}), null);
  assert.equal(global.FirebaseService.setBuildingPositionsVersion('desert_storm', 1), null);
});

test('user profile fallbacks return empty profile', () => {
  delete global.FirebaseManager;
  loadModule();
  const profile = global.FirebaseService.getUserProfile();
  assert.equal(profile.displayName, '');
  assert.equal(profile.nickname, '');
  assert.equal(profile.avatarDataUrl, '');
});

test('alliance fallbacks return safe empty values', async () => {
  delete global.FirebaseManager;
  loadModule();
  const notLoaded = { success: false, error: 'Firebase not loaded' };
  assert.deepEqual(await global.FirebaseService.createAlliance('Clan X'), notLoaded);
  assert.deepEqual(await global.FirebaseService.leaveAlliance(), notLoaded);
  assert.deepEqual(await global.FirebaseService.loadAllianceData(), notLoaded);
  assert.deepEqual(await global.FirebaseService.sendInvitation('user@x.com'), notLoaded);
  assert.deepEqual(await global.FirebaseService.checkInvitations(), []);
  assert.deepEqual(await global.FirebaseService.acceptInvitation('id1'), notLoaded);
  assert.deepEqual(await global.FirebaseService.rejectInvitation('id1'), notLoaded);
  assert.deepEqual(await global.FirebaseService.revokeInvitation('id1'), notLoaded);
  assert.deepEqual(await global.FirebaseService.resendInvitation('id1'), notLoaded);
  assert.equal(global.FirebaseService.getAllianceId(), null);
  assert.equal(global.FirebaseService.getAllianceName(), null);
  assert.equal(global.FirebaseService.getAllianceData(), null);
  assert.deepEqual(global.FirebaseService.getPendingInvitations(), []);
  assert.deepEqual(global.FirebaseService.getSentInvitations(), []);
  assert.deepEqual(global.FirebaseService.getInvitationNotifications(), []);
  assert.deepEqual(global.FirebaseService.getAllianceMembers(), {});
});

test('callback setters return null when manager is absent', () => {
  delete global.FirebaseManager;
  loadModule();
  assert.equal(global.FirebaseService.setAuthCallback(() => {}), null);
  assert.equal(global.FirebaseService.setDataLoadCallback(() => {}), null);
  assert.equal(global.FirebaseService.setAllianceDataCallback(() => {}), null);
});

test('feature flag helpers return default rollout values when manager is absent', () => {
  delete global.FirebaseManager;
  loadModule();
  assert.deepEqual(global.FirebaseService.getFeatureFlags(), {
    MULTIGAME_ENABLED: false,
    MULTIGAME_READ_FALLBACK_ENABLED: true,
    MULTIGAME_DUAL_WRITE_ENABLED: false,
    MULTIGAME_GAME_SELECTOR_ENABLED: false,
  });
  assert.equal(global.FirebaseService.isFeatureFlagEnabled('MULTIGAME_GAME_SELECTOR_ENABLED'), false);
  assert.equal(global.FirebaseService.isFeatureFlagEnabled('UNKNOWN_FLAG'), false);
});

// ── Delegation when FirebaseManager is present ───────────────────────────────

test('isAvailable returns true when FirebaseManager exists', () => {
  global.FirebaseManager = { dummy: true };
  loadModule();
  assert.equal(global.FirebaseService.isAvailable(), true);
});

test('getPlayerDatabase delegates to manager', () => {
  global.FirebaseManager = {
    getPlayerDatabase: () => ({ Alice: { name: 'Alice', power: 100, troops: 'Tank' } }),
  };
  loadModule();
  const db = global.FirebaseService.getPlayerDatabase();
  assert.ok(db.Alice);
  assert.equal(db.Alice.name, 'Alice');
});

test('getAlliancePlayerDatabase delegates to manager', () => {
  global.FirebaseManager = {
    getAlliancePlayerDatabase: () => ({ Bob: { name: 'Bob', power: 200, troops: 'Aero' } }),
  };
  loadModule();
  assert.ok(global.FirebaseService.getAlliancePlayerDatabase().Bob);
});

test('getActivePlayerDatabase delegates to manager', () => {
  global.FirebaseManager = {
    getActivePlayerDatabase: () => ({ Dave: { name: 'Dave', power: 50, troops: 'Missile' } }),
  };
  loadModule();
  assert.ok(global.FirebaseService.getActivePlayerDatabase().Dave);
});

test('getBuildingConfig delegates to manager', () => {
  const config = [{ name: 'HQ', slots: 2, priority: 1 }];
  global.FirebaseManager = { getBuildingConfig: () => config };
  loadModule();
  assert.deepEqual(global.FirebaseService.getBuildingConfig('desert_storm'), config);
});

test('getBuildingPositions delegates to manager', () => {
  const positions = { HQ: [100, 200] };
  global.FirebaseManager = { getBuildingPositions: () => positions };
  loadModule();
  assert.deepEqual(global.FirebaseService.getBuildingPositions('desert_storm'), positions);
});

test('getBuildingPositionsVersion delegates to manager', () => {
  global.FirebaseManager = { getBuildingPositionsVersion: () => 7 };
  loadModule();
  assert.equal(global.FirebaseService.getBuildingPositionsVersion('desert_storm'), 7);
});

test('getUserProfile delegates to manager', () => {
  const profile = { displayName: 'Alice', nickname: 'A', avatarDataUrl: 'data:...' };
  global.FirebaseManager = { getUserProfile: () => profile };
  loadModule();
  assert.deepEqual(global.FirebaseService.getUserProfile(), profile);
});

test('getPlayerSource delegates to manager', () => {
  global.FirebaseManager = { getPlayerSource: () => 'alliance' };
  loadModule();
  assert.equal(global.FirebaseService.getPlayerSource(), 'alliance');
});

test('getAllianceId delegates to manager', () => {
  global.FirebaseManager = { getAllianceId: () => 'alliance-123' };
  loadModule();
  assert.equal(global.FirebaseService.getAllianceId(), 'alliance-123');
});

test('getAllianceName delegates to manager', () => {
  global.FirebaseManager = { getAllianceName: () => 'Clan X' };
  loadModule();
  assert.equal(global.FirebaseService.getAllianceName(), 'Clan X');
});

test('getAllianceMembers delegates to manager', () => {
  const members = { uid1: { displayName: 'Alice' } };
  global.FirebaseManager = { getAllianceMembers: () => members };
  loadModule();
  assert.deepEqual(global.FirebaseService.getAllianceMembers(), members);
});

test('getPendingInvitations delegates to manager', () => {
  const invites = [{ id: 'i1', email: 'a@b.com' }];
  global.FirebaseManager = { getPendingInvitations: () => invites };
  loadModule();
  assert.deepEqual(global.FirebaseService.getPendingInvitations(), invites);
});

test('getInvitationNotifications delegates to manager', () => {
  const notifs = [{ id: 'n1', type: 'invite' }];
  global.FirebaseManager = { getInvitationNotifications: () => notifs };
  loadModule();
  assert.deepEqual(global.FirebaseService.getInvitationNotifications(), notifs);
});

test('setAuthCallback delegates to manager', () => {
  let registeredCb;
  global.FirebaseManager = { setAuthCallback: (cb) => { registeredCb = cb; } };
  loadModule();
  const cb = () => {};
  global.FirebaseService.setAuthCallback(cb);
  assert.equal(registeredCb, cb);
});

test('setDataLoadCallback delegates to manager', () => {
  let registeredCb;
  global.FirebaseManager = { setDataLoadCallback: (cb) => { registeredCb = cb; } };
  loadModule();
  const cb = () => {};
  global.FirebaseService.setDataLoadCallback(cb);
  assert.equal(registeredCb, cb);
});

test('feature flag helpers delegate to manager', () => {
  global.FirebaseManager = {
    getFeatureFlags: () => ({
      MULTIGAME_ENABLED: true,
      MULTIGAME_READ_FALLBACK_ENABLED: true,
      MULTIGAME_DUAL_WRITE_ENABLED: true,
      MULTIGAME_GAME_SELECTOR_ENABLED: false,
    }),
  };
  loadModule();
  assert.equal(global.FirebaseService.isFeatureFlagEnabled('MULTIGAME_DUAL_WRITE_ENABLED'), true);
  assert.equal(global.FirebaseService.isFeatureFlagEnabled('MULTIGAME_GAME_SELECTOR_ENABLED'), false);
});
