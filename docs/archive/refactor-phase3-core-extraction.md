# JS Refactor Phase 3: Core Domain Extraction

Date: 2026-02-16

## Objective
Extract pure generator-assignment preparation logic out of `app.js` into a dedicated core module.

## Implemented

1. Added new pure core module:
   - `js/core/generator-assignment.js`
   - Exposes:
     - `normalizeAssignmentAlgorithm(value)`
     - `comparePlayersForAssignment(a, b)`
     - `mapSelectionsToPlayers(selections, playerDatabase)`
     - `preparePlayersForAssignment(selections, playerDatabase)`

2. Updated script loading:
   - Added `js/core/generator-assignment.js` to `index.html` before `app.js`.

3. Simplified `app.js`:
   - Removed duplicated assignment compare/prep helper functions.
   - `generateTeamAssignments()` now uses `DSCoreGeneratorAssignment.preparePlayersForAssignment(...)`.
   - Removed unused local `findMixPartner` wrapper.

4. Added unit tests:
   - `tests/generator-assignment.core.test.js`
   - Covers algorithm normalization, mapping behavior, and sorting fallback behavior.

## Scope Notes
- No intended behavior changes for generator outputs.
- This phase is extraction-only to reduce `app.js` domain logic density.

## Validation
- `npm test` passes after changes.
