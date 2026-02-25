# Architecture

**Analysis Date:** 2025-02-25

## Pattern Overview

**Overall:** Modular single-page application (SPA) using IIFE (Immediately Invoked Function Expression) pattern with layered dependency injection. No framework — pure vanilla ES6+ JavaScript with real-time Firestore sync and feature-based organization.

**Key Characteristics:**
- All modules export to `window` globals via IIFE closures (e.g., `window.DSCoreAssignment`, `window.DSFeatureGeneratorController`)
- Dependency injection via function parameters in controller factories — modules are pure functions, not classes
- Firebase Firestore as source-of-truth with real-time listeners
- Feature-scoped controllers (generator, players-management, alliance, event-history, etc.) coordinate with shared infrastructure
- Observable state store for generator selections, navigation, and filters
- Data gateway abstraction layer isolating Firestore operations from business logic
- All JavaScript loaded via deferred `<script>` tags in `index.html` (no build step required, though esbuild bundles for production)

## Layers

**Presentation (UI):**
- Purpose: DOM rendering, user interaction, CSS variables integration
- Location: `js/ui/`, features' `*-view.js` files, `index.html`
- Contains: HTML builder functions, DOM queries, event delegation helpers, CSS variable readers
- Depends on: Core modules (for data shapes), state store (for current state), i18n (for labels)
- Used by: Controllers via dependency injection, `app.js` wiring

**Controllers (Feature Orchestration):**
- Purpose: Coordinate user actions, wire dependencies, manage feature lifecycle
- Location: `js/features/{feature}/*-controller.js`, `js/shell/*-controller.js`
- Contains: Factory functions returning controller objects with public methods
- Depends on: Actions, views, core logic, state store, Firebase service
- Used by: App bootstrap, app.js inline handlers, feature wiring in `app-init.js`

**Actions (Business Logic):**
- Purpose: Implement use cases — selection changes, generation, filtering, validation
- Location: `js/features/{feature}/*-actions.js`
- Contains: Pure functions and side-effecting operations (state mutations, DOM updates)
- Depends on: Core logic, state store, views
- Used by: Controllers

**Core (Algorithms & Data Models):**
- Purpose: Pure business logic and data transformation — independent of UI and Firebase
- Location: `js/core/`
- Contains: Assignment algorithms, event/building normalization, player sorting, reliability calculations, i18n engine, reliability color mappings
- Depends on: Nothing — no circular dependencies
- Used by: Actions, controllers, services

**Gateways (Data Abstraction):**
- Purpose: Abstract Firestore operations behind feature-scoped contracts
- Location: `js/shared/data/`
- Contains: `firebase-{feature}-gateway.js` files, each exporting `createGateway(utils) → { async methods }`
- Depends on: `firebase-gateway-utils.js`, `FirebaseManager` (accessed via utils)
- Used by: `FirebaseService` adapter which composes all gateways

**Firebase Infrastructure (Persistence):**
- Purpose: Direct Firestore reads/writes, auth lifecycle, error handling
- Location: `firebase-module.js`, `firebase-infra.js`, `firebase-auth-module.js`
- Contains: `FirebaseManager` (main facade), `DSFirebaseInfra` (path builders), `DSFirebaseAuth` (auth callbacks)
- Depends on: Firebase SDKs (in `vendor/`)
- Used by: Gateways, `FirebaseService` adapter

**Services (Adapter Pattern):**
- Purpose: Testable interface to Firebase — enables mocking in unit tests
- Location: `js/services/firebase-service.js`
- Contains: `FirebaseService` global with 15+ async/sync methods (upsertPlayerEntry, saveEventData, etc.)
- Depends on: All gateways (composes them), `FirebaseManager`
- Used by: Controllers, `app.js`, `app-init.js`, feature wiring callbacks

**Shell (App Bootstrap & Overlays):**
- Purpose: App lifecycle, navigation, modal/sheet management, auth UI, theming, onboarding
- Location: `js/shell/`
- Contains: Bootstrap sequence, navigation controller, modal controller, notifications sheet, auth UI, theme controller, game selector
- Depends on: Core modules, Firebase service, state store
- Used by: `index.html` startup, app.js handlers

**State Store (Observable State):**
- Purpose: Centralized, observable state for UI-driven features (generator selections, navigation, filters)
- Location: `js/shared/state/app-state-store.js`
- Contains: `DSAppStateStore.createStore()` — immutable state updates, subscriber notifications
- Depends on: Nothing
- Used by: Generator actions, players-management, event-history, player-updates features

## Data Flow

**Authentication & User Load:**

