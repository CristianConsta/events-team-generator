# Multi-Game Implementation Plan (Planner, Rev 2)

Status: planned  
Date: 2026-02-18  
Source baseline: `docs/multi-game-support.md`  
Validated by:
- `docs/architecture/multigame-plan-validation-agents.md`

Aligned contracts:
- `docs/architecture/multigame-data-contract.md`
- `docs/architecture/multigame-service-contract.md`
- `docs/architecture/migration-policy.md`
- `docs/architecture/multigame-ownership-matrix.md`

## 1. Goal

Enable multi-game support so all gameplay domains are scoped by `gameId`:
- generator
- players management
- events management
- alliances/invitations
- settings

Current single-game behavior (`last_war`) must remain backward compatible during migration.

## 2. Locked constraints and decisions

1. Games are programmatically defined only (no user-created games yet).
2. One active game context per signed-in user at a time.
3. Alliances and invitations are strictly game-scoped.
4. Settings are strictly game-scoped.
5. Per-event algorithm selection is required.
6. Per-game upload schema/template is required.
7. Super-admin game metadata editing is restricted to:
- `users/2z2BdO8aVsUovqQWWL9WCRMdV933`
8. This user is the platform super admin (Firestore user doc id):
- `2z2BdO8aVsUovqQWWL9WCRMdV933`
- only this user can edit game-level metadata:
  - game `name`
  - game `logo`
  - any other game-level attributes
- all other users are read-only for game-level metadata.
9. Algorithm resolution behavior is fixed:
- Missing legacy `assignmentAlgorithmId` -> default `balanced_round_robin`
- Unknown configured algorithm id -> hard-fail with `unknown-assignment-algorithm`
10. Data-layer authorization is mandatory (UI checks are not sufficient).
11. No framework/build-step migration in this initiative.

## 3. Release markers

From service contract timeline:
- `R0`: game-aware APIs introduced.
- `R1`: dual-write enabled by default.
- `R2`: legacy writes disabled (fallback reads still enabled).
- `R3`: legacy read fallback removed.

Planned mapping:
- `R0` after Phase 5
- `R1` after Phase 7
- `R2` after Phase 13
- `R3` after Phase 14

## 4. Global phase gate policy

Every phase must pass:
1. `npm test`
2. `npm run test:e2e:smoke`
3. Phase-specific checks listed below
4. QA non-regression checks (translations/index/mobile/accessibility/CSS/buildings-toggle)

Additional mandatory cadence:
- `npm run test:e2e:regression` for high-risk phases (6-14) and before release cutovers.

## 5. Phase schedule

## Phase 0: Baseline and guardrail freeze
Owner: QA  
Size: S  
Depends on: none

Objective:
Capture parity baseline before multi-game changes.

Touchpoints:
- `tests/*`
- `e2e/*`
- `docs/architecture/*`

Deliverables:
- Baseline evidence captured:
  - `npm test`
  - `npm run test:e2e:smoke`
  - `npm run test:e2e:regression`
- Record pass/fail baseline in phase note.

Definition of done:
- Baseline is reproducible on clean checkout.

## Phase 1: Feature flags and rollout controls
Owner: Service/Data  
Size: S  
Depends on: Phase 0

Objective:
Add rollout switches without changing behavior.

Touchpoints:
- `firebase-module.js`
- `js/services/firebase-service.js`
- `js/app-init.js`

Deliverables:
- Add:
  - `MULTIGAME_ENABLED`
  - `MULTIGAME_READ_FALLBACK_ENABLED`
  - `MULTIGAME_DUAL_WRITE_ENABLED`
  - `MULTIGAME_GAME_SELECTOR_ENABLED`
- Centralized flag resolution helper.

Definition of done:
- Flags default to current behavior (no functional drift).

## Phase 2: Game catalog and policy primitives
Owner: Core/Domain  
Size: S  
Depends on: Phase 1

Objective:
Establish canonical game definitions and super-admin policy module.

Touchpoints:
- `js/core/games.js` (new)
- `js/core/assignment-registry.js` (skeleton)
- `js/services/firebase-service.js`
- `translations.js`

