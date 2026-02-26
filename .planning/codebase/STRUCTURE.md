# Codebase Structure

**Analysis Date:** 2025-02-25

## Directory Layout

```
/Users/constantinescucristian/repos/events-team-generator/
├── index.html                          # Main app entry point
├── player-update.html                  # Player-facing update page
├── player-update.css                   # CSS for player-update.html
├── app.js                              # UI wiring & global state (193KB)
├── firebase-module.js                  # FirebaseManager facade (707KB)
├── firebase-infra.js                   # Path builders & data model (25KB)
├── firebase-auth-module.js             # Auth lifecycle (8.6KB)
├── translations.js                     # i18n strings (6 languages)
├── styles.css                          # All CSS (theme blocks)
├── theme-variables.css                 # Additional theme tokens
├── firestore.rules                     # Firestore security rules
├── firestore.indexes.json              # Index configuration
├── firebase.json                       # Firebase project config
├── firebase-config.example.js          # Credentials template (gitignored: firebase-config.js)
├── package.json                        # npm dependencies
├── package-lock.json                   # npm lockfile
│
├── js/                                 # All JavaScript modules
│   ├── main-entry.js                   # esbuild entry point (requires all modules)
│   ├── app-init.js                     # Firebase callbacks & feature wiring
│   │
│   ├── core/                           # Pure business logic & algorithms
│   │   ├── assignment.js               # Team→building assignment (balanced, aggressive)
│   │   ├── assignment-registry.js      # Algorithm registry per game
│   │   ├── buildings.js                # Building config normalization
│   │   ├── events.js                   # Event registry & defaults
│   │   ├── games.js                    # Game definitions (Desert Storm, Canyon Storm)
│   │   ├── generator-assignment.js     # Player quality checks, reliability
│   │   ├── i18n.js                     # Translation engine
│   │   ├── player-table.js             # Player data model & sorting
│   │   ├── firestore-utils.js          # Firestore snapshot/query helpers
│   │   ├── reliability.js              # Win rate, attendance, stats calculations
│   │   └── theme-colors.js             # CSS variable reader with cache
│   │
│   ├── features/                       # Feature modules (MVC per feature)
│   │   ├── alliance/
│   │   │   └── alliance-controller.js  # Create, invite, accept, leave alliance
│   │   │
│   │   ├── buildings/
│   │   │   ├── buildings-config-manager.js      # Edit/save building configuration
│   │   │   └── coordinate-picker-controller.js  # Map-based building positioning
│   │   │
│   │   ├── event-history/
│   │   │   ├── event-history-core.js       # Build history record shape
│   │   │   ├── event-history-actions.js    # Load, save, finalize records
│   │   │   ├── event-history-view.js       # Render history list HTML
│   │   │   └── event-history-controller.js # Wire history feature
│   │   │
│   │   ├── events-manager/
│   │   │   ├── event-selector-view.js      # Event dropdown rendering
│   │   │   ├── events-manager-actions.js   # Create, edit, delete events
│   │   │   ├── events-manager-controller.js
│   │   │   ├── events-image-processor.js   # Logo image → data URL
│   │   │   ├── events-map-controller.js    # Map image → data URL
│   │   │   └── events-registry-controller.js
│   │   │
│   │   ├── generator/
│   │   │   ├── team-selection-core.js      # Player selection state & validation
│   │   │   ├── generator-actions.js        # Toggle team, set role, generate assignments
│   │   │   ├── generator-view.js           # Algorithm radio button rendering
│   │   │   ├── generator-controller.js     # Wire generator feature
│   │   │   └── download-controller.js      # Excel & map download
│   │   │
│   │   ├── notifications/
│   │   │   ├── notifications-core.js       # Notification data model
│   │   │   └── notifications-controller.js # Polling & display
│   │   │
│   │   ├── player-updates/
│   │   │   ├── player-updates-core.js      # Token & update generation
│   │   │   ├── player-updates-actions.js   # Load, approve, reject updates
│   │   │   ├── player-updates-view.js      # Render review panel HTML
│   │   │   └── player-updates-controller.js
│   │   │
│   │   └── players-management/
│   │       ├── players-management-core.js       # Player edit/delete logic
│   │       ├── players-management-actions.js    # Add, edit, delete, filter
│   │       ├── players-management-view.js       # Render player table HTML
│   │       ├── players-management-controller.js
│   │       └── player-data-upload.js            # XLSX → player database
│   │
│   ├── ui/                             # Pure HTML builders (no state)
│   │   ├── player-table-ui.js          # buildPlayerRow(), buildPlayerHeader()
│   │   ├── alliance-panel-ui.js        # buildAlliancePanel()
│   │   ├── event-list-ui.js            # buildEventListItem()
│   │   └── event-buildings-editor-ui.js
│   │
│   ├── services/
│   │   └── firebase-service.js         # Testable adapter (15+ methods)
│   │
│   ├── shared/
│   │   ├── data/                       # Data gateways (Firestore abstraction)
│   │   │   ├── data-gateway-contract.js
│   │   │   ├── firebase-gateway-utils.js
│   │   │   ├── firebase-auth-gateway.js
│   │   │   ├── firebase-players-gateway.js
│   │   │   ├── firebase-events-gateway.js
│   │   │   ├── firebase-alliance-gateway.js
│   │   │   ├── firebase-notifications-gateway.js
│   │   │   ├── firebase-event-history-gateway.js
│   │   │   └── firebase-player-updates-gateway.js
│   │   │
│   │   └── state/                      # Observable state store
│   │       ├── state-store-contract.js
│   │       └── app-state-store.js
│   │
│   ├── shell/
│   │   ├── bootstrap/
│   │   │   ├── app-shell-bootstrap.js  # Boot sequence trigger
│   │   │   └── app-shell-contracts.js  # Feature controller contract
│   │   │
│   │   ├── navigation/
│   │   │   └── navigation-controller.js # Menu sync, page visibility
│   │   │
│   │   ├── overlays/
│   │   │   ├── modal-controller.js      # openModalOverlay(), closeModalOverlay()
│   │   │   └── notifications-sheet-controller.js
│   │   │
│   │   ├── auth-ui-controller.js        # Settings, avatar, delete account
│   │   ├── game-selector-controller.js  # Post-auth game selector
│   │   ├── game-metadata-admin-controller.js
│   │   ├── theme-controller.js          # Theme switch, persistence
│   │   └── onboarding-controller.js     # 11-step tour
│   │
│   └── player-update/
│       └── player-update.js             # Standalone page logic (token validation, form submit)
│
├── vendor/                             # Vendored libraries
│   ├── firebase-app.js                 # Firebase SDK
│   ├── firebase-auth.js
│   ├── firebase-firestore.js
│   └── xlsx.full.min.js                # SheetJS for Excel export
│
├── e2e/                                # Playwright E2E tests
│   ├── 01-auth.e2e.js
│   ├── 02-player-management.e2e.js
│   ├── helpers.js                      # navigateTo(), injectMockFirebase()
│   ├── 11-invite-flow.e2e.js
│   └── ... (14+ test files)
│
├── tests/                              # Node test runner tests
│   ├── *.core.test.js                  # Unit tests (pure logic)
│   ├── *.integration.test.js           # Integration tests (multi-module)
│   ├── *.feature.test.js               # Feature/controller tests
│   └── firestore-rules/
│       └── *.rules.test.js             # Firestore rules validation (requires emulator)
│
├── scripts/                            # Node.js utilities
│   ├── build.js                        # esbuild bundler
│   ├── firestore-migration.js          # Data migration scripts
│   └── ...
│
├── coverage/                           # Generated test coverage (c8)
├── dist/                               # Generated bundle
│   ├── bundle.js                       # esbuild output (prod)
│   └── bundle.js.map                   # Source map
│
├── docs/                               # Documentation (auto-generated & manual)
└── .github/
    └── workflows/
        └── pages.yml                   # CI/CD: lint, test, E2E, deploy
```

