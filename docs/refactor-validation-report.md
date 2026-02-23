# Phase 16–18 Validation Report

**Date**: 2026-02-23
**Reviewer**: Architect agent
**Scope**: Phase 18 success criteria SC1–SC6 as defined in
`docs/refactor-roadmap/refactor-phase18-legacy-runtime-retirement.md`

---

## Summary

| Criterion | Status | Notes |
|-----------|--------|-------|
| SC1 — Bundle replaces individual scripts | PASS | Single bundle tag in default path; rollback switch for legacy |
| SC2 — app.js line count reduced | PASS | 5784 lines, under 6000 budget; 3+ extractions merged |
| SC3 — firebase-module.js retirement | PASS | Not a separate script tag; bundled via main-entry.js |
| SC4 — Rollback switch | PASS (partial) | ?legacy=1 implemented; rollback drill doc missing |
| SC5 — Phase 17 coverage | PASS (partial) | Coverage CI gate exists; authorization tests exist; E2E bundle-smoke spec missing |
| SC6 — All tests pass | PASS | 595/595 pass; build succeeds |

---

## SC1 — Bundle replaces individual scripts

**Result: PASS**

Evidence:
- `index.html` line 984: the single inline `<script>` block loads `dist/bundle.js` by default
  (else branch of `?legacy=1` check). No individual module `<script defer>` tags remain in the
  default load path.
- Vendor scripts (`vendor/firebase-app-compat.js`, `vendor/firebase-auth-compat.js`,
  `vendor/firebase-firestore-compat.js`) remain as separate `<script defer>` tags in `<head>`.
- `firebase-config.js` remains external as a synchronous `<script>` (no `defer`), correctly
  ensuring it executes before the deferred bundle.
- The legacy path (all ~60 individual script tags) is only loaded when `?legacy=1` is present.

No issues found for SC1.

---

## SC2 — app.js line count reduced

**Result: PASS**

Evidence:
- `wc -l app.js` → **5784 lines** (down from 8634 baseline; target ≤6000). Budget met.
- `scripts/check-size-budgets.js` sets `APP_JS_MAX_LINES` = 6000. CI enforces this via
  `npm run check:budgets` (confirmed in `.github/workflows/pages.yml` line 60).
- At least 3 extractions confirmed in `js/main-entry.js`:
  - `js/features/generator/download-controller.js` (DOWNLOAD FUNCTIONS extraction)
  - `js/features/events-manager/events-registry-controller.js` (EVENT REGISTRY extraction)
  - `js/features/players-management/players-management-controller.js` (PLAYER DATA MANAGEMENT)

No issues found for SC2.

---

## SC3 — firebase-module.js retirement

**Result: PASS**

Evidence:
- `index.html` default path: `firebase-module.js` is NOT present as a `<script>` tag.
- `js/main-entry.js` line 6: `require('../firebase-module.js')` — bundled into `dist/bundle.js`.
- `app.js` has **0** direct calls to `window.FirebaseManager.*` (confirmed via grep). All Firebase
  access routes through `FirebaseService`.
- No direct `FirebaseManager` calls found in any `js/` file outside `firebase-service.js`
  (grep returned no output).

Note: `firebase-module.js` remains in source control as the internal `FirebaseManager`
implementation — this is correct and expected per the phase 18 plan.

---

## SC4 — Rollback switch

**Result: PASS (partial)**

Evidence:
- `index.html` line 984: Inline `<script>` detects `?legacy=1` via regex
  `/[?&]legacy=1/.test(location.search)`. When present, removes the bundle tag and injects all
  ~60 individual script tags dynamically.
- The legacy script list in the rollback switch matches the full ordered list in
  `js/main-entry.js`.

**Gap**: `docs/phase18-rollback-drill.md` does not exist. The phase 18 plan requires a documented
rollback drill showing all E2E smoke tests pass in legacy mode. This file is missing.

Action required: Perform and document the rollback drill before marking SC4 fully complete.

---

## SC5 — Phase 17 coverage

**Result: PASS (partial)**

Evidence:
- `.github/workflows/pages.yml` line 66: `npm run test:coverage` step is present and runs in
  the `lint-and-unit` job.
- Authorization tests exist:
  - `tests/phase17-authorization.core.test.js`: tests `setGameMetadata` rejection for non-admin,
    success for super-admin, and `#navGameMetadataBtn` hidden-class default.
  - `tests/firestore-rules/games.rules.test.js`: Firestore rules tests for `games/{gameId}`
    writes.

**Gap**: No `e2e/11-bundle-smoke.e2e.js` (or equivalent) spec exists. The phase 18 plan (SC5)
requires E2E smoke coverage for:
- Super-admin user sees `#navGameMetadataBtn` visible.
- Non-admin user does not see `#navGameMetadataBtn`.
- Super-admin can save game metadata without error.
- Non-admin attempt to save returns authorization error.

The existing E2E suite goes up to `e2e/11-invite-flow.e2e.js` — no bundle-smoke or
game-metadata-authorization E2E spec is present.

Action required: Add E2E spec covering bundle smoke boot path and game metadata authorization.

---

## SC6 — All tests pass

**Result: PASS**

Evidence:
- `npm test` output: **595 tests, 595 pass, 0 fail**.
- `npm run build` exits without errors (esbuild produces `dist/bundle.js` successfully).

No issues found for SC6.

---

## Issues Summary

### BLOCKING (must resolve before Phase 18 is marked complete)

**Issue B1 — Missing rollback drill documentation (SC4)**
`docs/phase18-rollback-drill.md` does not exist. The plan requires a documented rollback drill
showing the `?legacy=1` switch works and all E2E smoke tests pass in legacy mode. Create this
document after performing the drill.

**Issue B2 — Missing E2E bundle-smoke and game-metadata-authorization spec (SC5)**
No Playwright spec tests the bundle primary boot path or game-metadata authorization via a real
browser session. The phase 18 plan requires a spec covering super-admin vs non-admin menu
visibility and metadata save/reject. Add `e2e/11-bundle-smoke.e2e.js` (or rename the existing
`11-invite-flow.e2e.js` numbering accordingly).

### NON-BLOCKING (informational)

**Issue N1 — E2E smoke CI gate is opt-in**
`.github/workflows/pages.yml` line 69: `if: inputs.run_e2e == true`. E2E smoke only runs on
`workflow_dispatch` with explicit opt-in. It does not run on every push to `main`. This means the
E2E gate is not continuously enforced. Consider making the E2E job run unconditionally on pushes
to `main` once the bundle-smoke spec (B2) is added.

---

## Conclusion

Phase 18 implementation is substantially complete. The bundle migration (SC1), line count
reduction (SC2), firebase-module retirement (SC3), and test passage (SC6) all meet their
criteria. Two blocking gaps remain: the rollback drill document (SC4) and the E2E bundle-smoke
authorization spec (SC5). These must be resolved before Phase 18 can be declared fully closed.
