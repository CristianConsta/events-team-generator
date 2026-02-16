const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const actionsPath = path.resolve(__dirname, '../js/features/events-manager/events-manager-actions.js');
const controllerPath = path.resolve(__dirname, '../js/features/events-manager/events-manager-controller.js');

function reset(modulePath) {
  delete require.cache[require.resolve(modulePath)];
}

function setup() {
  global.window = global;
  delete global.DSFeatureEventsManagerActions;
  delete global.DSFeatureEventsManagerController;
  reset(actionsPath);
  reset(controllerPath);
  require(actionsPath);
  require(controllerPath);
}

test('events manager actions normalize edit intent and metadata patch', () => {
  setup();

  assert.equal(global.DSFeatureEventsManagerActions.normalizeEditIntent('save'), 'save');
  assert.equal(global.DSFeatureEventsManagerActions.normalizeEditIntent('unknown'), 'edit');

  assert.deepEqual(global.DSFeatureEventsManagerActions.buildMetadataPatch({
    name: '  Desert Storm  ',
    logoDataUrl: 'logo',
    mapDataUrl: 'map',
  }), {
    name: 'Desert Storm',
    logoDataUrl: 'logo',
    mapDataUrl: 'map',
  });
});

test('events manager controller delegates all event editor actions', () => {
  setup();

  const calls = [];
  const controller = global.DSFeatureEventsManagerController.createController({
    toggleEventsPanel() { calls.push('togglePanel'); },
    enterEditMode() { calls.push('enterEditMode'); },
    triggerLogoUpload() { calls.push('logoUpload'); },
    removeLogo() { calls.push('removeLogo'); },
    handleLogoChange() { calls.push('logoChange'); },
    triggerMapUpload() { calls.push('mapUpload'); },
    removeMap() { calls.push('removeMap'); },
    handleMapChange() { calls.push('mapChange'); },
    addBuildingRow() { calls.push('addBuildingRow'); },
    saveEvent() { calls.push('saveEvent'); },
    cancelEdit() { calls.push('cancelEdit'); },
    deleteEvent() { calls.push('deleteEvent'); },
    openCoordinatesPicker() { calls.push('coords'); },
  });

  controller.toggleEventsPanel();
  controller.enterEditMode();
  controller.triggerLogoUpload();
  controller.removeLogo();
  controller.handleLogoChange({});
  controller.triggerMapUpload();
  controller.removeMap();
  controller.handleMapChange({});
  controller.addBuildingRow();
  controller.saveEvent();
  controller.cancelEdit();
  controller.deleteEvent();
  controller.openCoordinatesPicker();

  assert.deepEqual(calls, [
    'togglePanel',
    'enterEditMode',
    'logoUpload',
    'removeLogo',
    'logoChange',
    'mapUpload',
    'removeMap',
    'mapChange',
    'addBuildingRow',
    'saveEvent',
    'cancelEdit',
    'deleteEvent',
    'coords',
  ]);
});
