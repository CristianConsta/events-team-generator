# Refactor Docs Audit Report

Date: 2026-02-23

## Summary Table

| Doc | Status | Key Finding |
|-----|--------|-------------|
| refactor-modern-architecture-plan.md | PARTIALLY IMPLEMENTED | Master plan. Phases 0-17 done, success metrics (app.js <= 1000 lines, ESM-only boot) not met |
| refactor-plan-validation-senior-software-developer.md | PARTIALLY IMPLEMENTED | Validation doc. Browser e2e added (Playwright), but coverage CI gate and Phase 18 not done |
| refactor-phase0-baseline.md | FULLY IMPLEMENTED | Guardrail tests exist (phase0.regression.test.js, phase1a.regression.test.js), npm test works |
| refactor-phase1-module-boundaries.md | FULLY IMPLEMENTED | All target directories exist: js/shell/, js/features/, js/shared/data/, js/shared/state/ |
| refactor-phase2-composition-root.md | FULLY IMPLEMENTED | js/shell/bootstrap/app-shell-bootstrap.js exists, app.js exposes initializeApplicationUiRuntime() |
| refactor-phase3-core-extraction.md | FULLY IMPLEMENTED | js/core/generator-assignment.js exists, tests/generator-assignment.core.test.js exists |
| refactor-phase4-generator-team-selection.md | FULLY IMPLEMENTED | js/features/generator/team-selection-core.js exists, tests exist |
| refactor-phase5-players-management-core.md | FULLY IMPLEMENTED | js/features/players-management/players-management-core.js exists, tests exist |
| refactor-phase6-events-manager-selector.md | FULLY IMPLEMENTED | js/features/events-manager/event-selector-view.js exists, tests exist |
| refactor-phase7-alliance-notifications.md | FULLY IMPLEMENTED | js/features/notifications/notifications-core.js exists, tests exist |
| refactor-phase8-architecture-contracts.md | FULLY IMPLEMENTED | js/shell/bootstrap/app-shell-contracts.js, js/shared/state/state-store-contract.js, js/shared/data/data-gateway-contract.js all exist |
| refactor-phase9-shared-state-store.md | FULLY IMPLEMENTED | js/shared/state/app-state-store.js exists, tests exist |
| refactor-phase10-shell-controllers.md | FULLY IMPLEMENTED | js/shell/navigation/navigation-controller.js, js/shell/overlays/modal-controller.js, notifications-sheet-controller.js exist, tests exist |
| refactor-phase11-generator-controller.md | FULLY IMPLEMENTED | js/features/generator/generator-controller.js, generator-actions.js, generator-view.js exist, tests exist |
| refactor-phase12-players-management-controller.md | FULLY IMPLEMENTED | js/features/players-management/players-management-controller.js, actions, view all exist, tests exist |
| refactor-phase13-events-manager-controller.md | FULLY IMPLEMENTED | js/features/events-manager/events-manager-controller.js, events-manager-actions.js exist, tests exist |
| refactor-phase14-alliance-notifications-controllers.md | FULLY IMPLEMENTED | js/features/alliance/alliance-controller.js, js/features/notifications/notifications-controller.js exist, tests exist |
| refactor-phase15-firebase-gateway-decomposition.md | FULLY IMPLEMENTED | All 5 gateway modules + utils exist in js/shared/data/, tests exist |
| refactor-phase16-esm-and-tooling.md | PARTIALLY IMPLEMENTED | js/main.mjs and ESM bootstrap exist. Build uses esbuild (scripts/build.js) instead of Vite as doc describes. vite.config.mjs exists but esbuild is the actual bundler per CLAUDE.md |
| refactor-phase17-quality-gates.md | PARTIALLY IMPLEMENTED | ESLint, TypeScript typecheck, smoke tests all exist. CI is in pages.yml (not separate ci.yml). Playwright e2e added. No coverage enforcement in CI |

## Detailed Findings

### refactor-modern-architecture-plan.md
**Status**: PARTIALLY IMPLEMENTED
**What the doc describes**: Master plan targeting app.js <= 1000 lines, firebase-module.js removed from runtime, >= 90% coverage on core/shared, ESM-first boot with no script-order coupling.
**What exists in codebase**: All phases 0-17 artifacts are present. app.js is 8760 lines (grew from baseline 6645). firebase-module.js is 6030 lines and still loaded. index.html still uses legacy script loading. No Phase 18 (legacy retirement) exists.
**Missing items**: Success metrics not met. app.js grew instead of shrinking. No Phase 18 implemented. No coverage gate in CI.
**Recommendation**: Keep as roadmap reference. Update baseline numbers. Phase 18 is the critical remaining work.

