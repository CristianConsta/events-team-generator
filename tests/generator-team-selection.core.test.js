const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const modulePath = path.resolve(__dirname, '../js/features/generator/team-selection-core.js');

function reset() {
  delete require.cache[require.resolve(modulePath)];
}

function loadModule() {
  global.window = global;
  delete global.DSFeatureGeneratorTeamSelection;
  reset();
  require(modulePath);
}

test('team selection core counts and selection maps are derived from selections', () => {
  loadModule();
  const selections = {
    teamA: [
      { name: 'Alpha', role: 'starter' },
      { name: 'Bravo', role: 'substitute' },
    ],
    teamB: [{ name: 'Charlie', role: 'starter' }],
  };

  const counts = global.DSFeatureGeneratorTeamSelection.getCurrentTeamCounts(selections);
  assert.deepEqual(counts, {
    teamAStarterCount: 1,
    teamASubCount: 1,
    teamBStarterCount: 1,
    teamBSubCount: 0,
  });

  const maps = global.DSFeatureGeneratorTeamSelection.buildTeamSelectionMaps(selections);
  assert.equal(maps.teamA.get('Alpha').role, 'starter');
  assert.equal(maps.teamA.get('Bravo').role, 'substitute');
  assert.equal(maps.teamB.get('Charlie').role, 'starter');
});

test('toggleTeamSelection moves players across teams and supports remove-on-repeat', () => {
  loadModule();

  const first = global.DSFeatureGeneratorTeamSelection.toggleTeamSelection(
    {
      teamA: [{ name: 'Alpha', role: 'starter' }],
      teamB: [{ name: 'Bravo', role: 'starter' }],
    },
    'Bravo',
    'A',
    { maxTotal: 30, maxStarters: 20, maxSubstitutes: 10 },
  );

  assert.equal(first.changed, true);
  assert.deepEqual(first.teamB.map((player) => player.name), []);
  assert.deepEqual(first.teamA.map((player) => player.name), ['Alpha', 'Bravo']);

  const second = global.DSFeatureGeneratorTeamSelection.toggleTeamSelection(
    { teamA: first.teamA, teamB: first.teamB },
    'Bravo',
    'A',
  );

  assert.equal(second.changed, true);
  assert.deepEqual(second.teamA.map((player) => player.name), ['Alpha']);
});

test('toggleTeamSelection uses substitute role when starters are full', () => {
  loadModule();
  const starters = Array.from({ length: 20 }, (_, index) => ({
    name: `Starter-${index + 1}`,
    role: 'starter',
  }));

  const result = global.DSFeatureGeneratorTeamSelection.toggleTeamSelection(
    { teamA: starters, teamB: [] },
    'Reserve-1',
    'A',
    { maxTotal: 30, maxStarters: 20, maxSubstitutes: 10 },
  );

  assert.equal(result.changed, true);
  assert.equal(result.teamA[result.teamA.length - 1].role, 'substitute');
});

test('setPlayerRole enforces role limits and clear helpers reset state', () => {
  loadModule();

  const starters = Array.from({ length: 20 }, (_, index) => ({
    name: `Starter-${index + 1}`,
    role: 'starter',
  }));

  const noChange = global.DSFeatureGeneratorTeamSelection.setPlayerRole(
    { teamA: starters.concat([{ name: 'SubA', role: 'substitute' }]), teamB: [] },
    'SubA',
    'starter',
    { maxStarters: 20, maxSubstitutes: 10 },
  );

  assert.equal(noChange.changed, false);
  assert.equal(noChange.reason, 'starters_full');

  const clearedOne = global.DSFeatureGeneratorTeamSelection.clearPlayerSelection(
    {
      teamA: [{ name: 'Alpha', role: 'starter' }],
      teamB: [{ name: 'Alpha', role: 'starter' }, { name: 'Bravo', role: 'starter' }],
    },
    'Alpha',
  );

  assert.equal(clearedOne.changed, true);
  assert.deepEqual(clearedOne.teamA.map((player) => player.name), []);
  assert.deepEqual(clearedOne.teamB.map((player) => player.name), ['Bravo']);

  const clearedAll = global.DSFeatureGeneratorTeamSelection.clearAllSelections();
  assert.deepEqual(clearedAll, { changed: true, teamA: [], teamB: [] });
});