Deliverables:
- Programmatic game catalog structure (`id`, `name`, `logo`, `company`, troop model, schema metadata, algorithm ids).
- Super-admin policy module with fixed UID.
- Service API: `listAvailableGames()`.

Definition of done:
- Unit tests pass for catalog and policy checks.

## Phase 3: Runtime active game context
Owner: UI/Runtime  
Size: M  
Depends on: Phase 2

Objective:
Make active game context mandatory post-auth.

Touchpoints:
- `app.js`
- `js/app-init.js`
- `index.html`
- `js/services/firebase-service.js`

Deliverables:
- Add `setActiveGame(gameId)` / `getActiveGame()`.
- Persist active game pointer.
- Typed error `missing-active-game` when gameplay APIs execute without context.

Definition of done:
- Signed-in runtime always has one active game context.

## Phase 4: Game-scoped read compatibility
Owner: Service/Data  
Size: M  
Depends on: Phase 3

Objective:
Introduce game-scoped reads with Last War fallback.

Touchpoints:
- `firebase-module.js`
- `js/services/firebase-service.js`
- `tests/firebase-*.test.js`

Deliverables:
- Read path priority:
  - `users/{uid}/games/{gameId}/...`
  - fallback for `last_war` legacy root fields only.
- User migration markers:
  - `migrationVersion`
  - `migratedToGameSubcollectionsAt`

Definition of done:
- Fixtures `legacy-only`, `mixed`, `native` pass read parity tests.

## Phase 5: Game-aware service signatures (R0)
Owner: Service/Data  
Size: M  
Depends on: Phase 4

Objective:
Adopt game-aware service contracts while keeping legacy signature compatibility.

Touchpoints:
- `js/services/firebase-service.js`
- `firebase-module.js`
- `tests/firebase-service*.test.js`

Deliverables:
- Implement contract APIs with optional `gameId` during migration window.
- Add warning logs for legacy signature usage.

Definition of done:
- Game-aware path works end-to-end with backward compatibility.
- `R0` reached.

## Phase 6: Dual-write migration and idempotent copier
Owner: Service/Data  
Size: L  
Depends on: Phase 5

Objective:
Write both schemas safely during migration window.

Touchpoints:
- `firebase-module.js`
- `scripts/*` (migration/copy utility)
- `tests/*migration*`

Deliverables:
- Dual-write to:
  - game-scoped model
  - legacy Last War fields
- Idempotent copy logic to `users/{uid}/games/last_war/*`.
- Dry-run and apply modes for migration utility.

Definition of done:
- Re-running migration does not duplicate/corrupt records.

## Phase 7: Dual-write observability and mismatch gating (R1)
Owner: Service/Data + QA  
Size: M  
Depends on: Phase 6

Objective:
Gate rollout with measurable parity telemetry.

Touchpoints:
- `firebase-module.js`
- `js/services/firebase-service.js`
- `tests/*`
- CI/reporting docs

Deliverables:
- Counters:
  - dual-write mismatch count
  - invitation context mismatch count
  - fallback-read hit rate
- Threshold checks from migration policy integrated in release checklist.

Definition of done:
- Observability dashboard/logs support Phase 4/5 migration thresholds.
- `R1` reached.

## Phase 8: Post-auth game selector UX
Owner: UI/Runtime  
Size: M  
Depends on: Phase 7

Objective:
Expose game selection and switching after auth.

Touchpoints:
- `index.html`
- `app.js`
- `styles.css`
- `translations.js`

Deliverables:
- Post-auth game selector flow.
- Active game badge/logo.
- Switch action reloads scoped data and resets transient planning state.

Definition of done:
- Login/signup -> select game -> generator visible.
- No auth-blocking defects.

## Phase 9: Scope players/events/settings by game
Owner: UI/Runtime + Service/Data  
Size: L  
Depends on: Phase 8

Objective:
Remove cross-game leakage in core gameplay data.

Touchpoints:
- `app.js`
- `firebase-module.js`
- `js/services/firebase-service.js`
- `js/core/events.js`
- `tests/*players*`, `tests/*events*`

Deliverables:
- Players/events/settings operations always resolve `gameId`.
- Event context migrated to `{gameId, eventId}`.

Definition of done:
- Isolation matrix passes for players/events/settings.

