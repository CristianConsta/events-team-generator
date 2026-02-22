# Integrations

## Authentication and Identity
- Firebase Authentication is the primary auth system.
- Browser auth flow is wired through:
  - `firebase-module.js` (Firebase manager implementation).
  - `js/services/firebase-service.js` (service facade and feature-flag/game-context handling).
  - `js/shared/data/firebase-auth-gateway.js` (gateway module interface).
- Supported sign-in paths include Google and email/password (`firebase-module.js`, `js/app-init.js` callback wiring).

## Database and Persistence
- Firestore is the primary datastore.
- Main collection contract (documented in `README.md`):
  - `users`
  - `app_config`
  - `alliances`
  - `invitations`
- Gateway wrappers expose data access by domain:
  - `js/shared/data/firebase-events-gateway.js`
  - `js/shared/data/firebase-players-gateway.js`
  - `js/shared/data/firebase-alliance-gateway.js`
  - `js/shared/data/firebase-notifications-gateway.js`
- Runtime service orchestration sits in `js/services/firebase-service.js`.

## Multi-Game Context and Feature Flags
- Multi-game behavior is controlled by runtime flags in `js/services/firebase-service.js`:
  - `MULTIGAME_ENABLED`
  - `MULTIGAME_READ_FALLBACK_ENABLED`
  - `MULTIGAME_DUAL_WRITE_ENABLED`
  - `MULTIGAME_GAME_SELECTOR_ENABLED`
- Active game context persists to local storage key `ds_active_game_id` (`js/services/firebase-service.js`).

## Browser and Network Surfaces
- CSP is defined inline in `index.html` and explicitly permits Google/Firebase endpoints.
- Network domains include:
  - `https://firestore.googleapis.com`
  - `https://identitytoolkit.googleapis.com`
  - `https://securetoken.googleapis.com`
  - `https://*.googleapis.com`
- OAuth/UI frame origins include `accounts.google.com` and Firebase-hosted domains (`index.html` CSP).

## CI/CD and Hosting
- GitHub Actions workflows:
  - `.github/workflows/ci.yml`
  - `.github/workflows/pages.yml`
- Pages deployment injects runtime Firebase config from secret:
  - Secret name: `FIREBASE_CONFIG_JS`
  - Output file at build time: `firebase-config.js`

## Data Migration and Admin Integrations
- Node admin scripts integrate with Firestore/Auth via service-account credentials:
  - `scripts/migrate_users_email_to_uid.js`
  - `scripts/sync_event_building_defaults.js`
  - `scripts/migrate_legacy_last_war_to_game_subcollections.js`
  - `scripts/migrate_legacy_building_fields_to_events.js`
- Scripts use `firebase-admin` and run in dry-run/apply modes with CLI flags.

## Test Integrations
- Playwright E2E runs Edge desktop/mobile projects (`playwright.config.js`).
- Unit/integration suites validate Firebase facades, contracts, and migration helpers in `tests/`.
