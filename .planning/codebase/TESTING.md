# Testing

## Test Frameworks in Use
- Unit/integration suites use Node's built-in test runner (`node --test`).
- Browser workflow coverage uses Playwright (`@playwright/test`).
- Assertions use `node:assert/strict`.

## Test Locations and Coverage Shape
- Unit/integration tests: `tests/*.test.js` (40 files).
- E2E tests: `e2e/*.e2e.js` (5 files).
- Core domains covered in unit tests include:
  - event/building normalization (`tests/events*.test.js`, `tests/buildings*.test.js`)
  - assignment logic (`tests/assignment*.test.js`, `tests/generator-assignment*.test.js`)
  - i18n and translations (`tests/i18n*.test.js`, `tests/translations.integration.test.js`)
  - Firebase adapters/services (`tests/firebase-*.test.js`)
  - shell and controller contracts (`tests/shell-*.test.js`, `tests/*controller*.test.js`)
  - QA guardrails (`tests/qa-agent.test.js`, `tests/phase0.regression.test.js`)

## NPM Script Surface (Current)
- Present in `package.json`:
  - `test` -> `npm run test:unit`
  - `test:unit` -> `node --test tests/*.test.js`
  - `test:e2e`, `test:e2e:edge`, `test:e2e:mobile`, `test:e2e:headed`
  - `test:e2e:smoke`, `test:e2e:regression`
- Missing in `package.json`:
  - `lint`
  - `typecheck`
  - `test:smoke`

## CI and Local Execution
- CI workflow (`.github/workflows/ci.yml`) attempts:
  - `npm run lint`
  - `npm run typecheck`
  - `npm test`
  - `npm run test:smoke`
- Current mismatch: only `npm test` is guaranteed to work with existing scripts.

## Current Signal from Local Run
- `npm test` succeeds in this workspace.
- Node test runner result observed:
  - 347 passing tests
  - 0 failing tests
- `npm run lint` and `npm run typecheck` fail due missing scripts.

## E2E Configuration Notes
- Playwright config in `playwright.config.js`.
- Projects:
  - `edge-desktop` (`Desktop Edge`, `msedge` channel)
  - `edge-mobile` (`Pixel 5`, `msedge` channel)
- Base URL points to local file path: `file://.../index.html`.

## Testing Gaps/Warnings
- E2E is not part of default `npm test` path.
- CI script names and package scripts are currently out of sync, which can block quality gates in PR pipelines.
