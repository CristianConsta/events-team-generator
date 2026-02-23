# JS Refactor Phase 15: Firebase Gateway Decomposition

Date: 2026-02-16

## Objective
Decompose Firebase access into focused shared gateway modules and keep `FirebaseService` as a composed backward-compatible facade.

## Implemented

1. Added shared gateway utility:
   - `js/shared/data/firebase-gateway-utils.js`
   - Provides `manager`, `withManager`, and `notLoadedResult` helpers.

2. Added focused Firebase gateway modules:
   - `js/shared/data/firebase-auth-gateway.js`
   - `js/shared/data/firebase-players-gateway.js`
   - `js/shared/data/firebase-events-gateway.js`
   - `js/shared/data/firebase-alliance-gateway.js`
   - `js/shared/data/firebase-notifications-gateway.js`

3. Updated service facade composition:
   - `js/services/firebase-service.js` now composes `FirebaseService` from gateway modules.
   - Public method surface remains unchanged.

4. Updated runtime script loading:
   - `index.html` now loads gateway utility + domain gateways before `js/services/firebase-service.js`.

5. Updated and expanded tests:
   - Updated `tests/firebase-service.test.js` to load gateway modules before service composition.
   - Added `tests/firebase-gateways.core.test.js` for gateway utility and domain gateway surfaces.

## Validation
- `npm test` passes.

## Exit Criteria
- Firebase access split into focused gateways under `js/shared/data/*`: done.
- `FirebaseService` preserved as compatibility facade: done.
