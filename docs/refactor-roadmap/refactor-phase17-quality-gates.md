# JS Refactor Phase 17: Quality Gates and Developer Experience

Date: 2026-02-16

## Objective
Add maintainability quality gates (lint/typecheck/smoke) and enforce them in CI.

## Implemented

1. Added linting configuration and scripts:
   - `.eslintrc.cjs`
   - `package.json` scripts:
     - `lint`

2. Added typecheck path (migration starter):
   - `tsconfig.typecheck.json`
   - `types/global.d.ts`
   - `package.json` script:
     - `typecheck`

3. Added smoke workflow tests:
   - `tests/smoke-workflows.test.js`
   - Covers smoke paths for:
     - login initialization surface
     - generator action route
     - players CRUD entrypoints
     - events CRUD route
     - alliance invite route
   - `package.json` script:
     - `test:smoke`

4. Added CI workflow gates:
   - `.github/workflows/ci.yml`
   - Runs on push/PR to `main`:
     - `npm ci`
     - `npm run lint`
     - `npm run typecheck`
     - `npm test`
     - `npm run test:smoke`

5. Added DX dependencies:
   - `eslint`
   - `typescript`
   - (Vite from Phase 16 retained)

## Audit Status (2026-02-23)

| Item | Status |
|------|--------|
| ESLint config (`.eslintrc.cjs`) | [DONE] |
| TypeScript typecheck (`tsconfig.typecheck.json`, `types/global.d.ts`) | [DONE] |
| Smoke workflow tests (`tests/smoke-workflows.test.js`) | [DONE] |
| Playwright browser e2e | [DONE] — added post-plan |
| Size budget checks (`scripts/check-size-budgets.js`) | [DONE] — added post-plan |
| CI workflow | [DONE] — runs in `.github/workflows/pages.yml` (not separate `ci.yml` as doc describes) |
| Coverage enforcement in CI | [TODO] — no `test:coverage` script or coverage threshold gate |
| Separate `ci.yml` | [TODO] — decide: keep merged in `pages.yml` or split out |

## Remaining Work
1. Add coverage enforcement (e.g., `c8` or `istanbul` with threshold gate in CI)
2. Update doc to reflect actual CI structure (`pages.yml`, not `ci.yml`)
