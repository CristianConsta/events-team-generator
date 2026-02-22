# Architecture

## High-Level Shape
- The codebase is a browser-first SPA with static hosting and Firebase-backed data/auth.
- Architecture is in a transition state:
  - Legacy monolith behavior remains in `app.js`.
  - Incremental modular architecture exists under `js/core`, `js/features`, `js/shell`, and `js/shared`.

## Runtime Entry Points
- Modern entry path:
  - `index.html` loads scripts and markup.
  - `js/main.mjs` calls `bootApplication()`.
  - `js/shell/bootstrap/app-shell-bootstrap.esm.mjs` delegates to `window.initializeApplicationUiRuntime()`.
- Legacy/bootstrap path:
  - `js/app-init.js` configures auth/data callbacks and UI state transitions after Firebase service availability.

## Layering Model
- `js/core/`: pure/mostly-pure domain logic (events, assignment, i18n, games, registries).
- `js/features/`: vertical feature modules (generator, events-manager, players-management, alliance, notifications).
- `js/shell/`: app-wide shell concerns (navigation, overlays/modals, bootstrap contracts).
- `js/shared/data/`: gateway contracts and Firebase-backed adapters.
- `js/shared/state/`: shared state store contract and selector layer.
- `js/ui/`: UI helper modules for event editor, tables, and panels.

## Data Flow
- UI interactions call controller/action modules in `js/features/*`.
- Controllers/actions delegate persistence calls through `window.FirebaseService` (`js/services/firebase-service.js`).
- `FirebaseService` delegates to `FirebaseManager` when available and falls back safely when not.
- Auth and initial data load callbacks are set in `js/app-init.js` and drive login/main-app visibility.

## Contract-Driven Refactor Direction
- Shell and feature contract wrappers:
  - `js/shell/bootstrap/app-shell-contracts.js`
  - `js/shared/state/state-store-contract.js`
  - `js/shared/data/data-gateway-contract.js`
- README markers indicate intentional decomposition:
  - `js/features/README.md`
  - `js/shell/README.md`
  - `js/shared/state/README.md`
  - `js/shared/data/README.md`

## Multi-Game Design Direction
- Game catalog and metadata model live in `js/core/games.js`.
- Assignment algorithm registry is in `js/core/assignment-registry.js`.
- Service-level game-scoped context management and fallback logic are centralized in `js/services/firebase-service.js`.
- Architecture plans and migration phases are documented in `docs/architecture/*.md`.

## Deployment and Runtime Configuration
- App is deployable as static files via GitHub Pages (`.github/workflows/pages.yml`).
- Firebase runtime config is injected during CI/CD (`firebase-config.js` generated from secrets).
- CSP and vendor script loading are controlled in `index.html`.
