# JS Refactor Modernization Plan (Planner Revision)

Date: 2026-02-18

## Planning Update Trigger
- Source: `docs/refactor-plan-validation-senior-software-developer.md`
- Validation result: `approved_with_conditions`
- This revision integrates all required conditions into an updated execution sequence.

## Goal
Move from the current transitional architecture (large `app.js` + global namespaces) to a modular, test-gated architecture with explicit dependencies, browser-level workflow coverage, and measurable migration completion criteria.

## Current Baseline (Validation Evidence)
- `app.js` line count: `6645`.
- `firebase-module.js` line count: `3195`.
- `index.html` still loads legacy globals plus `js/main.mjs`.
- Current CI gates: lint, typecheck, node tests, node smoke tests.

## Target State
- Thin shell/composition root with feature-owned controllers.
- Firebase access isolated behind focused gateways.
- ESM-first runtime boot with no script-order global coupling.
- CI enforces lint, typecheck, unit/integration, coverage, browser smoke.
- Migration-completion checks are automated and blocking.

## Success Metrics
- `app.js` reduced to `<= 1000` lines.
- `firebase-module.js` removed from runtime path or reduced to explicit compatibility shim not required for primary boot.
- `>= 90%` line coverage on core/shared targets via CI.
- Browser smoke e2e covers login, navigation, players CRUD, events CRUD, generator flow, alliance invite actions.
- `index.html` runtime boots from ESM dependency graph without legacy load-order dependency.

## Access Control Constraint (New)
- Firestore user document `users/2z2BdO8aVsUovqQWWL9WCRMdV933` is the platform super admin.
- Only this user can edit game-level metadata:
  - game name
  - game logo
  - any other game-level attributes
- All other users must be read-only for game-level metadata and can only switch active game context.
- The application menu must expose a dedicated super-admin entry for these actions (hidden for non-admin users).

## Condition-to-Solution Mapping
1. Runtime retirement gap.
- Solution: add Phase 18 for legacy runtime retirement, ESM-primary boot, and rollback window.

2. CI metric enforcement gap.
- Solution: extend Phase 17 CI to run coverage and add metric-budget checks.

3. Browser workflow gate gap.
- Solution: add Playwright-based browser smoke suite and enforce it in CI before Phase 18 completion.

## Implementation Phases (Updated)

## Phase 8: Architecture Contracts and Runtime Boundaries (complete)
Objective:
Define shell/state/data contracts and pilot contract usage.

Reference:
- `docs/refactor-phase8-architecture-contracts.md`

## Phase 9: Shared State Store and Selectors (complete)
Objective:
Replace ad-hoc mutable globals with state store + selectors.

Reference:
- `docs/refactor-phase9-shared-state-store.md`

## Phase 10: Shell Extraction (Navigation and Overlays) (complete)
Objective:
Move shell concerns to dedicated controllers and delegate from `app.js`.

Reference:
- `docs/refactor-phase10-shell-controllers.md`

## Phase 11: Generator Feature Full Controller (complete)
Objective:
Make generator workflow controller-owned.

Reference:
- `docs/refactor-phase11-generator-controller.md`

## Phase 12: Players Management Feature Full Controller (complete)
Objective:
Make players workflow controller-owned.

Reference:
- `docs/refactor-phase12-players-management-controller.md`

## Phase 13: Events Manager Feature Full Controller (complete)
Objective:
Make events workflow controller-owned.

Reference:
- `docs/refactor-phase13-events-manager-controller.md`

## Phase 14: Alliance and Notifications Controllers (complete)
Objective:
Move alliance/notifications orchestration to feature controllers.

Reference:
- `docs/refactor-phase14-alliance-notifications-controllers.md`

## Phase 15: Firebase Monolith Decomposition (implemented, pending runtime retirement)
Objective:
Keep gateway decomposition but retain safe compatibility facade until retirement phase.

Reference:
- `docs/refactor-phase15-firebase-gateway-decomposition.md`

Exit Criteria:
- Gateway modules remain the main integration surface for new code.
- No new direct Firebase calls added to `app.js`.

## Phase 16: ESM Migration and Tooling (implemented, pending legacy detachment)
Objective:
Run dual-boot compatibility while preparing full ESM ownership.

Reference:
- `docs/refactor-phase16-esm-and-tooling.md`

Exit Criteria:
- `js/main.mjs` remains functional and feature-complete for boot.
- Legacy script path limited to compatibility only.

## Phase 17: Quality Gates Hardening (reopened)
Objective:
Close CI enforcement gaps identified in validation.

Deliverables:
- Keep existing lint/typecheck/test/smoke gates.
- Add `npm run test:coverage` to CI.
- Add a repository check script that fails CI when:
  - `app.js` exceeds the phase line budget.
  - legacy runtime tags remain in `index.html` after retirement flag is enabled.
- Add authorization guard tests for game-level metadata mutations:
  - super admin (`2z2BdO8aVsUovqQWWL9WCRMdV933`) can create/update game metadata.
  - non-admin users cannot mutate game metadata.
- Enforce game metadata write policy at data layer (Firestore rules or equivalent server-side gate), not UI only.
- Add menu authorization tests:
  - super admin sees `Game Metadata Admin` menu entry.
  - non-admin users do not see this menu entry.
- Document thresholds and retirement-flag policy in phase notes.

Exit Criteria:
- CI blocks on lint, typecheck, unit/integration, smoke, coverage, and metric checks.
- CI blocks on failing super-admin authorization tests for game metadata writes.

## Phase 18: Browser E2E Smoke and Legacy Runtime Retirement (new)
Objective:
Retire legacy runtime path safely with browser-verified behavior parity.

Deliverables:
- Add Playwright smoke suite on Edge channel:
  - login
  - page navigation
  - players CRUD/search/filter
  - generator flow
  - events CRUD
  - alliance invite actions
  - game metadata authorization smoke:
    - super admin sees and can open `Game Metadata Admin` from menu
    - super admin can open and save game metadata edits
    - non-admin does not see `Game Metadata Admin` menu entry
    - non-admin cannot access game metadata edit actions
- Add CI job for browser smoke.
- Make ESM boot path primary and remove legacy load-order dependency from `index.html`.
- Keep one release-window rollback switch for emergency fallback.
- Add explicit final checks:
  - `firebase-module.js` not required for primary runtime boot.
  - `app.js` line budget target met.

Exit Criteria:
- Browser smoke passes in CI.
- Runtime boots from ESM dependency graph only.
- Legacy runtime retirement checks pass and rollback switch is documented.
- Browser smoke confirms game-level metadata edit restrictions by user id.

Reference:
- `docs/refactor-phase18-legacy-runtime-retirement.md`

## Execution Policy
- One phase per PR/commit group.
- Each phase must be deployable without intentional behavior change.
- Every phase closes with:
  - `npm.cmd run lint`
  - `npm.cmd run typecheck`
  - `npm.cmd test`
  - phase-specific validation commands
- Keep phase notes in `docs/refactor-phaseX-*.md` with `Objective`, `Implemented`, `Validation`, `Exit Criteria`.

## Risks and Mitigations
- Risk: hidden coupling across globals.
- Mitigation: keep adapter wrappers until Phase 18 retirement gate passes.

- Risk: regression in auth/data flows.
- Mitigation: browser smoke plus node integration guards before removing legacy path.

- Risk: metric goals not enforced.
- Mitigation: make metrics machine-checked and CI-blocking in Phase 17.

## Next Execution Slice
Run Phase 17 first, then Phase 18.
