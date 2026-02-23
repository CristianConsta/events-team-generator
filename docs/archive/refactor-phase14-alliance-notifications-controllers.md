# JS Refactor Phase 14: Alliance and Notifications Controllers

Date: 2026-02-16

## Objective
Introduce alliance and notifications feature controllers and route alliance/notification orchestration entry points through controller APIs.

## Implemented

1. Added feature controllers:
   - `js/features/alliance/alliance-controller.js`
   - `js/features/notifications/notifications-controller.js`

2. Updated script loading:
   - Added alliance/notifications controller scripts before `app.js`.

3. Wired controllers in `app.js`:
   - Added `getAllianceFeatureController()` and `getNotificationsFeatureController()` lazy initializers.
   - Header alliance and notifications button entry points now delegate through controllers.
   - Alliance panel callbacks in `renderAlliancePanel()` now route through controller methods with fallbacks.

4. Updated app init polling bridge:
   - `js/app-init.js` now starts/stops polling through notifications controller when available.

5. Added controller tests:
   - `tests/alliance-notifications-controller.feature.test.js`
   - Covers alliance action delegation and notifications panel/polling delegation.

## Validation
- `npm test` passes.

## Exit Criteria
- Alliance and notifications actions are controller-addressable: done.
- Polling start/stop is controller-integrated with fallback behavior: done.
