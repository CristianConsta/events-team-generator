const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const modulePath = path.resolve(__dirname, '../js/core/events.js');

function loadModule() {
  global.window = global;
  delete global.DSCoreEvents;
  delete require.cache[require.resolve(modulePath)];
  require(modulePath);
}

test('events core exposes known registry entries', () => {
  loadModule();
  assert.ok(global.DSCoreEvents.EVENT_REGISTRY.desert_storm);
  assert.ok(global.DSCoreEvents.EVENT_REGISTRY.canyon_battlefield);
});

test('cloneEventBuildings returns deep-copied defaults', () => {
  loadModule();
  const cloned = global.DSCoreEvents.cloneEventBuildings('desert_storm');
  assert.ok(Array.isArray(cloned));
  assert.ok(cloned.length > 0);

  cloned[0].slots = 999;
  const fresh = global.DSCoreEvents.cloneEventBuildings('desert_storm');
  assert.notEqual(fresh[0].slots, 999);
});

test('cloneDefaultPositions returns isolated object', () => {
  loadModule();
  const first = global.DSCoreEvents.cloneDefaultPositions('desert_storm');
  first['Info Center'][0] = 12345;

  const second = global.DSCoreEvents.cloneDefaultPositions('desert_storm');
  assert.notEqual(second['Info Center'][0], 12345);
});
