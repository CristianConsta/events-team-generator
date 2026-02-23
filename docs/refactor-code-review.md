# Phase 16-18 Refactor — Code Review

**Reviewer:** code-reviewer agent
**Date:** 2026-02-23
**Scope:** New extraction modules + modified app.js, index.html, main-entry.js, CI workflow, size-budget script, and associated tests.

---

## CRITICAL

### C-1 — `download-controller.js` accesses the global `FirebaseService` directly (line 354)

**File:** `js/features/generator/download-controller.js:354`

```js
var activePlayerDB = (typeof FirebaseService !== 'undefined' && FirebaseService.getActivePlayerDatabase && gameplayContext)
    ? FirebaseService.getActivePlayerDatabase(gameplayContext)
    : {};
```

All other access to Firebase in this module is done through the injected `deps` object. This line reaches out to the bare global `FirebaseService` instead of `deps.FirebaseService` (or `deps.getFirebaseService()`). This breaks the dependency-injection contract, makes the function untestable in isolation, and will silently fall back to `{}` in any environment where the global is not present (including tests). It is the only instance in the module where a dep is not injected — it looks like a leftover from the original copy.

**Fix:** Replace with `deps.FirebaseService` or a `deps.getFirebaseService()` call, matching the pattern used in the rest of the module.

---

### C-2 — `download-controller.js` has a module-level mutable side-effect variable `deps_MAP_CANVAS_WIDTH`

**File:** `js/features/generator/download-controller.js:250,253-254,343-344`

```js
// Module-level constant placeholder — set from deps on first call
var deps_MAP_CANVAS_WIDTH = 1080;

async function generateMapWithoutBackground(team, assignments, statusId, deps) {
    var MAP_CANVAS_WIDTH = deps.MAP_CANVAS_WIDTH;
    deps_MAP_CANVAS_WIDTH = MAP_CANVAS_WIDTH;   // mutates module state
    ...
}
```

`drawGeneratedMapHeader` reads `deps_MAP_CANVAS_WIDTH` as a module-scoped free variable (line 185). This is a design smell: the value is set as a side-effect of calling `generateMapWithoutBackground` or `generateMap`, so `drawGeneratedMapHeader` will use the wrong (initial) value of `1080` if called before either of those functions are called. The comment calls it a "constant placeholder", yet it is mutable. `drawGeneratedMapHeader` should receive the canvas width as part of `options` instead of relying on this module-level variable.

---

## MAJOR

### M-1 — `'use strict'` missing in three of the five new extraction modules

**Files:**
- `js/features/players-management/player-data-upload.js` — no `'use strict'`
- `js/features/buildings/buildings-config-manager.js` — no `'use strict'`
- `js/features/buildings/coordinate-picker-controller.js` — no `'use strict'`

`events-registry-controller.js` and `download-controller.js` both correctly include `'use strict'` at the top of their IIFEs. The remaining three do not. In non-strict mode, accidental global variable creation (e.g. a typo in a `var` declaration inside a nested function) goes silently undetected.

**Fix:** Add `'use strict';` as the first statement inside each IIFE that is missing it.

---

### M-2 — `buildings-config-manager.js` builds HTML via string concatenation with user-controlled data (`renderBuildingsTable`)

**File:** `js/features/buildings/buildings-config-manager.js:144-147`

```js
row.innerHTML = '\n            <td>\n                <div class="building-field-cell">\n                    <input ... value="' + escapeAttribute((b.label || b.name)) + '" ...
```

`escapeAttribute` is called for the `value` attribute, which is correct. However the same `label`/`name` values are interpolated unescaped into `title` and `aria-label` attributes multiple times within the same template string (e.g., `'Lock name'` / `'Edit name'` are hardcoded strings so those are safe, but the pattern of mixing escaped and unescaped attribute values in a long template string is fragile and easy to break). Verify all attribute interpolations in this block use `escapeAttribute`, or switch to DOM creation methods for safety.

On review, the `title` and `aria-label` values in this block appear to be hardcoded English strings only (`'Lock name'`, `'Edit name'`, etc.) so there is no immediate XSS. However the pattern is brittle — a future edit to include a building name in one of those attributes would introduce a vulnerability. The structure should be refactored to use `createElement`/`setAttribute` or at minimum document this constraint clearly.

---

### M-3 — `coordinate-picker-controller.js` accesses `deps.EVENT_REGISTRY` as a plain object property (line 314)

**File:** `js/features/buildings/coordinate-picker-controller.js:314`

```js
function openCoordinatesPickerForEvent(eventId, state, deps) {
    if (deps.EVENT_REGISTRY[eventId]) {
        deps.switchEvent(eventId);
    }
    openCoordinatesPicker(state, deps);
}
```

