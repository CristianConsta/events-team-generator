# Real Firebase E2E Runbook

## Purpose

Run a real-environment Playwright smoke workflow against Firebase Auth + Firestore, separate from mocked E2E coverage.

## Test entrypoint

- Script: `npm run test:e2e:real`
- Tags: `@real`
- Spec: `e2e/08-real-firebase-smoke.e2e.js`

## Required environment variables

- `E2E_REAL_EMAIL`
- `E2E_REAL_PASSWORD`
- `PLAYWRIGHT_CHANNEL` (optional, default `msedge`; use `chromium` in CI)

## Local execution

1. Ensure `firebase-config.js` points to the target Firebase project.
2. Export credentials:
   - PowerShell:
     - `$env:E2E_REAL_EMAIL='qa-user@example.com'`
     - `$env:E2E_REAL_PASSWORD='***'`
3. Run:
   - `npm run test:e2e:real`

## GitHub Actions execution

Workflow: `.github/workflows/e2e-real.yml` (manual `workflow_dispatch`)

Required repository secrets:

- `FIREBASE_CONFIG_JS`
- `E2E_REAL_EMAIL`
- `E2E_REAL_PASSWORD`

## Scope covered

- Login with email/password
- Main page visibility after auth
- Navigation between Generator, Players Management, Events Manager, and Alliance
- Basic player data rendering check

## Notes

- Keep real E2E credentials scoped to a dedicated QA account.
- The `@real` suite is intentionally separate from mocked `@smoke` and `@regression` suites.
