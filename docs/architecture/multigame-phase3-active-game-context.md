# Multi-Game Phase 3: Runtime Active Game Context

Date: 2026-02-18
Plan reference: `docs/architecture/multigame-implementation-plan.md` (Phase 3)

## Objective

Make active game context mandatory in signed-in runtime and persist it between sessions.

## Implemented

1. Added active game context APIs in `js/services/firebase-service.js`:
- `getActiveGame()`
- `setActiveGame(gameId)`
- `clearActiveGame()`
- `ensureActiveGame()`
- `requireActiveGame()`

2. Added typed context error:
- `missing-active-game` (error code + key) from service guard.

3. Wired post-auth context enforcement in `js/app-init.js`:
- On sign-in: `ensureActiveGame()` and cache in `window.__ACTIVE_GAME_ID`.
- On sign-out: clear active game context and cached id.

4. Added app-level game context helpers in `app.js`:
- `setActiveGame()` / `getActiveGame()` exposed on `window`.
- Runtime guard helper for gameplay actions.
- Active game badge update helper.

5. Added minimal active game badge element to header in `index.html`:
- `#activeGameBadge`

6. Added/updated tests:
- `tests/firebase-service.test.js`
- `tests/firebase-service.extended.test.js`
- `tests/app-init.extended.test.js`

## Validation

1. Unit/integration:
- `npm test`
- Result: `255 passed`, `0 failed`.

2. E2E smoke:
- `npm run test:e2e:smoke`
- Result: `8 passed`, `0 failed`, `2 skipped` (project/tag-conditional cases).

## Exit Criteria

- Signed-in runtime now always establishes active game context: complete.
- Active game pointer is persisted and cleared on sign-out: complete.
- Gameplay runtime has typed guard for missing context: complete.
