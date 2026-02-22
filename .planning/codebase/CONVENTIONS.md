# Conventions

## Module and Namespacing Pattern
- Browser modules commonly use IIFE wrappers:
  - pattern: `(function initX(global) { ... })(window);`
- Exposed APIs are attached to `window` under `DS*` namespaces:
  - examples: `DSCoreEvents`, `DSCoreGames`, `DSFeatureGeneratorController`, `DSShellNavigationController`.
- ESM is used sparingly and primarily for bootstrap (`js/main.mjs`).

## Defensive Coding Style
- Frequent guard checks for missing dependencies:
  - `if (!global.FirebaseService || typeof global.FirebaseService.foo !== 'function') { ... }`
- Safe fallbacks are preferred over throwing:
  - `js/services/firebase-service.js` returns default objects/arrays when manager is absent.
- Inputs are normalized before use:
  - IDs via lowercase/underscore normalization.
  - numeric coercion via `Number(...)` + `Number.isFinite(...)`.

## Data Normalization Patterns
- Event/building payload sanitizers in core modules:
  - `js/core/events.js`
  - `js/core/buildings.js`
- Gameplay/game context normalization:
  - `js/services/firebase-service.js` (`normalizeGameId`, context resolvers).
- Deep copy convention often uses JSON clone:
  - `JSON.parse(JSON.stringify(value))` in core/store modules.

## Naming Conventions
- File names are kebab-case (`events-manager-controller.js`, `state-store-contract.js`).
- Function names are verb-oriented and explicit (`resolveGameplayContext`, `setBuildingPositionsVersion`).
- Constants use uppercase with underscores (`DEFAULT_GAME_ID`, `ACTIVE_GAME_STORAGE_KEY`).

## UI and Accessibility Practices
- DOM IDs are stable and semantic (`navMenuBtn`, `notificationBtn`, `alliancePage`).
- ARIA attributes are set for menu and modal interactions in `index.html` and shell controllers.
- Translations follow key-based lookup (`translations.js` + `js/core/i18n.js`).

## Testing Conventions
- Node tests use built-in runner + strict assertions:
  - `const test = require('node:test')`
  - `const assert = require('node:assert/strict')`
- Test naming emphasizes behavior and outcome ("delegates", "normalizes", "returns safe fallback").
- Tests typically reset global module state by clearing `require.cache` and reloading modules.

## Refactor Direction Conventions
- Controller/action/view separation is being applied per feature (`js/features/*`).
- Shell/data/state contracts are explicit (`js/shell/bootstrap/app-shell-contracts.js`, `js/shared/*/*-contract.js`).
- Legacy compatibility layers remain in place while phased docs in `docs/` drive incremental migration.
