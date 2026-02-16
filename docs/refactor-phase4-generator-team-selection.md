# JS Refactor Phase 4: Generator Team Selection Module

Date: 2026-02-16

## Objective
Extract generator team-selection state transitions and counters from `app.js` into a dedicated feature module.

## Implemented

1. Added generator team-selection core module:
   - `js/features/generator/team-selection-core.js`
   - Exposes:
     - `getStarterCount(selections, teamKey)`
     - `getSubstituteCount(selections, teamKey)`
     - `getCurrentTeamCounts(selections)`
     - `buildTeamSelectionMaps(selections)`
     - `hasAnySelectedPlayers(selections)`
     - `toggleTeamSelection(selections, playerName, team, limits)`
     - `setPlayerRole(selections, playerName, nextRole, limits)`
     - `clearPlayerSelection(selections, playerName)`
     - `clearAllSelections()`

2. Updated script loading:
   - Added `js/features/generator/team-selection-core.js` to `index.html` before `app.js`.

3. Updated `app.js` to delegate generator selection logic to feature module:
   - Counter helpers now read from `DSFeatureGeneratorTeamSelection`.
   - Selection actions (`toggleTeam`, `togglePlayerRole`, `clearPlayerSelection`, `clearAllSelections`) use module transitions.
   - Preserved fallback behavior in `app.js` when feature module is unavailable.

4. Added unit tests:
   - `tests/generator-team-selection.core.test.js`
   - Covers counts/maps, team toggling, starter/substitute defaulting, role-limit enforcement, and clear helpers.

## Scope Notes
- No intended UX or assignment output changes.
- Extraction keeps existing app wiring while reducing selection-domain logic in `app.js`.

## Validation
- `npm test` passes after changes.
