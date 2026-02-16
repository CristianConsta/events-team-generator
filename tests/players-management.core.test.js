const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const modulePath = path.resolve(__dirname, '../js/features/players-management/players-management-core.js');

function reset() {
  delete require.cache[require.resolve(modulePath)];
}

function loadModule() {
  global.window = global;
  delete global.DSFeaturePlayersManagementCore;
  reset();
  require(modulePath);
}

test('players management core normalizes player records and database rows', () => {
  loadModule();

  const normalized = global.DSFeaturePlayersManagementCore.normalizePlayerRecordForUi('Alice', {
    power: '72.5',
    thp: '180',
    troops: ' Tank ',
  });

  assert.deepEqual(normalized, {
    name: 'Alice',
    power: 72.5,
    thp: 180,
    troops: 'Tank',
  });

  const fallback = global.DSFeaturePlayersManagementCore.normalizePlayerRecordForUi('Bob', {
    power: 'not-a-number',
    thp: null,
    troops: '   ',
  });

  assert.deepEqual(fallback, {
    name: 'Bob',
    power: 0,
    thp: 0,
    troops: 'Unknown',
  });

  const rows = global.DSFeaturePlayersManagementCore.buildRowsFromDatabase({
    Alice: { power: 10, thp: 5, troops: 'Aero' },
    Bob: { power: 8, thp: 4, troops: 'Tank' },
  });

  assert.deepEqual(rows.map((row) => row.name), ['Alice', 'Bob']);
});

test('players management core normalizes filter state and active status', () => {
  loadModule();

  const normalized = global.DSFeaturePlayersManagementCore.normalizeFilterState({
    searchTerm: '  test ',
    troopsFilter: ' Tank ',
    sortFilter: 'invalid-sort',
  });

  assert.deepEqual(normalized, {
    searchTerm: 'test',
    troopsFilter: 'Tank',
    sortFilter: 'power-desc',
  });

  assert.equal(global.DSFeaturePlayersManagementCore.hasActiveFilters(normalized), true);
  assert.equal(
    global.DSFeaturePlayersManagementCore.hasActiveFilters({
      searchTerm: '',
      troopsFilter: '',
      sortFilter: 'power-desc',
    }),
    false,
  );
});

test('players management core applies filters and sorting deterministically', () => {
  loadModule();
  const rows = [
    { name: 'Zed', power: 20, troops: 'Tank', thp: 100 },
    { name: 'Adam', power: 20, troops: 'Aero', thp: 90 },
    { name: 'Bella', power: 10, troops: 'Tank', thp: 80 },
  ];

  const byPowerDesc = global.DSFeaturePlayersManagementCore.applyFilters(rows, {
    searchTerm: '',
    troopsFilter: '',
    sortFilter: 'power-desc',
  });
  assert.deepEqual(byPowerDesc.map((row) => row.name), ['Adam', 'Zed', 'Bella']);

  const byPowerAsc = global.DSFeaturePlayersManagementCore.applyFilters(rows, {
    searchTerm: '',
    troopsFilter: '',
    sortFilter: 'power-asc',
  });
  assert.deepEqual(byPowerAsc.map((row) => row.name), ['Bella', 'Adam', 'Zed']);

  const tankSearch = global.DSFeaturePlayersManagementCore.applyFilters(rows, {
    searchTerm: 'e',
    troopsFilter: 'Tank',
    sortFilter: 'name-asc',
  });
  assert.deepEqual(tankSearch.map((row) => row.name), ['Bella', 'Zed']);
});
