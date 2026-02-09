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

test('firebase service returns safe fallbacks when manager is missing', async () => {
  delete global.FirebaseManager;
  loadModule();

  assert.equal(global.FirebaseService.isAvailable(), false);
  assert.deepEqual(await global.FirebaseService.signOut(), { success: false, error: 'Firebase not loaded' });
  assert.equal(global.FirebaseService.getPlayerSource(), 'personal');
  assert.deepEqual(global.FirebaseService.getGlobalDefaultBuildingPositions('desert_storm'), {});
  assert.equal(global.FirebaseService.getGlobalDefaultBuildingPositionsVersion(), 0);
});

test('firebase service delegates calls to FirebaseManager', async () => {
  let called = false;
  global.FirebaseManager = {
    signOut: async () => { called = true; return { success: true }; },
    isSignedIn: () => true,
    getGlobalDefaultBuildingPositions: () => ({ 'Info Center': [100, 200] }),
    getGlobalDefaultBuildingPositionsVersion: () => 123,
  };
  loadModule();

  const result = await global.FirebaseService.signOut();
  assert.deepEqual(result, { success: true });
  assert.equal(called, true);
  assert.equal(global.FirebaseService.isSignedIn(), true);
  assert.deepEqual(global.FirebaseService.getGlobalDefaultBuildingPositions('desert_storm'), { 'Info Center': [100, 200] });
  assert.equal(global.FirebaseService.getGlobalDefaultBuildingPositionsVersion(), 123);
});