## Phase 10: Scope alliances/invitations by game
Owner: Service/Data  
Size: L  
Depends on: Phase 9

Objective:
Enforce game context across alliance membership and invitation flows.

Touchpoints:
- `firebase-module.js`
- `js/services/firebase-service.js`
- `app.js`
- `tests/*alliance*`

Deliverables:
- Alliance and invitation documents include enforced `gameId`.
- Reject mismatched contexts with typed errors.

Definition of done:
- User may belong to different alliances in different games.
- Context mismatch tests pass.

## Phase 11: Algorithm registry and per-event resolution
Owner: Core/Domain  
Size: M  
Depends on: Phase 9

Objective:
Enable event-level algorithm strategy by game.

Touchpoints:
- `js/core/assignment.js`
- `js/core/generator-assignment.js`
- `js/core/assignment-registry.js`
- `app.js`
- `tests/assignment*.test.js`

Deliverables:
- Registry (`algorithmId -> strategy`).
- Event stores `assignmentAlgorithmId`.
- Enforced unknown-id hard fail behavior.

Definition of done:
- Invariant tests pass (no duplicates, no slot overflow, constraints respected).

## Phase 12: Per-game upload schema/template
Owner: Core/Domain + Service/Data  
Size: M  
Depends on: Phase 9

Objective:
Support game-specific player import contracts.

Touchpoints:
- `app.js`
- `firebase-module.js`
- `js/services/firebase-service.js`
- `translations.js`
- `tests/*upload*` (new)

Deliverables:
- Schema resolver by `gameId`.
- Template download and validation per game.
- Localized validation error for wrong-game template.

Definition of done:
- Schema matrix tests pass.

## Phase 13: Super-admin metadata management + rules (R2)
Owner: UI/Runtime + Service/Data  
Size: M  
Depends on: Phases 8, 9

Objective:
Ship constrained game metadata management safely.

Touchpoints:
- `index.html`
- `app.js`
- `firebase-module.js`
- `js/services/firebase-service.js`
- Firestore rules files/emulator tests (repo path as implemented)
- `tests/*`
- `e2e/*`

Deliverables:
- `Game Metadata Admin` menu entry only for `2z2BdO8aVsUovqQWWL9WCRMdV933`.
- Metadata edit view for name/logo/company/attributes.
- Data-layer authorization and Firestore rule enforcement.
- Rule tests in emulator/CI path.
- Explicit write guard:
  - only `2z2BdO8aVsUovqQWWL9WCRMdV933` may mutate game name/logo/attributes.
  - any non-admin write attempt must fail with typed authorization error.

Definition of done:
- Non-admin cannot read/write restricted metadata edit operations.
- Super-admin can perform metadata edits.
- `R2` reached.

## Phase 14: Staged rollout, retirement, and cleanup (R3)
Owner: Service/Data + QA + Architect signoff  
Size: L  
Depends on: Phases 6-13

Objective:
Retire legacy compatibility only when policy thresholds are satisfied.

Touchpoints:
- `firebase-module.js`
- `js/services/firebase-service.js`
- cleanup tests/docs

Deliverables:
- Disable legacy writes (`MULTIGAME_DUAL_WRITE_ENABLED=false`) after threshold window.
- Disable legacy read fallback after threshold window.
- Remove legacy signature shim and dead compatibility paths.
- Perform rollback drill before final fallback removal.

Definition of done:
- Migration-policy thresholds met.
- No open critical migration defects.
- `R3` reached.

## 6. QA strategy integration (mandatory)

Preserve existing QA-agent checks for every phase:
- translations integrity across 6 languages
- required `index.html` IDs/layout structure
- mobile/Edge safety checks
- accessibility checks
- CSS safety checks
- buildings editor display-toggle behavior

Fixture matrix (required in relevant phases):
1. legacy-only user
2. mixed-schema user
3. native multigame user

Isolation matrix (must be green before cutover):
- players by game
- events/buildings by game
- settings by game
- alliance/invitations by game
- algorithm selection by event
- import schema by game

## 7. Commit policy

One phase per PR/commit group:
- `feat(multigame-phase-X): ...`
- `test(multigame-phase-X): ...`
- `docs(multigame-phase-X): ...`

No irreversible schema step may merge without fallback/rollback controls in the same phase.
