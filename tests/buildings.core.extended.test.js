const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const modulePath = path.resolve(__dirname, '../js/core/buildings.js');

function loadModule() {
  global.window = global;
  delete global.DSCoreBuildings;
  delete require.cache[require.resolve(modulePath)];
  require(modulePath);
}

// ── clampPriority ───────────────────────────────────────────────────────────

test('clampPriority clamps below-minimum value to 1', () => {
  loadModule();
  assert.equal(global.DSCoreBuildings.clampPriority(-5, 3), 1);
  assert.equal(global.DSCoreBuildings.clampPriority(0, 3), 1);
});

test('clampPriority clamps above-maximum value to 6', () => {
  loadModule();
  assert.equal(global.DSCoreBuildings.clampPriority(7, 3), 6);
  assert.equal(global.DSCoreBuildings.clampPriority(100, 3), 6);
});

test('clampPriority rounds fractional values', () => {
  loadModule();
  assert.equal(global.DSCoreBuildings.clampPriority(3.4, 1), 3);
  assert.equal(global.DSCoreBuildings.clampPriority(3.6, 1), 4);
});

test('clampPriority returns fallback for NaN and non-numeric strings', () => {
  loadModule();
  assert.equal(global.DSCoreBuildings.clampPriority(NaN, 2), 2);
  assert.equal(global.DSCoreBuildings.clampPriority('abc', 2), 2);
  assert.equal(global.DSCoreBuildings.clampPriority(undefined, 2), 2);
});

test('clampPriority clamps Infinity to maximum 6', () => {
  loadModule();
  // Number(Infinity) is finite=false — returns fallback
  assert.equal(global.DSCoreBuildings.clampPriority(Infinity, 2), 2);
});

test('clampPriority treats null as 0 (coerced to finite) and clamps to 1', () => {
  loadModule();
  // Number(null) === 0, which is finite, so clamp(0, 1, 6) = 1
  assert.equal(global.DSCoreBuildings.clampPriority(null, 2), 1);
});

test('clampPriority accepts valid boundary values 1 and 6', () => {
  loadModule();
  assert.equal(global.DSCoreBuildings.clampPriority(1, 3), 1);
  assert.equal(global.DSCoreBuildings.clampPriority(6, 3), 6);
});

// ── clampSlots ──────────────────────────────────────────────────────────────

test('clampSlots clamps to minSlots when value is below minimum', () => {
  loadModule();
  assert.equal(global.DSCoreBuildings.clampSlots(-3, 2, 0, 20), 0);
});

test('clampSlots clamps to maxSlots when value is above maximum', () => {
  loadModule();
  assert.equal(global.DSCoreBuildings.clampSlots(99, 2, 0, 20), 20);
});

test('clampSlots rounds fractional values', () => {
  loadModule();
  assert.equal(global.DSCoreBuildings.clampSlots(3.2, 0, 0, 20), 3);
  assert.equal(global.DSCoreBuildings.clampSlots(3.7, 0, 0, 20), 4);
});

test('clampSlots returns fallback for non-finite inputs', () => {
  loadModule();
  assert.equal(global.DSCoreBuildings.clampSlots(NaN, 5, 0, 20), 5);
  assert.equal(global.DSCoreBuildings.clampSlots(Infinity, 5, 0, 20), 5);
  assert.equal(global.DSCoreBuildings.clampSlots('nope', 5, 0, 20), 5);
});

test('clampSlots string numbers are coerced correctly', () => {
  loadModule();
  assert.equal(global.DSCoreBuildings.clampSlots('4', 0, 0, 20), 4);
});

// ── getBuildingSlotsTotal ───────────────────────────────────────────────────

test('getBuildingSlotsTotal returns 0 for empty array', () => {
  loadModule();
  assert.equal(global.DSCoreBuildings.getBuildingSlotsTotal([]), 0);
});

test('getBuildingSlotsTotal returns 0 for non-array', () => {
  loadModule();
  assert.equal(global.DSCoreBuildings.getBuildingSlotsTotal(null), 0);
  assert.equal(global.DSCoreBuildings.getBuildingSlotsTotal(undefined), 0);
  assert.equal(global.DSCoreBuildings.getBuildingSlotsTotal('abc'), 0);
});

test('getBuildingSlotsTotal ignores null/undefined entries', () => {
  loadModule();
  const total = global.DSCoreBuildings.getBuildingSlotsTotal([
    null,
    undefined,
    { slots: 3 },
    { slots: 2 },
  ]);
  assert.equal(total, 5);
});

test('getBuildingSlotsTotal ignores entries without slots property', () => {
  loadModule();
  assert.equal(global.DSCoreBuildings.getBuildingSlotsTotal([{}, { slots: 4 }]), 4);
});

// ── normalizeBuildingConfig ─────────────────────────────────────────────────

