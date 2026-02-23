# Refactor Phase 18 — Legacy Runtime Retirement

**Status**: NOT STARTED
**Date drafted**: 2026-02-23
**Depends on**: Phase 17 (fully closed, see Prerequisites)

---

## Goal

Make `dist/bundle.js` (produced by esbuild) the **primary runtime artifact** for the application.
Remove the ~40 individual IIFE `<script defer>` tags from `index.html`, replacing them with a single
`<script defer src="dist/bundle.js">` tag (plus vendor scripts and `firebase-config.js` which remain
external by design).

Secondary goals within this phase:
- Retire `firebase-module.js` as a separately loaded runtime file once the bundle includes all gateway modules.
- Reduce `app.js` line count meaningfully toward the ≤1,000 line target through focused extraction.
- Document and implement a rollback switch for safe production deployment.
- Add E2E smoke coverage for game metadata authorization (super-admin vs non-admin).

---

## Prerequisites

Phase 17 must be **fully closed** before Phase 18 execution begins. The following Phase 17
deliverables are currently incomplete and block Phase 18:

| Deliverable | Status | Notes |
|---|---|---|
| `npm run test:coverage` script in CI | DONE (added in parallel) | c8-based coverage gate |
| Firestore rules tests for `games/{gameId}` writes | DONE (added in parallel) | `tests/firestore-rules/game-metadata.rules.test.js` |
| Super-admin authorization runtime tests | MISSING | `setGameMetadata` must reject non-admin callers |
| Menu visibility authorization test | MISSING | `#navGameMetadataBtn` hidden for non-admin |
| `firebase-module.js` size budget fixed | DONE | Updated to 6100 in `check-size-budgets.js` |

**Phase 18 execution is blocked until the two MISSING items above are resolved.**

---

## Scope

### 1. ESM Primary Boot: Clarification

**"ESM primary boot" in this project means: the esbuild-produced `dist/bundle.js` becomes the
single runtime source for all application JS modules.**

This is _not_ native browser ESM (i.e., not a `<script type="module">` dependency graph served
live from `js/`). The reasons are:

1. All application modules use the IIFE pattern (`(function init(global){ ... })(window)`).
   IIFE modules do not export ES named bindings — they cannot be statically imported by a browser
   module graph without a build transform.
2. CLAUDE.md mandates esbuild as the only bundler. esbuild bundles IIFE/CJS modules correctly
   into a single output file.
3. `js/main-entry.js` already exists as the esbuild entry point — it `require()`s each module in
   the same order as the current `index.html` script tags. This is the correct basis for the bundle.

The existing `js/main.mjs` ESM shim and `app-shell-bootstrap.esm.mjs` remain as a
browser-native fallback / progressive enhancement path but are **not** the primary delivery target.

**What changes in index.html:**

| Before | After |
|---|---|
| ~40 `<script defer src="js/...">` tags | Single `<script defer src="dist/bundle.js">` |
| `<script defer src="app.js">` | Bundled into `dist/bundle.js` |
| `<script defer src="firebase-module.js">` | Not loaded as a separate script |
| `<script defer src="translations.js">` | Bundled into `dist/bundle.js` |
| Vendor scripts (firebase-*-compat.js, xlsx) | Remain as separate `<script defer>` tags |
| `<script defer src="firebase-config.js">` | Remains external (gitignored, injected at deploy) |

**Why vendor scripts stay external**: Firebase compat SDKs and SheetJS are large, infrequently
updated, and already CDN-cached. Bundling them would bloat `dist/bundle.js` unnecessarily and
break the project's policy of vendoring (not npm-bundling) browser dependencies.

**Why `firebase-config.js` stays external**: It is gitignored and injected by GitHub Actions
from the `FIREBASE_CONFIG_JS` secret. It must be available before `firebase-module.js` (now
bundled) initializes Firebase — the bundle must guard against `firebase-config.js` not yet being
loaded (see Rollback Switch section for the initialization guard design).

---

### 2. app.js Reduction Plan

**Current state**: `app.js` is 8,634 lines. Target is ≤1,000 lines.

The controller extraction in Phases 11–14 created delegation layers, but the handler bodies were
not removed from `app.js`. The section breakdown below identifies the highest-value extraction
candidates:

