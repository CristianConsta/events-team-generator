const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const actionsPath = path.resolve(__dirname, '../js/features/players-management/players-management-actions.js');
const viewPath = path.resolve(__dirname, '../js/features/players-management/players-management-view.js');
const controllerPath = path.resolve(__dirname, '../js/features/players-management/players-management-controller.js');

function reset(modulePath) {
  delete require.cache[require.resolve(modulePath)];
}

function setup() {
  global.window = global;
  delete global.DSFeaturePlayersManagementActions;
  delete global.DSFeaturePlayersManagementView;
  delete global.DSFeaturePlayersManagementController;
  reset(actionsPath);
  reset(viewPath);
  reset(controllerPath);
  require(actionsPath);
  require(viewPath);
  require(controllerPath);
}

test('players management actions read add payload and filter payload', () => {
  setup();

  const payload = global.DSFeaturePlayersManagementActions.readAddPlayerPayload({
    document: {
      getElementById(id) {
        const values = {
          playersMgmtNewName: { value: 'Alpha' },
          playersMgmtNewPower: { value: '72' },
          playersMgmtNewThp: { value: '110' },
          playersMgmtNewTroops: { value: 'Tank' },
        };
        return values[id] || null;
      },
    },
  });

  assert.deepEqual(payload, {
    name: 'Alpha',
    power: '72',
    thp: '110',
    troops: 'Tank',
  });

  const filterPayload = global.DSFeaturePlayersManagementActions.toFilterChangePayload({
    target: { id: 'playersMgmtSearchFilter', value: 'abc' },
  });
  assert.deepEqual(filterPayload, { id: 'playersMgmtSearchFilter', value: 'abc' });
});

test('players management controller delegates actions and source switching', () => {
  setup();

  const calls = [];
  const controller = global.DSFeaturePlayersManagementController.createController({
    handleAddPlayer() {
      calls.push('add');
    },
    handleTableAction(event) {
      calls.push(['table', event.type]);
    },
    handleFilterChange(event) {
      calls.push(['filter', event.type]);
    },
    clearFilters() {
      calls.push('clear');
    },
    switchSource(source) {
      calls.push(['source', source]);
    },
    focusAddNameField() {
      calls.push('focus');
    },
  });

  controller.submitAddPlayer({ preventDefault() {} });
  controller.handleTableAction({ type: 'click' });
  controller.handleFilterChange({ type: 'input' });
  controller.clearFilters();
  controller.switchSource('alliance');
  assert.doesNotThrow(() => controller.focusAddNameField());

  assert.deepEqual(calls, [
    'add',
    ['table', 'click'],
    ['filter', 'input'],
    'clear',
    ['source', 'alliance'],
  ]);
});

test('players management view focuses add name input and toggles panel', () => {
  setup();

  let focused = false;
  global.DSFeaturePlayersManagementView.focusAddNameField({
    getElementById(id) {
      if (id !== 'playersMgmtNewName') {
        return null;
      }
      return {
        focus() {
          focused = true;
        },
      };
    },
  });

  assert.equal(focused, true);

  let expanded = null;
  const value = global.DSFeaturePlayersManagementView.setAddPanelExpanded({
    expanded: true,
    toggleAddPanel(next) {
      expanded = next;
    },
  });

  assert.equal(value, true);
  assert.equal(expanded, true);
});
