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

// ── normalizeEventId (via slugifyEventId & upsertEvent) ─────────────────────

test('slugifyEventId produces lowercase underscore-separated id', () => {
  loadModule();
  const id = global.DSCoreEvents.slugifyEventId('My Custom Event', []);
  assert.equal(id, 'my_custom_event');
});

test('slugifyEventId trims and handles special characters', () => {
  loadModule();
  const id = global.DSCoreEvents.slugifyEventId('  Hello World! 123  ', []);
  assert.equal(id, 'hello_world_123');
});

test('slugifyEventId uses "event" as base when name is empty', () => {
  loadModule();
  const id = global.DSCoreEvents.slugifyEventId('', []);
  assert.equal(id, 'event');
});

test('slugifyEventId avoids collision by appending counter', () => {
  loadModule();
  // 'desert_storm' already exists in registry
  const id1 = global.DSCoreEvents.slugifyEventId('Desert Storm', ['desert_storm']);
  assert.equal(id1, 'desert_storm_2');

  const id2 = global.DSCoreEvents.slugifyEventId('Desert Storm', ['desert_storm', 'desert_storm_2']);
  assert.equal(id2, 'desert_storm_3');
});

test('slugifyEventId caps base at 30 characters', () => {
  loadModule();
  const longName = 'A'.repeat(50);
  const id = global.DSCoreEvents.slugifyEventId(longName, []);
  assert.ok(id.length <= 30);
});

// ── upsertEvent ─────────────────────────────────────────────────────────────

test('upsertEvent returns null for empty or non-string eventId', () => {
  loadModule();
  assert.equal(global.DSCoreEvents.upsertEvent('', { name: 'Test' }), null);
  assert.equal(global.DSCoreEvents.upsertEvent('   ', { name: 'Test' }), null);
  assert.equal(global.DSCoreEvents.upsertEvent(null, { name: 'Test' }), null);
});

test('upsertEvent normalizes id (trims and lowercases)', () => {
  loadModule();
  const result = global.DSCoreEvents.upsertEvent('  MY_EVENT  ', { name: 'My Event' });
  assert.equal(result.id, 'my_event');
});

test('upsertEvent trims and caps event name at 30 characters', () => {
  loadModule();
  const longName = 'A'.repeat(40);
  const result = global.DSCoreEvents.upsertEvent('test_long', { name: longName });
  assert.equal(result.name.length, 30);
});

test('upsertEvent sanitizes buildings list — filters blank names', () => {
  loadModule();
  const result = global.DSCoreEvents.upsertEvent('my_event', {
    name: 'My Event',
    buildings: [
      { name: '', slots: 2, priority: 1 },
      { name: '  ', slots: 2, priority: 1 },
      { name: 'Valid', slots: 2, priority: 1 },
    ],
  });
  assert.equal(result.buildings.length, 1);
  assert.equal(result.buildings[0].name, 'Valid');
});

test('upsertEvent sanitizes buildings — rounds float slots and priority', () => {
  loadModule();
  const result = global.DSCoreEvents.upsertEvent('my_event', {
    name: 'My Event',
    buildings: [{ name: 'Tower', slots: 2.9, priority: 3.1 }],
  });
  assert.equal(result.buildings[0].slots, 3);
  assert.equal(result.buildings[0].priority, 3);
});

test('upsertEvent defaults to empty buildings array when none provided', () => {
  loadModule();
  const result = global.DSCoreEvents.upsertEvent('bare_event', { name: 'Bare' });
  assert.deepEqual(result.buildings, []);
  assert.equal(result.assignmentAlgorithmId, 'balanced_round_robin');
});

test('upsertEvent normalizes assignmentAlgorithmId with fallback default', () => {
  loadModule();
  const withInvalid = global.DSCoreEvents.upsertEvent('algo_event', {
    name: 'Algorithm Event',
    assignmentAlgorithmId: '   ',
    buildings: [],
  });
  assert.equal(withInvalid.assignmentAlgorithmId, 'balanced_round_robin');
  const withExplicit = global.DSCoreEvents.upsertEvent('algo_event', {
    name: 'Algorithm Event',
    assignmentAlgorithmId: 'BALANCED_ROUND_ROBIN',
    buildings: [],
  });
  assert.equal(withExplicit.assignmentAlgorithmId, 'balanced_round_robin');
});

test('upsertEvent updates existing event rather than creating duplicate', () => {
  loadModule();
  global.DSCoreEvents.upsertEvent('my_event', { name: 'Original' });
  const updated = global.DSCoreEvents.upsertEvent('my_event', { name: 'Updated' });
  assert.equal(updated.name, 'Updated');
  const ids = global.DSCoreEvents.getEventIds();
  assert.equal(ids.filter((id) => id === 'my_event').length, 1);
});

test('upsertEvent returns a deep clone (mutations do not affect registry)', () => {
  loadModule();
  const result = global.DSCoreEvents.upsertEvent('clone_test', {
    name: 'Clone Test',
    buildings: [{ name: 'HQ', slots: 2, priority: 1 }],
  });
  result.buildings[0].slots = 9999;
  const fresh = global.DSCoreEvents.getEvent('clone_test');
  assert.notEqual(fresh.buildings[0].slots, 9999);
});