| Section | Lines | Extraction Target | Notes |
|---|---|---|---|
| I18N | 1–1127 (1,126 lines) | `js/shell/i18n-controller.js` | Wraps `js/core/i18n.js`; includes language switching, text refresh, onboarding i18n hooks |
| GLOBAL STATE | 1802–2951 (1,149 lines) | `js/shell/app-state-manager.js` | Top-level auth state, game context, post-auth game selector, game metadata form — high complexity |
| EVENT REGISTRY | 2951–4355 (1,404 lines) | `js/features/events-manager/events-registry-controller.js` | Custom event CRUD, event select/deselect handlers, building rows — largest single block |
| PLAYER DATA MANAGEMENT | 5820–7030 (1,210 lines) | Already partially extracted to `players-management-controller.js`; residual handler bodies remain in `app.js` | Dedup with Phase 12 extraction |
| DOWNLOAD FUNCTIONS | 7667–8594 (927 lines) | `js/features/generator/download-controller.js` | CSV/image/share output logic |
| ONBOARDING TOUR | 1127–1747 (620 lines) | `js/shell/onboarding-controller.js` | Self-contained tour logic |
| COLLAPSIBLE PANEL | 4489–5096 (607 lines) | `js/features/generator/generator-panel-controller.js` | Team slot expansion, filter panels |

**Realistic Phase 18 target**: Extracting the top 3 sections (EVENT REGISTRY, PLAYER DATA
MANAGEMENT residuals, DOWNLOAD FUNCTIONS) removes ~3,500 lines from `app.js`, bringing it to
~5,100 lines. A full 1,000-line target requires additional passes in a follow-on phase.

**Recommended Phase 18 target for `app.js`**: ≤6,000 lines (down from 8,634). Update the CI
budget in `check-size-budgets.js` to enforce this new threshold after extraction is complete.

**Extraction rules** (must be followed for each extraction):
1. New file uses the IIFE pattern: `(function initModuleName(global){ ... })(window)`.
2. New file added to `js/main-entry.js` `require()` list in the same relative order.
3. New file added to `index.html` script list (legacy path, for rollback switch).
4. `app.js` delegates to the new module via `window.ModuleName.method()` with a guard.
5. A unit test file is created at `tests/{module-name}.feature.test.js` before extraction.

---

### 3. firebase-module.js Retirement

**Current state**: `firebase-module.js` is 5,914 lines and is loaded at line 14 of `index.html`
as the second script after the Firebase vendor SDKs.

**Retirement definition**: `firebase-module.js` is considered retired from the primary runtime
path when `dist/bundle.js` can initialize and operate the full application without
`firebase-module.js` being loaded as a separate `<script>` tag.

**This does NOT mean deleting `firebase-module.js`**. It remains the internal implementation of
`FirebaseManager`. The change is that esbuild bundles it into `dist/bundle.js` so it is no longer
loaded as a standalone script.

**Verification checklist** — all of the following must pass before firebase-module.js is removed
from the primary `index.html` load path:

- [ ] Every public method on `window.FirebaseManager` is reachable through the `FirebaseService`
      facade in `js/services/firebase-service.js` (audit via `js/shared/data/data-gateway-contract.js`
      `DATA_GATEWAY_METHODS`).
- [ ] All gateway modules (`firebase-*-gateway.js`) are included in `js/main-entry.js` and
      therefore bundled.
- [ ] `firebase-service.js` is the sole entry point used by `app.js` and all feature controllers
      — no direct calls to `window.FirebaseManager` from outside `firebase-module.js` or
      `firebase-service.js`.
- [ ] E2E smoke test suite passes against the bundle-only boot path (no individual scripts).
- [ ] The `phase0.regression.test.js` suite continues to pass (it guards the `FirebaseService`
      public API surface which must remain stable regardless of internal changes).

**Known risk**: `firebase-module.js` contains the `MULTIGAME_*` feature flag defaults and the
`GAME_METADATA_SUPER_ADMIN_UID` constant. These are also defined in `js/core/games.js`. Verify
no duplication conflict when both are bundled together.

---

### 4. Rollback Switch

A rollback switch allows reverting to the legacy individual-script-tag load path without a code
deployment — only a URL parameter change or server config change is needed.

**Design: Query parameter `?legacy=1`**

When `?legacy=1` is present in the URL, `index.html` must not load `dist/bundle.js` and instead
fall back to individual script tags.

**Implementation approach** (inline `<script>` in `<head>` of index.html — the only permitted
exception to the "no inline script in index.html" rule):

```html
<script>
  window.__USE_LEGACY_SCRIPTS = new URLSearchParams(location.search).has('legacy');
</script>
```

Then in `<body>`:

```html
<!-- Bundle path (default) -->
<script defer src="dist/bundle.js" data-bundle-gate></script>

<!-- Legacy path (fallback) -->
<script>
  if (window.__USE_LEGACY_SCRIPTS) {
    document.querySelector('[data-bundle-gate]').remove();
    // inject individual script tags dynamically
    var legacyScripts = [
      'translations.js',
      'js/core/games.js',
      // ... full ordered list
      'app.js'
    ];
    legacyScripts.forEach(function(src) {
      var s = document.createElement('script');
      s.defer = true;
      s.src = src;
      document.head.appendChild(s);
    });
  }
</script>
```

