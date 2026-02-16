# JS Refactor Phase 13: Events Manager Feature Controller

Date: 2026-02-16

## Objective
Introduce events-manager controller/actions modules and route events-manager UI orchestration through controller APIs.

## Implemented

1. Added events-manager feature modules:
   - `js/features/events-manager/events-manager-actions.js`
   - `js/features/events-manager/events-manager-controller.js`

2. Updated script loading:
   - Added events-manager actions/controller scripts before `app.js` in `index.html`.

3. Wired controller in `app.js`:
   - Added `getEventsManagerFeatureController()` lazy initializer.
   - Events panel, edit mode, logo/map upload/remove/change, building row add, save/cancel/delete, and coordinates picker actions now route through controller methods with fallbacks.

4. Added unit tests:
   - `tests/events-manager-controller.feature.test.js`
   - Covers events-manager actions helpers and controller delegation surface.

## Validation
- `npm test` passes.

## Exit Criteria
- Events-manager interactions callable through feature controller API: done.
- Existing behavior preserved with fallback handlers: done.
