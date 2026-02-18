# Multi-Game Migration Policy

Status: approved baseline for implementation  
Version: 1

## 1. Goal

Migrate from legacy Last War root-level gameplay data to game-scoped subcollections without breaking existing users.

## 2. Migration flags

Runtime flags:

- `MULTIGAME_ENABLED`
- `MULTIGAME_READ_FALLBACK_ENABLED`
- `MULTIGAME_DUAL_WRITE_ENABLED`
- `MULTIGAME_GAME_SELECTOR_ENABLED`

Default rollout:

1. enabled: `READ_FALLBACK`
2. enabled: `DUAL_WRITE`
3. disabled: selector for broad audience

## 3. Migration phases

## Phase 1: Read compatibility

- Reads:
  - prefer `users/{uid}/games/{gameId}/...`
  - fallback to legacy Last War fields for `gameId == last_war`
- Writes:
  - unchanged legacy writes

Exit criteria:
- legacy and new-schema fixtures pass read parity tests.

## Phase 2: Dual-write

- Writes:
  - write new game-scoped model
  - continue writing legacy Last War fields
- Reads:
  - still prefer new, fallback enabled

Exit criteria:
- read-after-write parity across schemas
- no elevated error rate in save/upload/generate flows

## Phase 3: Post-auth game selector rollout

- Enable selector for target cohorts.
- Persist `selectedGameId` in user root doc.

Exit criteria:
- no auth-to-app blocking defects
- successful game selection and switching telemetry stable

## Phase 4: Legacy write retirement

- Disable legacy writes (`MULTIGAME_DUAL_WRITE_ENABLED=false`)
- Keep read fallback enabled

Exit criteria:
- sustained stability window with no fallback-only dependency spikes

## Phase 5: Legacy read fallback retirement

- Disable fallback (`MULTIGAME_READ_FALLBACK_ENABLED=false`)
- Remove dead compatibility code in cleanup release

Exit criteria:
- migration completion threshold reached
- rollback not required during observation window

## 4. Idempotency rules

- Migration copy into `games/last_war` must be idempotent.
- Re-running migration must not duplicate players/events/invitations.
- Version markers in user root:
  - `migrationVersion`
  - `migratedToGameSubcollectionsAt`

## 5. Rollback policy

Rollback trigger examples:
- data mismatch between legacy/new reads
- invitation/alliance context corruption
- severe upload/generation failures after cutover

Rollback actions:
1. set `MULTIGAME_GAME_SELECTOR_ENABLED=false`
2. set `MULTIGAME_DUAL_WRITE_ENABLED=true`
3. set `MULTIGAME_READ_FALLBACK_ENABLED=true`
4. route users to `last_war` active game

## 6. Validation matrix

Required fixtures:
- legacy-only user
- mixed-schema user
- native multi-game user

Required checks:
- `npm test`
- `npm run test:e2e:smoke`
- `npm run test:e2e:regression`

Additional checks:
- isolation matrix:
  - players by game
  - events/buildings by game
  - settings by game
  - alliance/invitations by game
  - algorithm selection by event
  - import schema by game

## 7. Observability requirements

Track at minimum:
- active game selection success rate
- fallback-read hit rate
- dual-write mismatch count
- invitation context mismatch count
- upload schema validation failures by game
- assignment algorithm resolution failures by game/event

## 8. Cutover approval checklist

All must be true:

1. zero open critical migration bugs
2. fixture suite green for two consecutive runs
3. smoke and regression suites green
4. fallback-read hit rate below agreed threshold
5. product and QA signoff recorded

## 9. Numeric cutover thresholds

The following thresholds are mandatory for phase transitions:

- Dual-write retirement (Phase 4):
  - observation window: 14 consecutive days
  - dual-write mismatch count: 0 mismatches in the window
  - invitation context mismatch count: 0 mismatches in the window
  - upload schema validation failure increase: <= 5% relative to pre-rollout baseline

- Legacy read fallback retirement (Phase 5):
  - observation window: 14 consecutive days after dual-write retirement
  - fallback-read hit rate: < 2.0% of gameplay reads for 14 consecutive days
  - assignment algorithm resolution failures: 0 unknown-algorithm errors for 14 consecutive days
  - no Sev-1 or Sev-2 production incidents attributed to migration in the window

## 10. Observation window definitions

- A day counts only if:
  - full smoke and regression gates passed at least once in CI
  - no unresolved data-integrity alerts are open
- Any breach resets the current observation window counter to day 0.
