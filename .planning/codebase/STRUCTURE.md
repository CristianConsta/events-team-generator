# Structure

## Top-Level Layout
- `index.html`: main DOM shell, CSP, and script includes.
- `styles.css`: full app styling and responsive rules.
- `app.js`: legacy monolithic runtime logic (7,382 lines).
- `translations.js`: language dictionary payloads.
- `firebase-module.js`: Firebase manager implementation.
- `js/`: modularized runtime source.
- `tests/`: Node test-runner unit/integration/QA suites.
- `e2e/`: Playwright browser workflow tests.
- `scripts/`: Firestore/Auth migration and sync utilities.
- `docs/`: refactor and multi-game architecture docs.
- `vendor/`: vendored browser libraries.

## Runtime Source Breakdown (`js/`)
- `js/main.mjs`: ESM runtime entry.
- `js/app-init.js`: startup callbacks and login/app state transitions.
- `js/core/`:
  - `assignment.js`, `generator-assignment.js`, `assignment-registry.js`
  - `events.js`, `buildings.js`, `games.js`, `i18n.js`, `player-table.js`
- `js/features/`:
  - `generator/`
  - `events-manager/`
  - `players-management/`
  - `notifications/`
  - `alliance/`
- `js/shell/`:
  - `bootstrap/`
  - `navigation/`
  - `overlays/`
- `js/shared/`:
  - `data/` (gateway adapters/contracts)
  - `state/` (store/selectors/contracts)
- `js/ui/`:
  - `alliance-panel-ui.js`
  - `event-buildings-editor-ui.js`
  - `event-list-ui.js`
  - `player-table-ui.js`

## Tests and Quality Directories
- `tests/*.test.js` (40 files):
  - core logic tests (`events`, `buildings`, `assignment`, `i18n`)
  - controller/feature tests (`generator`, `players`, `events-manager`, `shell`)
  - integration/guardrail suites (`firebase-*`, `qa-agent`, `phase0.regression`)
- `e2e/*.e2e.js` (5 files):
  - login, navigation, players, generator, game selector flows.

## Infra and Configuration Files
- `.github/workflows/ci.yml`: CI quality job.
- `.github/workflows/pages.yml`: GitHub Pages deploy.
- `.eslintrc.cjs`: lint config.
- `tsconfig.typecheck.json`: check-js typecheck config.
- `playwright.config.js`: E2E project config (Edge desktop/mobile).
- `vite.config.mjs`: optional static build/dev config.

## Planning and Architecture Docs
- `docs/refactor-phase*.md`: phased refactor history.
- `docs/architecture/multigame-*.md`: multi-game contract/rollout docs.
- `docs/multi-game-support.md`: implementation notes and rollout expectations.
