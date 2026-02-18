# Multi-Game Phase 11: Algorithm Registry and Per-Event Resolution

Date: 2026-02-18  
Plan reference: `docs/architecture/multigame-implementation-plan.md` (Phase 11)

## Objective

Enable event-level assignment strategy selection by game and enforce a hard-fail on unknown configured algorithms.

## Implemented

1. Extended algorithm registry in `js/core/assignment-registry.js`:
- added `resolveAlgorithmSelection(gameId, assignmentAlgorithmId)` with typed error payload:
  - `error: 'unknown-assignment-algorithm'`
- kept backward-compatible `resolveAlgorithmForEvent(...)` behavior.

2. Added event algorithm metadata support in event core and persistence:
- `js/core/events.js` now stores `assignmentAlgorithmId` per event.
- `firebase-module.js` now reads/writes `assignmentAlgorithmId` in event payloads and metadata APIs.
- default fallback algorithm id is `balanced_round_robin`.

3. Added event editor algorithm selector UI:
- `index.html`: new `#eventAssignmentAlgorithmInput` select in Events Manager editor.
- `app.js`: renders game-scoped algorithm options, persists selected algorithm on save.
- `translations.js`: added `events_manager_algorithm_label` across all languages.

4. Wired generator execution to event algorithm resolution:
- `app.js` now resolves current event algorithm via registry before assignment generation.
- unknown/mismatched algorithm now hard-fails with:
  - `unknown-assignment-algorithm`
  - localized user-facing message key `assignment_algorithm_unknown`.

5. Added/updated tests:
- `tests/assignment-registry.core.test.js`
- `tests/events.core.test.js`
- `tests/events.core.extended.test.js`
- `tests/firebase-manager.events.integration.test.js`

## Validation

1. Unit/integration:
- `npm test`
- Result: `273 passed`, `0 failed`.

2. E2E smoke:
- `npm run test:e2e:smoke`
- Result: `10 passed`, `0 failed`, `2 skipped`.

## Exit Criteria

- Event-level algorithm metadata exists and persists: complete.
- Generator resolves per-event strategy by active game: complete.
- Unknown configured algorithm hard-fails with typed error: complete.