## Directory Purposes

**Root Level:**
- Purpose: Configuration, credentials, main entry points, style sheets
- Contains: `index.html` (SPA root), `player-update.html` (standalone page), `app.js` (state/wiring), Firebase modules, CSS
- Key files:
  - `app.js` (193KB): Global state, UI handler wiring, page visibility, modal coordination
  - `firebase-module.js` (707KB): All Firestore operations, auth, data loading, validation
  - `styles.css`: All CSS rules with `:root` blocks for 3 themes (standard, last-war, light)

**`js/core/`:**
- Purpose: Pure business logic independent of UI and persistence
- Contains: Algorithms (assignment, reliability), data models (player, event, game), transformations, caching (i18n, theme colors)
- Key files:
  - `assignment.js`: Main assignment algorithm (balanced with troop-mix pairing)
  - `assignment.js` also exports `assignTeamToBuildingsAggressive()` (top-heavy strategy)
  - `assignment-registry.js`: Registry mapping algorithm IDs to functions per game
  - `reliability.js`: Win rate, attendance calculations used by player-updates finalization

**`js/features/{feature}/`:**
- Purpose: Feature-scoped MVC — isolate each feature's logic and presentation
- Pattern: Each feature has `*-core.js` (pure logic), `*-actions.js` (use cases), `*-view.js` (HTML builders), `*-controller.js` (wiring)
- Examples:
  - `generator/`: Player selection → team assignment → download
  - `players-management/`: Add, edit, delete, upload, filter players
  - `alliance/`: Create, invite, accept, manage members
  - `event-history/`: Save, load, finalize event records with attendance
  - `player-updates/`: Generate tokens, review pending updates, approve/reject

