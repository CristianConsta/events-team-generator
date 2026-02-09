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
  assert.deepEqual(await global.FirebaseService.deleteUserAccountAndData(), { success: false, error: 'Firebase not loaded' });
  assert.equal(global.FirebaseService.getPlayerSource(), 'personal');
  assert.equal(global.FirebaseService.getBuildingConfigVersion('desert_storm'), 0);
  assert.equal(global.FirebaseService.getGlobalDefaultBuildingConfig('canyon_battlefield'), null);
  assert.equal(global.FirebaseService.getGlobalDefaultBuildingConfigVersion(), 0);
  assert.deepEqual(global.FirebaseService.getGlobalDefaultBuildingPositions('desert_storm'), {});
  assert.equal(global.FirebaseService.getGlobalDefaultBuildingPositionsVersion(), 0);
});

test('firebase service delegates calls to FirebaseManager', async () => {
  let called = false;
  global.FirebaseManager = {
    signOut: async () => { called = true; return { success: true }; },
    deleteUserAccountAndData: async () => ({ success: true, dataDeleted: true, accountDeleted: true }),
    isSignedIn: () => true,
    getBuildingConfigVersion: () => 11,
    getGlobalDefaultBuildingConfig: () => [{ name: 'Command Center', label: 'CC' }],
    getGlobalDefaultBuildingConfigVersion: () => 456,
    getGlobalDefaultBuildingPositions: () => ({ 'Info Center': [100, 200] }),
    getGlobalDefaultBuildingPositionsVersion: () => 123,
  };
  loadModule();

  const result = await global.FirebaseService.signOut();
  assert.deepEqual(result, { success: true });
  assert.equal(called, true);
  assert.deepEqual(await global.FirebaseService.deleteUserAccountAndData(), { success: true, dataDeleted: true, accountDeleted: true });
  assert.equal(global.FirebaseService.isSignedIn(), true);
  assert.equal(global.FirebaseService.getBuildingConfigVersion('desert_storm'), 11);
  assert.deepEqual(global.FirebaseService.getGlobalDefaultBuildingConfig('canyon_battlefield'), [{ name: 'Command Center', label: 'CC' }]);
  assert.equal(global.FirebaseService.getGlobalDefaultBuildingConfigVersion(), 456);
  assert.deepEqual(global.FirebaseService.getGlobalDefaultBuildingPositions('desert_storm'), { 'Info Center': [100, 200] });
  assert.equal(global.FirebaseService.getGlobalDefaultBuildingPositionsVersion(), 123);
});
