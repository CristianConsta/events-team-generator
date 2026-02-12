const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const modulePath = path.resolve(__dirname, '../js/core/player-table.js');

function loadModule() {
  global.window = global;
  delete global.DSCorePlayerTable;
  delete require.cache[require.resolve(modulePath)];
  require(modulePath);
}

test('filterAndSortPlayers applies search and troops filters', () => {
  loadModule();
  const players = [
    { name: 'Alpha', power: 100, troops: 'T11' },
    { name: 'Bravo', power: 150, troops: 'T10' },
    { name: 'Alpine', power: 90, troops: 'T10' },
  ];

  const result = global.DSCorePlayerTable.filterAndSortPlayers(players, {
    searchTerm: ' al ',
    troopsFilter: 'T10',
    sortFilter: 'name-asc',
  });

  assert.deepEqual(result, [{ name: 'Alpine', power: 90, troops: 'T10' }]);
});

test('filterAndSortPlayers defaults to power-desc when sort filter is invalid', () => {
  loadModule();
  const players = [
    { name: 'Alpha', power: 100, troops: 'T11' },
    { name: 'Bravo', power: 150, troops: 'T10' },
    { name: 'Charlie', power: 120, troops: 'T10' },
  ];

  const result = global.DSCorePlayerTable.filterAndSortPlayers(players, {
    sortFilter: 'unsupported-sort',
  });

  assert.deepEqual(result.map((player) => player.name), ['Bravo', 'Charlie', 'Alpha']);
});

test('filterAndSortPlayers supports name and power ascending sorts', () => {
  loadModule();
  const players = [
    { name: 'Charlie', power: 120, troops: 'T11' },
    { name: 'Alpha', power: 100, troops: 'T10' },
    { name: 'Bravo', power: 150, troops: 'T10' },
  ];

  const byName = global.DSCorePlayerTable.filterAndSortPlayers(players, {
    sortFilter: 'name-asc',
  });
  assert.deepEqual(byName.map((player) => player.name), ['Alpha', 'Bravo', 'Charlie']);

  const byPower = global.DSCorePlayerTable.filterAndSortPlayers(players, {
    sortFilter: 'power-asc',
  });
  assert.deepEqual(byPower.map((player) => player.name), ['Alpha', 'Charlie', 'Bravo']);
});

test('filterAndSortPlayers handles non-array inputs safely', () => {
  loadModule();
  const result = global.DSCorePlayerTable.filterAndSortPlayers(null, {
    searchTerm: 'alpha',
  });
  assert.deepEqual(result, []);
});
