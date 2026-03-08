const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const assignmentCorePath = path.resolve(__dirname, '../js/core/assignment.js');
const generatorAssignmentPath = path.resolve(__dirname, '../js/core/generator-assignment.js');

function reset(modulePath) {
  delete require.cache[require.resolve(modulePath)];
}

function loadModule(options = {}) {
  const withAssignmentCore = options.withAssignmentCore !== false;
  global.window = global;
  delete global.DSCoreAssignment;
  delete global.DSCoreGeneratorAssignment;
  reset(generatorAssignmentPath);
  if (withAssignmentCore) {
    reset(assignmentCorePath);
    require(assignmentCorePath);
  }
  require(generatorAssignmentPath);
}

test('normalizeAssignmentAlgorithm keeps balanced default and accepts aggressive', () => {
  loadModule();
  assert.equal(global.DSCoreGeneratorAssignment.normalizeAssignmentAlgorithm('balanced'), 'balanced');
  assert.equal(global.DSCoreGeneratorAssignment.normalizeAssignmentAlgorithm('aggressive'), 'aggressive');
  assert.equal(global.DSCoreGeneratorAssignment.normalizeAssignmentAlgorithm('unknown'), 'balanced');
  assert.equal(global.DSCoreGeneratorAssignment.normalizeAssignmentAlgorithm(''), 'balanced');
});

test('mapSelectionsToPlayers returns starters/substitutes and skips unknown players', () => {
  loadModule();
  const selections = [
    { name: 'StarterOne', role: 'starter' },
    { name: 'SubOne', role: 'substitute' },
    { name: 'Missing', role: 'starter' },
  ];
  const db = {
    StarterOne: { power: 100, troops: 'Tank', thp: 50 },
    SubOne: { power: 90, troops: 'Aero', thp: 30 },
  };

  const mapped = global.DSCoreGeneratorAssignment.mapSelectionsToPlayers(selections, db);
  assert.deepEqual(mapped.starters.map((x) => x.name), ['StarterOne']);
  assert.deepEqual(mapped.substitutes.map((x) => x.name), ['SubOne']);
  assert.equal(mapped.starters[0].power, 100);
  assert.equal(mapped.substitutes[0].thp, 30);
});

test('preparePlayersForAssignment sorts by power and THP fallback without assignment core', () => {
  loadModule({ withAssignmentCore: false });
  const selections = [
    { name: 'PowerLowThpHigh', role: 'starter' },
    { name: 'PowerHighThpLow', role: 'starter' },
    { name: 'SubA', role: 'substitute' },
    { name: 'SubB', role: 'substitute' },
  ];
  const db = {
    PowerLowThpHigh: { power: 20100000, troops: 'Tank', thp: 600 },
    PowerHighThpLow: { power: 20900000, troops: 'Aero', thp: 120 },
    SubA: { power: 100, troops: 'Tank', thp: 1 },
    SubB: { power: 120, troops: 'Missile', thp: 0 },
  };

  const prepared = global.DSCoreGeneratorAssignment.preparePlayersForAssignment(selections, db);
  assert.deepEqual(prepared.starters.map((x) => x.name), ['PowerLowThpHigh', 'PowerHighThpLow']);
  assert.deepEqual(prepared.substitutes.map((x) => x.name), ['SubA', 'SubB']);
});

test('assignSubstitutesToStarters gives each reserve up to two nearby starters by rank', () => {
  loadModule();
  const starters = [
    { name: 'Starter1', power: 400, thp: 40, troops: 'Tank' },
    { name: 'Starter2', power: 390, thp: 39, troops: 'Aero' },
    { name: 'Starter3', power: 300, thp: 30, troops: 'Missile' },
    { name: 'Starter4', power: 290, thp: 29, troops: 'Tank' },
  ];
  const substitutes = [
    { name: 'ReserveHigh', power: 395, thp: 35, troops: 'Tank' },
    { name: 'ReserveLow', power: 295, thp: 25, troops: 'Aero' },
  ];

  const assigned = global.DSCoreGeneratorAssignment.assignSubstitutesToStarters(starters, substitutes);

  assert.deepEqual(assigned.map((x) => x.name), ['ReserveHigh', 'ReserveLow']);
  assert.deepEqual(assigned[0].replacementStarterNames, ['Starter1', 'Starter2']);
  assert.deepEqual(assigned[1].replacementStarterNames, ['Starter3', 'Starter4']);
  assert.equal(assigned[0].replacementStarterSummary, 'Starter1, Starter2');
});
