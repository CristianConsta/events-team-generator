# JS Refactor Phase 9: Shared State Store and Selectors

Date: 2026-02-16

## Objective
Introduce a centralized app state store and route navigation/generator state reads and writes through selectors.

## Implemented

1. Added shared app state store:
   - `js/shared/state/app-state-store.js`
   - Exposes:
     - `createStore(initialState)`
     - `createDefaultStore(initialState)`
     - `mergeState(base, patch)`
     - selector set for navigation, generator and players-management filters.

2. Updated runtime loading:
   - Added `js/shared/state/app-state-store.js` to `index.html` before `app.js`.

3. Wired `app.js` to centralized store:
   - Initialized runtime store (`appStateStore`) and store contract wrapper.
   - Added state sync/getter helpers:
     - `getCurrentPageViewState` / `setCurrentPageViewState`
     - `getCurrentAssignmentAlgorithmState` / `setCurrentAssignmentAlgorithmState`
     - `syncGeneratorTeamSelectionsState`
     - `syncPlayersManagementFilterState`
   - Navigation and assignment logic now reads via store-backed selectors.
   - Team count / selected-player computations route through store selectors.
   - Players-management filter active-state reads through store selector.

4. Added unit tests:
   - `tests/app-state-store.core.test.js`
   - Covers store initialization, subscription behavior, merge semantics, and selectors.

## Validation
- `npm test` passes.

## Exit Criteria
- Shared state store and selectors added: done.
- Two slices (`navigation`, `generator`) wired through store selectors/setters: done.