### refactor-plan-validation-senior-software-developer.md
**Status**: PARTIALLY IMPLEMENTED
**What the doc describes**: Validation requiring Phase 18 (legacy retirement), CI coverage enforcement, browser e2e gate.
**What exists in codebase**: Playwright e2e exists and runs in CI (pages.yml). No coverage enforcement. No Phase 18.
**Missing items**: CI coverage gate, metric budget enforcement (partially done via check-size-budgets.js), Phase 18.
**Recommendation**: Keep as roadmap reference. Update to reflect Playwright e2e is done.

### refactor-phase0-baseline.md
**Status**: FULLY IMPLEMENTED
**What the doc describes**: Baseline tests, guardrail regression tests, manual checklist.
**What exists in codebase**: tests/phase0.regression.test.js, tests/phase1a.regression.test.js, npm test works. Extensive test suite (49+ test files).
**Missing items**: None.
**Recommendation**: Archive - completed.

### refactor-phase1-module-boundaries.md
**Status**: FULLY IMPLEMENTED
**What the doc describes**: Target module map with js/shell/, js/features/, js/shared/ directories and contract definitions.
**What exists in codebase**: All target directories exist with implementations: js/shell/bootstrap/, js/shell/navigation/, js/shell/overlays/, js/features/generator/, js/features/players-management/, js/features/events-manager/, js/features/alliance/, js/features/notifications/, js/shared/data/, js/shared/state/.
**Missing items**: None - all boundaries are established.
**Recommendation**: Archive - completed.

### refactor-phase2-composition-root.md
**Status**: FULLY IMPLEMENTED
**What the doc describes**: Shell bootstrap composition root with app-shell-bootstrap.js.
**What exists in codebase**: js/shell/bootstrap/app-shell-bootstrap.js, js/shell/bootstrap/app-shell-bootstrap.esm.mjs, tests/shell-bootstrap.integration.test.js.
**Missing items**: None.
**Recommendation**: Archive - completed.

### refactor-phase3-core-extraction.md
**Status**: FULLY IMPLEMENTED
**What the doc describes**: js/core/generator-assignment.js with normalizeAssignmentAlgorithm, comparePlayersForAssignment, etc.
**What exists in codebase**: File exists with described API. tests/generator-assignment.core.test.js exists.
**Missing items**: None.
**Recommendation**: Archive - completed.

### refactor-phase4-generator-team-selection.md
**Status**: FULLY IMPLEMENTED
**What the doc describes**: js/features/generator/team-selection-core.js with selection state transitions.
**What exists in codebase**: File exists with described API. tests/generator-team-selection.core.test.js exists.
**Missing items**: None.
**Recommendation**: Archive - completed.

### refactor-phase5-players-management-core.md
**Status**: FULLY IMPLEMENTED
**What the doc describes**: js/features/players-management/players-management-core.js with filter/sort/normalize logic.
**What exists in codebase**: File exists with described API. tests/players-management.core.test.js exists.
**Missing items**: None.
**Recommendation**: Archive - completed.

### refactor-phase6-events-manager-selector.md
**Status**: FULLY IMPLEMENTED
**What the doc describes**: js/features/events-manager/event-selector-view.js with selector render logic.
**What exists in codebase**: File exists. tests/events-manager-selector.feature.test.js exists.
**Missing items**: None.
**Recommendation**: Archive - completed.

### refactor-phase7-alliance-notifications.md
**Status**: FULLY IMPLEMENTED
**What the doc describes**: js/features/notifications/notifications-core.js with formatting helpers.
**What exists in codebase**: File exists. tests/notifications.core.test.js exists.
**Missing items**: None.
**Recommendation**: Archive - completed.

### refactor-phase8-architecture-contracts.md
**Status**: FULLY IMPLEMENTED
**What the doc describes**: Shell contracts, state store contract, data gateway contract, folder skeleton.
**What exists in codebase**: js/shell/bootstrap/app-shell-contracts.js, js/shared/state/state-store-contract.js, js/shared/data/data-gateway-contract.js all exist. tests/shell-contracts.core.test.js exists.
**Missing items**: None.
**Recommendation**: Archive - completed.

### refactor-phase9-shared-state-store.md
**Status**: FULLY IMPLEMENTED
**What the doc describes**: js/shared/state/app-state-store.js with createStore, selectors, app.js wiring.
**What exists in codebase**: File exists. tests/app-state-store.core.test.js exists.
**Missing items**: None.
**Recommendation**: Archive - completed.

### refactor-phase10-shell-controllers.md
**Status**: FULLY IMPLEMENTED
**What the doc describes**: Navigation controller, modal controller, notifications sheet controller.
**What exists in codebase**: All three files exist in js/shell/. tests/shell-navigation.controller.test.js and tests/shell-overlays.controller.test.js exist.
**Missing items**: None.
**Recommendation**: Archive - completed.

