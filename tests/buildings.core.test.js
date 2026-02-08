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
    { name: 'A', priority: 1, slots: 20 },
    { name: 'B', priority: 6, slots: 0 },
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
