# Coding Conventions

**Analysis Date:** 2026-02-25

## Naming Patterns

**Files:**
- kebab-case for all filenames: `player-table.js`, `assignment-registry.js`, `event-history-controller.js`
- Feature directories use kebab-case: `js/features/player-updates/`, `js/features/generator/`
- Test files use descriptive suffixes: `.core.test.js` (unit), `.integration.test.js`, `.feature.test.js`, `.extended.test.js`

**Functions:**
- camelCase for all function names: `normalizePlayerData()`, `assignTeamToBuildings()`, `toggleTeamSelection()`
- Private helper functions are also camelCase with no underscore prefix
- Factory functions prefix with `make` or `create`: `makePlayer()`, `createController()`, `createUtils()`
- Constructor/factory functions are regular functions, not classes

**Variables:**
- camelCase for all variable names: `currentEvent`, `allPlayers`, `teamSelections`, `activeGameContextCache`
- Global module exports use PascalCase with scope prefix: `DSCoreAssignment`, `DSFeatureGeneratorController`, `FirebaseService`, `DSI18N`
- Constants are UPPER_CASE: `MAX_UPLOAD_BYTES`, `POWER_SIMILARITY_THRESHOLD`, `INVITE_MAX_RESENDS`
- Object properties are camelCase: `assignment.buildingKey`, `player.reliabilityScore`
- Boolean properties often use `is` or `can` prefix: `isSigned`, `canFinalize`, `hasAlliance`

**Types/Objects:**
- Data objects use camelCase properties consistently
- Event objects follow pattern: `{ eventId, eventName, logoDataUrl, mapDataUrl, buildingConfig, ... }`
- Player objects follow pattern: `{ name, power, thp, troops, reliabilityScore, ... }`
- Assignment objects follow pattern: `{ building, buildingKey, priority, player, troops, power, thp }`

## Code Style

**Formatting:**
- No formatter configured (no Prettier)
- 4-space indentation (no tabs)
- Consistent with ESLint recommended rules
- Lines may exceed 80 characters; no hard limit enforced

**Linting:**
- ESLint with `@eslint/js` recommended config
- Old config: `.eslintrc.cjs` (CJS format)
- New config: `eslint.config.js` (ESLint flat config, newer format)
- Both configs coexist; prefer new flat config
- Key rules:
  - `no-unused-vars`: warn, with `args: 'none'` (unused parameters allowed)
  - `no-undef`: off for `app.js`, `firebase-module.js`, `js/app-init.js`, `js/core/i18n.js` (IIFE scope confusion)
  - `no-inner-declarations`: off for same files
  - `no-useless-assignment`: off (avoid false positives in browser code)
  - `sourceType: 'script'` for most files (CommonJS-style IIFEs)
  - `sourceType: 'module'` for `.mjs` files only

**Run linting:**
```bash
npm run lint              # ESLint check
npm run lint:ci          # CI variant (same as lint)
npm run check:budgets    # Check file size budgets for app.js (6000 lines) and firebase-module.js (7000 lines)
```

## Import Organization

**Order in CommonJS test files:**
```javascript
const test = require('node:test');              // Node built-in
const assert = require('node:assert/strict');   // Node built-in
const path = require('node:path');              // Node built-in
// ... blank line

const modulePath = path.resolve(__dirname, '../path/to/module.js');
// ... other module paths

// ... blank line
function loadModule() { ... }  // Helpers
```

**Order in IIFE module exports (js/main-entry.js):**
```javascript
require('../firebase-infra.js');           // Firebase setup
require('../firebase-auth-module.js');
require('../firebase-module.js');
require('../translations.js');             // Localization
require('./core/firestore-utils.js');      // Core utilities
require('./core/games.js');                // Core logic
require('./core/events.js');
require('./features/...');                 // Feature modules
require('./shell/...');                    // App shell modules
require('./shared/...');                   // Shared utilities
```

**Path aliases:** None used. All paths are relative or absolute.

## Error Handling

**Patterns:**
- Defensive null checks before property access: `typeof value === 'string' ? value : ''`
- Type guards using `typeof` and `Array.isArray()`: `if (typeof handler === 'function')`
- Fallback values for missing data: `Number(value) || 0`, `items || []`
- Try-catch blocks wrap storage/DOM operations that can fail:
  ```javascript
  try {
    global.localStorage.setItem('ds_language', lang);
  } catch (error) {
    console.warn('Unable to persist language preference', error);
  }
  ```
- Errors logged to console but not thrown (graceful degradation):
  ```javascript
  if (!svc) {
    return typeof fallback === 'function' ? fallback() : fallback;
  }
  ```
- No custom error classes; errors are handled synchronously or logged
- Gateway pattern (`withManager()`) returns fallback value instead of throwing:
  ```javascript
  withManager: function(fn, fallback) {
    const svc = manager();
    if (!svc) return typeof fallback === 'function' ? fallback() : fallback;
    return fn(svc);
  }
  ```

## Logging

**Framework:** `console` (no logger library)

**Patterns:**
- `console.warn()` for recoverable issues: `console.warn('Unable to persist...', error)`
- `console.error()` for startup failures: `console.error('FirebaseService not available')`
- `console.log()` for Firebase init confirmation: `console.log('✅ Firebase config loaded')`
- Emoji prefixes used informally for console output: ✅ (success), ❌ (error), but not part of code conventions

