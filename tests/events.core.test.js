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
  assert.equal(global.DSCoreEvents.EVENT_REGISTRY.desert_storm.assignmentAlgorithmId, 'balanced_round_robin');
  assert.equal(global.DSCoreEvents.EVENT_REGISTRY.canyon_battlefield.assignmentAlgorithmId, 'balanced_round_robin');
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
  assert.equal(created.assignmentAlgorithmId, 'balanced_round_robin');
  assert.equal(created.buildings.length, 1);
  assert.deepEqual(created.buildings[0], { name: 'Tower', label: 'Tower', slots: 2, priority: 4, showOnMap: true });
  assert.ok(global.DSCoreEvents.EVENT_REGISTRY.custom_event);
});

test('upsertEvent keeps explicit assignmentAlgorithmId when provided', () => {
  loadModule();
  const created = global.DSCoreEvents.upsertEvent('algo_event', {
    name: 'Algorithm Event',
    assignmentAlgorithmId: 'balanced_round_robin',
    buildings: [],
  });
  assert.equal(created.assignmentAlgorithmId, 'balanced_round_robin');
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

test('events core handles invalid ids and remove operations safely', () => {
  loadModule();
  assert.equal(global.DSCoreEvents.getEvent('missing_event'), null);
  assert.equal(global.DSCoreEvents.upsertEvent('   ', { name: 'Invalid' }), null);
  assert.equal(global.DSCoreEvents.removeEvent('   '), false);
  assert.equal(global.DSCoreEvents.removeEvent('missing_event'), false);
});

test('upsertEvent sanitizes metadata fallbacks and showOnMap flags', () => {
  loadModule();
  const created = global.DSCoreEvents.upsertEvent('sanitized_event', {
    name: 'Sanitized Event',
    mapFile: 'map.png',
    previewMapFile: 'map-preview.png',
    exportMapFile: 'map-export.png',
    buildings: [{ name: 'HQ', label: '', slots: 1.8, priority: 2.2, showOnMap: false }],
  });
  assert.equal(created.id, 'sanitized_event');
  assert.deepEqual(created.buildings, [
    { name: 'HQ', label: 'HQ', slots: 2, priority: 2, showOnMap: false },
  ]);

  const updated = global.DSCoreEvents.upsertEvent('sanitized_event', {
    name: '',
    mapDataUrl: '  data:image/png;base64,AAA  ',
    logoDataUrl: '  data:image/png;base64,BBB  ',
    mapTitle: 'alpha zone',
    excelPrefix: '',
    buildings: [{ name: 'HQ', slots: 'x', priority: 'y' }],
  });
  assert.equal(updated.name, 'Sanitized Event');
  assert.equal(updated.mapDataUrl, 'data:image/png;base64,AAA');
  assert.equal(updated.logoDataUrl, 'data:image/png;base64,BBB');
  assert.equal(updated.mapFile, 'data:image/png;base64,AAA');
  assert.equal(updated.previewMapFile, 'data:image/png;base64,AAA');
  assert.equal(updated.exportMapFile, 'data:image/png;base64,AAA');
  assert.equal(updated.mapTitle, 'ALPHA ZONE');
  assert.equal(updated.excelPrefix, 'sanitized_event');
  assert.deepEqual(updated.buildings, [
    { name: 'HQ', label: 'HQ', slots: 0, priority: 1, showOnMap: true },
  ]);
});

test('setEventRegistry sanitizes entries and clone helpers return deep copies', () => {
  loadModule();
  global.DSCoreEvents.setEventRegistry({
    '__invalid__': { id: '', name: 'Ignored' },
    '  New Event  ': {
      id: '  New Event  ',
      name: '  New Event Name  ',
      buildings: [{ name: 'Outpost', slots: 3, priority: 2, showOnMap: false }],
      defaultPositions: { Outpost: [100, 200] },
    },
  });

  const ids = global.DSCoreEvents.getEventIds();
  assert.deepEqual(ids, ['invalid', 'new_event']);
  assert.deepEqual(global.DSCoreEvents.cloneEventBuildings('missing'), []);
  assert.deepEqual(global.DSCoreEvents.cloneDefaultPositions('missing'), {});
  assert.deepEqual(global.DSCoreEvents.cloneEventBuildings('new_event'), [
    { name: 'Outpost', label: 'Outpost', slots: 3, priority: 2, showOnMap: false },
  ]);

  const legacy = global.DSCoreEvents.cloneLegacyEventRegistry();
  legacy.desert_storm.name = 'Mutated Name';
  const fresh = global.DSCoreEvents.cloneLegacyEventRegistry();
  assert.notEqual(fresh.desert_storm.name, 'Mutated Name');
});

test('slugifyEventId falls back to event prefix and truncates collisions', () => {
  loadModule();
  const existing = ['event', 'event_2', 'event_3', 'x'.repeat(30), `${'x'.repeat(28)}_2`];
  assert.equal(global.DSCoreEvents.slugifyEventId('   ', existing), 'event_4');
  assert.equal(global.DSCoreEvents.slugifyEventId('x'.repeat(40), existing), `${'x'.repeat(28)}_3`);
});
