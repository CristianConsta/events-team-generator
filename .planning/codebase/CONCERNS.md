# Concerns

## 1) CI workflow and package scripts are out of sync (High)
- Evidence:
  - `.github/workflows/ci.yml` runs `npm run lint`, `npm run typecheck`, and `npm run test:smoke`.
  - `package.json` does not define `lint`, `typecheck`, or `test:smoke`.
  - Local commands fail: `npm run lint`, `npm run typecheck` -> "Missing script".
- Impact:
  - CI quality job will fail on script lookup before actual lint/type checks run.
  - Reduced confidence that branch protection reflects real code quality.

## 2) Large legacy monolith still active alongside modular refactor (High)
- Evidence:
  - `app.js` is 7,382 lines and still part of runtime behavior.
  - Modular feature/shell/state files exist in `js/`, creating a hybrid architecture.
- Impact:
  - Behavior can diverge between legacy and modular paths.
  - Onboarding and debugging cost remain high due split sources of truth.

## 3) Mixed module systems increase integration complexity (Medium)
- Evidence:
  - IIFE globals (`window.*`) in most runtime files.
  - ESM bootstrap files (`js/main.mjs`, `js/shell/bootstrap/app-shell-bootstrap.esm.mjs`).
  - CommonJS in tests and scripts (`tests/*.test.js`, `scripts/*.js`).
- Impact:
  - Tooling assumptions differ per layer.
  - Future bundling, tree-shaking, or strict type-check migration is harder.

## 4) Runtime configuration and secrets are deployment-sensitive (Medium)
- Evidence:
  - `firebase-config.js` is required at runtime and generated in Pages deploy via `FIREBASE_CONFIG_JS`.
  - Missing config triggers runtime login-screen error path in `js/app-init.js`.
- Impact:
  - Environment drift or missing secrets can make production unusable.
  - Manual local setup remains a common failure path.

## 5) Hard-coded privilege identifier in client/runtime code (Medium)
- Evidence:
  - Super-admin UID is hard-coded in:
    - `js/core/games.js`
    - `js/services/firebase-service.js`
- Impact:
  - Authorization logic is partly encoded in shipped code.
  - Rotating privileged identity requires code change + redeploy.

## 6) Vendored third-party browser libraries require manual update discipline (Medium)
- Evidence:
  - Firebase compat SDK and SheetJS are committed under `vendor/`.
- Impact:
  - Security/bug updates are manual and can lag.
  - Version provenance is less visible than package-managed browser deps.

## 7) Test execution defaults underrepresent end-to-end risk (Medium)
- Evidence:
  - `npm test` executes unit/integration tests only.
  - E2E flows are separate and opt-in (`npm run test:e2e*`).
- Impact:
  - Regressions in browser interaction flows may pass default local test runs.

## 8) Architecture transition docs are extensive but can drift from code (Low/Medium)
- Evidence:
  - Many phased specs in `docs/refactor-phase*.md` and `docs/architecture/multigame-*.md`.
- Impact:
  - If not continuously reconciled, docs may describe target state, not actual behavior.
  - Planning and maintenance decisions can be made on stale assumptions.