// ── removeEvent ─────────────────────────────────────────────────────────────

test('removeEvent deletes a custom event and returns true', () => {
  loadModule();
  global.DSCoreEvents.upsertEvent('to_remove', { name: 'Temp' });
  assert.equal(global.DSCoreEvents.removeEvent('to_remove'), true);
  assert.equal(global.DSCoreEvents.getEvent('to_remove'), null);
});

test('removeEvent can delete built-in events from the mutable registry', () => {
  loadModule();
  // Built-in events live in the mutable EVENT_REGISTRY — they are not write-protected
  assert.equal(global.DSCoreEvents.removeEvent('desert_storm'), true);
  assert.equal(global.DSCoreEvents.getEvent('desert_storm'), null);
  assert.equal(global.DSCoreEvents.removeEvent('canyon_battlefield'), true);
});

test('removeEvent returns false for non-existent event', () => {
  loadModule();
  assert.equal(global.DSCoreEvents.removeEvent('no_such_event'), false);
});

test('removeEvent returns false for empty/null id', () => {
  loadModule();
  assert.equal(global.DSCoreEvents.removeEvent(''), false);
  assert.equal(global.DSCoreEvents.removeEvent(null), false);
});

// ── getEvent / getEventIds ──────────────────────────────────────────────────

test('getEvent returns null for unknown id', () => {
  loadModule();
  assert.equal(global.DSCoreEvents.getEvent('unknown'), null);
  assert.equal(global.DSCoreEvents.getEvent(''), null);
  assert.equal(global.DSCoreEvents.getEvent(null), null);
});

test('getEventIds returns array containing both built-in events', () => {
  loadModule();
  const ids = global.DSCoreEvents.getEventIds();
  assert.ok(Array.isArray(ids));
  assert.ok(ids.includes('desert_storm'));
  assert.ok(ids.includes('canyon_battlefield'));
});

// ── cloneEventRegistry ──────────────────────────────────────────────────────

test('cloneEventRegistry returns isolated copy — mutations do not affect live registry', () => {
  loadModule();
  const clone = global.DSCoreEvents.cloneEventRegistry();
  clone.desert_storm.name = 'MUTATED';
  assert.notEqual(global.DSCoreEvents.getEvent('desert_storm').name, 'MUTATED');
});

test('cloneEventRegistry includes custom events added after load', () => {
  loadModule();
  global.DSCoreEvents.upsertEvent('new_event', { name: 'New' });
  const clone = global.DSCoreEvents.cloneEventRegistry();
  assert.ok(clone.new_event);
});

// ── setEventRegistry ────────────────────────────────────────────────────────

test('setEventRegistry replaces all entries including built-ins', () => {
  loadModule();
  global.DSCoreEvents.setEventRegistry({
    custom_only: { id: 'custom_only', name: 'Custom Only', buildings: [] },
  });
  const ids = global.DSCoreEvents.getEventIds();
  assert.ok(ids.includes('custom_only'));
  assert.equal(global.DSCoreEvents.getEvent('desert_storm'), null);
});

test('setEventRegistry with null/undefined clears all events', () => {
  loadModule();
  global.DSCoreEvents.setEventRegistry(null);
  assert.deepEqual(global.DSCoreEvents.getEventIds(), []);
});

// ── cloneEventBuildings ─────────────────────────────────────────────────────

test('cloneEventBuildings returns empty array for unknown event', () => {
  loadModule();
  assert.deepEqual(global.DSCoreEvents.cloneEventBuildings('unknown'), []);
});

test('cloneEventBuildings sets showOnMap to true when not explicitly false', () => {
  loadModule();
  const buildings = global.DSCoreEvents.cloneEventBuildings('desert_storm');
  buildings.forEach((b) => {
    assert.equal(typeof b.showOnMap, 'boolean');
    assert.equal(b.showOnMap, true);
  });
});

// ── cloneDefaultPositions ───────────────────────────────────────────────────

test('cloneDefaultPositions returns empty object for unknown event', () => {
  loadModule();
  assert.deepEqual(global.DSCoreEvents.cloneDefaultPositions('unknown'), {});
});

test('cloneDefaultPositions mutations do not affect subsequent calls', () => {
  loadModule();
  const pos1 = global.DSCoreEvents.cloneDefaultPositions('desert_storm');
  const keys = Object.keys(pos1);
  if (keys.length > 0) {
    pos1[keys[0]] = [9999, 9999];
  }
  const pos2 = global.DSCoreEvents.cloneDefaultPositions('desert_storm');
  if (keys.length > 0) {
    assert.notDeepEqual(pos2[keys[0]], [9999, 9999]);
  }
});

// ── LEGACY_EVENT_REGISTRY ───────────────────────────────────────────────────

test('LEGACY_EVENT_REGISTRY is immutable — mutations via cloneLegacyEventRegistry are isolated', () => {
  loadModule();
  const clone = global.DSCoreEvents.cloneLegacyEventRegistry();
  clone.desert_storm.name = 'HACKED';
  // Reload to get a fresh cloneLegacyEventRegistry; legacy is a const in module scope
  const fresh = global.DSCoreEvents.cloneLegacyEventRegistry();
  assert.equal(fresh.desert_storm.name, 'Desert Storm');
});
