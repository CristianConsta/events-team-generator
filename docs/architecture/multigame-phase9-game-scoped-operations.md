# Multi-Game Phase 9: Game-Scoped Players, Events, and Settings Context

Date: 2026-02-18  
Plan reference: `docs/architecture/multigame-implementation-plan.md` (Phase 9)

## Objective

Remove cross-game operation leakage by enforcing explicit game context through players/events/settings flows.

## Implemented

1. Added game-context helpers in `app.js`:
- `getGameplayContext(...)`
- `getEventGameplayContext(eventId, ...)`

2. Updated app runtime calls to pass explicit game context for core gameplay operations:
- player CRUD and upload:
  - `getPlayerDatabase(...)`
  - `getAlliancePlayerDatabase(...)`
  - `getActivePlayerDatabase(...)`
  - `upsertPlayerEntry(...)`
  - `removePlayerEntry(...)`
  - `uploadPlayerDatabase(...)`
  - `uploadAlliancePlayerDatabase(...)`
  - `setPlayerSource(...)`
- settings:
  - `getUserProfile(...)`
  - `setUserProfile(...)`
  - `saveUserData(..., { gameId })`
- events/buildings:
  - `getAllEventData(...)`
  - `upsertEvent(..., { gameId, eventId })`
  - `removeEvent(..., { gameId, eventId })`
  - `get/setBuildingConfig(...)`
  - `get/setBuildingConfigVersion(...)`
  - `get/setBuildingPositions(...)`
  - `get/setBuildingPositionsVersion(...)`

3. Extended `js/services/firebase-service.js`:
- added event-scoped context resolver that supports event context payloads.
- event and building service methods now accept `{ gameId, eventId }` contexts.
- settings service methods (`getUserProfile`, `setUserProfile`) now accept optional game context.

4. Updated `firebase-module.js` API wrapper entries:
- `getUserProfile(context)` and `setUserProfile(profile, context)` now resolve gameplay context through the manager wrapper path.

5. Added/updated service tests:
- `tests/firebase-service.extended.test.js` now includes:
  - event-scoped getter with `{ gameId, eventId }`.
  - `getUserProfile` explicit game context propagation.

## Validation

1. Unit/integration:
- `npm test`
- Result: `268 passed`, `0 failed`.

2. E2E smoke:
- `npm run test:e2e:smoke`
- Result: `10 passed`, `0 failed`, `2 skipped`.

## Exit Criteria

- Players/events/settings app operations now resolve explicit game context: complete.
- Event operations support `{ gameId, eventId }` context payloads via service layer: complete.
