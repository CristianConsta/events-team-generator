# Technology Stack

**Analysis Date:** 2026-02-25

## Languages

**Primary:**
- JavaScript (ES2017+) - All browser code and frontend logic
- Node.js (v20.x) - Runtime for build scripts, tests, and Firebase admin operations

**Secondary:**
- Shell scripting - CI/CD workflows and utility scripts in `scripts/`

## Runtime

**Browser Environment:**
- No Node.js dependencies for frontend code - pure vanilla JavaScript SPA
- Targets browsers supporting ES2017 features (Chromium-based browsers: Chrome, Edge)

**Build & Test Environment:**
- Node.js 20.x (specified in CI/CD `.github/workflows/pages.yml`)
- Package manager: npm with lockfile (`package-lock.json`)

## Frameworks

**Core:**
- Firebase SDK v9+ (compat mode, vendored) - Authentication and Firestore database
  - `vendor/firebase-app-compat.js` - Core Firebase initialization
  - `vendor/firebase-auth-compat.js` - Firebase Authentication
  - `vendor/firebase-firestore-compat.js` - Cloud Firestore database
- SheetJS (XLSX) v0.18+ (vendored in `vendor/xlsx.full.min.js`) - Excel file parsing and generation for player database import/export

**Testing:**
- Node built-in `node:test` module - Unit, integration, and feature tests (no external test runner)
- `node:assert/strict` - Assertion library
- `@firebase/rules-unit-testing` v4.0.1 - Firestore security rules validation
- `firebase-admin` v13.6.1 - Backend Firebase admin operations for rule tests and migrations
- `@playwright/test` v1.58.2 - End-to-end browser testing (multiple browsers and mobile viewports)

**Build/Dev:**
- esbuild v0.25.0 - JavaScript bundler (IIFE format, entry point: `js/main-entry.js`, output: `dist/bundle.js`)
- Playwright v1.58.2 - E2E testing framework, configured in `playwright.config.js`

**Linting:**
- ESLint v10.0.1 with @eslint/js v10.0.1 - JavaScript linting
- Two config files: `.eslintrc.cjs` (legacy CommonJS) and `eslint.config.js` (newer flat config)

**Code Quality:**
- c8 v10.1.3 - Code coverage reporting with 80% line coverage gate on `js/core/**` and `js/shared/data/**`
- TypeScript v5.4.0 - Type checking via `npm run typecheck` (checkJs mode, no transpilation)
- `globals` v17.3.0 - ESLint globals for browser and Node environments

**Caching & CI:**
- Actions caching in CI for npm dependencies and ESLint cache
- Firebase Emulator Suite (local development via `firebase emulators`)

## Key Dependencies

**Critical (Browser):**
- Firebase Web SDK (vendored) - Authentication, Firestore, real-time listeners
- XLSX (vendored) - Player database Excel export/import
- CSS custom properties (`--ds-*` tokens) - Design token system for theming

**Infrastructure (Dev only):**
- firebase-admin v13.6.1 - Server-side Firebase operations in Node scripts
- @google-cloud/firestore v8.2.0 - Firestore client for migrations and tests
- firebase-tools v15.7.0 - Firebase CLI for deployments and local emulation
- @firebase/rules-unit-testing v4.0.1 - Firestore rules testing framework

**Build Pipeline:**
- esbuild v0.25.0 - Only bundler (no webpack, Vite, etc.)
- Playwright v1.58.2 - E2E testing across Chrome, Edge, and mobile viewports

## Configuration

**Environment:**
- Firebase configuration via `firebase-config.js` (gitignored, example in `firebase-config.example.js`)
- GitHub Actions secret: `FIREBASE_CONFIG_JS` - Firebase config injected at deploy time
- Google Cloud service account key (gitignored) - Used for Firebase admin operations in Node scripts

**Build:**
- `scripts/build.js` - esbuild configuration (entry: `js/main-entry.js`, format: IIFE, target: ES2017)
- `scripts/check-size-budgets.js` - Size budget validation:
  - `app.js`: max 6000 lines
  - `firebase-module.js`: max 7000 lines

**Bundling:**
- IIFE format (Immediately Invoked Function Expression) - all modules wrapped in `(function initModuleName(global) { ... })(window)`
- No code splitting - single `dist/bundle.js` output
- Source maps enabled for debugging

**Testing:**
- `playwright.config.js` - E2E test configuration:
  - Projects: Edge desktop, Edge mobile, Chrome desktop, Chrome mobile
  - Base URL: `file://` protocol (no dev server)
  - Single worker (global app state constraints)
  - Timeouts: 30s per test, 10s action timeout, 15s navigation timeout
- `firebase.json` - Firestore emulator config (port 8080, no UI)
- `tsconfig.typecheck.json` - TypeScript strict type checking (ES2020 target)

## Platform Requirements

**Development:**
- Node.js 20.x
- npm (lockfile included)
- Playwright browsers auto-install via npm (Chrome, Edge)
- Firestore Emulator (part of Firebase CLI) for rule testing
- macOS, Linux, or Windows

**Production (GitHub Pages):**
- Deployed via GitHub Actions to GitHub Pages static hosting
- Static files only - no server-side runtime
- Firebase backend (Firestore, Authentication) provided by Google Cloud

**Browser Compatibility:**
- Modern Chromium browsers (Chrome, Edge) - ES2017 target
- Mobile viewports tested (Pixel 5 resolution)
- iOS and other browsers not officially tested (but likely compatible)

**Build Environment:**
- GitHub Actions with Ubuntu latest runner for CI/CD
- Playwright container image: `mcr.microsoft.com/playwright:v1.58.2-noble`
- Node cache via actions/setup-node v4

---

*Stack analysis: 2026-02-25*
