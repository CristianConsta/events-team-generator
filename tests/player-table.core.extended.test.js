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

const PLAYERS = [
  { name: 'Alice', power: 300, troops: 'Tank' },
  { name: 'Bob',   power: 100, troops: 'Aero' },
  { name: 'Carol', power: 200, troops: 'Missile' },
  { name: 'Dave',  power: 150, troops: 'Tank' },
  { name: 'Eve',   power: 250, troops: 'Aero' },
];

// ── Sorting ─────────────────────────────────────────────────────────────────

test('filterAndSortPlayers sorts by name-desc correctly', () => {
  loadModule();
  const result = global.DSCorePlayerTable.filterAndSortPlayers(PLAYERS, { sortFilter: 'name-desc' });
  assert.deepEqual(result.map((p) => p.name), ['Eve', 'Dave', 'Carol', 'Bob', 'Alice']);
});

test('filterAndSortPlayers sorts by power-asc correctly', () => {
  loadModule();
  const result = global.DSCorePlayerTable.filterAndSortPlayers(PLAYERS, { sortFilter: 'power-asc' });
  assert.deepEqual(result.map((p) => p.power), [100, 150, 200, 250, 300]);
});

test('filterAndSortPlayers sorts by power-desc (default) correctly', () => {
  loadModule();
  const result = global.DSCorePlayerTable.filterAndSortPlayers(PLAYERS, { sortFilter: 'power-desc' });
  assert.deepEqual(result.map((p) => p.power), [300, 250, 200, 150, 100]);
});

test('filterAndSortPlayers sorts by name-asc correctly', () => {
  loadModule();
  const result = global.DSCorePlayerTable.filterAndSortPlayers(PLAYERS, { sortFilter: 'name-asc' });
  assert.deepEqual(result.map((p) => p.name), ['Alice', 'Bob', 'Carol', 'Dave', 'Eve']);
});

test('filterAndSortPlayers defaults to power-desc for empty string sort filter', () => {
  loadModule();
  const result = global.DSCorePlayerTable.filterAndSortPlayers(PLAYERS, { sortFilter: '' });
  assert.equal(result[0].power, 300);
});

// ── Search filter ───────────────────────────────────────────────────────────

test('filterAndSortPlayers search is case-insensitive', () => {
  loadModule();
  const result = global.DSCorePlayerTable.filterAndSortPlayers(PLAYERS, { searchTerm: 'ALICE' });
  assert.equal(result.length, 1);
  assert.equal(result[0].name, 'Alice');
});

test('filterAndSortPlayers search trims leading/trailing whitespace', () => {
  loadModule();
  const result = global.DSCorePlayerTable.filterAndSortPlayers(PLAYERS, { searchTerm: '  bob  ' });
  assert.equal(result.length, 1);
  assert.equal(result[0].name, 'Bob');
});

test('filterAndSortPlayers empty search term returns all players', () => {
  loadModule();
  const result = global.DSCorePlayerTable.filterAndSortPlayers(PLAYERS, { searchTerm: '' });
  assert.equal(result.length, PLAYERS.length);
});

test('filterAndSortPlayers search with no match returns empty array', () => {
  loadModule();
  const result = global.DSCorePlayerTable.filterAndSortPlayers(PLAYERS, { searchTerm: 'xyz' });
  assert.deepEqual(result, []);
});

test('filterAndSortPlayers search is substring match', () => {
  loadModule();
  const result = global.DSCorePlayerTable.filterAndSortPlayers(PLAYERS, { searchTerm: 'a' });
  // Alice, Carol, Dave all contain 'a'
  const names = result.map((p) => p.name);
  assert.ok(names.includes('Alice'));
  assert.ok(names.includes('Carol'));
  assert.ok(names.includes('Dave'));
  assert.ok(!names.includes('Bob'));
});

// ── Troops filter ───────────────────────────────────────────────────────────

test('filterAndSortPlayers troops filter is case-sensitive exact match', () => {
  loadModule();
  const result = global.DSCorePlayerTable.filterAndSortPlayers(PLAYERS, { troopsFilter: 'Tank' });
  assert.ok(result.every((p) => p.troops === 'Tank'));
  assert.equal(result.length, 2); // Alice and Dave
});

