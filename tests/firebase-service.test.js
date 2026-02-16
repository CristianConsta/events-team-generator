const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const gatewayUtilsPath = path.resolve(__dirname, '../js/shared/data/firebase-gateway-utils.js');
const authGatewayPath = path.resolve(__dirname, '../js/shared/data/firebase-auth-gateway.js');
const playersGatewayPath = path.resolve(__dirname, '../js/shared/data/firebase-players-gateway.js');
const eventsGatewayPath = path.resolve(__dirname, '../js/shared/data/firebase-events-gateway.js');
const allianceGatewayPath = path.resolve(__dirname, '../js/shared/data/firebase-alliance-gateway.js');
const notificationsGatewayPath = path.resolve(__dirname, '../js/shared/data/firebase-notifications-gateway.js');
const modulePath = path.resolve(__dirname, '../js/services/firebase-service.js');

function loadModule() {
  global.window = global;
  delete global.DSSharedFirebaseGatewayUtils;
  delete global.DSSharedFirebaseAuthGateway;
  delete global.DSSharedFirebasePlayersGateway;
  delete global.DSSharedFirebaseEventsGateway;
  delete global.DSSharedFirebaseAllianceGateway;
  delete global.DSSharedFirebaseNotificationsGateway;
  delete global.FirebaseService;
  delete require.cache[require.resolve(gatewayUtilsPath)];
  delete require.cache[require.resolve(authGatewayPath)];
  delete require.cache[require.resolve(playersGatewayPath)];
  delete require.cache[require.resolve(eventsGatewayPath)];
  delete require.cache[require.resolve(allianceGatewayPath)];
  delete require.cache[require.resolve(notificationsGatewayPath)];
  delete require.cache[require.resolve(modulePath)];
  require(gatewayUtilsPath);
  require(authGatewayPath);
  require(playersGatewayPath);
  require(eventsGatewayPath);
  require(allianceGatewayPath);
  require(notificationsGatewayPath);
  require(modulePath);
}

