# Multi-Game Phase 6: Dual-Write and Idempotent Migration Utility

Date: 2026-02-18
Plan reference: `docs/architecture/multigame-implementation-plan.md` (Phase 6)

## Objective

Enable safe dual-write behavior during migration and provide an idempotent copier for legacy Last War data.

## Implemented

1. Added dual-write support in `firebase-module.js`:
- Guarded by `MULTIGAME_DUAL_WRITE_ENABLED`.
- Primary save path (`persistChangedUserData`) now writes:
  - legacy root payload (`users/{uid}`)
  - game-scoped payload (`users/{uid}/games/last_war`) when dual-write is enabled.
- Dual-write patch includes:
  - `playerDatabase`
  - `events`
  - `userProfile`
  - `playerSource`
  - `allianceId`
  - `allianceName`
  - metadata timestamps

2. Added migration markers update during dual-write:
- `migrationVersion = 1`
- `migratedToGameSubcollectionsAt`
- `lastActiveGameId = last_war`

3. Added dual-write path for `setPlayerSource()` updates when flag enabled.

4. Added idempotent migration utility script:
- `scripts/migrate_legacy_last_war_to_game_subcollections.js`
- Supports:
  - dry-run (default)
  - `--apply`
  - `--batch-size`
  - `--limit`
  - `--service-account`
  - `--project-id`
- Copy semantics are idempotent:
  - only fills missing game-scoped fields from legacy root
  - no-op when game-scoped doc already has migrated fields

5. Added migration utility unit tests:
- `tests/migration.lastwar-script.test.js`
  - legacy payload detection
  - missing-field copy behavior
  - idempotent no-op behavior

## Validation

1. Unit/integration:
- `npm test`
- Result: `262 passed`, `0 failed`.

2. E2E smoke:
- `npm run test:e2e:smoke`
- Result: `8 passed`, `0 failed`, `2 skipped` (project/tag-conditional cases).

## Exit Criteria

- Dual-write support behind feature flag is active: complete.
- Migration utility supports dry-run/apply and idempotent behavior: complete.