test('filterAndSortPlayers empty troops filter returns all players', () => {
  loadModule();
  const result = global.DSCorePlayerTable.filterAndSortPlayers(PLAYERS, { troopsFilter: '' });
  assert.equal(result.length, PLAYERS.length);
});

test('filterAndSortPlayers troops filter with no match returns empty array', () => {
  loadModule();
  const result = global.DSCorePlayerTable.filterAndSortPlayers(PLAYERS, { troopsFilter: 'Cavalry' });
  assert.deepEqual(result, []);
});

// ── Combined filters ────────────────────────────────────────────────────────

test('filterAndSortPlayers combines search and troops filter', () => {
  loadModule();
  const result = global.DSCorePlayerTable.filterAndSortPlayers(PLAYERS, {
    searchTerm: 'a',
    troopsFilter: 'Tank',
  });
  // 'Alice' (Tank, contains 'a') and 'Dave' (Tank, contains 'a')
  assert.equal(result.length, 2);
  const names = result.map((p) => p.name);
  assert.ok(names.includes('Alice'));
  assert.ok(names.includes('Dave'));
});

test('filterAndSortPlayers applies all three options simultaneously', () => {
  loadModule();
  const result = global.DSCorePlayerTable.filterAndSortPlayers(PLAYERS, {
    searchTerm: 'a',
    troopsFilter: 'Tank',
    sortFilter: 'name-desc',
  });
  assert.equal(result.length, 2);
  assert.equal(result[0].name, 'Dave'); // 'D' > 'A' in desc order
  assert.equal(result[1].name, 'Alice');
});

// ── Edge cases ───────────────────────────────────────────────────────────────

test('filterAndSortPlayers handles undefined options gracefully', () => {
  loadModule();
  const result = global.DSCorePlayerTable.filterAndSortPlayers(PLAYERS, undefined);
  assert.equal(result.length, PLAYERS.length);
});

test('filterAndSortPlayers handles null options gracefully', () => {
  loadModule();
  const result = global.DSCorePlayerTable.filterAndSortPlayers(PLAYERS, null);
  assert.equal(result.length, PLAYERS.length);
});

test('filterAndSortPlayers handles players with missing name gracefully', () => {
  loadModule();
  const players = [
    { name: undefined, power: 100, troops: 'Tank' },
    { name: null, power: 200, troops: 'Aero' },
    { name: 'Alice', power: 300, troops: 'Tank' },
  ];
  const result = global.DSCorePlayerTable.filterAndSortPlayers(players, { searchTerm: 'alice' });
  assert.equal(result.length, 1);
  assert.equal(result[0].name, 'Alice');
});

test('filterAndSortPlayers handles players with missing troops gracefully', () => {
  loadModule();
  const players = [
    { name: 'Alice', power: 100, troops: undefined },
    { name: 'Bob', power: 200, troops: 'Tank' },
  ];
  const result = global.DSCorePlayerTable.filterAndSortPlayers(players, { troopsFilter: 'Tank' });
  assert.equal(result.length, 1);
  assert.equal(result[0].name, 'Bob');
});

test('filterAndSortPlayers does not mutate the original array', () => {
  loadModule();
  const original = [...PLAYERS];
  global.DSCorePlayerTable.filterAndSortPlayers(PLAYERS, { sortFilter: 'name-asc' });
  assert.deepEqual(PLAYERS, original);
});

test('filterAndSortPlayers returns empty array for empty player list', () => {
  loadModule();
  const result = global.DSCorePlayerTable.filterAndSortPlayers([], { searchTerm: 'alice' });
  assert.deepEqual(result, []);
});

test('filterAndSortPlayers handles single-element array', () => {
  loadModule();
  const result = global.DSCorePlayerTable.filterAndSortPlayers(
    [{ name: 'Solo', power: 999, troops: 'Tank' }],
    { sortFilter: 'power-asc' }
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].name, 'Solo');
});