**When to log:**
- Firebase module initialization status
- Storage operation failures (localStorage)
- Missing configuration
- Auth state changes (in Firebase module only)
- Do NOT log inside business logic (core, features) — log at boundaries (firebase-service, controllers)

## Comments

**When to comment:**
- Block comments at file/function top-level explaining purpose
- Example: `// FIREBASE MODULE FOR DESERT STORM & CANYON BATTLEFIELD` at top of `firebase-module.js`
- Example: `// Module paths` section header in test files
- Example: `// Capture module references at load time` to explain unusual pattern
- Explain WHY, not WHAT: "Survives test cleanup of global" is better than "Store DSFirebaseInfra"

**JSDoc/TSDoc:**
- Not used; codebase has no JSDoc conventions
- Function signatures self-document via parameter names and test coverage

**Example from `firebase-module.js` (line 20-22):**
```javascript
// Capture module references at load time (survives test cleanup of global)
var DSFirebaseInfra = (typeof window !== 'undefined' && window.DSFirebaseInfra) || ...
```

## Function Design

**Size:** No strict limit; typical functions range 20-50 lines
- `assignTeamToBuildings()` in `assignment.js` spans ~60 lines (complex algorithm)
- Most utility functions are 10-20 lines
- Controllers delegate to smaller action/core functions

**Parameters:**
- No rest parameters (`...args`) or destructuring
- Pass dependency objects as `deps` parameter: `createController(deps)` then `deps.generatorActions`
- Avoid parameter defaults; use guards instead:
  ```javascript
  function normalizeString(value) {
    return typeof value === 'string' ? value : '';
  }
  ```

**Return values:**
- Synchronous functions return data directly or `null` (not `undefined`)
- Async functions return Promises (used in Firebase gateway methods)
- Functions that may fail return fallback objects: `{ success: false, error: 'reason' }`
- Example from `firebase-service.js`:
  ```javascript
  fallback: { success: false, error: 'Firebase not loaded' }
  ```

## Module Design

**Exports:**
- IIFE pattern mandatory: `(function initModuleName(global) { ... global.ModuleName = { ... } })(window)`
- All public exports attached to `global` object (in browser) or `window`
- Namespace follows pattern: `DS{Category}{ComponentName}` or `FirebaseService`, `DSI18N`
- Example namespaces:
  - `DSCore*` — pure logic: `DSCoreAssignment`, `DSCoreEvents`, `DSCorePlayerTable`
  - `DSFeature*` — feature controllers/views: `DSFeatureGeneratorController`, `DSFeatureEventHistoryCore`
  - `DSShell*` — app shell: `DSShellNavigationController`, `DSShellModalController`
  - `DSShared*` — shared utilities: `DSAppStateStore`, `DSSharedFirebaseGatewayUtils`
  - `FirebaseManager`, `FirebaseService`, `DSI18N`, `DSThemeColors` — core infrastructure

**Barrel Files:**
- Not used; each feature module is a separate file
- Controllers often delegate to separate `*-actions.js`, `*-core.js`, `*-view.js` files in same directory

**Example from `assignment.js`:**
```javascript
(function initAssignmentCore(global) {
    // Helper functions (private)
    function toNumeric(value) { ... }
    function comparePlayersForAssignment(a, b) { ... }

    // Public API
    global.DSCoreAssignment = {
        findMixPartner: findMixPartner,
        assignTeamToBuildings: assignTeamToBuildings,
        assignTeamToBuildingsAggressive: assignTeamToBuildingsAggressive,
        sortBuildingsByPriority: sortBuildingsByPriority,
    };
})(window);
```

## Validation

**Pattern:** Normalize inputs before using them:
```javascript
function filterAndSortPlayers(players, options) {
    const source = Array.isArray(players) ? players : [];
    const config = options && typeof options === 'object' ? options : {};
    const searchTerm = normalizeString(config.searchTerm).trim().toLowerCase();
    // ... now safe to use
}
```

**Type checking order:**
1. Check existence: `typeof value !== 'undefined'`
2. Check type: `typeof value === 'string'`, `Array.isArray(value)`
3. Fallback: `value || defaultValue`
4. Never assume; always guard

## Data Flow

**Data objects:**
- Immutable where possible (use `Object.freeze()` for constants)
- Example: `const MULTIGAME_FLAG_DEFAULTS = Object.freeze({ ... })`
- Arrays cloned before mutation: `[...players].sort(...)`, `available.slice(1)`
- Objects cloned via JSON: `JSON.parse(JSON.stringify(value))` for deep copy (used in `cloneDeep()`)

**Callbacks:**
- Stored in objects, not global variables: `{ onApply: callback }`
- Example from `i18n.js`: `hooks = { onApply: options && typeof options.onApply === 'function' ? options.onApply : null }`
- Callbacks checked before invocation: `if (hooks.onApply) { hooks.onApply(...) }`

## Dependency Injection

**Pattern:** Pass dependencies as parameter object rather than accessing globals:
```javascript
function createController(deps) {
    const dependencies = deps && typeof deps === 'object' ? deps : {};
    return {
        method: function() {
            if (typeof dependencies.handler === 'function') {
                dependencies.handler();
            }
        }
    };
}
```

**Fallback:** If dependency missing, use global as backup:
```javascript
var actions = dependencies.generatorActions || global.DSFeatureGeneratorActions;
```

This pattern enables testing without mocking globals.

---

*Convention analysis: 2026-02-25*
