const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const utilsPath = path.resolve(__dirname, '../js/shared/data/firebase-gateway-utils.js');
const authPath = path.resolve(__dirname, '../js/shared/data/firebase-auth-gateway.js');
const playersPath = path.resolve(__dirname, '../js/shared/data/firebase-players-gateway.js');
const eventsPath = path.resolve(__dirname, '../js/shared/data/firebase-events-gateway.js');
const alliancePath = path.resolve(__dirname, '../js/shared/data/firebase-alliance-gateway.js');
const notificationsPath = path.resolve(__dirname, '../js/shared/data/firebase-notifications-gateway.js');

function reset(modulePath) {
  delete require.cache[require.resolve(modulePath)];
}

function loadAll() {
  global.window = global;
  delete global.DSSharedFirebaseGatewayUtils;
  delete global.DSSharedFirebaseAuthGateway;
  delete global.DSSharedFirebasePlayersGateway;
  delete global.DSSharedFirebaseEventsGateway;
  delete global.DSSharedFirebaseAllianceGateway;
  delete global.DSSharedFirebaseNotificationsGateway;
  reset(utilsPath);
  reset(authPath);
  reset(playersPath);
  reset(eventsPath);
  reset(alliancePath);
  reset(notificationsPath);
  require(utilsPath);
  require(authPath);
  require(playersPath);
  require(eventsPath);
  require(alliancePath);
  require(notificationsPath);
}

test('firebase gateway modules expose expected method surfaces', () => {
  loadAll();
  const utils = global.DSSharedFirebaseGatewayUtils.createUtils(global);

  const auth = global.DSSharedFirebaseAuthGateway.createGateway(utils);
  const players = global.DSSharedFirebasePlayersGateway.createGateway(utils);
  const events = global.DSSharedFirebaseEventsGateway.createGateway(utils);
  const alliance = global.DSSharedFirebaseAllianceGateway.createGateway(utils);
  const notifications = global.DSSharedFirebaseNotificationsGateway.createGateway(utils);

  assert.equal(typeof auth.signInWithEmail, 'function');
  assert.equal(typeof players.upsertPlayerEntry, 'function');
  assert.equal(typeof events.getBuildingConfig, 'function');
  assert.equal(typeof alliance.createAlliance, 'function');
  assert.equal(typeof notifications.checkInvitations, 'function');
});

test('firebase gateway utils withManager returns fallback without manager', () => {
  loadAll();
  delete global.FirebaseManager;

  const utils = global.DSSharedFirebaseGatewayUtils.createUtils(global);
  assert.equal(utils.manager(), null);
  assert.deepEqual(
    utils.withManager(() => ({ ok: true }), { ok: false }),
    { ok: false },
  );
});
