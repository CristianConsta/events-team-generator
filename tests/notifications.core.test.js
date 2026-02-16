const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const modulePath = path.resolve(__dirname, '../js/features/notifications/notifications-core.js');

function reset() {
  delete require.cache[require.resolve(modulePath)];
}

function loadModule() {
  global.window = global;
  delete global.DSFeatureNotificationsCore;
  reset();
  require(modulePath);
}

test('notifications core resolves invitation sender display and createdAt formatting', () => {
  loadModule();

  assert.equal(
    global.DSFeatureNotificationsCore.getInvitationSenderDisplay({ inviterName: '  Commander  ', inviterEmail: 'c@example.com' }),
    'Commander',
  );
  assert.equal(
    global.DSFeatureNotificationsCore.getInvitationSenderDisplay({ inviterName: '', inviterEmail: '  c@example.com  ' }),
    'c@example.com',
  );
  assert.equal(global.DSFeatureNotificationsCore.getInvitationSenderDisplay(null), '');

  const fromDate = global.DSFeatureNotificationsCore.formatInvitationCreatedAt(new Date('2026-02-16T10:00:00Z'));
  assert.equal(typeof fromDate, 'string');
  assert.equal(fromDate.length > 0, true);

  const fromToDate = global.DSFeatureNotificationsCore.formatInvitationCreatedAt({
    toDate() {
      return new Date('2026-02-15T10:00:00Z');
    },
  });
  assert.equal(typeof fromToDate, 'string');
  assert.equal(fromToDate.length > 0, true);
});

test('notifications core normalizes notification items from service or pending invites', () => {
  loadModule();

  const directItems = [{ id: 'n1', notificationType: 'invite_reminder_day1' }];
  const fromService = global.DSFeatureNotificationsCore.normalizeNotificationItems({
    invitationNotifications: directItems,
    pendingInvitations: [{ id: 'p1' }],
  });
  assert.deepEqual(fromService, directItems);

  const fromPending = global.DSFeatureNotificationsCore.normalizeNotificationItems({
    invitationNotifications: null,
    pendingInvitations: [{ id: 'abc', allianceId: 'a1', allianceName: 'A', inviterEmail: 'x@y.com' }],
  });
  assert.deepEqual(fromPending, [
    {
      id: 'invite:abc',
      invitationId: 'abc',
      notificationType: 'invitation_pending',
      allianceId: 'a1',
      allianceName: 'A',
      inviterEmail: 'x@y.com',
      inviterName: '',
      createdAt: null,
    },
  ]);
});

test('notifications core computes badge state and notification detail text', () => {
  loadModule();

  assert.deepEqual(global.DSFeatureNotificationsCore.getNotificationBadgeState([]), {
    count: 0,
    hasNotifications: false,
  });
  assert.deepEqual(global.DSFeatureNotificationsCore.getNotificationBadgeState([{}, {}]), {
    count: 2,
    hasNotifications: true,
  });

  const translate = (key, params) => {
    if (key === 'notification_invited_by') {
      return `invited:${params.email}`;
    }
    return key;
  };

  assert.equal(
    global.DSFeatureNotificationsCore.getNotificationDetailText({ notificationType: 'invite_reminder_day1' }, translate),
    'notification_invite_reminder_day1',
  );
  assert.equal(
    global.DSFeatureNotificationsCore.getNotificationDetailText({ notificationType: 'invite_reminder_day3' }, translate),
    'notification_invite_reminder_day3',
  );
  assert.equal(
    global.DSFeatureNotificationsCore.getNotificationDetailText({ inviterEmail: 'inviter@example.com' }, translate),
    'invited:inviter@example.com',
  );
});