test('normalizeBuildingConfig returns empty array when defaults is not array', () => {
  loadModule();
  const result = global.DSCoreBuildings.normalizeBuildingConfig(
    [{ name: 'X', slots: 2, priority: 1 }],
    null,
    0, 20
  );
  assert.deepEqual(result, []);
});

test('normalizeBuildingConfig returns default values when config is null', () => {
  loadModule();
  const defaults = [{ name: 'HQ', priority: 2, slots: 4, label: 'HQ' }];
  const result = global.DSCoreBuildings.normalizeBuildingConfig(null, defaults, 0, 20);
  assert.equal(result.length, 1);
  assert.equal(result[0].name, 'HQ');
  assert.equal(result[0].slots, 4);
});

test('normalizeBuildingConfig returns default values when config is empty array', () => {
  loadModule();
  const defaults = [{ name: 'HQ', priority: 2, slots: 4 }];
  const result = global.DSCoreBuildings.normalizeBuildingConfig([], defaults, 0, 20);
  assert.equal(result.length, 1);
  assert.equal(result[0].name, 'HQ');
});

test('normalizeBuildingConfig deduplicates entries with same name in config', () => {
  loadModule();
  const defaults = [{ name: 'HQ', priority: 1, slots: 2 }];
  const config = [
    { name: 'HQ', priority: 1, slots: 2 },
    { name: 'HQ', priority: 2, slots: 4 }, // duplicate — should be ignored
  ];
  const result = global.DSCoreBuildings.normalizeBuildingConfig(config, defaults, 0, 20);
  const hqEntries = result.filter((b) => b.name === 'HQ');
  assert.equal(hqEntries.length, 1);
});

test('normalizeBuildingConfig ignores null/invalid entries in config', () => {
  loadModule();
  const defaults = [{ name: 'HQ', priority: 1, slots: 2 }];
  const config = [null, undefined, 'string', 42, { name: 'HQ', priority: 1, slots: 2 }];
  const result = global.DSCoreBuildings.normalizeBuildingConfig(config, defaults, 0, 20);
  assert.equal(result.length, 1);
  assert.equal(result[0].name, 'HQ');
});

test('normalizeBuildingConfig ignores defaults with blank/missing names', () => {
  loadModule();
  const defaults = [
    { name: '  ', priority: 1, slots: 2 },
    { name: 'Valid', priority: 2, slots: 4 },
  ];
  const config = [{ name: 'Valid', priority: 2, slots: 4 }];
  const result = global.DSCoreBuildings.normalizeBuildingConfig(config, defaults, 0, 20);
  assert.equal(result.length, 1);
  assert.equal(result[0].name, 'Valid');
});

test('normalizeBuildingConfig maintains priority order: defaults first, then custom', () => {
  loadModule();
  const defaults = [
    { name: 'Alpha', priority: 1, slots: 2 },
    { name: 'Beta', priority: 2, slots: 2 },
  ];
  const config = [
    { name: 'Custom', priority: 3, slots: 1 }, // not in defaults
    { name: 'Beta', priority: 2, slots: 2 },
    { name: 'Alpha', priority: 1, slots: 2 },
  ];
  const result = global.DSCoreBuildings.normalizeBuildingConfig(config, defaults, 0, 20);
  // defaults-order entries come first; custom entries append after
  assert.equal(result[0].name, 'Alpha');
  assert.equal(result[1].name, 'Beta');
  assert.equal(result[2].name, 'Custom');
});

// ── normalizeBuildingPositions ──────────────────────────────────────────────

test('normalizeBuildingPositions returns empty object for null input', () => {
  loadModule();
  assert.deepEqual(global.DSCoreBuildings.normalizeBuildingPositions(null, new Set(['HQ'])), {});
  assert.deepEqual(global.DSCoreBuildings.normalizeBuildingPositions(undefined, new Set(['HQ'])), {});
});

test('normalizeBuildingPositions rounds float coordinates', () => {
  loadModule();
  const result = global.DSCoreBuildings.normalizeBuildingPositions(
    { HQ: [100.7, 200.3] },
    new Set(['HQ'])
  );
  assert.deepEqual(result.HQ, [101, 200]);
});

test('normalizeBuildingPositions accepts all names when validNames is not provided', () => {
  loadModule();
  const result = global.DSCoreBuildings.normalizeBuildingPositions(
    { Anywhere: [10, 20] },
    null
  );
  assert.deepEqual(result.Anywhere, [10, 20]);
});

test('normalizeBuildingPositions rejects coordinates with wrong array length', () => {
  loadModule();
  const result = global.DSCoreBuildings.normalizeBuildingPositions(
    { HQ: [10], Other: [10, 20, 30] },
    new Set(['HQ', 'Other'])
  );
  assert.deepEqual(result, {});
});

test('normalizeBuildingPositions rejects non-numeric coordinates', () => {
  loadModule();
  const result = global.DSCoreBuildings.normalizeBuildingPositions(
    { HQ: ['a', 'b'] },
    new Set(['HQ'])
  );
  assert.deepEqual(result, {});
});
