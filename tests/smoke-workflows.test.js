const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const appInitPath = path.resolve(__dirname, './app-init.integration.test.js');
const generatorControllerPath = path.resolve(__dirname, '../js/features/generator/generator-controller.js');
const playersControllerPath = path.resolve(__dirname, '../js/features/players-management/players-management-controller.js');
const eventsCorePath = path.resolve(__dirname, '../js/core/events.js');
const eventsControllerPath = path.resolve(__dirname, '../js/features/events-manager/events-manager-controller.js');
const allianceControllerPath = path.resolve(__dirname, '../js/features/alliance/alliance-controller.js');

function reset(modulePath) {
  delete require.cache[require.resolve(modulePath)];
}

test('smoke: login initialization suite is loadable', () => {
  assert.equal(typeof require, 'function');
  assert.equal(require.resolve(appInitPath).length > 0, true);
});

test('smoke: generator flow controller can trigger generate operation', () => {
  global.window = global;
  delete global.DSFeatureGeneratorController;
  reset(generatorControllerPath);
  require(generatorControllerPath);

  let generatedTeam = null;
  const controller = global.DSFeatureGeneratorController.createController({
    generateAssignments(team) {
      generatedTeam = team;
    },
  });

  controller.generateAssignments('A');
  assert.equal(generatedTeam, 'A');
});

test('smoke: players CRUD entrypoints are controller-addressable', () => {
  global.window = global;
  delete global.DSFeaturePlayersManagementController;
  reset(playersControllerPath);
  require(playersControllerPath);

  const calls = [];
  const controller = global.DSFeaturePlayersManagementController.createController({
    handleAddPlayer() { calls.push('add'); },
    handleTableAction() { calls.push('tableAction'); },
  });

  controller.submitAddPlayer({ preventDefault() {} });
  controller.handleTableAction({});
  assert.deepEqual(calls, ['add', 'tableAction']);
});

test('smoke: events CRUD can upsert/remove and controller save/delete routes', () => {
  global.window = global;
  delete global.DSCoreEvents;
  delete global.DSFeatureEventsManagerController;
  reset(eventsCorePath);
  reset(eventsControllerPath);
  require(eventsCorePath);
  require(eventsControllerPath);

  const id = 'smoke_event';
  const upserted = global.DSCoreEvents.upsertEvent(id, {
    id,
    name: 'Smoke Event',
    buildings: [{ name: 'HQ', slots: 2, priority: 1 }],
  });
  assert.equal(upserted.id, id);
  assert.equal(global.DSCoreEvents.removeEvent(id), true);

  const calls = [];
  const controller = global.DSFeatureEventsManagerController.createController({
    saveEvent() { calls.push('save'); },
    deleteEvent() { calls.push('delete'); },
  });
  controller.saveEvent();
  controller.deleteEvent();
  assert.deepEqual(calls, ['save', 'delete']);
});

test('smoke: alliance invites controller routes accept/reject handlers', () => {
  global.window = global;
  delete global.DSFeatureAllianceController;
  reset(allianceControllerPath);
  require(allianceControllerPath);

  const calls = [];
  const controller = global.DSFeatureAllianceController.createController({
    acceptInvitation(invitationId) { calls.push(['accept', invitationId]); },
    rejectInvitation(invitationId) { calls.push(['reject', invitationId]); },
  });

  controller.acceptInvitation('invite-smoke-1');
  controller.rejectInvitation('invite-smoke-2');
  assert.deepEqual(calls, [
    ['accept', 'invite-smoke-1'],
    ['reject', 'invite-smoke-2'],
  ]);
});
