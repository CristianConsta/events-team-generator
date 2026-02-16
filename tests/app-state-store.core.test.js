const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const modulePath = path.resolve(__dirname, '../js/shared/state/app-state-store.js');

function reset() {
  delete require.cache[require.resolve(modulePath)];
}

function loadModule() {
  global.window = global;
  delete global.DSAppStateStore;
  reset();
  require(modulePath);
}

test('app state store creates default state and supports subscribers', () => {
  loadModule();

  const store = global.DSAppStateStore.createDefaultStore();
  const initial = store.getState();
  assert.equal(initial.navigation.currentView, 'generator');
  assert.equal(initial.generator.assignmentAlgorithm, 'balanced');

  let notifications = 0;
  const unsubscribe = store.subscribe(() => {
    notifications += 1;
  });

  store.setState({ navigation: { currentView: 'players' } });
  const next = store.getState();
  assert.equal(next.navigation.currentView, 'players');
  assert.equal(notifications, 1);

  unsubscribe();
  store.setState({ navigation: { currentView: 'support' } });
  assert.equal(notifications, 1);
});

test('app state store merges slices and clones arrays safely', () => {
  loadModule();

  const merged = global.DSAppStateStore.mergeState(
    {
      generator: {
        assignmentAlgorithm: 'balanced',
        teamSelections: { teamA: [{ name: 'A', role: 'starter' }], teamB: [] },
      },
    },
    {
      generator: {
        teamSelections: { teamA: [{ name: 'B', role: 'substitute' }], teamB: [] },
      },
    },
  );

  assert.equal(merged.generator.assignmentAlgorithm, 'balanced');
  assert.deepEqual(merged.generator.teamSelections.teamA.map((item) => item.name), ['B']);
});

test('app state selectors derive navigation, generator and players filters', () => {
  loadModule();

  const state = {
    navigation: { currentView: 'alliance' },
    generator: {
      assignmentAlgorithm: 'aggressive',
      teamSelections: {
        teamA: [
          { name: 'Alpha', role: 'starter' },
          { name: 'Bravo', role: 'substitute' },
        ],
        teamB: [{ name: 'Charlie', role: 'starter' }],
      },
    },
    playersManagement: {
      filters: {
        searchTerm: '  ab ',
        troopsFilter: ' Tank ',
        sortFilter: 'name-asc',
      },
    },
  };

  assert.equal(global.DSAppStateStore.selectors.selectNavigationView(state), 'alliance');
  assert.equal(global.DSAppStateStore.selectors.selectAssignmentAlgorithm(state), 'aggressive');

  const counts = global.DSAppStateStore.selectors.selectTeamCounts(state);
  assert.deepEqual(counts, {
    teamAStarterCount: 1,
    teamASubCount: 1,
    teamBStarterCount: 1,
    teamBSubCount: 0,
  });

  const filters = global.DSAppStateStore.selectors.selectPlayersManagementFilters(state);
  assert.deepEqual(filters, {
    searchTerm: 'ab',
    troopsFilter: 'Tank',
    sortFilter: 'name-asc',
  });
});