### refactor-phase11-generator-controller.md
**Status**: FULLY IMPLEMENTED
**What the doc describes**: Generator feature controller/actions/view modules.
**What exists in codebase**: js/features/generator/generator-controller.js, generator-actions.js, generator-view.js all exist. tests/generator-controller.feature.test.js exists.
**Missing items**: None.
**Recommendation**: Archive - completed.

### refactor-phase12-players-management-controller.md
**Status**: FULLY IMPLEMENTED
**What the doc describes**: Players management controller/actions/view modules.
**What exists in codebase**: All three files exist in js/features/players-management/. tests/players-management-controller.feature.test.js exists.
**Missing items**: None.
**Recommendation**: Archive - completed.

### refactor-phase13-events-manager-controller.md
**Status**: FULLY IMPLEMENTED
**What the doc describes**: Events manager controller and actions modules.
**What exists in codebase**: js/features/events-manager/events-manager-controller.js and events-manager-actions.js exist. tests/events-manager-controller.feature.test.js exists.
**Missing items**: None.
**Recommendation**: Archive - completed.

### refactor-phase14-alliance-notifications-controllers.md
**Status**: FULLY IMPLEMENTED
**What the doc describes**: Alliance controller and notifications controller.
**What exists in codebase**: js/features/alliance/alliance-controller.js and js/features/notifications/notifications-controller.js exist. tests/alliance-notifications-controller.feature.test.js exists.
**Missing items**: None.
**Recommendation**: Archive - completed.

### refactor-phase15-firebase-gateway-decomposition.md
**Status**: FULLY IMPLEMENTED
**What the doc describes**: Five focused gateway modules + utils, FirebaseService as composed facade.
**What exists in codebase**: js/shared/data/firebase-gateway-utils.js, firebase-auth-gateway.js, firebase-players-gateway.js, firebase-events-gateway.js, firebase-alliance-gateway.js, firebase-notifications-gateway.js all exist. Additional gateways added beyond plan: firebase-event-history-gateway.js, firebase-player-updates-gateway.js. tests/firebase-gateways.core.test.js exists.
**Missing items**: None - exceeds plan scope.
**Recommendation**: Archive - completed.

### refactor-phase16-esm-and-tooling.md
**Status**: PARTIALLY IMPLEMENTED
**What the doc describes**: ESM entrypoint (js/main.mjs, app-shell-bootstrap.esm.mjs), Vite build tooling.
**What exists in codebase**: js/main.mjs and app-shell-bootstrap.esm.mjs exist. vite.config.mjs exists but the actual build system uses esbuild via scripts/build.js (per CLAUDE.md: "esbuild only"). js/main-entry.js is the esbuild entrypoint producing dist/bundle.js. tests/esm-bootstrap.test.js exists.
**Missing items**: Vite is not the active bundler despite being configured. esbuild replaced it. Doc is outdated regarding tooling choice.
**Recommendation**: Move to roadmap. Update doc to reflect esbuild is the actual bundler. Vite config may be dead code.

### refactor-phase17-quality-gates.md
**Status**: PARTIALLY IMPLEMENTED
**What the doc describes**: ESLint, TypeScript typecheck, smoke tests, CI workflow (ci.yml).
**What exists in codebase**: .eslintrc.cjs, tsconfig.typecheck.json, types/global.d.ts all exist. tests/smoke-workflows.test.js exists. CI runs in .github/workflows/pages.yml (not separate ci.yml). Playwright e2e exists. scripts/check-size-budgets.js exists for size gates.
**Missing items**: No separate ci.yml (merged into pages.yml). No coverage enforcement in CI. Doc references ci.yml which doesn't exist.
**Recommendation**: Move to roadmap. Update to reflect actual CI structure and remaining coverage gap.

## Recommendation

### Archive (completed, no remaining work):
- refactor-phase0-baseline.md
- refactor-phase1-module-boundaries.md
- refactor-phase2-composition-root.md
- refactor-phase3-core-extraction.md
- refactor-phase4-generator-team-selection.md
- refactor-phase5-players-management-core.md
- refactor-phase6-events-manager-selector.md
- refactor-phase7-alliance-notifications.md
- refactor-phase8-architecture-contracts.md
- refactor-phase9-shared-state-store.md
- refactor-phase10-shell-controllers.md
- refactor-phase11-generator-controller.md
- refactor-phase12-players-management-controller.md
- refactor-phase13-events-manager-controller.md
- refactor-phase14-alliance-notifications-controllers.md
- refactor-phase15-firebase-gateway-decomposition.md