1. `index.html` deferred script creates `<script defer src="dist/bundle.js">`
2. Bundle evaluates → all IIFE modules export globals → `app.js` top-level code runs → `app-init.js` IIFE fires
3. `app-init.js` → `initializeFirebaseCallbacks()` → `FirebaseService.setAuthCallback()`
4. `firebase-module.js` → `FirebaseManager.init()` → `firebase.auth().onAuthStateChanged()`
5. User signs in → `DSFirebaseAuth.handleAuthStateChanged(user)` → calls registered callback
6. Callback fires → `app-init.js` authCallback → `FirebaseService.loadUserData()` → loads Firestore
7. `FirebaseManager.loadUserData()` queries `users/{uid}/games/{gameId}/players`, `events`, `user_state`
8. Data loaded → callback chain → `loadPlayerData()`, `loadBuildingConfig()`, feature wiring
9. `DSFeatureEventHistoryController.init()` and `DSFeaturePlayerUpdatesController.init()` subscribed

**Player Selection & Team Generation:**

1. User clicks player row in `#playersTableBody` (delegated) → `.team-a-btn` or `.team-b-btn`
2. Click → `toggleTeam(playerName, teamA/B)` in `app.js`
3. `toggleTeam()` → `DSFeatureGeneratorTeamSelection.toggleTeamSelection()` → `DSAppStateStore.setState()`
4. State update notifies listeners → `updateTeamCounters()` re-renders counts, `renderPlayersTable()` re-renders rows
5. User clicks `#generateBtnA` or `#generateBtnB`
6. Click → `generateTeamAssignments(teamA/B)` in `app.js`
7. Gets selected players from state → `DSCoreGeneratorAssignment.preparePlayersForAssignment()` (player quality checks)
8. `DSAssignmentRegistry.resolveCurrentEventAssignmentSelection()` picks algorithm (balanced/aggressive/pairs)
9. `DSCoreAssignment.assignTeamToBuildings()` runs assignment → returns array of `{ building, player, power, troops, thp }`
10. Assignments stored in global `assignmentsA` or `assignmentsB` → `openDownloadModal(team)` shows download modal

**Real-time Alliance & Updates:**

1. After player data load, `FirebaseService.setAllianceDataCallback()` registered in `app-init.js`
2. Firestore listener on `alliances/{allianceId}` fires when members, invitations, or alliance data change
3. Callback → `handleAllianceDataRealtimeUpdate()` in `app.js`
4. Updates global `allianceData` → `renderAlliancePanel()`, `updateAllianceHeaderDisplay()`
5. Also triggers `_playerUpdatesController.subscribeBadge()` → loads pending player updates count

**State Management:**

- **Global state** on `window`: `allPlayers`, `currentAuthUser`, `activeDownloadTeam`, `currentEvent`, `teamSelections`, `assignmentsA/B`, `currentEvent`
- **Feature state** in `DSAppStateStore`: `{ navigation.currentView, generator.assignmentAlgorithm, generator.teamSelections, playersManagement.filters, eventHistory.filterGameId, playerUpdates.reviewFilter }`
- **Firestore state** cached locally: `playerDatabase`, `allEventData`, `buildingConfig`, `allianceData`
- Reads from Firestore are one-time on mount; real-time listeners update via callbacks; writes are async via gateways

## Key Abstractions

**Assignment Algorithms:**
- Purpose: Distribute players to buildings by power/troop composition strategy
- Examples: `DSCoreAssignment.assignTeamToBuildings()` (balanced, with troop-mix pairing), `assignTeamToBuildingsAggressive()` (top-heavy, map-aware)
- Pattern: Implement function `(players, buildingConfig) → assignments[]`, register in `DSAssignmentRegistry`, select via algorithm ID in event

**Feature Controller Factory:**
- Purpose: Isolate feature logic from global scope — enable testing via dependency injection
- Examples: `DSFeatureGeneratorController.createController(deps)`, `DSFeaturePlayersManagementController.createController(deps)`
- Pattern: Return object with public methods; methods call injected `deps.*` functions; fallback to global if not injected

**Data Gateway:**
- Purpose: Encapsulate Firestore paths and operations behind a feature-scoped contract
- Examples: `DSSharedFirebaseEventsGateway.createGateway(utils)` → `{ saveEventData(), loadEventData(), deleteEvent() }`
- Pattern: Export `createGateway(utils)` function; use `utils.withManager(fn, fallback)` to safely wrap Firebase calls

**State Store Selectors:**
- Purpose: Extract slices of app state in a consistent, testable way
- Examples: `DSAppStateStore.selectors.selectTeamSelections(state, 'teamA')`, `selectTeamCounts(state)`
- Pattern: Pure functions `(state) → slice` — no side effects

**UI Builders:**
- Purpose: Generate HTML strings for feature panels and tables (no JSX, no templates)
- Examples: `DSPlayerTableUI.buildPlayerRow(player, index)`, `DSAlliancePanelUI.buildAlliancePanel(alliance, user)`
- Pattern: Return HTML string; caller inserts via `.innerHTML` or `.textContent`

## Entry Points

**`index.html` (Browser):**
- Location: `/Users/constantinescucristian/repos/events-team-generator/index.html`
- Triggers: Page load
- Responsibilities:
  - Inline `<script>` tag creates deferred bundle script
  - Global `<div id="loginScreen">` and `<div id="mainApp">` containers
  - Loads `firebase-config.js` (credentials)
  - All feature-specific `<div id="*Page">` pages

