# Multi-Game Phase 4: Game-Scoped Read Compatibility

Date: 2026-02-18
Plan reference: `docs/architecture/multigame-implementation-plan.md` (Phase 4)

## Objective

Introduce game-scoped read compatibility with legacy Last War fallback and migration markers.

## Implemented

1. Added game-scoped read primitives in `firebase-module.js`:
- `USER_GAMES_SUBCOLLECTION = games`
- `DEFAULT_GAME_ID = last_war`
- `resolveGameScopedReadPayload(...)`

2. Updated `loadUserData()` read priority:
1. `users/{uid}/games/last_war` document
2. Legacy root user document fallback (Last War compatibility)

3. Added migration marker handling:
- `migrationVersion`
- `migratedToGameSubcollectionsAt`
- Persisted marker update when game-scoped data path is used.

4. Exposed migration and compatibility helpers:
- `FirebaseManager.getMigrationVersion()`
- `FirebaseManager.getMigratedToGameSubcollectionsAt()`
- `FirebaseManager.resolveGameScopedReadPayload(...)`
- `FirebaseService.getMigrationVersion()`
- `FirebaseService.getMigratedToGameSubcollectionsAt()`

5. Added fixture-style parity tests:
- `tests/firebase-manager.events.integration.test.js` now validates:
  - `legacy-only` read resolution
  - `mixed` read resolution
  - `native` game-scoped read resolution

## Validation

1. Unit/integration:
- `npm test`
- Result: `256 passed`, `0 failed`.

2. E2E smoke:
- `npm run test:e2e:smoke`
- Result: `8 passed`, `0 failed`, `2 skipped` (project/tag-conditional cases).

## Exit Criteria

- Game-scoped read path with Last War legacy fallback is active: complete.
- Migration markers exist and are exposed for rollout telemetry: complete.
- Fixture parity resolution tests for legacy/mixed/native are green: complete.
