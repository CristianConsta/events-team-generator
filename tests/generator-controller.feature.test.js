const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const actionsPath = path.resolve(__dirname, '../js/features/generator/generator-actions.js');
const viewPath = path.resolve(__dirname, '../js/features/generator/generator-view.js');
const controllerPath = path.resolve(__dirname, '../js/features/generator/generator-controller.js');

function reset(modulePath) {
  delete require.cache[require.resolve(modulePath)];
}

function setupWindow() {
  global.window = global;
  delete global.DSFeatureGeneratorActions;
  delete global.DSFeatureGeneratorView;
  delete global.DSFeatureGeneratorController;
  reset(actionsPath);
  reset(viewPath);
  reset(controllerPath);
  require(actionsPath);
  require(viewPath);
  require(controllerPath);
}

test('generator actions normalize algorithm and role limits', () => {
  setupWindow();

  assert.equal(
    global.DSFeatureGeneratorActions.normalizeAssignmentSelection('aggressive', null, 'balanced'),
    'aggressive',
  );
  assert.equal(
    global.DSFeatureGeneratorActions.normalizeAssignmentSelection('unknown', null, 'balanced'),
    'balanced',
  );

  assert.deepEqual(global.DSFeatureGeneratorActions.buildRoleLimits({ maxTotal: 40 }), {
    maxTotal: 40,
    maxStarters: 20,
    maxSubstitutes: 10,
  });
});

test('generator controller delegates interactions to provided dependencies', () => {
  setupWindow();

  const calls = [];
  const fakeDocument = {
    querySelectorAll() {
      return [];
    },
    getElementById() {
      return { value: '' };
    },
  };

  const controller = global.DSFeatureGeneratorController.createController({
    document: fakeDocument,
    defaultAlgorithm: 'balanced',
    normalizeAssignmentAlgorithm(value) {
      return value === 'aggressive' ? 'aggressive' : 'balanced';
    },
    setAssignmentAlgorithm(value) {
      calls.push(['setAssignmentAlgorithm', value]);
    },
    syncAssignmentAlgorithmControl() {
      calls.push(['syncAssignmentAlgorithmControl']);
    },
    toggleTeamSelection(name, team) {
      calls.push(['toggleTeamSelection', name, team]);
    },
    setPlayerRole(name, role) {
      calls.push(['setPlayerRole', name, role]);
    },
    clearPlayerSelection(name) {
      calls.push(['clearPlayerSelection', name]);
    },
    clearAllSelections() {
      calls.push(['clearAllSelections']);
    },
    generateAssignments(team) {
      calls.push(['generateAssignments', team]);
    },
    roleLimits: { maxTotal: 30, maxStarters: 20, maxSubstitutes: 10 },
  });

  controller.changeAlgorithm({ target: { value: 'aggressive', type: 'radio', checked: true } });
  controller.toggleTeamSelection('Alice', 'A');
  controller.setPlayerRole('Alice', 'starter');
  controller.clearPlayerSelection('Alice');
  controller.clearAllSelections();
  controller.generateAssignments('B');

  assert.deepEqual(calls, [
    ['setAssignmentAlgorithm', 'aggressive'],
    ['toggleTeamSelection', 'Alice', 'A'],
    ['setPlayerRole', 'Alice', 'starter'],
    ['clearPlayerSelection', 'Alice'],
    ['clearAllSelections'],
    ['generateAssignments', 'B'],
  ]);
});

test('generator view syncs algorithm value to select fallback', () => {
  setupWindow();

  const select = { value: '' };
  global.DSFeatureGeneratorView.syncAssignmentAlgorithmControl({
    document: {
      querySelectorAll() {
        return [];
      },
      getElementById(id) {
        return id === 'assignmentAlgorithmSelect' ? select : null;
      },
    },
    value: 'aggressive',
  });

  assert.equal(select.value, 'aggressive');
});
