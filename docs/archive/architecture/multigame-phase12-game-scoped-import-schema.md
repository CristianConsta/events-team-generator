# Multi-Game Phase 12: Per-Game Upload Schema and Template

Date: 2026-02-18  
Plan reference: `docs/architecture/multigame-implementation-plan.md` (Phase 12)

## Objective

Support game-specific player import schema/template contracts and fail uploads with a clear localized error when a wrong-game template is used.

## Implemented

1. Added game-aware import schema resolution in `firebase-module.js`:
- default schema fallback (`last_war_players_v1`)
- resolver reads `DSCoreGames.getGame(gameId).playerImportSchema`
- normalized fields: `sheetName`, `headerRowIndex`, `columns`, `templateFileName`

2. Added schema validation and parsing in `firebase-module.js`:
- validates required sheet and required headers
- returns typed error on mismatch:
  - `errorKey: 'players_upload_schema_mismatch'`
  - `errorParams: { sheet, columns }`
- personal and alliance upload flows now parse from resolved schema

3. Updated upload flows to be explicitly game-context aware:
- `uploadPlayerDatabase(file, context)` now resolves `gameId`
- wrapper now passes resolved context to upload function
- personal upload save path persists with explicit `{ gameId }`

4. Updated template generation in `app.js`:
- template columns/sheet/file now derive from active game schema
- header row placement honors schema `headerRowIndex`

5. Improved upload error presentation in `app.js`:
- centralized upload error formatting now handles `errorKey` + `errorParams`
- localized schema mismatch now shown in existing upload status UI

6. Added localization key across all supported languages in `translations.js`:
- `players_upload_schema_mismatch`

## Validation

1. Unit/integration:
- `npm test`
- Result: `273 passed`, `0 failed`.

2. E2E smoke:
- `npm run test:e2e:smoke`
- Result: `10 passed`, `0 failed`, `2 skipped`.

## Exit Criteria

- Upload parsing and template generation are schema-driven per game: complete.
- Wrong-template upload path returns localized validation error: complete.