**Alternative for CI/staging**: An environment-based toggle can be used by having the GitHub
Actions build step conditionally write the `index.html` with the legacy script block instead of
the bundle tag. This is preferable for automated rollback without requiring users to know the
query parameter.

**Rollback procedure**:
1. If the bundle causes production issues, append `?legacy=1` to the URL to switch all users
   to the legacy load path within seconds (no deploy needed).
2. For a full rollback, revert the `index.html` commit and redeploy to GitHub Pages (typically
   under 2 minutes for this repo).

**Rollback drill requirement**: Before Phase 18 is marked complete, perform a documented rollback
drill in a staging environment:
- Deploy with bundle-primary.
- Verify `?legacy=1` switches to legacy scripts.
- Verify all features work in legacy mode.
- Document the drill result in `docs/phase18-rollback-drill.md`.

---

### 5. index.html Migration

**Current state**: `index.html` has 1,038 lines, of which ~55 are `<script>` tags (5 vendor/config
scripts + ~40 application module scripts + 1 ESM module script + 1 `app.js` deferred script).

**Target state after Phase 18**:

```html
<!-- Vendor scripts — unchanged -->
<script defer src="vendor/firebase-app-compat.js"></script>
<script defer src="vendor/firebase-auth-compat.js"></script>
<script defer src="vendor/firebase-firestore-compat.js"></script>
<script defer src="firebase-config.js"></script>

<!-- Application bundle — replaces all individual module scripts -->
<script defer src="dist/bundle.js"></script>

<!-- ESM progressive enhancement shim — unchanged, optional -->
<script type="module" src="js/main.mjs" defer></script>
```

**Migration steps**:

1. Verify `js/main-entry.js` requires every module currently listed as a `<script>` tag in
   `index.html` (excluding vendor scripts and `firebase-config.js`). Add any missing requires.
2. Run `npm run build` and verify `dist/bundle.js` is generated without errors.
3. Test the application with only `dist/bundle.js` loaded (temporarily remove individual scripts
   from `index.html` locally, load `dist/bundle.js`).
4. Implement the rollback switch (section 4 above).
5. Replace the ~40 script tags in `index.html` with the single bundle script tag plus rollback
   switch inline script.
6. Run full test suite: `npm run test:ci`.
7. Run E2E smoke suite: `npm run test:e2e:smoke`.
8. Deploy to staging/preview and perform rollback drill.

**Script load order preservation**: esbuild processes `js/main-entry.js` in `require()` call
order. The current order in `main-entry.js` must match the `index.html` order exactly. Add a
comment block to `js/main-entry.js` noting it is the authoritative load-order document.

---

## Risks

The following risks are drawn from the arch review findings (architect, senior-dev, and QA agents):

### R1 — app.js grows faster than it shrinks (HIGH)
`app.js` grew from 6,413 lines (Phase 0) to 8,634 lines despite controller extraction in Phases
11–14. The extraction created delegation wrappers but left handler bodies in `app.js`. Without
explicitly removing the handler bodies after extraction, Phase 18 targets will slip.

**Mitigation**: Enforce an updated CI budget (≤6,000 lines target) before Phase 18 is marked
complete. Each extraction PR must show a net reduction in `app.js` line count.

### R2 — firebase-module.js exceeds its CI size budget (HIGH)
`firebase-module.js` is 5,914 lines; the CI budget was 5,700. This causes CI failures independent
of Phase 18 work. The budget was updated to 6,100 as an immediate fix, but the underlying growth
from Phase 1A/1B remains.

**Mitigation**: The budget fix is done. The retirement path (bundling into `dist/bundle.js`)
removes `firebase-module.js` from the budget check entirely once it is no longer a standalone file.

### R3 — MULTIGAME_* flag constants duplicated between firebase-module.js and js/core/games.js (MEDIUM)
Both files define game-related constants. When bundled together, duplicate `const` declarations
at module scope may cause esbuild errors or silent overwrite depending on IIFE scoping.

**Mitigation**: Before bundling, audit for duplicate top-level declarations using
`grep -n "GAME_METADATA_SUPER_ADMIN_UID\|MULTIGAME_" js/core/games.js firebase-module.js` and
resolve any conflicts by consolidating to a single source.

### R4 — firebase-config.js initialization race in the bundle (HIGH)
In the legacy load path, `firebase-config.js` runs before `firebase-module.js` because of script
tag order. In the bundle path, `dist/bundle.js` is a single deferred script. `firebase-config.js`
is loaded as a separate `<script defer>`, so load order between `firebase-config.js` and
`dist/bundle.js` is non-deterministic in the `defer` model.

