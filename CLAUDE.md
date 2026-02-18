# CLAUDE.md — Events Team Generator

## Project Overview

A vanilla JavaScript SPA for generating team assignments for mobile game events (Desert Storm, Canyon Storm). Uses Firebase Auth + Firestore for persistence. No build step — files are served directly.

## Commands

```bash
# Run tests
npm test
# → node --test tests/*.test.js  (Node 18+ built-in test runner)

# Local development
# Open index.html directly in a browser (no dev server needed)
# Requires firebase-config.js with real Firebase credentials

# Deploy
# Push to main → GitHub Actions auto-deploys to GitHub Pages
# Requires FIREBASE_CONFIG_JS secret set in GitHub repository settings
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
styles.css              # All CSS (~57KB, single file)
js/
  app-init.js           # Startup callbacks
  core/
    assignment.js       # Team assignment algorithm
    buildings.js        # Building normalization
    events.js           # Event registry and defaults
    i18n.js             # Translation engine
    player-table.js     # Player data model
  services/
    firebase-service.js # Adapter wrapping FirebaseManager (enables testing)
  ui/
    alliance-panel-ui.js
    event-buildings-editor-ui.js
    event-list-ui.js
    player-table-ui.js
vendor/                 # Vendored Firebase + SheetJS (no npm for browser code)
tests/                  # Node built-in test runner tests
scripts/                # One-off Firestore migration scripts (Node + firebase-admin)
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
- **No build process** — avoid anything that requires compilation
- **No npm packages for browser code** — use vendored libs in `vendor/`
- **Mobile-first** — use safe-area insets, test on small viewports

## Testing

Tests live in `tests/` and use Node's built-in `node:test` module. No Jest, no Mocha.

- Unit tests: `*.core.test.js`
- Integration tests: `*.integration.test.js`
- The `firebase-service.js` adapter exists specifically to make Firebase mockable in tests

Run with: `npm test`

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
```

## What NOT to Do

- Do not introduce a build tool (webpack, vite, etc.) without explicit request
- Do not add npm packages that need to be bundled for the browser
- Do not convert to TypeScript
- Do not break the IIFE module pattern
- Do not add inline `<script>` logic to `index.html` — keep JS in separate files
- Do not commit `firebase-config.js` or service account files
