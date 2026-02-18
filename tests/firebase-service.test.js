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
  assert.deepEqual(global.FirebaseService.getAllEventData(), {});
  assert.deepEqual(global.FirebaseService.getEventIds(), []);
  assert.equal(global.FirebaseService.getEventMeta('desert_storm'), null);
  assert.equal(global.FirebaseService.upsertEvent('test_event', { name: 'Test' }), null);
  assert.equal(global.FirebaseService.removeEvent('test_event'), false);
  assert.equal(global.FirebaseService.setEventMetadata('test_event', { name: 'Test' }), null);
  assert.equal(global.FirebaseService.getBuildingConfigVersion('desert_storm'), 0);
  assert.equal(global.FirebaseService.getGlobalDefaultBuildingConfig('canyon_battlefield'), null);
  assert.equal(global.FirebaseService.getGlobalDefaultBuildingConfigVersion(), 0);
  assert.deepEqual(global.FirebaseService.getGlobalDefaultBuildingPositions('desert_storm'), {});
  assert.equal(global.FirebaseService.getGlobalDefaultBuildingPositionsVersion(), 0);
  assert.deepEqual(global.FirebaseService.getFeatureFlags(), {
    MULTIGAME_ENABLED: false,
    MULTIGAME_READ_FALLBACK_ENABLED: true,
    MULTIGAME_DUAL_WRITE_ENABLED: false,
    MULTIGAME_GAME_SELECTOR_ENABLED: false,
  });
  assert.equal(global.FirebaseService.isFeatureFlagEnabled('MULTIGAME_ENABLED'), false);
  assert.deepEqual(global.FirebaseService.listAvailableGames(), []);
  assert.deepEqual(global.FirebaseService.getActiveGame(), { gameId: '', source: 'none' });
  assert.deepEqual(global.FirebaseService.setActiveGame('last_war'), { success: true, gameId: 'last_war', changed: true });
  assert.equal(global.FirebaseService.requireActiveGame(), 'last_war');
  global.FirebaseService.clearActiveGame();
  assert.throws(() => global.FirebaseService.requireActiveGame(), (error) => error && error.code === 'missing-active-game');
  assert.equal(global.FirebaseService.getMigrationVersion(), 0);
  assert.equal(global.FirebaseService.getMigratedToGameSubcollectionsAt(), null);
});

test('firebase service delegates calls to FirebaseManager', async () => {
  let called = false;
  global.FirebaseManager = {
    signOut: async () => { called = true; return { success: true }; },
    deleteUserAccountAndData: async () => ({ success: true, dataDeleted: true, accountDeleted: true }),
    isSignedIn: () => true,
    getAllEventData: () => ({ desert_storm: { name: 'Desert Storm' } }),
    getEventIds: () => ['desert_storm'],
    getEventMeta: (eventId) => ({ id: eventId, name: 'Desert Storm', logoDataUrl: '', mapDataUrl: '' }),
    upsertEvent: (eventId, payload) => ({ id: eventId, name: payload.name, logoDataUrl: '', mapDataUrl: '' }),
    removeEvent: () => true,
    setEventMetadata: (eventId, payload) => ({ id: eventId, name: payload.name, logoDataUrl: '', mapDataUrl: '' }),
    getBuildingConfigVersion: () => 11,
    getGlobalDefaultBuildingConfig: () => [{ name: 'Command Center', label: 'CC' }],
    getGlobalDefaultBuildingConfigVersion: () => 456,
    getGlobalDefaultBuildingPositions: () => ({ 'Info Center': [100, 200] }),
    getGlobalDefaultBuildingPositionsVersion: () => 123,
    getFeatureFlags: () => ({
      MULTIGAME_ENABLED: true,
      MULTIGAME_READ_FALLBACK_ENABLED: false,
      MULTIGAME_DUAL_WRITE_ENABLED: true,
      MULTIGAME_GAME_SELECTOR_ENABLED: true,
    }),
    listAvailableGames: () => ([{ id: 'last_war', name: 'Last War: Survival' }]),
    getMigrationVersion: () => 1,
    getMigratedToGameSubcollectionsAt: () => '2026-02-18T00:00:00.000Z',
  };
  loadModule();

  const result = await global.FirebaseService.signOut();
  assert.deepEqual(result, { success: true });
  assert.equal(called, true);
  assert.deepEqual(await global.FirebaseService.deleteUserAccountAndData(), { success: true, dataDeleted: true, accountDeleted: true });
  assert.equal(global.FirebaseService.isSignedIn(), true);
  assert.deepEqual(global.FirebaseService.getAllEventData(), { desert_storm: { name: 'Desert Storm' } });
  assert.deepEqual(global.FirebaseService.getEventIds(), ['desert_storm']);
  assert.deepEqual(global.FirebaseService.getEventMeta('desert_storm'), { id: 'desert_storm', name: 'Desert Storm', logoDataUrl: '', mapDataUrl: '' });
  assert.deepEqual(global.FirebaseService.upsertEvent('test_event', { name: 'Test' }), { id: 'test_event', name: 'Test', logoDataUrl: '', mapDataUrl: '' });
  assert.equal(global.FirebaseService.removeEvent('test_event'), true);
  assert.deepEqual(global.FirebaseService.setEventMetadata('desert_storm', { name: 'Desert Storm' }), { id: 'desert_storm', name: 'Desert Storm', logoDataUrl: '', mapDataUrl: '' });
  assert.equal(global.FirebaseService.getBuildingConfigVersion('desert_storm'), 11);
  assert.deepEqual(global.FirebaseService.getGlobalDefaultBuildingConfig('canyon_battlefield'), [{ name: 'Command Center', label: 'CC' }]);
  assert.equal(global.FirebaseService.getGlobalDefaultBuildingConfigVersion(), 456);
  assert.deepEqual(global.FirebaseService.getGlobalDefaultBuildingPositions('desert_storm'), { 'Info Center': [100, 200] });
  assert.equal(global.FirebaseService.getGlobalDefaultBuildingPositionsVersion(), 123);
  assert.deepEqual(global.FirebaseService.getFeatureFlags(), {
    MULTIGAME_ENABLED: true,
    MULTIGAME_READ_FALLBACK_ENABLED: false,
    MULTIGAME_DUAL_WRITE_ENABLED: true,
    MULTIGAME_GAME_SELECTOR_ENABLED: true,
  });
  assert.equal(global.FirebaseService.isFeatureFlagEnabled('MULTIGAME_DUAL_WRITE_ENABLED'), true);
  assert.deepEqual(global.FirebaseService.listAvailableGames(), [{ id: 'last_war', name: 'Last War: Survival' }]);
  assert.deepEqual(global.FirebaseService.setActiveGame('last_war'), { success: true, gameId: 'last_war', changed: true });
  assert.equal(global.FirebaseService.requireActiveGame(), 'last_war');
  assert.equal(global.FirebaseService.getMigrationVersion(), 1);
  assert.equal(global.FirebaseService.getMigratedToGameSubcollectionsAt(), '2026-02-18T00:00:00.000Z');
});