**`js/ui/`:**
- Purpose: Pure HTML string builders — no state, no side effects, no DOM mutations
- Contains: Functions like `buildPlayerRow()` that return `<tr>...</tr>` HTML
- Used by: Feature views and `app.js` rendering functions
- Pattern: Caller handles DOM insertion via `.innerHTML` or `.textContent`

**`js/services/`:**
- Purpose: Testable adapter to Firebase — replaces `FirebaseManager` in tests
- Contains: `FirebaseService` global with 15+ methods (see firebase-service.js line 32+)
- Depends on: All gateways, composes them into a single interface
- Used by: Controllers, `app.js`, `app-init.js`

**`js/shared/data/`:**
- Purpose: Abstract Firestore operations per feature
- Contains: Gateway files — each exports `createGateway(utils)` returning async methods
- Pattern:
  - `firebase-players-gateway.js` → `{ uploadPlayerDatabase(), upsertPlayerEntry(), removePlayerEntry() }`
  - `firebase-events-gateway.js` → `{ saveEventData(), loadEventData(), deleteEvent() }`
  - All use `utils.withManager(fn, fallback)` for safe Firebase access

**`js/shared/state/`:**
- Purpose: Observable state for UI-driven features
- Contains: `DSAppStateStore` — immutable updates, subscriber notifications, selectors
- Used by: Generator (selections, algorithm), players-management (filters), navigation (current page)

**`js/shell/`:**
- Purpose: App lifecycle, navigation, overlays, authentication UI, theming, onboarding
- Subdirectories:
  - `bootstrap/`: Boot sequence & feature controller contracts
  - `navigation/`: Menu toggle, page visibility sync
  - `overlays/`: Modal & notifications sheet open/close
  - Root level: Auth UI (settings), game selector, theme switcher, onboarding tour

**`vendor/`:**
- Purpose: Vendored browser libraries — no npm for client code
- Contains: Firebase SDKs (auth, firestore), SheetJS (Excel)
- Pattern: Loaded directly via `<script>` in `index.html`

**`tests/`:**
- Purpose: Node test runner tests (no Jest, no Mocha — native `node:test`)
- File naming: `{feature}.core.test.js` (unit), `{feature}.integration.test.js` (multi-module), `{feature}.feature.test.js` (controllers)
- Firestore rules in `firestore-rules/` subdirectory (requires Firestore emulator)

