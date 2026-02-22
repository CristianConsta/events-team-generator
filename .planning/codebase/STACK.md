# Stack

## Runtime Model
- Primary runtime is browser JavaScript loaded from `index.html`.
- Main boot path is ESM: `js/main.mjs` -> `js/shell/bootstrap/app-shell-bootstrap.esm.mjs`.
- Most feature code uses IIFE globals (for example `window.DSCoreEvents`, `window.FirebaseService`) in files under `js/`.
- Legacy app runtime still exists in `app.js` and is initialized from global callbacks in `js/app-init.js`.

## Languages and Module Styles
- JavaScript is the dominant language (`.js` + small `.mjs` surface).
- CommonJS is used in Node scripts and tests (`scripts/*.js`, `tests/*.test.js`, `playwright.config.js`).
- ESM is used in selected runtime/tooling files (`js/main.mjs`, `vite.config.mjs`).
- Global script style remains active in many browser modules (IIFE + `window` namespaces).

## Core Libraries and Dependencies
- Runtime backend dependencies in `package.json`:
  - `firebase-admin` (`^12.7.0`) for migration/admin scripts.
  - `@google-cloud/firestore` (`^8.2.0`) for script-level Firestore access.
- Runtime browser SDKs are vendored in `vendor/`:
  - `vendor/firebase-app-compat.js`
  - `vendor/firebase-auth-compat.js`
  - `vendor/firebase-firestore-compat.js`
  - `vendor/xlsx.full.min.js`
- E2E test dependency:
  - `@playwright/test` (`^1.58.2`).

## Build, Dev, and Packaging
- App can run directly from static files (`index.html` + local assets).
- Optional Vite config exists in `vite.config.mjs` (`dist` output, sourcemaps, port `5173`).
- No active `npm` scripts for `vite` build/serve are currently defined in `package.json`.

## Lint, Typecheck, and QA Tooling
- ESLint config exists at `.eslintrc.cjs` (ES2021, browser+node environments).
- TypeScript check-js config exists at `tsconfig.typecheck.json` with `allowJs` + `checkJs`.
- CI currently calls `npm run lint` and `npm run typecheck` in `.github/workflows/ci.yml`, but these scripts are missing from `package.json`.

## Test Stack
- Unit/integration tests run with Node test runner (`node --test tests/*.test.js`).
- E2E tests run with Playwright (`playwright.config.js`) against `file://.../index.html`.
- Current test inventory:
  - `tests/*.test.js`: 40 files.
  - `e2e/*.e2e.js`: 5 files.