### Move to docs/refactor-roadmap/ (has remaining work):
- refactor-modern-architecture-plan.md — Success metrics unmet; app.js is 8760 lines (target: <= 1000). Needs Phase 18 planning.
- refactor-plan-validation-senior-software-developer.md — Coverage CI gate and Phase 18 still required.
- refactor-phase16-esm-and-tooling.md — Doc describes Vite but esbuild is actual bundler. Needs update.
- refactor-phase17-quality-gates.md — Coverage enforcement missing. CI structure differs from doc.

### Key Observation
The extraction phases (3-15) successfully created the modular architecture alongside app.js, but app.js has not been reduced -- it grew from ~6645 to 8760 lines. The feature controllers delegate TO app.js functions rather than replacing them. The critical next step is migrating logic OUT of app.js into the feature controllers, which is the unwritten Phase 18.

---

## Frontend Validation of UI/Component Extraction Phases (4-7, 10-14)

**Validator**: frontend-validator
**Date**: 2026-02-23

### 1. app.js Monolith Status

**Confirmed: app.js is 8760 lines and still monolithic.** It contains the actual implementations of functions like `clearPlayerSelection` (line 7410), `clearAllSelections` (line 7433), and many others. The feature controllers created in phases 10-14 do not replace this logic — they wrap it via a `dependencies` injection pattern that delegates back to app.js.

### 2. js/features/ — Feature Modules Exist but Are Thin Wrappers

Seven feature directories exist: alliance, event-history, events-manager, generator, notifications, player-updates, players-management. Each has controller/actions/view files as the refactor docs describe.

However, the controllers are **thin delegation layers**, not real logic owners:
- `generator-controller.js` (87 lines): Every method calls `dependencies.someFunction()` — the actual functions live in app.js. The controller adds minor guard checks (`typeof dependencies.X === 'function'`) but no business logic.
- `players-management-controller.js` (52 lines), `alliance-controller.js` (62 lines), `notifications-controller.js` (49 lines): Same pattern. Total controller code is ~302 lines across all features.

**The core extraction modules do contain real, self-contained logic:**
- `players-management-core.js` (107 lines): Genuine filter/sort/normalize logic with no app.js dependencies. Well-structured.
- `notifications-core.js` (89 lines): Real formatting helpers, self-contained.
- `team-selection-core.js`: Real state transition logic.
- `generator-assignment.js` in js/core/: Real algorithm extraction.

**Verdict**: The `-core.js` files (phases 3-7) are genuine extractions with real logic. The `-controller.js` files (phases 10-14) are scaffolding that delegates to app.js rather than owning the logic.

### 3. js/ui/ — Properly Separated

Four UI modules exist, all using correct IIFE pattern:
- `alliance-panel-ui.js` (22KB) — substantial, self-contained UI rendering
- `player-table-ui.js` (12KB) — substantial
- `event-buildings-editor-ui.js` (8KB)
- `event-list-ui.js` (4KB)

These are genuine UI extractions with real rendering logic.

### 4. js/core/ — Properly Extracted

Ten core modules exist (assignment.js, buildings.js, events.js, i18n.js, player-table.js, generator-assignment.js, etc.). All use IIFE pattern. These contain real domain logic.

### 5. Spot-Check of "FULLY IMPLEMENTED" Phases

- **Phase 4 (generator-team-selection)**: AGREE — `team-selection-core.js` exists with real selection state logic, tests exist.
- **Phase 5 (players-management-core)**: AGREE — `players-management-core.js` has genuine filter/sort/normalize logic (107 lines), fully self-contained.
- **Phase 11 (generator-controller)**: AGREE the files exist, but DISAGREE on completeness — the controller is a thin wrapper (87 lines) that delegates everything to app.js via `dependencies`. It does not own any logic. The phase artifact exists but the extraction is incomplete.

### 6. Extraction Work Still Needed

The architect's Key Observation is correct. The critical gap is:

1. **Controllers are shells, not logic owners.** Phases 10-14 created the file structure and test scaffolding, but the actual business logic remains in app.js. The controllers need to absorb the ~8000+ lines of logic from app.js.
2. **app.js should shrink to a thin wiring layer** (~200-500 lines) that instantiates controllers with dependencies and connects them to the DOM. Currently it is the opposite: app.js has the logic and controllers are the thin layer.

### Summary

| Area | Architect Finding | Frontend Validation |
|------|------------------|-------------------|
| Core extractions (phases 3-7) | FULLY IMPLEMENTED | **AGREE** — real, self-contained logic |
| Controller scaffolding (phases 10-14) | FULLY IMPLEMENTED | **PARTIALLY AGREE** — files/tests exist, but controllers delegate to app.js rather than owning logic |
| UI modules (js/ui/) | N/A (not phase-specific) | Properly separated, substantial code |
| app.js monolith | 8760 lines, needs Phase 18 | **CONFIRMED** — still the real logic owner |
