# Multi-Game Phase 2: Game Catalog and Policy Primitives

Date: 2026-02-18
Plan reference: `docs/architecture/multigame-implementation-plan.md` (Phase 2)

## Objective

Establish canonical programmatic game definitions and super-admin policy primitives.

## Implemented

1. Added game catalog core module:
- `js/core/games.js`
- Canonical `last_war` definition includes:
  - `id`, `name`, `logo`, `company`
  - `troopModel`
  - `playerImportSchema`
  - `assignmentAlgorithmIds`

2. Added fixed super-admin policy primitive:
- `GAME_METADATA_SUPER_ADMIN_UID = 2z2BdO8aVsUovqQWWL9WCRMdV933`
- `isGameMetadataSuperAdmin(userOrUid)`
- `canEditGameMetadata(userOrUid, gameId)`

3. Added assignment registry skeleton:
- `js/core/assignment-registry.js`
- Includes `balanced_round_robin` as default algorithm id.

4. Added service API:
- `FirebaseService.listAvailableGames()`
- Uses manager delegation when available; falls back to core catalog.

5. Wired runtime script loading:
- Added `js/core/games.js` and `js/core/assignment-registry.js` to `index.html`.

6. Added translation seeds for phase scaffolding:
- `game_selector_title`
- `game_metadata_admin_menu`
- `game_last_war_name`

## Validation

1. Unit/integration:
- `npm test`
- Result: `250 passed`, `0 failed`.

2. E2E smoke:
- `npm run test:e2e:smoke`
- Result: `8 passed`, `0 failed`, `2 skipped` (project/tag-conditional cases).

## Exit Criteria

- Programmatic catalog and super-admin policy primitives are in place: complete.
- Assignment registry skeleton is available for later algorithm phases: complete.
- Service exposes `listAvailableGames()` for UI/runtime usage: complete.
