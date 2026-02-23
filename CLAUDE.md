# CLAUDE.md — Events Team Generator

## Project Overview

A vanilla JavaScript SPA for generating team assignments for mobile game events (Desert Storm, Canyon Storm). Uses Firebase Auth + Firestore for persistence. No build step — files are served directly.

## Commands

```bash
# Run tests (all test types)
npm test
# → Unit tests (*.core.test.js), integration (*.integration.test.js),
#   Firestore rules (tests/firestore-rules/*.rules.test.js)

# Build & watch
npm run build    # esbuild: js/main-entry.js → dist/bundle.js
npm run dev      # esbuild watch mode (auto-rebuild on file changes)

# Local development
# Option 1: Direct browser — Open index.html in browser (no dev server needed)
#   Requires firebase-config.js with real Firebase credentials
# Option 2: Bundled — npm run dev, then load dist/bundle.js in HTML

# Deploy
# Push to main → GitHub Actions auto-deploys to GitHub Pages
# Requires FIREBASE_CONFIG_JS secret set in GitHub repository settings

# Firestore rules tests
# Requires Firestore emulator running (gcloud emulators firestore start)
npm test -- tests/firestore-rules/
```

## Architecture

### Module Pattern
Every JS file uses the IIFE pattern — **do not deviate from this**:
```js
(function initModuleName(global) {
  // module code
  global.ModuleName = { ... };
})(window);
```

### Directory Layout
```
index.html              # Entry point — loads all scripts via <script> tags
app.js                  # Top-level app state and wiring
firebase-module.js      # Firebase IIFE (Auth + Firestore operations)
translations.js         # i18n string dictionaries
styles.css              # All CSS
player-update.html      # Standalone page for player-facing updates
player-update.css       # CSS for player-update page
js/
  main-entry.js         # esbuild entry point (requires all modules for bundling)
  app-init.js           # Startup callbacks
  core/
    assignment.js       # Team assignment algorithm
    buildings.js        # Building normalization
    events.js           # Event registry and defaults
    i18n.js             # Translation engine
    player-table.js     # Player data model
    firestore-utils.js  # Firestore query and snapshot utilities
    reliability.js      # Data reliability checks and retries
  services/
    firebase-service.js # Adapter wrapping FirebaseManager (enables testing)
  features/
    event-history/      # Event history feature
      event-history-core.js
      event-history-actions.js
      event-history-view.js
      event-history-controller.js
    player-updates/     # Player updates feature
      player-updates-core.js
      player-updates-actions.js
      player-updates-view.js
      player-updates-controller.js
  shared/
    data/
      data-gateway-contract.js
      firebase-event-history-gateway.js
      firebase-player-updates-gateway.js
  ui/
    alliance-panel-ui.js
    event-buildings-editor-ui.js
    event-list-ui.js
    player-table-ui.js
vendor/                 # Vendored Firebase + SheetJS (no npm for browser code)
tests/                  # Node built-in test runner tests
  firestore-rules/      # Firestore security rules tests (requires emulator)
    *.rules.test.js
  e2e/                  # Playwright E2E tests
    *.e2e.js
  *.core.test.js        # Unit tests
  *.integration.test.js # Integration tests
scripts/
  build.js              # esbuild build script
  ...                   # Firestore migration scripts (Node + firebase-admin)
dist/                   # Generated bundle (do not edit manually)
  bundle.js             # esbuild output
```

### State Management
- Global state lives on `window` via IIFE exports (e.g., `window.DSAssignment`)
- App-level state in `app.js`: `allPlayers`, `currentAuthUser`, `activeDownloadTeam`, etc.
- Firestore is source of truth; real-time listeners via `setDataLoadCallback`

### i18n
- HTML elements use `data-i18n="key"` attributes
- Applied by calling `DSI18N.applyTranslations()`
- Supported languages: EN, FR, DE, IT, KO, RO
- All user-visible strings must be added to `translations.js`

## Key Conventions

- **File naming**: kebab-case (`player-table-ui.js`)
- **Functions**: camelCase
- **CSS variables**: `--kebab-case`
- **No TypeScript** — pure ES6+ JavaScript
- **esbuild only** — `npm run build` bundles `js/main-entry.js` → `dist/bundle.js`; do not introduce other bundlers
- **No npm packages for browser code** — use vendored libs in `vendor/`
- **Mobile-first** — use safe-area insets, test on small viewports

## Testing

Tests live in `tests/` and use Node's built-in `node:test` module. No Jest, no Mocha.

Three test categories:

1. **Unit tests**: `*.core.test.js` — isolated module tests (assignment logic, data transforms, etc.)
2. **Integration tests**: `*.integration.test.js` — test data flows across modules, mock Firestore operations
3. **Firestore rules tests**: `tests/firestore-rules/*.rules.test.js` — security rules validation (requires Firestore emulator)
4. **E2E tests**: `tests/e2e/*.e2e.js` — Playwright end-to-end tests against live Firebase

The `firebase-service.js` adapter exists specifically to make Firebase mockable in tests.

Run all tests: `npm test`
Run specific category: `npm test -- tests/firestore-rules/` (or use grep patterns)

## Firebase / Secrets

- `firebase-config.js` — **gitignored**, contains Firebase API keys. Copy from `firebase-config.example.js` for local dev.
- `scripts/PATH_TO_SERVICE_ACCOUNT.json` — **gitignored**, service account for migration scripts.
- GitHub Actions creates `firebase-config.js` from the `FIREBASE_CONFIG_JS` secret at deploy time.

## Firestore Data Model (brief)

```
users/{uid}/
  players/{playerId}        # Player records (max 100 per user)
  events/{eventId}          # Custom event configs
  app_config/settings       # User preferences

alliances/{allianceId}/
  members/{uid}             # Alliance membership
  invitations/{inviteId}    # Pending invites

event_history/{docId}       # Global event history records
  {auto-generated fields}   # timestamp, event_name, team_count, etc.

attendance/{docId}          # Event attendance tracking
  {auto-generated fields}   # Tracks which players attended which events

player_stats/{docId}        # Aggregated player statistics
  {auto-generated fields}   # Win rate, team assignments count, etc.

update_tokens/{tokenId}     # One-time tokens for player-facing updates
  {auto-generated fields}   # Secure link for player to update own data

pending_updates/{docId}     # Queue of pending player updates
  {auto-generated fields}   # Batched for reliability
```

## What NOT to Do

- Do not introduce a new build tool (esbuild is the only approved bundler)
- Do not add npm packages that need to be bundled for the browser
- Do not convert to TypeScript
- Do not break the IIFE module pattern
- Do not add inline `<script>` logic to `index.html` — keep JS in separate files
- Do not commit `firebase-config.js` or service account files
