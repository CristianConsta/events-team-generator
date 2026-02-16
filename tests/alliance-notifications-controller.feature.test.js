const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const allianceControllerPath = path.resolve(__dirname, '../js/features/alliance/alliance-controller.js');
const notificationsControllerPath = path.resolve(__dirname, '../js/features/notifications/notifications-controller.js');

function reset(modulePath) {
  delete require.cache[require.resolve(modulePath)];
}

function setup() {
  global.window = global;
  delete global.DSFeatureAllianceController;
  delete global.DSFeatureNotificationsController;
  reset(allianceControllerPath);
  reset(notificationsControllerPath);
  require(allianceControllerPath);
  require(notificationsControllerPath);
}

test('alliance controller delegates alliance panel actions', () => {
  setup();

  const calls = [];
  const controller = global.DSFeatureAllianceController.createController({
    renderPanel() { calls.push('renderPanel'); },
    createAlliance() { calls.push('createAlliance'); },
    sendInvitation() { calls.push('sendInvitation'); },
    leaveAlliance() { calls.push('leaveAlliance'); },
    acceptInvitation(id) { calls.push(['accept', id]); },
    rejectInvitation(id) { calls.push(['reject', id]); },
    resendInvitation(id) { calls.push(['resend', id]); },
    revokeInvitation(id) { calls.push(['revoke', id]); },
    openPanel() { calls.push('openPanel'); },
    closePanel() { calls.push('closePanel'); },
  });

  controller.renderPanel();
  controller.createAlliance();
  controller.sendInvitation();
  controller.leaveAlliance();
  controller.acceptInvitation('a1');
  controller.rejectInvitation('a2');
  controller.resendInvitation('a3');
  controller.revokeInvitation('a4');
  controller.openPanel();
  controller.closePanel();

  assert.deepEqual(calls, [
    'renderPanel',
    'createAlliance',
    'sendInvitation',
    'leaveAlliance',
    ['accept', 'a1'],
    ['reject', 'a2'],
    ['resend', 'a3'],
    ['revoke', 'a4'],
    'openPanel',
    'closePanel',
  ]);
});

test('notifications controller delegates panel and polling operations', async () => {
  setup();

  const calls = [];
  const controller = global.DSFeatureNotificationsController.createController({
    checkAndDisplay() { calls.push('check'); return Promise.resolve(); },
    render() { calls.push('render'); },
    togglePanel() { calls.push('toggle'); return Promise.resolve(); },
    closePanel() { calls.push('close'); },
    startPolling() { calls.push('start'); },
    stopPolling() { calls.push('stop'); },
    openAllianceInvite(id) { calls.push(['openInvite', id]); },
  });

  await controller.checkAndDisplay();
  controller.render();
  await controller.togglePanel();
  controller.closePanel();
  controller.startPolling();
  controller.stopPolling();
  controller.openAllianceInvite('invite-1');

  assert.deepEqual(calls, ['check', 'render', 'toggle', 'close', 'start', 'stop', ['openInvite', 'invite-1']]);
});
