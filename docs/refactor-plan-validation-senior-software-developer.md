# Senior Software Developer Validation: Refactor Implementation Plan

Date: 2026-02-18
Validator: `senior-software-developer` agent

## Decision
`approved_with_conditions`

## Scope
- `docs/refactor-modern-architecture-plan.md`
- `docs/refactor-phase8-architecture-contracts.md` through `docs/refactor-phase17-quality-gates.md`
- Runtime and gates validation in current repo state

## Findings

1. High: Stated success metrics are not yet enforced in runtime.
- Plan metric says `app.js` should be `<= 1000` lines, but current `app.js` is `6645` lines.
- Plan target says Firebase monolith should be removed from runtime path, but `firebase-module.js` is still loaded in `index.html`.
- Plan target says no manual script-order coupling; current `index.html` still loads multiple deferred globals before module bootstrap.

2. Medium: CI quality gates do not fully enforce declared plan metrics.
- CI runs lint, typecheck, test, smoke.
- CI does not run `test:coverage` and does not assert success metrics like file-size budget or runtime-path retirement checks.

3. Medium: Workflow coverage is strong at node-level but lacks real-browser e2e gate.
- Current smoke tests validate controller-addressable workflows.
- No browser-level automated gate exists for navigation/menu/modals/render interactions in a real engine.

## Required changes

1. Add Phase 18: Legacy Runtime Retirement and Metrics Enforcement.
- Enforce ESM-primary boot path.
- Define objective thresholds for removing `firebase-module.js` from runtime.
- Add rollback switch for one release window.

2. Add CI enforcement for plan-level metrics.
- Add `npm run test:coverage` into CI.
- Add a small script that fails CI if:
  - `app.js` line budget threshold is exceeded for the phase target
  - `index.html` still includes legacy scripts after retirement phase flag is enabled

3. Add browser e2e smoke gate.
- Introduce Playwright smoke for login, page navigation, players/events/generator critical flows.
- Keep it separate from existing node unit/integration tests.

## Validation evidence
- `npm.cmd run lint` passed.
- `npm.cmd run typecheck` passed.
- `npm.cmd test` passed (100/100).
- `npm.cmd run test:smoke` passed (5/5).
- `app.js` line count observed: `6645`.
- `firebase-module.js` line count observed: `3195`.
- `index.html` still includes:
  - `firebase-module.js`
  - `js/services/firebase-service.js`
  - `app.js`
  - `js/main.mjs`

## Re-validation gates
- Plan update includes Phase 18 with measurable exit criteria.
- CI enforces coverage and metric checks.
- Browser e2e smoke runs green in CI.
