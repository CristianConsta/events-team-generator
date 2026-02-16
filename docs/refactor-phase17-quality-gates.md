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

## Validation
- `npm run lint` passes.
- `npm run typecheck` passes.
- `npm test` passes.
- `npm run test:smoke` passes.

## Exit Criteria
- CI gate coverage for lint/typecheck/tests/smoke: done.
- Typecheck path established for gradual adoption: done.