**`app-shell-bootstrap.js` (Boot):**
- Location: `/Users/constantinescucristian/repos/events-team-generator/js/shell/bootstrap/app-shell-bootstrap.js`
- Triggers: `DOMContentLoaded` or `setTimeout(boot, 0)` if DOM already ready
- Responsibilities:
  - Creates `DSAppShellBootstrap.boot()` → calls `rootController.init()` → `initializeApplicationUiRuntime()` in `app.js`

**`app.js` (UI Wiring):**
- Location: `/Users/constantinescucristian/repos/events-team-generator/app.js`
- Triggers: Bundle evaluation (top-level code)
- Responsibilities:
  - Exports `initializeApplicationUiRuntime()` called by boot
  - Wires ALL `#btnId.click`, `#selectId.change` handlers via `bindStaticUiActions()`
  - Manages global state: `allPlayers`, `currentEvent`, `teamSelections`, `assignmentsA/B`
  - Orchestrates page visibility, modal overlays, notifications

**`app-init.js` (Firebase & Feature Init):**
- Location: `/Users/constantinescucristian/repos/events-team-generator/js/app-init.js`
- Triggers: IIFE execution at bundle load (before DOMContentLoaded)
- Responsibilities:
  - Calls `FirebaseService.setAuthCallback()`, `setDataLoadCallback()`, `setAllianceDataCallback()`
  - Implements callback handlers: auth state changes, player data loaded, alliance data sync
  - Instantiates `DSFeatureEventHistoryController` and `DSFeaturePlayerUpdatesController`
  - Calls `initLanguage()` → `DSI18N.init()`

**Firebase Init Sequence:**
- `FirebaseManager.init()` (deferred until DOM or readyState guard) → `DSFirebaseInfra.setDb()` → `DSFirebaseAuth.configure()`
- `firebase.auth().onAuthStateChanged()` → triggers auth callback
- On sign-in: `FirebaseManager.loadUserData()` → Firestore queries → triggers data callback

## Error Handling

**Strategy:** Layered error recovery with console logging and user-facing fallbacks.

**Patterns:**

1. **Firebase Errors (gateways):**
   ```javascript
   // firebase-players-gateway.js
   uploadPlayerDatabase: async (file) => {
     try {
       const result = await FirebaseManager.uploadPlayerDatabase(file);
       return { success: true, data: result };
     } catch (err) {
       console.error('Upload failed:', err);
       return { success: false, error: err.message };
     }
   }
   ```

2. **Missing Dependencies (adapter pattern):**
   ```javascript
   // firebase-service.js
   withManager: (fn, fallback) => {
     const mgr = manager();
     return !mgr ? fallback : fn(mgr);
   }
   ```

3. **Missing Firebase Config (`app-init.js`):**
   - If `FirebaseService.isAvailable()` returns false
   - Call `renderMissingFirebaseError()` → display error UI in `#loginScreen`

4. **Assignment Validation (`generator-actions.js`):**
   - Check player count vs. building slots before assignment
   - Return early if insufficient players
   - Render validation errors in UI

5. **Firestore Rules Failures:**
   - Operations return `{ success: false, error: string }`
   - Controllers check `success` flag before proceeding
   - Render toast or inline error to user

## Cross-Cutting Concerns

**Logging:** No logger library; use `console.log()`, `console.warn()`, `console.error()` with context strings.

**Validation:** Mixed approach:
- Firestore rules enforce data shape at persistence layer
- Gateways validate inputs (file size, field types) before write
- Controllers validate state (e.g., team selection limits) before action

**Authentication:**
- Firebase Auth handles token lifecycle
- `DSFirebaseAuth.handleAuthStateChanged()` synchronizes app state
- Auth callback in `app-init.js` gates all data operations
- Unauthenticated users see `#loginScreen` only

**i18n:**
- All user-visible strings in `translations.js` with 6 language entries (EN, FR, DE, IT, KO, RO)
- `DSI18N.applyTranslations()` called on boot and language switch
- HTML elements with `data-i18n="key"` auto-translated
- Dynamic text via `t(key)` or `t(key, params)` (e.g., `t('player_count', { count: 42 })`)

**Theming:**
- 4 themes: `standard`, `last-war`, `light`, `system`
- CSS variables `--ds-*` declared in `:root` blocks per theme in `styles.css` and `theme-variables.css`
- Runtime reading via `DSThemeColors.get('token-name')` with hardcoded fallback
- Theme persisted in `localStorage` and Firebase user profile
- On theme switch: update `<html data-theme>`, invalidate CSS var cache

**Real-time Data Sync:**
- Firestore listeners registered in `app-init.js` callbacks
- Multiple listeners: player data, alliance data, event history finalization count, player updates pending count
- Listeners fire on every Firestore change → re-render affected panels
- No polling — purely event-driven via Firestore SDKs

---

*Architecture analysis: 2025-02-25*
