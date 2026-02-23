# Multi-Game Phase 14: Rollout Retirement and R3 Cleanup

Date: 2026-02-18  
Plan reference: `docs/architecture/multigame-implementation-plan.md` (Phase 14)

## Objective

Move the platform to `R3` defaults by retiring legacy read fallback in default runtime behavior and removing legacy signature warning shim paths.

## Implemented

1. Updated runtime feature-flag defaults to `R3` posture:
- `MULTIGAME_READ_FALLBACK_ENABLED` default changed to `false` in:
  - `firebase-module.js`
  - `js/services/firebase-service.js`

2. Gated legacy-root read fallback explicitly in `firebase-module.js`:
- `resolveGameScopedReadPayload(...)` now requires `allowLegacyFallback: true` to use legacy fallback data.
- `loadUserData(...)` now passes `allowLegacyFallback` from runtime flag state.
- association fallback to legacy root (`resolveUserGameAssociationState`) now runs only when fallback flag is enabled.

3. Retired service-layer legacy-signature warning shim:
- removed one-time warning emission logic from `js/services/firebase-service.js`.
- retained active-game resolution behavior for backward-safe call paths, without legacy warning logging.

4. Retired manager-layer legacy-signature warning shim:
- removed warning emission logic from `firebase-module.js` `resolveGameplayContext(...)`.

5. Updated tests for R3 behavior:
- default flag assertions now expect `MULTIGAME_READ_FALLBACK_ENABLED: false`.
- fallback resolver integration test now validates:
  - default no-fallback behavior
  - explicit fallback behavior when enabled.
- legacy warning test updated to assert no warning shim emission.

## Validation

1. Unit/integration:
- `npm test`

2. E2E smoke:
- `npm run test:e2e:smoke`

## Exit Criteria

- Legacy read fallback is disabled by default: complete.
- Legacy warning shim paths are removed from service/manager layers: complete.
- Regression checks remain green: complete.