const NOT_LOADED = { success: false, error: 'Firebase not loaded' };
const profilePayload = { displayName: 'Ana', nickname: 'A', avatarDataUrl: '', theme: 'standard' };
const scenarios = [
  { method: 'init', args: [], fallback: false },
  { method: 'setAuthCallback', args: [() => {}], fallback: null },
  { method: 'setDataLoadCallback', args: [() => {}], fallback: null },
  { method: 'setAllianceDataCallback', args: [() => {}], fallback: null },
  { method: 'signInWithGoogle', args: [], fallback: NOT_LOADED },
  { method: 'signInWithEmail', args: ['user@example.com', 'password'], fallback: NOT_LOADED },
  { method: 'signUpWithEmail', args: ['new@example.com', 'password'], fallback: NOT_LOADED },
  { method: 'resetPassword', args: ['user@example.com'], fallback: NOT_LOADED },
  { method: 'signOut', args: [], fallback: NOT_LOADED },
  { method: 'deleteUserAccountAndData', args: [], fallback: NOT_LOADED },
  { method: 'getCurrentUser', args: [], fallback: null },
  { method: 'isSignedIn', args: [], fallback: false },
  { method: 'loadUserData', args: [{ uid: 'user-1' }], fallback: NOT_LOADED },
  { method: 'saveUserData', args: [{ scope: 'all' }], fallback: NOT_LOADED },
  { method: 'uploadPlayerDatabase', args: ['players.csv'], reject: NOT_LOADED },
  { method: 'getPlayerDatabase', args: [], fallback: {} },
  { method: 'getAlliancePlayerDatabase', args: [], fallback: {} },
  { method: 'upsertPlayerEntry', args: ['personal', 'Old Name', { name: 'New Name' }], fallback: NOT_LOADED },
  { method: 'removePlayerEntry', args: ['personal', 'To Delete'], fallback: NOT_LOADED },
  { method: 'getAllEventData', args: [], fallback: {} },
  { method: 'getEventIds', args: [], fallback: [] },
  { method: 'getEventMeta', args: ['desert_storm'], fallback: null },
  { method: 'upsertEvent', args: ['test_event', { name: 'Test Event' }], fallback: null },
  { method: 'removeEvent', args: ['test_event'], fallback: false },
  { method: 'setEventMetadata', args: ['test_event', { name: 'Updated' }], fallback: null },
  { method: 'getActivePlayerDatabase', args: [], fallback: {} },
  { method: 'getUserProfile', args: [], fallback: { displayName: '', nickname: '', avatarDataUrl: '', theme: 'standard' } },
  { method: 'setUserProfile', args: [profilePayload], fallback: { displayName: '', nickname: '', avatarDataUrl: '', theme: 'standard' } },
  { method: 'getPlayerSource', args: [], fallback: 'personal' },
  { method: 'getBuildingConfig', args: ['desert_storm'], fallback: null },
  { method: 'setBuildingConfig', args: ['desert_storm', [{ name: 'HQ' }]], fallback: null },
  { method: 'getBuildingConfigVersion', args: ['desert_storm'], fallback: 0 },
  { method: 'setBuildingConfigVersion', args: ['desert_storm', 5], fallback: null },
  { method: 'getBuildingPositions', args: ['desert_storm'], fallback: null },
  { method: 'setBuildingPositions', args: ['desert_storm', { HQ: [10, 20] }], fallback: null },
  { method: 'getBuildingPositionsVersion', args: ['desert_storm'], fallback: 0 },
  { method: 'setBuildingPositionsVersion', args: ['desert_storm', 6], fallback: null },
  { method: 'getGlobalDefaultBuildingConfig', args: ['desert_storm'], fallback: null },
  { method: 'getGlobalDefaultBuildingConfigVersion', args: [], fallback: 0 },
  { method: 'getGlobalDefaultBuildingPositions', args: ['desert_storm'], fallback: {} },
  { method: 'getGlobalDefaultBuildingPositionsVersion', args: [], fallback: 0 },
  { method: 'createAlliance', args: ['Alpha'], fallback: NOT_LOADED },
  { method: 'leaveAlliance', args: [], fallback: NOT_LOADED },
  { method: 'loadAllianceData', args: [], fallback: NOT_LOADED },
  { method: 'sendInvitation', args: ['ally@example.com'], fallback: NOT_LOADED },
  { method: 'checkInvitations', args: [], fallback: [] },
  { method: 'acceptInvitation', args: ['invite-1'], fallback: NOT_LOADED },
  { method: 'rejectInvitation', args: ['invite-2'], fallback: NOT_LOADED },
  { method: 'revokeInvitation', args: ['invite-3'], fallback: NOT_LOADED },
  { method: 'resendInvitation', args: ['invite-4'], fallback: NOT_LOADED },
  { method: 'uploadAlliancePlayerDatabase', args: ['alliance.csv'], reject: NOT_LOADED },
  { method: 'setPlayerSource', args: ['alliance'], fallback: NOT_LOADED },
  { method: 'getAllianceId', args: [], fallback: null },
  { method: 'getAllianceName', args: [], fallback: null },
  { method: 'getAllianceData', args: [], fallback: null },
  { method: 'getPendingInvitations', args: [], fallback: [] },
  { method: 'getSentInvitations', args: [], fallback: [] },
  { method: 'getInvitationNotifications', args: [], fallback: [] },
  { method: 'getAllianceMembers', args: [], fallback: {} },
];

test('firebase service returns safe fallbacks when manager is missing', async () => {
  delete global.FirebaseManager;
  loadModule();
  assert.equal(global.FirebaseService.isAvailable(), false);

  for (const scenario of scenarios) {
    if (scenario.reject) {
      await assert.rejects(
        () => global.FirebaseService[scenario.method](...scenario.args),
        (error) => {
          assert.deepEqual(error, scenario.reject);
          return true;
        }
      );
      continue;
    }
    const result = await Promise.resolve(global.FirebaseService[scenario.method](...scenario.args));
    assert.deepEqual(result, scenario.fallback, `fallback mismatch for ${scenario.method}`);
  }
});

test('firebase service delegates every adapter call to FirebaseManager', async () => {
  const calls = [];
  global.FirebaseManager = new Proxy({}, {
    get(_target, property) {
      return (...args) => {
        const name = String(property);
        calls.push({ method: name, args });
        return { method: name, argsLength: args.length };
      };
    },
  });
  loadModule();

  assert.equal(global.FirebaseService.isAvailable(), true);
  for (const scenario of scenarios) {
    const result = await Promise.resolve(global.FirebaseService[scenario.method](...scenario.args));
    assert.equal(result.method, scenario.method);
    assert.equal(result.argsLength, scenario.args.length);
  }

  assert.deepEqual(calls.map((entry) => entry.method), scenarios.map((entry) => entry.method));
});
