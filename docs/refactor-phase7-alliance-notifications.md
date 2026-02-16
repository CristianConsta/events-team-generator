# JS Refactor Phase 7: Alliance and Notifications Helpers

Date: 2026-02-16

## Objective
Extract invitation/notification formatting and normalization helpers from `app.js` into a notifications feature core module shared by alliance and notifications UI flows.

## Implemented

1. Added notifications core module:
   - `js/features/notifications/notifications-core.js`
   - Exposes:
     - `getInvitationSenderDisplay(invitation)`
     - `formatInvitationCreatedAt(createdAt)`
     - `normalizeNotificationItems(options)`
     - `getNotificationBadgeState(items)`
     - `getNotificationDetailText(item, translate)`

2. Updated script loading:
   - Added `js/features/notifications/notifications-core.js` to `index.html` before `app.js`.

3. Updated `app.js` delegation:
   - Alliance invitation sender/date helpers now delegate to `DSFeatureNotificationsCore`.
   - Notification badge state calculation now delegates to core helper.
   - Notification item normalization now delegates to core helper.
   - Notification card detail text now delegates to core helper.

4. Added unit tests:
   - `tests/notifications.core.test.js`
   - Covers invitation sender/date helpers, notification normalization, badge state, and detail text resolution.

## Scope Notes
- No changes to invitation actions (accept/reject/revoke/resend) or polling cadence.
- Extraction-only for formatting/normalization helpers used by alliance/notifications surfaces.

## Validation
- `npm test` passes after changes.