**`e2e/`:**
- Purpose: Playwright E2E tests with `file://` URLs (no dev server)
- Run: `npm run test:e2e` (all), `npm run test:e2e:smoke` (smoke tagged)
- Pattern: `*.e2e.js` files use `@smoke` tag for selective runs
- Helpers: `navigateTo()` (known pages), `injectMockFirebase()` (mock auth)

## Key File Locations

**Entry Points:**
- `index.html`: SPA root — loads all `<script>` tags, defines page containers
- `player-update.html`: Standalone page for player-facing updates
- `js/main-entry.js`: esbuild entry point — requires all modules in exact order
- `js/app-init.js`: Firebase callback setup, feature instantiation

**Configuration:**
- `firebase-config.js` (gitignored): Firebase credentials — template at `firebase-config.example.js`
- `package.json`: npm dependencies, npm scripts
- `firestore.rules`: Firestore security rules
- `eslint.config.js`: ESLint configuration

**Core Logic:**
- `js/core/assignment.js`: Main assignment algorithms
- `js/core/events.js`: Event registry, defaults by game
- `js/core/games.js`: Game definitions (Desert Storm, Canyon Storm)
- `js/core/reliability.js`: Player stats calculations

**State & Services:**
- `app.js`: Global state (allPlayers, currentEvent, teamSelections, assignmentsA/B, activeDownloadTeam)
- `js/shared/state/app-state-store.js`: Observable store for selections, filters, navigation
- `js/services/firebase-service.js`: Testable Firebase adapter

**Features (Main App):**
- `js/features/generator/`: Team assignment flow
- `js/features/players-management/`: Player CRUD & upload
- `js/features/events-manager/`: Event CRUD & asset management
- `js/features/alliance/`: Alliance creation & membership
- `js/features/event-history/`: Record & finalize event outcomes
- `js/features/player-updates/`: Player-facing update tokens & review

**Features (Sidebar):**
- `js/features/notifications/`: Invitation & notification polling
- `js/features/buildings/`: Building config & coordinate picker

**Shell & UI:**
- `js/shell/bootstrap/app-shell-bootstrap.js`: Boot trigger
- `js/shell/auth-ui-controller.js`: Settings modal, avatar, delete account
- `js/shell/theme-controller.js`: Theme selection & persistence
- `js/ui/player-table-ui.js`: Player row rendering
- `js/ui/alliance-panel-ui.js`: Alliance panel HTML

## Naming Conventions

**Files:**
- Feature modules: `{feature}-{type}.js` where type is `core`, `actions`, `view`, `controller`, `manager` (e.g., `players-management-core.js`)
- Gateways: `firebase-{feature}-gateway.js` (e.g., `firebase-players-gateway.js`)
- Utils: kebab-case ending with `-utils.js` (e.g., `firebase-gateway-utils.js`)
- Tests: `{module}.{category}.test.js` where category is `core`, `integration`, `feature` (e.g., `assignment.core.test.js`)
- E2E: `NN-{feature}.e2e.js` numbered for execution order (e.g., `01-auth.e2e.js`)

**Directories:**
- Features: kebab-case (`players-management`, `event-history`, `player-updates`)
- Shell subsystems: kebab-case (`bootstrap`, `navigation`, `overlays`)
- Data: `data` (gateways), `state` (store)

**Globals (window exports):**
- Core: `DS{Name}` (e.g., `DSCoreAssignment`, `DSCoreEvents`)
- Features: `DSFeature{Name}` (e.g., `DSFeatureGeneratorController`, `DSFeaturePlayersManagementView`)
- Services: `DS{Name}Service` or `{Name}Service` (e.g., `FirebaseService`)
- Shell: `DSShell{Name}` (e.g., `DSShellModalController`, `DSShellNavigationController`)
- Gateways: `DSSharedFirebase{Name}Gateway` (e.g., `DSSharedFirebasePlayersGateway`)
- State: `DSAppStateStore`
- UI: `DS{Name}UI` (e.g., `DSPlayerTableUI`)

