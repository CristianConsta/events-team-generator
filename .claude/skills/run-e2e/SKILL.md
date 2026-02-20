---
name: run-e2e
description: Run Playwright E2E tests for the Events Team Generator. Presents available test suites and runs the chosen one.
disable-model-invocation: true
---

Ask the user which E2E suite to run, then execute it using Bash.

## Available Suites

| Choice | npm Script | Description |
|--------|-----------|-------------|
| 1 | `npm run test:e2e` | Full suite — Edge desktop + mobile |
| 2 | `npm run test:e2e:edge` | Edge desktop only |
| 3 | `npm run test:e2e:mobile` | Edge mobile (Pixel 5 viewport) |
| 4 | `npm run test:e2e:headed` | Edge desktop with visible browser window |
| 5 | `npm run test:e2e:smoke` | Smoke tests only (`@smoke` tag) |
| 6 | `npm run test:e2e:regression` | Regression tests only (`@regression` tag) |

## Steps

1. Present the table above to the user and ask which suite to run.
2. Run the chosen npm script with `Bash`.
3. Report results: total tests, passed, failed, skipped, and duration.
4. For any failures, show the test name, file path, and error message.

## Notes
- E2E tests open Edge browser via Playwright — the browser must be installed (`npx playwright install`)
- Tests run against `file://` URLs (no dev server required)
- `headed` mode is useful for visual debugging of failures
- Smoke tests are the fastest subset and good for quick sanity checks
