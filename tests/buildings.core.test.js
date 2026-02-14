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

test('normalizeBuildingConfig clamps values and preserves default order', () => {
  loadModule();
  const defaults = [
    { name: 'A', priority: 2, slots: 2 },
    { name: 'B', priority: 4, slots: 1 },
  ];
  const stored = [
    { name: 'B', priority: 99, slots: -10 },
    { name: 'A', priority: 0, slots: 99 },
  ];

  const normalized = global.DSCoreBuildings.normalizeBuildingConfig(stored, defaults, 0, 20);
  assert.deepEqual(normalized, [
    { name: 'A', label: 'A', priority: 1, slots: 20, showOnMap: true },
    { name: 'B', label: 'B', priority: 6, slots: 0, showOnMap: true },
  ]);
});

test('normalizeBuildingConfig keeps custom labels when present', () => {
  loadModule();
  const defaults = [
    { name: 'Bomb Squad', priority: 1, slots: 4 },
  ];
  const stored = [
    { name: 'Bomb Squad', label: 'Alpha Team', priority: 1, slots: 4 },
  ];

  const normalized = global.DSCoreBuildings.normalizeBuildingConfig(stored, defaults, 0, 20);
  assert.deepEqual(normalized, [
    { name: 'Bomb Squad', label: 'Alpha Team', priority: 1, slots: 4, showOnMap: true },
  ]);
});

test('normalizeBuildingConfig preserves default label when stored label is missing', () => {
  loadModule();
  const defaults = [
    { name: 'Command Center', label: 'HQ North', priority: 3, slots: 2 },
  ];
  const stored = [
    { name: 'Command Center', priority: 3, slots: 2 },
  ];

  const normalized = global.DSCoreBuildings.normalizeBuildingConfig(stored, defaults, 0, 20);
  assert.deepEqual(normalized, [
    { name: 'Command Center', label: 'HQ North', priority: 3, slots: 2, showOnMap: true },
  ]);
});

test('normalizeBuildingConfig preserves custom building names not present in defaults', () => {
  loadModule();
  const defaults = [
    { name: 'Missile Silo 1', priority: 2, slots: 2 },
    { name: 'Missile Silo 2', priority: 2, slots: 2 },
  ];
  const stored = [
    { name: 'Data Center 1', priority: 4, slots: 1 },
    { name: 'Virus Lab', priority: 1, slots: 4 },
  ];

  const normalized = global.DSCoreBuildings.normalizeBuildingConfig(stored, defaults, 0, 20);
  assert.deepEqual(normalized, [
    { name: 'Data Center 1', label: 'Data Center 1', priority: 4, slots: 1, showOnMap: true },
    { name: 'Virus Lab', label: 'Virus Lab', priority: 1, slots: 4, showOnMap: true },
  ]);
});

test('normalizeBuildingConfig respects stored showOnMap flag', () => {
  loadModule();
  const defaults = [
    { name: 'Bomb Squad', priority: 1, slots: 4, showOnMap: true },
  ];
  const stored = [
    { name: 'Bomb Squad', priority: 1, slots: 4, showOnMap: false },
  ];

  const normalized = global.DSCoreBuildings.normalizeBuildingConfig(stored, defaults, 0, 20);
  assert.deepEqual(normalized, [
    { name: 'Bomb Squad', label: 'Bomb Squad', priority: 1, slots: 4, showOnMap: false },
  ]);
});

test('normalizeBuildingPositions keeps only valid names and numeric pairs', () => {
  loadModule();
  const positions = {
    Good: [10.2, 20.9],
    BadShape: [1],
    BadType: ['x', 1],
    Unknown: [50, 50],
  };
  const validNames = new Set(['Good', 'BadShape', 'BadType']);

  const normalized = global.DSCoreBuildings.normalizeBuildingPositions(positions, validNames);
  assert.deepEqual(normalized, { Good: [10, 21] });
});

test('getBuildingSlotsTotal sums finite slot values only', () => {
  loadModule();
  const total = global.DSCoreBuildings.getBuildingSlotsTotal([
    { slots: 2 },
    { slots: '3' },
    { slots: Infinity },
    {},
  ]);
  assert.equal(total, 5);
});

test('clamp helpers handle invalid input and bounds', () => {
  loadModule();
  assert.equal(global.DSCoreBuildings.clampPriority('x', 4), 4);
  assert.equal(global.DSCoreBuildings.clampPriority(9.9, 1), 6);
  assert.equal(global.DSCoreBuildings.clampPriority(0.2, 1), 1);

  assert.equal(global.DSCoreBuildings.clampSlots('x', 3, 0, 20), 3);
  assert.equal(global.DSCoreBuildings.clampSlots(33.7, 0, 0, 20), 20);
  assert.equal(global.DSCoreBuildings.clampSlots(-5, 0, 0, 20), 0);
});

test('normalizeBuildingConfig handles invalid defaults/config and fallback-to-default behavior', () => {
  loadModule();
  assert.deepEqual(global.DSCoreBuildings.normalizeBuildingConfig([], null, 0, 20), []);
  assert.equal(global.DSCoreBuildings.getBuildingSlotsTotal(null), 0);

  const defaults = [
    null,
    { name: '', priority: 2, slots: 2 },
    { name: 'A', label: 'Alpha', priority: 2, slots: 2, showOnMap: false },
  ];
  const fromNonArrayConfig = global.DSCoreBuildings.normalizeBuildingConfig(null, defaults, 0, 20);
  assert.deepEqual(fromNonArrayConfig, [
    { name: 'A', label: 'Alpha', priority: 2, slots: 2, showOnMap: false },
  ]);

  const fallbackToDefaults = global.DSCoreBuildings.normalizeBuildingConfig(
    [{ name: '   ' }],
    [{ name: 'HQ', priority: 1, slots: 4 }],
    0,
    20
  );
  assert.deepEqual(fallbackToDefaults, [
    { name: 'HQ', label: 'HQ', priority: 1, slots: 4, showOnMap: true },
  ]);
});

test('normalizeBuildingPositions supports missing validNames set and invalid payloads', () => {
  loadModule();
  assert.deepEqual(global.DSCoreBuildings.normalizeBuildingPositions(null), {});
  assert.deepEqual(global.DSCoreBuildings.normalizeBuildingPositions('x'), {});

  const normalized = global.DSCoreBuildings.normalizeBuildingPositions({
    HQ: [10.4, 20.6],
    Bad: [5],
  });
  assert.deepEqual(normalized, { HQ: [10, 21] });
});