**Functions:**
- camelCase: `toggleTeamSelection()`, `generateAssignments()`, `normalizePlayerData()`
- Factories: `createController(deps)`, `createGateway(utils)`, `createStore(initialState)`
- Event handlers: `handle{EventName}` or `on{EventName}` (e.g., `handlePlayersManagementAddPlayer`, `onI18nApplied`)

**CSS Variables:**
- Format: `--ds-{category}-{variant}` (e.g., `--ds-surface-base`, `--ds-text-primary`, `--ds-accent-primary`)
- Categories: `surface`, `text`, `accent`, `state`, `border` (examples)
- Variants: `base`, `primary`, `secondary`, `muted`, `inverse`, `error` (examples)

## Where to Add New Code

**New Feature:**
- Primary code: `js/features/{feature-name}/*`
  - Create `js/features/{feature-name}/{feature-name}-core.js` (pure logic)
  - Create `js/features/{feature-name}/{feature-name}-actions.js` (use cases)
  - Create `js/features/{feature-name}/{feature-name}-view.js` (HTML builders)
  - Create `js/features/{feature-name}/{feature-name}-controller.js` (wiring via deps)
- Add data gateway: `js/shared/data/firebase-{feature-name}-gateway.js`
- Add tests: `tests/{feature-name}.core.test.js`, `tests/{feature-name}.integration.test.js`, `tests/{feature-name}.feature.test.js`
- Wire in `js/app-init.js`: Instantiate controller if needed for real-time or eager init
- Add `require()` to `js/main-entry.js` in correct dependency order

**New Component/Module:**
- UI builder: Add to `js/ui/{component-name}-ui.js`
- Pure logic: Add to `js/core/{module-name}.js` if independent, else to feature
- Implementation: Export IIFE → `global.DS{Name} = { ... }`

**Utilities:**
- Shared data utilities: `js/shared/data/` (gateways, utils)
- Shared state utilities: `js/shared/state/` (store, selectors)
- Shell utilities: `js/shell/` (controllers, helpers)

**Firestore Operations:**
- All operations via gateways in `js/shared/data/`
- Gateway calls `utils.withManager(fn, fallback)` to safely access `FirebaseManager`
- Gateway is composed into `FirebaseService` in `js/services/firebase-service.js`
- Services are injected into feature controllers via deps

**Tests:**
- Unit: `tests/{module}.core.test.js` — pure function tests, mocked deps
- Integration: `tests/{module}.integration.test.js` — multi-module interaction, mocked Firebase
- Feature: `tests/{feature}.feature.test.js` — controller tests with full dependency injection
- Firestore Rules: `tests/firestore-rules/{collection}.rules.test.js` (requires emulator)
- E2E: `e2e/{feature}.e2e.js` — Playwright against live/mock Firebase with file:// URLs

## Special Directories

**`dist/`:**
- Purpose: esbuild output bundle
- Generated: Yes, by `npm run build`
- Committed: Yes (used by GitHub Pages)
- Loaded by: `index.html` via deferred `<script src="dist/bundle.js">`
- Note: For local dev without bundling, `index.html` can load individual files instead

**`vendor/`:**
- Purpose: Vendored browser libraries (Firebase, SheetJS)
- Generated: No — pre-downloaded
- Committed: Yes
- Loaded by: `index.html` via `<script>` tags before bundle

**`coverage/`:**
- Purpose: Test coverage reports from c8
- Generated: Yes, by `npm run test:coverage`
- Committed: No (in `.gitignore`)

**`node_modules/`:**
- Purpose: npm dependencies
- Generated: Yes, by `npm ci` or `npm install`
- Committed: No (in `.gitignore`)
- Used by: Build scripts, linting, testing (Node only, not browser)

---

*Structure analysis: 2025-02-25*
