# Multi-Game Phase 5: Game-Aware Service Signatures (R0)

Date: 2026-02-18
Plan reference: `docs/architecture/multigame-implementation-plan.md` (Phase 5)

## Objective

Adopt game-aware service contracts with backward-compatible legacy signatures during migration.

## Implemented

1. Added optional `gameId` context support across gameplay service APIs in `js/services/firebase-service.js`:
- player, event, building, and alliance operations now accept optional context:
  - string `gameId`
  - `{ gameId }` object

2. Added legacy-signature compatibility behavior:
- If context is missing, methods still execute using active/default game context.
- One-time warning per method:
  - `[multigame][legacy-signature] ... called without explicit gameId`

3. Added context resolution primitives:
- `resolveGameplayContext(methodName, context)`
- active game context reuse and fallback behavior remain backward-compatible.

4. Added matching manager-side compatibility wrappers in `firebase-module.js`:
- gameplay methods now accept optional context signature and warn once when omitted.
- exported helper: `FirebaseManager.resolveGameplayContext(...)`.

5. Added tests for R0 compatibility:
- `tests/firebase-service.extended.test.js`
  - one-time legacy warning behavior
  - explicit gameId forwarding
- `tests/firebase-manager.events.integration.test.js`
  - manager-side context resolution behavior

## Validation

1. Unit/integration:
- `npm test`
- Result: `259 passed`, `0 failed`.

2. E2E smoke:
- `npm run test:e2e:smoke`
- Result: `8 passed`, `0 failed`, `2 skipped` (project/tag-conditional cases).

## Exit Criteria

- Game-aware service signatures are available with legacy compatibility: complete.
- Missing `gameId` usage is observable via warnings: complete.
- `R0` milestone reached for API surface migration start: complete.