`deps.EVENT_REGISTRY` is not documented as part of the deps contract and is not provided in the corresponding test stubs. All other deps functions use `getEvent`, `getEventIds`, or `getActiveEvent` through the controller abstraction. Accessing a raw registry object bypasses any lazy-init or normalization that `getEvent` performs, and it will throw a TypeError if `deps.EVENT_REGISTRY` is undefined (as it will be in most test setups). Use `deps.getActiveEvent ? deps.getActiveEvent() : null` or `global.DSCoreEvents.getEvent(eventId)` instead.

---

### M-4 — `download-controller.feature.test.js` uses `global.window = global` pattern without restoration

**File:** `tests/download-controller.feature.test.js:15`

```js
global.window = global;
```

This is done at module top-level (not inside `beforeEach`/`afterEach`) and is never restored. It permanently mutates `global` for the entire test process lifetime. If other test files are loaded in the same process that depend on `window` being different from `global`, this could cause subtle cross-test contamination. The more robust pattern used in `events-registry-controller.feature.test.js` correctly saves/restores `globalThis.window` inside `loadController`.

---

## MINOR

### N-1 — `getStarterCardStartX` in `download-controller.js` is an identity function (dead code)

**File:** `js/features/generator/download-controller.js:472-474`

```js
function getStarterCardStartX(anchorX, cardWidth) {
    return anchorX;
}
```

`cardWidth` is accepted but unused. The function just returns `anchorX`. This is dead code / premature abstraction. Either remove the function and inline `x` (the anchor) directly, or document why the indirection is needed.

---

### N-2 — `check-size-budgets.js` budgets are very loose relative to the refactor goal

**File:** `scripts/check-size-budgets.js:21-26`

```js
{ file: 'app.js',           maxLines: resolveMax('APP_JS_MAX_LINES', 6000) },
{ file: 'firebase-module.js', maxLines: resolveMax('FIREBASE_MODULE_MAX_LINES', 6100) },
```

The refactor is explicitly aimed at shrinking `app.js`. A 6000-line budget does not enforce the shrinkage goal. Consider tightening these budgets to reflect the actual post-refactor sizes (e.g., add a step after each phase that lowers the budget) so the CI gate actually catches regressions.

---

### N-3 — Rollback switch in `index.html` does not include several modules present in `main-entry.js`

**File:** `index.html:984` (rollback legacy script list)

The legacy fallback list in the rollback switch is missing entries that appear in `main-entry.js`:

- `js/core/firestore-utils.js`
- `js/core/reliability.js`
- `js/features/event-history/*` (4 files)
- `js/features/player-updates/*` (4 files)
- `js/shell/*` (5 files: `app-shell-contracts.js`, `navigation-controller.js`, `modal-controller.js`, `notifications-sheet-controller.js`, `app-shell-bootstrap.js`)

If a user appends `?legacy=1` to the URL, the app will break because these modules will not load. The rollback switch should be kept in sync with `main-entry.js` or removed if it is only a development aid.

---

### N-4 — CI `stage deploy files` step copies individual JS files redundantly with `cp -r js`

**File:** `.github/workflows/pages.yml:132-133`

```yaml
cp index.html player-update.html app.js firebase-module.js firebase-config.js translations.js styles.css player-update.css _site/
cp -r js _site/js
```

`app.js` is copied individually AND implicitly included via `cp -r js` would be incorrect for it (it lives at the root, not under `js/`), so the explicit copy is correct. However, `firebase-module.js` and `translations.js` are at the root too, and they are copied individually even though they are not under `js/`. This is fine as-is. No functional issue — this is just a note for reviewers.

---

### N-5 — `phase17-authorization.core.test.js` hardcodes a super-admin UID

**File:** `tests/phase17-authorization.core.test.js:9`

```js
const SUPER_ADMIN_UID = '2z2BdO8aVsUovqQWWL9WCRMdV933';
```

A production UID is hardcoded in a test file that is committed to the repository. While this is not a secret (it is an auth UID, not a credential), it couples the test to a specific production user. If the super-admin UID ever changes, the test silently tests the wrong thing. Consider reading this value from an environment variable or extracting it to a test-only fixture constant.

---

## Summary

| Severity | Count | Issues |
|----------|-------|--------|
| CRITICAL | 2 | C-1 (global FirebaseService leak in download-controller), C-2 (mutable module var deps_MAP_CANVAS_WIDTH) |
| MAJOR    | 4 | M-1 (missing `'use strict'`), M-2 (innerHTML with mixed escaping), M-3 (raw registry access in coord picker), M-4 (unrestored global mutation in test) |
| MINOR    | 5 | N-1 (dead identity function), N-2 (loose size budgets), N-3 (rollback list out of sync), N-4 (CI copy step note), N-5 (hardcoded prod UID) |

### Verdict

The IIFE module pattern is correctly used in all five new files. File naming is kebab-case, functions are camelCase, no TypeScript, no npm browser packages, no `eval`, no SQL/DOM injection (aside from M-2 which is low-risk but fragile). Tests use `node:test` correctly. No credentials or Firebase config keys are present. The architecture is sound.

**C-1 and C-2 should be fixed before merging.** M-1 through M-4 are strongly recommended fixes. The minor items can be addressed as follow-up.
