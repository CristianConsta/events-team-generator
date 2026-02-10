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

test('upsertEvent stores sanitized custom event definitions', () => {
  loadModule();
  const created = global.DSCoreEvents.upsertEvent(' custom_event ', {
    name: '  My Custom Event  ',
    buildings: [
      { name: 'Tower', slots: 2.2, priority: 3.7 },
      { name: '  ', slots: 9, priority: 2 },
    ],
  });

  assert.equal(created.id, 'custom_event');
  assert.equal(created.name, 'My Custom Event');
  assert.equal(created.buildings.length, 1);
  assert.deepEqual(created.buildings[0], { name: 'Tower', label: 'Tower', slots: 2, priority: 4, showOnMap: true });
  assert.ok(global.DSCoreEvents.EVENT_REGISTRY.custom_event);
});

test('setEventRegistry replaces runtime registry', () => {
  loadModule();
  global.DSCoreEvents.setEventRegistry({
    test_event: {
      id: 'test_event',
      name: 'Test Event',
      buildings: [{ name: 'HQ', slots: 2, priority: 1 }],
    },
  });

  assert.deepEqual(global.DSCoreEvents.getEventIds(), ['test_event']);
  assert.ok(global.DSCoreEvents.getEvent('test_event'));
  assert.equal(global.DSCoreEvents.getEvent('desert_storm'), null);
});

test('slugifyEventId avoids collisions', () => {
  loadModule();
  const id = global.DSCoreEvents.slugifyEventId('Desert Storm');
  assert.equal(id, 'desert_storm_2');
});