**Mitigation**: `firebase-module.js` already guards Firebase initialization with
`firebase.apps.length > 0` checks. Verify this guard handles the case where the bundle loads
before `firebase-config.js`. Alternatively, move `firebase-config.js` to a `<script>` (no
`defer`) so it executes synchronously before the deferred bundle runs.

### R5 — Phase 0 regression tests test the legacy global path (MEDIUM)
`phase0.regression.test.js` tests `window.FirebaseManager` and `window.FirebaseService` globals.
After bundling, these globals are still set (IIFEs write to `window`), so the tests should
continue to pass. However, if any module scope isolation occurs in the bundle, globals may not
be set.

**Mitigation**: Run `phase0.regression.test.js` against the bundle entry point explicitly as a
Phase 18 exit criterion. The Node test runner context does not run the browser globals, so the
tests already mock `window` — no change expected.

### R6 — No Playwright browser smoke for post-retirement boot path (CRITICAL)
The existing E2E suite (`e2e/01–10`) does not test the bundle-primary load path. After retiring
individual scripts, there is no automated regression guard for the browser boot sequence.

**Mitigation**: Add a new E2E spec `e2e/11-bundle-smoke.e2e.js` that:
- Loads the application normally (bundle path).
- Asserts auth, navigation, and generator features work.
- Asserts `?legacy=1` fallback also works.

---

## Success Criteria

Phase 18 is complete when **all** of the following are true and verified in CI:

### SC1 — Bundle replaces individual scripts
- `index.html` contains exactly 1 application `<script defer src="dist/bundle.js">` tag.
- The ~40 individual application `<script defer>` tags (from `translations.js` through `app.js`)
  are removed from the default load path.
- Vendor scripts and `firebase-config.js` remain as separate `<script>` tags.

### SC2 — app.js line count reduced
- `app.js` is ≤6,000 lines (down from 8,634).
- `check-size-budgets.js` APP_MAX_LINES is updated to 6,000 and enforced in CI.
- At least 3 feature controller extractions from app.js are merged (EVENT REGISTRY,
  DOWNLOAD FUNCTIONS, and one of ONBOARDING TOUR or PLAYER DATA MANAGEMENT residuals).

### SC3 — firebase-module.js retirement
- `firebase-module.js` is no longer loaded as a `<script>` tag in the primary `index.html` path.
- `firebase-module.js` is included in `js/main-entry.js` and bundled into `dist/bundle.js`.
- All `FirebaseManager` public API surface is reachable via `FirebaseService` facade (verified
  by audit checklist in section 3).

### SC4 — Rollback switch implemented and drilled
- `?legacy=1` URL parameter switches load path to individual scripts in all browsers.
- Rollback drill completed and documented in `docs/phase18-rollback-drill.md`.
- Drill shows all E2E smoke tests pass in legacy mode.

### SC5 — E2E smoke coverage for game metadata authorization
- `e2e/11-bundle-smoke.e2e.js` (or equivalent) covers:
  - Super-admin user sees `#navGameMetadataBtn` visible.
  - Non-admin user does not see `#navGameMetadataBtn`.
  - Super-admin can save game metadata without error.
  - Non-admin attempt to save game metadata returns authorization error.
- These tests pass in CI.

### SC6 — All existing tests continue to pass
- `npm run test:ci` passes (lint, budget check, unit tests, E2E smoke).
- `npm run test:coverage` reports ≥80% line coverage on `js/core/*` and `js/shared/data/*`.
- `phase0.regression.test.js` passes unchanged (API surface guard).

### SC7 — Production deployment verified
- Application deployed to GitHub Pages with bundle-primary load.
- Real-Firebase E2E smoke (`e2e/08-real-firebase-smoke.e2e.js`) passes against production URL.
- No JavaScript errors in browser console on Chrome, Firefox, and Safari (or Edge) during
  login → navigation → generator → players → events flow.

---

## Out of Scope for Phase 18

The following are explicitly deferred to follow-on phases:

- Reducing `app.js` below 1,000 lines (the master plan target). Phase 18 targets ≤6,000.
  Full reduction requires additional extraction passes in a Phase 19 or equivalent.
- Deleting `firebase-module.js` from the repository. It remains in source control as the internal
  `FirebaseManager` implementation, now bundled rather than standalone.
- Multigame Phase 14 (R3 staged rollout retirement). Unrelated to the bundle migration.
- Native browser ESM module graph (no `import`/`export` syntax in IIFE modules). esbuild bundling
  is the correct and only approved approach per CLAUDE.md.
- Vite or any bundler other than esbuild. CLAUDE.md prohibits this.
