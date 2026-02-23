# JS Refactor Phase 6: Events Manager Selector Extraction

Date: 2026-02-16

## Objective
Extract events-manager selector display/render logic from `app.js` into a dedicated feature module.

## Implemented

1. Added events-manager selector module:
   - `js/features/events-manager/event-selector-view.js`
   - Exposes:
     - `resolveEventDisplayName(eventId, options)`
     - `createEventSelectorButton(options)`
     - `renderEventSelector(options)`

2. Updated script loading:
   - Added `js/features/events-manager/event-selector-view.js` to `index.html` before `app.js`.

3. Updated `app.js` delegation:
   - `getEventDisplayName` now delegates to `DSFeatureEventsManagerSelector.resolveEventDisplayName(...)`.
   - `createEventSelectorButton` delegates to feature module button creation.
   - `renderEventSelector` delegates to module renderer and keeps fallback behavior.

4. Added unit tests:
   - `tests/events-manager-selector.feature.test.js`
   - Covers display-name fallback chain and selector button render/click behavior.

## Scope Notes
- No event registry or assignment behavior changes.
- Extraction targets selector UI assembly only.

## Validation
- `npm test` passes after changes.
