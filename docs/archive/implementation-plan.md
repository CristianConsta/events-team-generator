# Events Team Generator — Phased Implementation Plan

> Generated: 2026-02-21 | Revised: 2026-02-21 (incorporated architect, sr-developer, sr-QA review)
> Source: docs/platform-evolution-research.md + codebase analysis
> This document is self-contained. Developer agents implement from this doc + codebase only.

---

## Table of Contents

1. [Conventions & Patterns Reference](#1-conventions--patterns-reference)
2. [Phase 0: Foundation](#2-phase-0-foundation)
3. [Phase 1A: Event History MVP](#3-phase-1a-event-history-mvp)
4. [Phase 1B: Player Self-Update MVP](#4-phase-1b-player-self-update-mvp)
5. [Phase 2: Integration](#5-phase-2-integration)
6. [Phase 3: Multi-Game Plugin System](#6-phase-3-multi-game-plugin-system)
7. [Phase 4: Battle Plans & Interactive Maps](#7-phase-4-battle-plans--interactive-maps)
8. [Phase 5: Timeline/Phase System](#8-phase-5-timelinephase-system)
9. [Phase 6: Dashboard & Analytics](#9-phase-6-dashboard--analytics)
10. [Phase 7: Collaboration](#10-phase-7-collaboration)
11. [Inter-Phase Dependency Graph](#11-inter-phase-dependency-graph)
12. [Review Changelog](#12-review-changelog)

---

## 1. Conventions & Patterns Reference

This section captures the project-wide patterns every developer agent MUST follow.

### 1.1 IIFE Module Pattern

Every JS file uses this exact structure. No deviations.

```js
(function initModuleName(global) {
    // private variables and functions here

    global.DSModuleName = {
        publicMethod: publicMethod,
    };
})(window);
```

- Export name prefix: `DS` (e.g., `DSCoreReliability`, `DSFeatureEventHistory`)
- File name: `kebab-case.js`
- Function names: `camelCase`

### 1.2 Gateway Pattern

All Firestore access goes through a gateway file in `js/shared/data/`. Each gateway:

- Is created via a `createGateway(utils)` factory function
- Delegates to `gatewayUtils.withManager((svc) => svc.method(), fallback)`
- Is exported as `global.DSSharedFirebase<Domain>Gateway = { createGateway }`

Example shape from `firebase-players-gateway.js`:
```js
(function initFirebase<Domain>Gateway(global) {
    function createGateway(utils) {
        const gatewayUtils = utils || global.DSSharedFirebaseGatewayUtils.createUtils(global);
        return {
            methodName: async function methodName(args) {
                return gatewayUtils.withManager((svc) => svc.methodName(args), fallback);
            },
        };
    }
    global.DSSharedFirebase<Domain>Gateway = { createGateway };
})(window);
```

### 1.3 Gateway Composition into FirebaseService (CRITICAL)

`firebase-service.js` exports a **flat** `window.FirebaseService` object. This is the single unified gateway used throughout `app.js`. When adding new gateway domains, you MUST wire them into `FirebaseService` inside `firebase-service.js`.

**How new gateways are composed** (look for the `fromFactory` block near line 250):

```js
// Pattern already in firebase-service.js:
const authGateway = fromFactory('DSSharedFirebaseAuthGateway', fallbackAuthGateway);
const playersGateway = fromFactory('DSSharedFirebasePlayersGateway', fallbackPlayersGateway);
// ... etc
```

For each new gateway (e.g., `eventHistory`), you must:

1. Create the gateway file: `js/shared/data/firebase-event-history-gateway.js` (exports `DSSharedFirebaseEventHistoryGateway`)
2. Add a fallback function inside `firebase-service.js`:
   ```js
   function fallbackEventHistoryGateway(gatewayUtils) {
       return {
           saveHistoryRecord: async function() { return gatewayUtils.notLoadedResult(); },
           // ... all methods with sensible fallbacks
       };
   }
   ```
3. Add `fromFactory` call near the other gateway instantiations:
   ```js
   const eventHistoryGateway = fromFactory('DSSharedFirebaseEventHistoryGateway', fallbackEventHistoryGateway);
   ```
4. Add each method to the flat `FirebaseService` object at the bottom of the file:
   ```js
   saveHistoryRecord: function(allianceId, record) {
       return eventHistoryGateway.saveHistoryRecord(allianceId, record);
   },
   ```

**Grep anchor for finding where to add methods in `app.js`**: Search for the string `// BEGIN FEATURE WIRING` — if not present, add it as a comment above the first alliance-load wiring block, then use it as anchor for all new feature wiring.

### 1.4 Feature Folder Structure

Each feature lives in `js/features/<feature-name>/`:
- `<feature>-core.js` — pure logic, no DOM, testable in Node
- `<feature>-actions.js` — reads from DOM, builds payloads (keep even if only 2 methods — consistency)
- `<feature>-view.js` — renders DOM from data
- `<feature>-controller.js` — wires core + view + gateway

### 1.5 State Store

`window.DSAppStateStore` is the global pub/sub state. Access via:
- `DSAppStateStore.getState()` → returns deep clone
- `DSAppStateStore.setState(updater)` → merges patch, notifies listeners
- `DSAppStateStore.subscribe(listener)` → returns unsubscribe fn

### 1.6 i18n

- Add all user-visible strings to `translations.js` under every language key
- HTML: `data-i18n="key_name"` on elements, applied by `DSI18N.applyTranslations()`
- Keys: `snake_case`

### 1.7 Tests

Tests live in `tests/` using Node's `node:test` module. Pattern:

```js
const test = require('node:test');
const assert = require('node:assert/strict');

test('description', () => {
    global.window = global;
    delete global.DSModuleName;
    require('../js/path/to/module.js');
    // test DSModuleName functions
});
```

### 1.8 Firestore Rules Tests

Firestore security rules tests live in `tests/firestore-rules/` and use `@firebase/rules-unit-testing`.

```js
// tests/firestore-rules/event-history.rules.test.js
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
```

Install: `npm install --save-dev @firebase/rules-unit-testing`

Each rules test file follows the pattern:
1. `initializeTestEnvironment` with `firestore.rules` loaded
2. Create authenticated/unauthenticated contexts
3. `assertSucceeds` / `assertFails` on read/write operations

### 1.9 Data Gateway Contract

`js/shared/data/data-gateway-contract.js` lists required methods by domain. When adding a new domain, add it to `DATA_GATEWAY_METHODS`. The contract is validated on startup — a missing method will surface as a warning in the console.

### 1.10 CSP

Current CSP in `index.html`:
```
script-src 'self' https://apis.google.com https://www.gstatic.com https://accounts.google.com
connect-src 'self' https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com https://*.googleapis.com
```

No `unsafe-eval` or `unsafe-inline` for scripts. Any new vendor library must not require these.

### 1.11 Firestore Document ID Safety: `sanitizeDocId(name)`

Player names can contain characters invalid in Firestore document IDs (`.`, `/`, `#`, `[`, `]`, `*`, etc.). Whenever a player name is used as a Firestore document ID (e.g., `attendance/{playerName}`, `player_stats/{playerName}`), it MUST be sanitized first.

**Create this utility in `js/core/firestore-utils.js`** (new file, Phase 1A):

```js
(function initFirestoreUtils(global) {
    // Sanitize a string for use as a Firestore document ID.
    // Replaces invalid chars with '_', trims to 1500 bytes (Firestore limit).
    // Does NOT guarantee uniqueness — callers must be aware of collisions.
    function sanitizeDocId(name) {
        if (typeof name !== 'string' || name.length === 0) return '_empty_';
        // Replace invalid Firestore doc ID chars
        var sanitized = name.replace(/[\/\.#\[\]\*]/g, '_');
        // Firestore doc IDs cannot start/end with __
        sanitized = sanitized.replace(/^__/, '_x_').replace(/__$/, '_x_');
        // Trim to 1500 bytes (Firestore limit is 1500 bytes for doc IDs)
        if (sanitized.length > 1500) sanitized = sanitized.slice(0, 1500);
        return sanitized;
    }

    global.DSFirestoreUtils = {
        sanitizeDocId: sanitizeDocId,
    };
})(window);
```

**Usage**: Any gateway that writes `attendance/{playerName}` or `player_stats/{playerName}` must call `DSFirestoreUtils.sanitizeDocId(playerName)` before using the name as a doc ID. The raw `playerName` string is still stored as a field inside the document.

### 1.12 E2E Testing Tooling

All E2E tests use **Playwright**. Setup:

```bash
npm install --save-dev @playwright/test
npx playwright install chromium
```

E2E tests live in `tests/e2e/`. Run with: `npx playwright test`

Config file: `playwright.config.js` at project root:
```js
module.exports = {
    testDir: './tests/e2e',
    use: {
        baseURL: 'http://localhost:5000',  // firebase serve or simple-http-server
        headless: true,
    },
};
```

### 1.13 Test Data Factories

To avoid repetitive test setup, create `tests/helpers/factories.js`:

```js
// tests/helpers/factories.js
// Factory functions for creating test data objects

function makePlayer(overrides) {
    return Object.assign({
        name: 'TestPlayer',
        power: 100,
        thp: 500,
        troops: 'Tank',
        reliabilityScore: null,
    }, overrides || {});
}

function makeAttendanceRecord(overrides) {
    return Object.assign({
        status: 'attended',
        team: 'teamA',
        role: 'assigned',
        building: 'B1',
        markedBy: 'uid_leader',
        markedAt: null,
    }, overrides || {});
}

function makeHistoryRecord(overrides) {
    return Object.assign({
        eventTypeId: 'desert_storm',
        eventName: 'Desert Storm #1',
        gameId: 'last_war',
        scheduledAt: new Date('2026-01-01T18:00:00Z'),
        completedAt: null,
        status: 'planned',
        teamAssignments: { teamA: [], teamB: [] },
        notes: '',
        createdBy: 'uid_leader',
        finalized: false,
    }, overrides || {});
}

function makePlayerStats(overrides) {
    return Object.assign({
        totalEvents: 0,
        attended: 0,
        noShows: 0,
        excused: 0,
        reliabilityScore: null,
        currentStreak: 0,
        longestNoShowStreak: 0,
        lastEventDate: null,
        recentHistory: [],
    }, overrides || {});
}

function makeToken(overrides) {
    return Object.assign({
        token: 'abcdef1234567890abcdef1234567890',
        allianceId: 'alliance_1',
        playerName: 'TestPlayer',
        gameId: 'last_war',
        createdBy: 'uid_leader',
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        used: false,
        usedAt: null,
        usedByAnonUid: null,
        currentSnapshot: { power: 100, thp: 500, troops: 'Tank' },
        linkedEventId: null,
    }, overrides || {});
}

module.exports = { makePlayer, makeAttendanceRecord, makeHistoryRecord, makePlayerStats, makeToken };
```

---

## 2. Phase 0: Foundation

### 2.1 Overview

**Goal**: Improve developer experience without changing any user-visible behavior. Optionally introduce esbuild.

**IMPORTANT**: CLAUDE.md currently states "No build tool — avoid anything that requires compilation." If Phase 0 is adopted, **CLAUDE.md must be updated** to reflect the new build step. Add this to the Commands section:

```md
# Build (if esbuild adopted in Phase 0)
npm run build    # produces dist/bundle.js
npm run dev      # watch mode
```

This is a deliberate override of the CLAUDE.md rule. If the team decides NOT to adopt esbuild, Phase 0 is skipped entirely and CLAUDE.md is unchanged.

**Effort**: 1–2 weeks
**Dependencies**: None
**Parallel with**: Nothing (do first if adopted, then all other phases)

### 2.2 New Files to Create

#### `scripts/build.js`
- **IIFE export**: None (Node script)
- **Purpose**: esbuild bundler entry point

```js
// scripts/build.js
const esbuild = require('esbuild');
esbuild.build({
    entryPoints: ['js/main-entry.js'],
    bundle: true,
    outfile: 'dist/bundle.js',
    sourcemap: true,
    target: ['es2017'],
    format: 'iife',
});
```

#### `js/main-entry.js`
- **Purpose**: Entry point that requires all IIFE modules in correct order
- **Description**: Replaces the implicit load ordering of `<script defer>` tags

### 2.3 Existing Files to Modify

#### `CLAUDE.md` (if esbuild adopted)
- Update the Commands section to document `npm run build` and `npm run dev`
- Update the "What NOT to Do" section: change "Do not introduce a build tool" to "Do not introduce a new build tool (esbuild is the only approved bundler)"

#### `package.json`
- Add `"build": "node scripts/build.js"` to scripts
- Add `"dev": "node scripts/build.js --watch"` to scripts
- Add `esbuild` as devDependency

#### `index.html`
- If esbuild is adopted: replace all `<script defer>` tags with single `<script defer src="dist/bundle.js"></script>`
- If esbuild is NOT adopted: no change

#### `.github/workflows/deploy.yml`
- Add `npm run build` step before deploy if esbuild is adopted

### 2.4 Firestore Data Model

No changes.

### 2.5 Security Rules

No changes.

### 2.6 i18n Keys

No new keys.

### 2.7 CSS Changes

No changes.

### 2.8 HTML Changes

Only if esbuild adopted: replace `<script defer>` tags.

### 2.9 Acceptance Criteria

- [ ] `npm run build` produces `dist/bundle.js` with source maps
- [ ] App loads and all existing features work identically
- [ ] All existing tests pass (`npm test`)
- [ ] No user-visible changes
- [ ] CLAUDE.md updated to reflect build step (if esbuild adopted)

### 2.10 Test Plan

**Unit tests**: None (no logic changes)
**Integration tests**: Run existing suite after build change — all must pass
**E2E tests**: Run existing smoke tests — all must pass
**Edge cases**: Test that bundle loads in mobile Chrome (iOS Safari, Android Chrome)

---

## 3. Phase 1A: Event History MVP

### 3.1 Overview

**Goal**: Allow leaders to record event history, mark attendance, and see per-player reliability scores as colored dots in the player list.

**Effort**: 2–3 weeks
**Dependencies**: None (can start immediately)
**Parallel with**: Phase 1B (zero code dependencies between them)

### 3.2 Firestore Data Model

**Note**: `{playerName}` used as Firestore document IDs MUST be sanitized via `DSFirestoreUtils.sanitizeDocId(playerName)` (see Section 1.11). The raw `playerName` is stored as a field inside the document.

```
alliances/{allianceId}/event_history/{historyId}
  Fields:
    eventTypeId: string         // e.g. "desert_storm"
    eventName: string           // e.g. "Desert Storm #12"
    gameId: string              // e.g. "last_war"
    scheduledAt: Timestamp
    completedAt: Timestamp | null
    status: string              // "planned" | "completed" | "cancelled"
    teamAssignments: {          // snapshot at time of event
        teamA: Array<{ playerName, building, troops, power }>,
        teamB: Array<{ playerName, building, troops, power }>
    }
    notes: string
    createdBy: string           // uid
    createdAt: Timestamp
    finalized: boolean          // true after attendance is locked

  Subcollection: attendance/{sanitizedPlayerName}
    Fields:
      playerName: string        // RAW (unsanitized) player name — always stored here
      team: string              // "teamA" | "teamB"
      role: string              // "assigned" | "substitute"
      building: string
      status: string            // "confirmed" | "attended" | "no_show" | "late_sub" | "excused" | "cancelled_event"
      confirmedAt: Timestamp | null
      markedAt: Timestamp | null
      markedBy: string          // uid of leader who marked

alliances/{allianceId}/player_stats/{sanitizedPlayerName}
  Fields:
    playerName: string          // RAW (unsanitized) player name
    totalEvents: number
    attended: number
    noShows: number
    excused: number
    reliabilityScore: number | null   // 0-100, null if < 3 valid events
    currentStreak: number             // consecutive attended events
    longestNoShowStreak: number
    lastEventDate: Timestamp | null
    recentHistory: Array<{            // last 10 events, newest first
        historyId: string,
        status: string,
        eventName: string,
        scheduledAt: Timestamp
    }>
    updatedAt: Timestamp
```

**Firestore Indexes needed**:
- `alliances/{allianceId}/event_history`: composite on `(gameId ASC, scheduledAt DESC)`
- `alliances/{allianceId}/event_history`: composite on `(status ASC, scheduledAt DESC)`

### 3.3 Firestore Security Rules

```javascript
// Add to existing rules

match /alliances/{allianceId}/event_history/{historyId} {
    allow read: if isAllianceMember(allianceId);
    allow create: if isAllianceMember(allianceId)
                  && request.resource.data.createdBy == request.auth.uid;
    allow update: if isAllianceMember(allianceId);
    allow delete: if isAllianceMember(allianceId);
}

match /alliances/{allianceId}/event_history/{historyId}/attendance/{playerDocId} {
    allow read: if isAllianceMember(allianceId);
    allow write: if isAllianceMember(allianceId);
}

match /alliances/{allianceId}/player_stats/{playerDocId} {
    allow read: if isAllianceMember(allianceId);
    allow write: if isAllianceMember(allianceId);
}
```

### 3.4 New Files to Create

#### `js/core/firestore-utils.js`
- **IIFE export**: `window.DSFirestoreUtils`
- **Purpose**: Shared Firestore utilities used by all gateway files
- See full implementation in Section 1.11 above.

#### `js/core/reliability.js`
- **IIFE export**: `window.DSCoreReliability`
- **Public API**:

```js
// Calculate reliability score using exponential decay.
// history: Array<{ status: string }> — most recent FIRST (index 0 = most recent)
// Returns: number (0-100) | null
// Returns null if validHistory (after excluding cancelled_event and computing excused)
//   has fewer than 3 entries where status is not 'cancelled_event'.
// ALGORITHM:
//   DECAY_FACTOR = 0.85
//   for each entry at index i (0 = most recent):
//     weight = DECAY_FACTOR ^ i
//     if status == 'attended':    attendedWeight += weight; totalWeight += weight
//     if status == 'late_sub':    attendedWeight += weight * 0.8; totalWeight += weight
//     if status == 'excused':     skip (neither totalWeight nor attendedWeight incremented)
//     if status == 'no_show':     totalWeight += weight (attendedWeight not incremented)
//     if status == 'cancelled_event': skip entirely (not counted in threshold check)
//   validCount = count of entries where status != 'cancelled_event'
//   if validCount < 3: return null
//   if totalWeight == 0: return null
//   return Math.round((attendedWeight / totalWeight) * 100)
calculateReliabilityScore(history)

// Returns tier object for a given score.
// score: number | null
// Returns: { tier: string, label: string, color: string, cssClass: string }
// Tier mapping: 90-100=excellent, 70-89=good, 50-69=fair, 30-49=poor, 0-29=critical, null=new
getReliabilityTier(score)

// Recalculates and returns updated player_stats object from full attendance history.
// history: Array<{ status, eventName, scheduledAt, historyId }>  — most recent FIRST
// existing: existing player_stats object (may be empty {})
// Returns: updated player_stats object (does NOT write to Firestore — caller does)
recalculatePlayerStats(history, existing)
```

**Reliability Tiers**:

| Score | tier | label | color | cssClass |
|-------|------|-------|-------|----------|
| 90-100 | excellent | Rock solid | #2e7d32 | `reliability-excellent` |
| 70-89 | good | Reliable | #1565c0 | `reliability-good` |
| 50-69 | fair | Inconsistent | #ef6c00 | `reliability-fair` |
| 30-49 | poor | Unreliable | #c62828 | `reliability-poor` |
| 0-29 | critical | Chronic no-show | #b71c1c | `reliability-critical` |
| null | new | No history | #757575 | `reliability-new` |

#### `js/features/event-history/event-history-core.js`
- **IIFE export**: `window.DSFeatureEventHistoryCore`
- **Public API**:

```js
// Build a new event history document from a completed assignment.
// assignment: { eventTypeId, eventName, gameId, scheduledAt, teamA: [], teamB: [] }
// createdByUid: string
// Returns: event_history Firestore document (without id)
buildHistoryRecord(assignment, createdByUid)

// Build attendance subcollection docs from teamAssignments.
// teamAssignments: { teamA: [], teamB: [] }
// Returns: Array<{ docId: string (sanitized), playerName: string (raw), attendanceDoc: object }>
buildAttendanceDocs(teamAssignments)

// Validate a status transition.
// Valid transitions:
//   confirmed -> attended | no_show | late_sub | excused | cancelled_event
//   attended  -> (no transitions — finalized states are terminal)
//   no_show   -> (terminal)
//   late_sub  -> (terminal)
//   excused   -> (terminal)
//   cancelled_event -> (terminal)
// currentStatus: string, newStatus: string
// Returns: { valid: boolean, reason?: string }
validateStatusTransition(currentStatus, newStatus)

// Check if an event_history doc has unfinalized attendance (staleness warning).
// Stale = completedAt is more than 7 days ago AND finalized is false.
// historyDoc: event_history document, now: Date
// Returns: { stale: boolean, daysSinceCompleted: number }
checkFinalizationStaleness(historyDoc, now)
```

#### `js/features/event-history/event-history-controller.js`
- **IIFE export**: `window.DSFeatureEventHistoryController`
- **Public API**:

```js
// Initialize the event history feature, attach Firestore listeners.
// gateway: FirebaseService (the unified flat gateway)
// Returns: { destroy() }
init(gateway)

// Navigate to Event History view.
showEventHistoryView()

// Save current assignment as new history record.
// assignment: current generator output
// Returns: Promise<{ ok, historyId?, error? }>
saveAssignmentAsHistory(assignment)

// Open attendance check-in panel for a history record.
// historyId: string
openAttendancePanel(historyId)

// Mark attendance for all players in batch.
// Uses Firestore batched write (see finalization atomicity note in Section 3.5).
// historyId: string, attendanceMap: { playerName (raw): status }
// Returns: Promise<{ ok, error? }>
markAttendanceBatch(historyId, attendanceMap)

// Finalize attendance — ATOMIC operation.
// Uses a single Firestore batched write to:
//   1. Set event_history.finalized = true
//   2. Write all updated player_stats documents
// historyId: string
// Returns: Promise<{ ok, error? }>
finalizeAttendance(historyId)
```

**Atomicity of finalization**: `finalizeAttendance` MUST use a Firestore `batch()` that writes the history document update AND all player_stats updates in a single commit. If any individual write would fail, the whole batch fails and the record stays unfinalized. This prevents partial state.

#### `js/features/event-history/event-history-view.js`
- **IIFE export**: `window.DSFeatureEventHistoryView`
- **Public API**:

```js
// Render the event history list view into a container element.
// container: HTMLElement, records: Array<event_history docs>
renderHistoryList(container, records)

// Render the attendance check-in panel.
// container: HTMLElement, historyDoc: event_history, attendanceDocs: Array
renderAttendancePanel(container, historyDoc, attendanceDocs)

// Render a reliability dot for a player row.
// score: number | null
// Returns: HTMLElement (colored dot span with aria-label and title tooltip)
// MUST include aria-label for accessibility: aria-label="Reliability: 85% (Reliable)"
renderReliabilityDot(score)

// Render the pending finalization badge count.
// container: HTMLElement, count: number
renderPendingBadge(container, count)
```

#### `js/features/event-history/event-history-actions.js`
- **IIFE export**: `window.DSFeatureEventHistoryActions`
- **Public API** (2 methods — keep for folder consistency):

```js
// Read attendance form state from DOM.
// Returns: { [playerName (raw)]: status } map
readAttendanceFormState()

// Read event history filter state from DOM.
// Returns: { gameId, status, dateRange }
readHistoryFilterState()
```

#### `js/shared/data/firebase-event-history-gateway.js`
- **IIFE export**: `window.DSSharedFirebaseEventHistoryGateway`
- **Note**: Methods in this gateway are delegated to `FirebaseManager`. The method names listed here must also be implemented on `FirebaseManager` (inside `firebase-module.js`) and wired into `FirebaseService` (see Section 1.3).
- **Public API** (all methods are async unless noted):

```js
createGateway(utils) → {
    // Save a new history record.
    // allianceId: string, record: object
    // Returns: Promise<{ ok, historyId?, error? }>
    saveHistoryRecord(allianceId, record)

    // Save attendance subcollection in a Firestore batch.
    // allianceId, historyId, attendanceDocs: Array<{ docId, playerName, doc }>
    // Returns: Promise<{ ok, error? }>
    saveAttendanceBatch(allianceId, historyId, attendanceDocs)

    // Load history records for an alliance (ordered by scheduledAt DESC).
    // allianceId: string, filters: { gameId?, status?, limit?: number }
    // Returns: Promise<Array<event_history docs with id>>
    loadHistoryRecords(allianceId, filters)

    // Load attendance for a single history record.
    // allianceId, historyId
    // Returns: Promise<Array<{ docId, playerName, ...attendanceDoc }>>
    loadAttendance(allianceId, historyId)

    // Update attendance status for one player (pre-finalization only).
    // allianceId, historyId, docId (sanitized), status, markedBy
    // Returns: Promise<{ ok, error? }>
    updateAttendanceStatus(allianceId, historyId, docId, status, markedBy)

    // Mark event as finalized + write all player_stats in ONE atomic batch.
    // allianceId, historyId, playerStatsUpdates: Array<{ docId, stats }>
    // Returns: Promise<{ ok, error? }>
    finalizeHistory(allianceId, historyId, playerStatsUpdates)

    // Load player_stats for a list of sanitized doc IDs.
    // allianceId: string, playerDocIds: Array<string>
    // Returns: Promise<{ [docId]: player_stats }>
    loadPlayerStats(allianceId, playerDocIds)

    // Upsert player_stats (used outside of finalization for incremental updates).
    // allianceId: string, docId: string, stats: object
    // Returns: Promise<{ ok, error? }>
    upsertPlayerStats(allianceId, docId, stats)

    // Set up real-time listener for pending finalization count.
    // allianceId: string, callback: (count: number) => void
    // Returns: unsubscribe function (synchronous)
    subscribePendingFinalizationCount(allianceId, callback)
}
```

### 3.5 Existing Files to Modify

#### `js/core/firestore-utils.js` (NEW — create this first)
See Section 3.4 above.

#### `js/shared/data/data-gateway-contract.js`
Add `eventHistory` domain to `DATA_GATEWAY_METHODS`:
```js
eventHistory: [
    'saveHistoryRecord', 'saveAttendanceBatch', 'loadHistoryRecords',
    'loadAttendance', 'updateAttendanceStatus', 'finalizeHistory',
    'loadPlayerStats', 'upsertPlayerStats', 'subscribePendingFinalizationCount'
],
```

#### `js/services/firebase-service.js`
Wire the event history gateway into the flat `FirebaseService` object (see Section 1.3 for the full pattern):

1. Add `fallbackEventHistoryGateway(gatewayUtils)` function returning all methods with sensible fallbacks
2. Add `const eventHistoryGateway = fromFactory('DSSharedFirebaseEventHistoryGateway', fallbackEventHistoryGateway);`
3. Spread all event history methods into the `FirebaseService` object

**Grep anchor**: Search for `const notificationsGateway = fromFactory(` to find where to add the new `fromFactory` line.

#### `index.html`
1. Add `<script defer>` tags for new files **in this exact dependency order** after all existing tags:
   ```html
   <script defer src="js/core/firestore-utils.js"></script>
   <script defer src="js/core/reliability.js"></script>
   <script defer src="js/shared/data/firebase-event-history-gateway.js"></script>
   <script defer src="js/features/event-history/event-history-core.js"></script>
   <script defer src="js/features/event-history/event-history-actions.js"></script>
   <script defer src="js/features/event-history/event-history-view.js"></script>
   <script defer src="js/features/event-history/event-history-controller.js"></script>
   ```

2. Add nav menu item after `navAllianceBtn`:
   ```html
   <button id="navEventHistoryBtn" class="header-menu-item" role="menuitem">
       <span data-i18n="event_history_nav">Event History</span>
       <span id="eventHistoryPendingBadge" class="nav-badge hidden" aria-label="Pending finalization">0</span>
   </button>
   ```

3. Add Event History view section (after existing view sections):
   ```html
   <section id="eventHistoryView" class="view-section hidden" aria-labelledby="eventHistoryHeading">
       <div id="eventHistoryContainer"></div>
   </section>
   ```

4. Add attendance check-in modal:
   ```html
   <div id="attendancePanelModal" class="modal-overlay hidden" role="dialog" aria-modal="true" aria-labelledby="attendancePanelTitle">
       <div class="modal-card">
           <h2 id="attendancePanelTitle" data-i18n="attendance_panel_title">Mark Attendance</h2>
           <div id="attendancePanelBody"></div>
           <div class="modal-actions">
               <button id="attendanceFinalizeBtn" class="primary" data-i18n="attendance_finalize_btn">Finalize Attendance</button>
               <button id="attendanceCancelBtn" class="secondary" data-i18n="cancel_button">Cancel</button>
           </div>
       </div>
   </div>
   ```

#### `translations.js`
Add all i18n keys listed in Section 3.6 to ALL language blocks.

#### `styles.css`
Add CSS described in Section 3.7.

#### `app.js`
Wire event history controller. **Grep anchor**: Search for `// BEGIN FEATURE WIRING` (add this comment if missing, place it just before the first `setAllianceDataCallback` or `setDataLoadCallback` call in the alliance-loaded section).

Add after that anchor:
```js
// Event History feature wiring
var eventHistoryController = DSFeatureEventHistoryController.init(FirebaseService);
FirebaseService.subscribePendingFinalizationCount(allianceId, function(count) {
    DSFeatureEventHistoryView.renderPendingBadge(
        document.getElementById('eventHistoryPendingBadge'), count
    );
});
```

Also wire:
- `navEventHistoryBtn` click → `eventHistoryController.showEventHistoryView()`
- Generator "Save as History" button click → `eventHistoryController.saveAssignmentAsHistory(currentAssignment)`

**Grep anchor for generator section**: Search for `// Generator output` or `assignmentOutput` to find where to add the "Save as History" button and its click handler.

### 3.6 i18n Keys

Add to ALL languages (EN values shown; translate others by meaning):

```js
event_history_nav: 'Event History',
event_history_title: 'Event History',
event_history_empty: 'No events recorded yet.',
event_history_save_btn: 'Save as History',
event_history_filter_all: 'All Events',
event_history_filter_completed: 'Completed',
event_history_filter_planned: 'Planned',
event_history_status_planned: 'Planned',
event_history_status_completed: 'Completed',
event_history_status_cancelled: 'Cancelled',

attendance_panel_title: 'Mark Attendance',
attendance_finalize_btn: 'Finalize Attendance',
attendance_finalize_confirm: 'This will lock the attendance record. Continue?',
attendance_status_attended: 'Attended',
attendance_status_no_show: 'No Show',
attendance_status_excused: 'Excused',
attendance_status_late_sub: 'Late Sub',
attendance_status_cancelled: 'Event Cancelled',
attendance_pending_badge: '{count} events pending review',
attendance_staleness_warning: 'This event was completed {days} days ago and attendance has not been finalized.',
attendance_bulk_cancel_btn: 'Mark All as Cancelled',

reliability_dot_tooltip: 'Reliability: {score}% ({label})',
reliability_dot_tooltip_new: 'No history yet',
reliability_tier_excellent: 'Rock solid',
reliability_tier_good: 'Reliable',
reliability_tier_fair: 'Inconsistent',
reliability_tier_poor: 'Unreliable',
reliability_tier_critical: 'Chronic no-show',
reliability_tier_new: 'No history',

player_detail_reliability_section: 'Reliability',
player_detail_recent_events: 'Recent Events',
player_detail_streak: 'Current Streak',
player_detail_no_show_streak: 'Longest No-Show Streak',
```

### 3.7 CSS Changes

Add to `styles.css`:

```css
/* Reliability dots */
.reliability-dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
    cursor: help;
    /* Accessible: size is above 4.5px minimum for decorative indicators */
}
.reliability-excellent { background-color: #2e7d32; }
.reliability-good      { background-color: #1565c0; }
.reliability-fair      { background-color: #ef6c00; }
.reliability-poor      { background-color: #c62828; }
.reliability-critical  { background-color: #b71c1c; }
.reliability-new       { background-color: #757575; }

/* Nav badge */
.nav-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    border-radius: 9px;
    background: var(--color-danger, #c62828);
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    padding: 0 4px;
    margin-left: 4px;
}
.nav-badge.hidden { display: none; }

/* Event history list */
.event-history-list { list-style: none; padding: 0; margin: 0; }
.event-history-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 0;
    border-bottom: 1px solid var(--color-border);
}
.event-history-item-name { font-weight: 600; flex: 1; }
.event-history-item-date { font-size: 12px; color: var(--color-text-muted); }
.event-history-item-status {
    font-size: 12px;
    padding: 2px 8px;
    border-radius: 12px;
}
.event-history-status-completed { background: #e8f5e9; color: #2e7d32; }
.event-history-status-planned    { background: #e3f2fd; color: #1565c0; }
.event-history-status-cancelled  { background: #fafafa; color: #757575; }

/* Attendance panel */
.attendance-player-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 0;
    border-bottom: 1px solid var(--color-border);
}
.attendance-player-name { flex: 1; font-weight: 500; }
.attendance-radio-group { display: flex; gap: 8px; flex-wrap: wrap; }
.attendance-staleness-warning {
    padding: 10px 14px;
    background: #fff3e0;
    border-left: 3px solid #ef6c00;
    border-radius: 4px;
    font-size: 13px;
    margin-bottom: 12px;
}
```

### 3.8 Acceptance Criteria

- [ ] Leader can click "Save as History" after generating assignments — record saved to Firestore
- [ ] Leader can navigate to Event History view and see list of saved events
- [ ] Leader can open an event and mark attendance for each player (Attended / No Show / Excused / Late Sub / Event Cancelled)
- [ ] After finalizing attendance, the record is locked (no further edits)
- [ ] After finalization, `player_stats` are recalculated and saved atomically with the finalization in a single Firestore batch
- [ ] Player list shows colored reliability dot next to each player name
- [ ] Reliability dot has `aria-label` and `title` for accessibility
- [ ] Tooltip on dot shows score + tier label
- [ ] Nav shows badge count for events pending finalization
- [ ] Staleness warning shown if event completed > 7 days ago and not finalized
- [ ] New players (< 3 valid events) show grey dot
- [ ] Player names with special characters (`.`, `/`, `#`) do not break Firestore doc ID

### 3.9 Test Plan

#### Unit Tests — `tests/reliability.core.test.js`

Test `DSCoreReliability.calculateReliabilityScore`:
- Empty history `[]` → `null`
- 2 non-cancelled entries → `null` (below < 3 threshold)
- Exactly 3 attended entries → not null, score close to 100
- Mix: `[attended, no_show, attended]` (3 entries) → score between 0 and 100
- All 5 no_show → score = 0
- All 5 excused → `null` (all entries excluded from totalWeight, validCount is 5 but totalWeight is 0 → null)
- Mix of cancelled_event + attended: `[cancelled_event, cancelled_event, attended, attended]` → `null` (only 2 non-cancelled = < 3)
- late_sub gets 0.8 weight: `[late_sub, late_sub, late_sub]` → score = 80 (not 100)
- Recency weighting: `[no_show, attended, attended, attended, attended]` vs `[attended, attended, attended, attended, no_show]` → first scores lower (recent no_show hurts more)
- **Golden snapshot**: `calculateReliabilityScore([{status:'attended'},{status:'attended'},{status:'no_show'},{status:'attended'},{status:'attended'}])` → assert result equals exact expected value (compute manually: weights 1, 0.85, 0.7225, 0.6141, 0.5220 → attendedWeight = 1+0.85+0.6141+0.5220 = 2.9861, totalWeight = 2.9861+0.7225 = 3.7086 → score = round(2.9861/3.7086*100) = 80)

Test `DSCoreReliability.getReliabilityTier`:
- score=100 → tier=excellent
- score=90 → tier=excellent
- score=89 → tier=good
- score=70 → tier=good
- score=69 → tier=fair
- score=50 → tier=fair
- score=49 → tier=poor
- score=30 → tier=poor
- score=29 → tier=critical
- score=0 → tier=critical
- score=null → tier=new

Test `DSCoreReliability.recalculatePlayerStats`:
- 5 attended → `{ attended: 5, noShows: 0, currentStreak: 5, longestNoShowStreak: 0 }`
- Streak breaks on no_show: `[attended, attended, no_show, attended]` → `{ currentStreak: 1, longestNoShowStreak: 1 }`
- All excused → `{ excused: N, attended: 0, noShows: 0, currentStreak: 0 }`
- Mix of cancelled_event + real: cancelled_event entries do NOT increment totalEvents
- `recentHistory` truncated to last 10 entries (newest first)
- `longestNoShowStreak`: `[attended, no_show, no_show, no_show, attended]` → longestNoShowStreak = 3
- `lastEventDate` set to most recent non-cancelled entry's `scheduledAt`

#### Unit Tests — `tests/event-history.core.test.js`

Test `DSFeatureEventHistoryCore.buildHistoryRecord`:
- Returns document with `status = 'planned'`, `finalized = false`
- `createdBy` matches passed uid

Test `DSFeatureEventHistoryCore.buildAttendanceDocs`:
- Returns array with one entry per player (across both teams)
- Each entry has `docId` (sanitized) and `playerName` (raw)
- Default status is `"confirmed"`
- Player in teamA has `team = 'teamA'`
- Player name with `.` in it: raw name preserved in `playerName` field, docId sanitized

Test `DSFeatureEventHistoryCore.validateStatusTransition`:

Complete transition matrix:
| from | to | valid |
|------|-----|-------|
| confirmed | attended | YES |
| confirmed | no_show | YES |
| confirmed | late_sub | YES |
| confirmed | excused | YES |
| confirmed | cancelled_event | YES |
| attended | attended | NO |
| attended | no_show | NO |
| attended | confirmed | NO |
| no_show | attended | NO |
| no_show | excused | NO |
| late_sub | attended | NO |
| excused | attended | NO |
| cancelled_event | attended | NO |
| '' | attended | NO (invalid starting state) |

Test `DSFeatureEventHistoryCore.checkFinalizationStaleness`:
- completedAt 8 days ago, finalized=false → `{ stale: true, daysSinceCompleted: 8 }`
- completedAt 3 days ago, finalized=false → `{ stale: false, daysSinceCompleted: 3 }`
- finalized=true, completedAt 30 days ago → `{ stale: false }`
- completedAt=null → `{ stale: false, daysSinceCompleted: 0 }`

#### Unit Tests — `tests/firestore-utils.core.test.js`

Test `DSFirestoreUtils.sanitizeDocId`:
- `'PlayerName'` → `'PlayerName'` (unchanged)
- `'Player.Name'` → `'Player_Name'`
- `'Player/Name'` → `'Player_Name'`
- `'Player#Name'` → `'Player_Name'`
- `'Player[Name]'` → `'Player_Name_'`
- `''` → `'_empty_'`
- String of 2000 chars → truncated to 1500

#### Integration Tests — `tests/event-history.integration.test.js`

- Mock gateway, test `controller.init → subscribePendingFinalizationCount` callback called
- Verify pending count badge updates when gateway returns count > 0

#### Firestore Rules Tests — `tests/firestore-rules/event-history.rules.test.js`

- Alliance member can read `event_history`
- Alliance member can create `event_history` with matching `createdBy`
- Alliance member can write `attendance`
- Non-alliance authenticated user cannot read `event_history`
- Unauthenticated user cannot read `event_history`
- Alliance member can read/write `player_stats`

#### E2E Tests (Playwright) — `tests/e2e/event-history.spec.js`

- **Full attendance flow**: Sign in → Generate assignment → Click "Save as History" → Navigate to Event History → Open event → Mark all players as Attended → Click "Finalize Attendance" → Confirm dialog → Verify event shows as finalized (no edit controls)
- **Reliability dot**: After finalization, navigate to Players Management → Verify colored dots appear next to player names
- **Finalized event is locked**: Open a finalized event → Verify radio buttons are disabled

#### Regression Strategy

Before merging Phase 1A: run `npm test` (full unit + integration suite). All pre-existing tests must pass. Add a regression smoke test `tests/phase1a.regression.test.js` that imports and spot-checks the new modules.

---

## 4. Phase 1B: Player Self-Update MVP

### 4.1 Overview

**Goal**: Allow players to update their own data (Power, THP, Troop Type) via a one-time magic link. Leaders review and approve changes.

**Effort**: 2–3 weeks
**Dependencies**: None
**Parallel with**: Phase 1A (zero code overlap)

### 4.2 Firestore Data Model

```
alliances/{allianceId}/update_tokens/{tokenId}
  Fields:
    token: string              // 32-char lowercase hex (128-bit random)
    allianceId: string
    playerName: string         // raw player name
    gameId: string
    createdBy: string          // uid of leader
    createdAt: Timestamp
    expiresAt: Timestamp       // createdAt + 48h default
    used: boolean              // false initially
    usedAt: Timestamp | null
    usedByAnonUid: string | null
    currentSnapshot: {         // values at time of token creation
        power: number,
        thp: number,
        troops: string
    }
    linkedEventId: string | null  // optional: linked event for context

alliances/{allianceId}/pending_updates/{updateId}
  Fields:
    tokenId: string
    playerName: string         // raw player name
    gameId: string
    submittedAt: Timestamp
    submittedByAnonUid: string
    previousValues: { power: number, thp: number, troops: string }
    proposedValues: { power: number, thp: number, troops: string }
    status: string             // "pending" | "approved" | "rejected"
    reviewedBy: string | null  // uid
    reviewedAt: Timestamp | null
    linkedEventId: string | null
```

### 4.3 Firestore Security Rules

```javascript
// Helper: is request from an anonymous user?
function isAnonymous() {
    return request.auth != null
           && request.auth.token.firebase.sign_in_provider == 'anonymous';
}

match /alliances/{allianceId}/update_tokens/{tokenId} {
    // Leaders can create tokens
    allow create: if isAllianceMember(allianceId);

    // Leaders can read all tokens; anonymous users can read unexpired unused tokens
    allow read: if isAllianceMember(allianceId)
                || (isAnonymous()
                    && resource.data.used == false
                    && resource.data.expiresAt > request.time);

    // Leaders can update any field; anonymous users can ONLY mark as used
    // (restrict to exactly the three fields that change on token use)
    allow update: if isAllianceMember(allianceId)
                  || (isAnonymous()
                      && resource.data.used == false
                      && request.resource.data.used == true
                      && request.resource.data.diff(resource.data)
                             .affectedKeys()
                             .hasOnly(['used', 'usedAt', 'usedByAnonUid']));

    allow delete: if isAllianceMember(allianceId);
}

match /alliances/{allianceId}/pending_updates/{updateId} {
    // Anonymous users can submit updates; validated by field-level rules
    allow create: if isAnonymous()
                  && request.resource.data.proposedValues.power is number
                  && request.resource.data.proposedValues.power >= 0
                  && request.resource.data.proposedValues.power <= 9999
                  && request.resource.data.proposedValues.thp is number
                  && request.resource.data.proposedValues.thp >= 0
                  && request.resource.data.proposedValues.thp <= 99999
                  && request.resource.data.proposedValues.troops in ['Tank', 'Aero', 'Missile'];
    // Leaders can read and update (approve/reject)
    allow read, update: if isAllianceMember(allianceId);
}
```

### 4.4 New Files to Create

#### `player-update.html`
- **Purpose**: Standalone page served to players — loads minimal Firebase + one JS file
- **No auth required to open**: Anonymous auth performed in JS on load

**Full CSP for `player-update.html`**:
```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' https://www.gstatic.com https://apis.google.com;
  style-src 'self' 'unsafe-inline';
  connect-src 'self'
    https://firestore.googleapis.com
    https://identitytoolkit.googleapis.com
    https://securetoken.googleapis.com
    https://www.googleapis.com
    https://*.googleapis.com;
  img-src 'self' data:;
  font-src 'self' data:;
  base-uri 'none';
  form-action 'self';
  frame-src 'none';
```

Note: `frame-src 'none'` differs from `index.html` (no Google sign-in popup needed — anonymous auth uses API calls only).

**Deploy verification**: `player-update.html` must be listed in `.github/workflows/deploy.yml` as a file to copy to the GitHub Pages output directory alongside `index.html`. Verify the deploy workflow copies it explicitly or uses a wildcard that includes root `.html` files.

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' https://www.gstatic.com https://apis.google.com; style-src 'self' 'unsafe-inline'; connect-src 'self' https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com https://*.googleapis.com; img-src 'self' data:; font-src 'self' data:; base-uri 'none'; form-action 'self'; frame-src 'none';">
    <link rel="stylesheet" href="player-update.css">
    <title>Update Your Stats</title>
</head>
<body>
    <div id="playerUpdateRoot" class="update-card-root">
        <div id="updateLoading" class="update-state-loading">
            <span data-i18n="player_update_loading">Loading...</span>
        </div>
        <div id="updateForm" class="update-state-form hidden">
            <h1 data-i18n="player_update_title">Update Your Stats</h1>
            <p id="updatePlayerName" class="update-player-name"></p>
            <form id="updateStatsForm" novalidate>
                <label for="updatePower" data-i18n="player_update_power_label">Total Power (M)</label>
                <input type="number" id="updatePower" min="0" max="9999" step="0.01" required>
                <label for="updateThp" data-i18n="player_update_thp_label">Total Hero Power</label>
                <input type="number" id="updateThp" min="0" max="99999" required>
                <label for="updateTroops" data-i18n="player_update_troops_label">Primary Troop Type</label>
                <select id="updateTroops" required>
                    <option value="Tank">Tank</option>
                    <option value="Aero">Aero</option>
                    <option value="Missile">Missile</option>
                </select>
                <button type="submit" data-i18n="player_update_submit_btn">Submit Update</button>
            </form>
        </div>
        <div id="updateSuccess" class="update-state-success hidden">
            <p data-i18n="player_update_success">Your stats have been submitted for review. Thank you!</p>
        </div>
        <div id="updateError" class="update-state-error hidden">
            <p id="updateErrorMessage"></p>
        </div>
    </div>
    <script defer src="vendor/firebase-app-compat.js"></script>
    <script defer src="vendor/firebase-auth-compat.js"></script>
    <script defer src="vendor/firebase-firestore-compat.js"></script>
    <script defer src="firebase-config.js"></script>
    <script defer src="translations.js"></script>
    <script defer src="js/core/i18n.js"></script>
    <script defer src="js/player-update/player-update.js"></script>
</body>
</html>
```

#### `player-update.css`
- **Purpose**: Minimal standalone styles for the update page
- Mobile-first, dark theme matching main app

```css
/* Key classes */
.update-card-root {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    background: var(--color-bg-dark, #121212);
}
.update-card {
    background: var(--color-surface, #1e1e1e);
    border-radius: 12px;
    padding: 24px;
    width: 100%;
    max-width: 420px;
}
.update-state-loading { /* spinner centered */ }
.update-state-form { /* form layout */ }
.update-state-success { /* success checkmark + message */ }
.update-state-error { /* error message with icon */ }
/* All states use .hidden to toggle visibility */
.hidden { display: none !important; }
```

#### `js/player-update/player-update.js`
- **IIFE export**: `window.DSPlayerUpdate`
- **Purpose**: Self-contained script for player-update.html

```js
// Entry point — reads URL params, performs anon auth, loads token, shows form.
// Called automatically on DOMContentLoaded.
init()

// Error codes:
// TOKEN_EXPIRED → i18n key player_update_error_expired
// TOKEN_USED    → i18n key player_update_error_used
// TOKEN_INVALID → i18n key player_update_error_invalid
// NETWORK_ERROR → i18n key player_update_error_network
```

**Behavior steps**:
1. Parse `?token=<hex>&aid=<allianceId>&lang=<lang>` from `window.location.search`
2. Set i18n language from `lang` param (call `DSI18N.setLanguage`)
3. Show loading state
4. Sign in anonymously via `firebase.auth().signInAnonymously()`
5. Query `alliances/{aid}/update_tokens` where `token == <hex>` (use `.where('token', '==', hex).limit(1)`)
6. If no results → show TOKEN_INVALID
7. If `used == true` → show TOKEN_USED
8. If `expiresAt < now` → show TOKEN_EXPIRED
9. Pre-fill form with `currentSnapshot` values; show `playerName` in header
10. On submit: client-validate, write `pending_updates` doc with `submittedByAnonUid = auth.currentUser.uid`, then update token with `{ used: true, usedAt: Timestamp.now(), usedByAnonUid: uid }`
11. Show success state

#### `js/features/player-updates/player-updates-core.js`
- **IIFE export**: `window.DSFeaturePlayerUpdatesCore`
- **Public API**:

```js
// Generate a secure 32-char lowercase hex token using crypto.getRandomValues.
// Returns: string
generateToken()

// Build a token document for Firestore (no id field).
// playerName: string (raw), allianceId: string, gameId: string,
// createdByUid: string, options: { expiryHours?: number, linkedEventId?: string, currentSnapshot: object }
// Returns: token document
buildTokenDoc(playerName, allianceId, gameId, createdByUid, options)

// Build a shareable update link for a token.
// token: string, allianceId: string, lang: string
// Returns: string URL — format: <window.location.origin>/player-update.html?token=<hex>&aid=<allianceId>&lang=<lang>
// URL-encode all params via encodeURIComponent.
buildUpdateLink(token, allianceId, lang)

// Format links for Discord/WhatsApp bulk copy.
// players: Array<{ playerName: string, link: string }>
// Returns: formatted multiline string, one player per line: "PlayerName: <link>"
formatLinksForMessaging(players)

// Validate proposed values against allowed ranges.
// proposed: { power: any, thp: any, troops: any }
// Returns: { valid: boolean, errors: Array<string> }
// Rules: power in [0, 9999], thp in [0, 99999], troops in ['Tank','Aero','Missile']
validateProposedValues(proposed)

// Calculate deltas between old and new values.
// old: { power, thp, troops }, proposed: { power, thp, troops }
// flagged = true if abs(delta/old) > 0.20 (20% change threshold)
// Returns: {
//   power: { old: number, new: number, delta: number, flagged: boolean },
//   thp:   { old: number, new: number, delta: number, flagged: boolean },
//   troops: { changed: boolean, old: string, new: string }
// }
calculateDeltas(old, proposed)
```

#### `js/features/player-updates/player-updates-actions.js`
- **IIFE export**: `window.DSFeaturePlayerUpdatesActions`
- **Public API**:

```js
// Read selected player names from player management table checkboxes.
// Returns: Array<string> (raw player names)
readSelectedPlayerNames()

// Read token generation options from modal form.
// Returns: { expiryHours: number, linkedEventId: string | null }
readTokenGenerationOptions()

// Read review decision from review panel.
// updateId: string
// Returns: { updateId: string, decision: 'approved' | 'rejected' }
readReviewDecision(updateId)
```

#### `js/features/player-updates/player-updates-view.js`
- **IIFE export**: `window.DSFeaturePlayerUpdatesView`
- **Public API**:

```js
// Render token generation modal with links.
// container: HTMLElement, tokens: Array<{ playerName, link }>
renderTokenModal(container, tokens)

// Render pending updates review panel.
// container: HTMLElement, updates: Array<pending_update docs with deltas>
renderReviewPanel(container, updates)

// Render side-by-side comparison row for one pending update.
// update: pending_update doc with deltas pre-calculated by DSFeaturePlayerUpdatesCore.calculateDeltas
// Returns: HTMLElement
renderComparisonRow(update)

// Render pending updates badge on nav.
// container: HTMLElement, count: number
renderPendingBadge(container, count)

// Render data freshness dot for a player.
// lastUpdated: Date | null, now: Date
// Returns: HTMLElement with aria-label
renderFreshnessDot(lastUpdated, now)
```

#### `js/features/player-updates/player-updates-controller.js`
- **IIFE export**: `window.DSFeaturePlayerUpdatesController`
- **Public API**:

```js
// Initialize the feature.
// gateway: FirebaseService (the unified flat gateway)
// Returns: { destroy() }
init(gateway)

// Open token generation modal for selected players.
// playerNames: Array<string>
openTokenGenerationModal(playerNames)

// Approve a pending update (applies to player record + marks approved).
// updateId: string
// Returns: Promise<{ ok, error? }>
approveUpdate(updateId)

// Reject a pending update.
// updateId: string
// Returns: Promise<{ ok, error? }>
rejectUpdate(updateId)

// Revoke a token (marks it used/invalid so it cannot be submitted).
// tokenId: string
// Returns: Promise<{ ok, error? }>
revokeToken(tokenId)

// Configure auto-approve thresholds (stored in alliance settings).
// thresholds: { powerMaxDeltaPct: number, thpMaxDeltaPct: number, troopChangesAllowed: boolean }
setAutoApproveThresholds(thresholds)
```

#### `js/shared/data/firebase-player-updates-gateway.js`
- **IIFE export**: `window.DSSharedFirebasePlayerUpdatesGateway`
- **Public API**:

```js
createGateway(utils) → {
    // Save multiple tokens in a batch.
    // allianceId: string, tokenDocs: Array<{ playerName, doc }>
    // Returns: Promise<{ ok, tokenIds: Array<string>, error? }>
    saveTokenBatch(allianceId, tokenDocs)

    // Load pending updates for review.
    // allianceId: string, status: 'pending' | 'all'
    // Returns: Promise<Array<pending_update docs>>
    loadPendingUpdates(allianceId, status)

    // Update pending update status (approve/reject).
    // allianceId, updateId, decision: { status, reviewedBy, reviewedAt }
    // Returns: Promise<{ ok, error? }>
    updatePendingUpdateStatus(allianceId, updateId, decision)

    // Revoke a token.
    // allianceId, tokenId
    // Returns: Promise<{ ok, error? }>
    revokeToken(allianceId, tokenId)

    // Load active tokens for an alliance.
    // allianceId: string
    // Returns: Promise<Array<token docs>>
    loadActiveTokens(allianceId)

    // Subscribe to pending updates count.
    // allianceId: string, callback: (count: number) => void
    // Returns: unsubscribe function
    subscribePendingUpdatesCount(allianceId, callback)
}
```

### 4.5 Existing Files to Modify

#### `js/shared/data/data-gateway-contract.js`
Add `playerUpdates` domain:
```js
playerUpdates: [
    'saveTokenBatch', 'loadPendingUpdates', 'updatePendingUpdateStatus',
    'revokeToken', 'loadActiveTokens', 'subscribePendingUpdatesCount'
],
```

#### `js/services/firebase-service.js`
Wire the player updates gateway into `FirebaseService` (same pattern as Section 1.3):

1. Add `fallbackPlayerUpdatesGateway(gatewayUtils)` function
2. Add `const playerUpdatesGateway = fromFactory('DSSharedFirebasePlayerUpdatesGateway', fallbackPlayerUpdatesGateway);`
3. Spread all player updates methods into `FirebaseService`

**Grep anchor**: Search for `const notificationsGateway = fromFactory(` — add the new line after it.

#### `index.html`
1. Add `<script defer>` tags in **this exact order** (gateway BEFORE controller):
   ```html
   <script defer src="js/shared/data/firebase-player-updates-gateway.js"></script>
   <script defer src="js/features/player-updates/player-updates-core.js"></script>
   <script defer src="js/features/player-updates/player-updates-actions.js"></script>
   <script defer src="js/features/player-updates/player-updates-view.js"></script>
   <script defer src="js/features/player-updates/player-updates-controller.js"></script>
   ```

2. Add "Request Updates" button in player management toolbar (find the toolbar by searching for `playersMgmtToolbar` or similar existing ID):
   ```html
   <button id="playersMgmtRequestUpdatesBtn" class="secondary" data-i18n="request_updates_btn">Request Updates</button>
   ```

3. Add pending updates badge in nav (after `navAllianceBtn`):
   ```html
   <button id="navPlayerUpdatesBtn" class="header-menu-item" role="menuitem">
       <span data-i18n="player_updates_review_nav">Pending Updates</span>
       <span id="playerUpdatesPendingBadge" class="nav-badge hidden" aria-label="Pending updates">0</span>
   </button>
   ```

4. Add review panel section:
   ```html
   <section id="playerUpdatesReviewView" class="view-section hidden" aria-labelledby="playerUpdatesReviewHeading">
       <div id="playerUpdatesReviewContainer"></div>
   </section>
   ```

5. Add token generation modal:
   ```html
   <div id="tokenGenerationModal" class="modal-overlay hidden" role="dialog" aria-modal="true" aria-labelledby="tokenModalTitle">
       <div class="modal-card">
           <h2 id="tokenModalTitle" data-i18n="token_modal_title">Generate Update Links</h2>
           <div id="tokenModalBody"></div>
           <div class="modal-actions">
               <button id="tokenCopyAllBtn" class="secondary" data-i18n="token_copy_all_btn">Copy All Links</button>
               <button id="tokenModalCloseBtn" class="primary" data-i18n="close_button">Close</button>
           </div>
       </div>
   </div>
   ```

#### `translations.js`
Add all i18n keys from Section 4.6.

#### `styles.css`
Add CSS from Section 4.7.

#### `app.js`
**Grep anchor**: Search for `// BEGIN FEATURE WIRING` (same anchor as Phase 1A):

```js
// Player Updates feature wiring
var playerUpdatesController = DSFeaturePlayerUpdatesController.init(FirebaseService);
FirebaseService.subscribePendingUpdatesCount(allianceId, function(count) {
    DSFeaturePlayerUpdatesView.renderPendingBadge(
        document.getElementById('playerUpdatesPendingBadge'), count
    );
});
```

Also wire:
- `playersMgmtRequestUpdatesBtn` click → read selected names → `playerUpdatesController.openTokenGenerationModal(names)`
- `navPlayerUpdatesBtn` click → show `playerUpdatesReviewView`

**Grep anchor for players management section**: Search for `playersMgmt` to find where the players management buttons are wired.

### 4.6 i18n Keys

```js
// Player update standalone page
player_update_page_title: 'Update Your Stats',
player_update_loading: 'Loading...',
player_update_title: 'Update Your Stats',
player_update_power_label: 'Total Power (M)',
player_update_thp_label: 'Total Hero Power',
player_update_troops_label: 'Primary Troop Type',
player_update_submit_btn: 'Submit Update',
player_update_success: 'Your stats have been submitted for review. Thank you!',
player_update_error_expired: 'This link has expired. Please ask your leader for a new link.',
player_update_error_used: 'This link has already been used.',
player_update_error_invalid: 'This link is not valid.',
player_update_error_network: 'Network error. Please check your connection and try again.',

// Leader UI — token generation
token_modal_title: 'Generate Update Links',
token_modal_expiry_label: 'Link Expiry',
token_modal_expiry_24h: '24 hours',
token_modal_expiry_48h: '48 hours (default)',
token_modal_expiry_72h: '72 hours',
token_copy_all_btn: 'Copy All Links',
token_copy_success: 'Links copied to clipboard!',
request_updates_btn: 'Request Updates',
request_updates_select_players: 'Select players to request updates from.',
player_updates_review_nav: 'Pending Updates',

// Review panel
player_updates_review_title: 'Pending Player Updates',
player_updates_review_empty: 'No pending updates.',
player_updates_approve_btn: 'Approve',
player_updates_reject_btn: 'Reject',
player_updates_pending_badge: '{count} pending updates',
player_updates_delta_warning: 'Large change detected',
player_updates_old_value: 'Current',
player_updates_new_value: 'Proposed',

// Freshness dots
freshness_dot_fresh: 'Updated recently',
freshness_dot_stale: 'Not updated in over 30 days',
freshness_dot_very_stale: 'Not updated in over 90 days',
freshness_dot_never: 'Never updated via self-update',
```

### 4.7 CSS Changes

```css
/* Freshness dots */
.freshness-dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
    cursor: help;
}
.freshness-fresh       { background-color: #2e7d32; }
.freshness-stale       { background-color: #ef6c00; }
.freshness-very-stale  { background-color: #c62828; }
.freshness-never       { background-color: #757575; }

/* Review panel */
.review-panel { padding: 16px; }
.review-comparison-row {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr auto;
    gap: 8px;
    align-items: center;
    padding: 10px 0;
    border-bottom: 1px solid var(--color-border);
}
.review-player-name { font-weight: 600; }
.review-delta-warning { color: #ef6c00; font-size: 12px; }
.review-actions { display: flex; gap: 8px; }

/* Token generation modal */
.token-link-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 0;
    border-bottom: 1px solid var(--color-border);
    font-size: 13px;
}
.token-link-url {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: monospace;
    font-size: 12px;
    color: var(--color-text-muted);
}
```

### 4.8 Acceptance Criteria

- [ ] Leader can select players in Players Management and click "Request Updates"
- [ ] Token generation modal opens with one link per selected player
- [ ] "Copy All Links" copies Discord/WhatsApp-formatted text to clipboard
- [ ] Player opens link, sees pre-filled form with their current stats
- [ ] Player submits form → appears in leader's review panel
- [ ] Link shows TOKEN_EXPIRED error after expiry time
- [ ] Link shows TOKEN_USED error if submitted once already
- [ ] Leader can approve or reject each pending update
- [ ] Approving applies update to player record in Firestore
- [ ] Nav shows badge count for pending updates
- [ ] Absurd values (power = 99999) rejected by client-side validation AND Firestore rules
- [ ] Anonymous users cannot modify token fields other than `used`, `usedAt`, `usedByAnonUid`
- [ ] player-update.html loads correctly when deployed to GitHub Pages

### 4.9 Test Plan

#### Unit Tests — `tests/player-updates.core.test.js`

Test `DSFeaturePlayerUpdatesCore.generateToken`:
- Returns string of length 32
- Contains only hex chars `[0-9a-f]`
- Two consecutive calls return different values

Test `DSFeaturePlayerUpdatesCore.buildUpdateLink`:
- Result URL contains `?token=` param
- Result URL contains `&aid=` param
- Result URL contains `&lang=` param
- Player name with special chars in the URL is properly encoded (no raw `#` etc)
- `buildUpdateLink('abc', 'alliance1', 'fr')` → URL ends in `?token=abc&aid=alliance1&lang=fr`

Test `DSFeaturePlayerUpdatesCore.validateProposedValues`:
- `{ power: -1, thp: 500, troops: 'Tank' }` → invalid
- `{ power: 9999, thp: 500, troops: 'Tank' }` → valid
- `{ power: 100, thp: 100000, troops: 'Tank' }` → invalid
- `{ power: 100, thp: 99999, troops: 'Tank' }` → valid
- `{ power: 100, thp: 500, troops: 'Cavalry' }` → invalid
- `{ power: 100, thp: 500, troops: 'Missile' }` → valid
- `{ power: 'abc', thp: 500, troops: 'Tank' }` → invalid (non-numeric)

Test `DSFeaturePlayerUpdatesCore.calculateDeltas`:
- power 100→120: delta=20, flagged=true (20% change exactly at boundary)
- power 100→119: delta=19, flagged=false (below 20%)
- power 100→121: delta=21, flagged=true (above 20%)
- power 0→100: flagged=true (division by zero guard: treat 0 old value as flagged)
- troops Tank→Aero: `{ changed: true, old: 'Tank', new: 'Aero' }`
- troops Tank→Tank: `{ changed: false }`

Test `DSFeaturePlayerUpdatesCore.formatLinksForMessaging`:
- Returns string containing all player names
- Returns string containing all links
- Each player on its own line

#### Integration Tests — `tests/player-updates.integration.test.js`

- Mock gateway, test `controller.openTokenGenerationModal` calls `gateway.saveTokenBatch` with correct count
- Test `approveUpdate` calls `gateway.updatePendingUpdateStatus` with `status: 'approved'` and applies player record update via players gateway

#### Race Condition Integration Test — `tests/player-updates.race.integration.test.js`

- Simulate two concurrent anonymous writes with same token
- Firestore rule `resource.data.used == false` in the update rule ensures second write is rejected
- Test: mock gateway where first update succeeds, second fails with `PERMISSION_DENIED` — verify controller handles error gracefully and shows appropriate message

#### Firestore Rules Tests — `tests/firestore-rules/player-updates.rules.test.js`

- Alliance member can create `update_tokens`
- Anonymous user can read unexpired, unused token
- Anonymous user CANNOT read expired token
- Anonymous user CANNOT read already-used token
- Anonymous user can update token to mark as `used` (only `used`, `usedAt`, `usedByAnonUid` fields)
- Anonymous user CANNOT update other token fields (e.g., `playerName`)
- Anonymous user can create `pending_updates` with valid values
- Anonymous user CANNOT create `pending_updates` with `power > 9999`
- Anonymous user CANNOT create `pending_updates` with invalid `troops` value
- Alliance member can read and update `pending_updates`

#### E2E Tests (Playwright) — `tests/e2e/player-updates.spec.js`

- **Full flow**: Leader signs in → selects players → clicks "Request Updates" → modal opens → copy link → open link in new page → verify form pre-filled → submit → return to main app → verify pending badge appears → approve update → verify player record updated in UI

#### Cross-Browser/Mobile Checklist for `player-update.html`

- [ ] Chrome (Android)
- [ ] Safari (iOS)
- [ ] Firefox (desktop)
- [ ] Chrome (desktop)

Test on each: page loads, form submits, success/error states render correctly.

#### Regression Strategy

Before merging Phase 1B: run `npm test`. Add `tests/phase1b.regression.test.js` for smoke checks.

---

## 5. Phase 2: Integration

### 5.1 Overview

**Goal**: Connect Phase 1A and 1B features together and integrate reliability into assignments. Add auto-approve, data freshness, and reliability-weighted algorithm.

**Effort**: 3–4 weeks
**Dependencies**: Phase 1A AND Phase 1B must be complete
**Parallel with**: Nothing

### 5.2 New Files to Create

#### `js/core/reliability-algorithm.js`
- **IIFE export**: `window.DSCoreReliabilityAlgorithm`
- **Purpose**: Implements `reliability_aware_balanced` assignment algorithm
- **How execution is wired**: This module's `assignWithReliability` function is called from `js/core/generator-assignment.js` (or whichever file dispatches algorithm execution). Look for the function that calls `DSCoreAssignment.assignTeamToBuildings` — add a branch there:

```js
// In generator-assignment.js, find where assignTeamToBuildings is called.
// Grep for: DSCoreAssignment.assignTeamToBuildings
// Add before that call:
if (algorithmId === 'reliability_aware_balanced' && global.DSCoreReliabilityAlgorithm) {
    return global.DSCoreReliabilityAlgorithm.assignWithReliability(players, buildingConfig, constraints);
}
// Fall through to existing balanced_round_robin logic
```

- **Public API**:

```js
// Main entry point — extends the signature of assignTeamToBuildings.
// players: Array<player objects>, each may have reliabilityScore (number|null) and currentStreak (number)
// buildingConfig: Array<building config objects>
// constraints: reliability constraint object (see defaults below)
// Returns: { assignments: Array, warnings: Array<{ type, playerName, building, score, streak? }> }
assignWithReliability(players, buildingConfig, constraints)

// Validate a completed assignment set against reliability constraints.
// assignments: Array<assignment objects with player and building fields>
// playerStats: { [playerName]: player_stats } — for streak lookup
// constraints: object
// Returns: Array<warning objects>
// Warning types: 'low_score_at_anchor', 'no_show_streak'
validateAssignment(assignments, playerStats, constraints)
```

**Constraint defaults**:
```js
var DEFAULT_RELIABILITY_CONSTRAINTS = {
    enabled: false,
    mode: 'warn',           // 'warn' | 'enforce'
    anchorMinScore: 70,     // min score for priority-1 buildings
    benchThreshold: 30,     // below this, auto-suggest as substitute
    noShowStreakLimit: 3,    // warn if streak >= this value
};
```

**Algorithm behavior**:
- `warn` mode: call existing `DSCoreAssignment.assignTeamToBuildings`, then call `validateAssignment` on the result to generate warnings. Return `{ assignments, warnings }`.
- `enforce` mode: split players into eligible (score >= benchThreshold or score is null) and ineligible. Assign eligible players to priority-1 buildings first. Ineligible players go to lower-priority buildings or bench. Then validate for remaining warnings.

Also register `aggressive_fill` as an alias in the registry during this phase (see Section 5.3).

#### `js/features/generator/generator-warnings-view.js`
- **IIFE export**: `window.DSFeatureGeneratorWarningsView`
- **Public API**:

```js
// Render collapsible warnings panel below the assignment table.
// container: HTMLElement, warnings: Array<warning objects>
// If warnings is empty: render "no concerns" message
renderWarningsPanel(container, warnings)

// Render a single swap suggestion row.
// warning: { type, playerName, building, score, streak? }
// Returns: HTMLElement
renderWarningRow(warning)
```

### 5.3 Existing Files to Modify

#### `js/core/assignment-registry.js`
Add two new algorithm entries:
```js
reliability_aware_balanced: {
    id: 'reliability_aware_balanced',
    name: 'Reliability-Aware Balanced',
    description: 'Balances teams while flagging unreliable players at priority buildings.',
    enabled: true,
},
aggressive_fill: {
    id: 'aggressive_fill',
    name: 'Aggressive Fill',
    description: 'Fills highest-priority buildings with strongest players regardless of diversity.',
    enabled: true,
},
```

#### `js/core/games.js`
Add both algorithms to `last_war.assignmentAlgorithmIds`:
```js
assignmentAlgorithmIds: ['balanced_round_robin', 'reliability_aware_balanced', 'aggressive_fill'],
```

#### `js/core/generator-assignment.js`
Add dispatch branch for `reliability_aware_balanced` (see Section 5.2 above for the exact grep anchor and code pattern).

#### `index.html`
- Add in order:
  ```html
  <script defer src="js/core/reliability-algorithm.js"></script>
  <script defer src="js/features/generator/generator-warnings-view.js"></script>
  ```
- Add warnings panel container below assignment output area

#### `translations.js`
Add keys from Section 5.4.

#### `styles.css`
Add warnings panel CSS.

#### `app.js`
**Grep anchor**: `// BEGIN FEATURE WIRING`

- When generating with `reliability_aware_balanced`: load player_stats via `FirebaseService.loadPlayerStats(allianceId, playerNames)` before calling the algorithm
- After generation: call `DSFeatureGeneratorWarningsView.renderWarningsPanel` with the returned warnings
- Auto-approve logic: in the `subscribePendingUpdatesCount` callback area, after each new pending update arrives, call `playerUpdatesController.checkAutoApprove(updateId)` if auto-approve thresholds are configured

### 5.4 i18n Keys

```js
reliability_algorithm_name: 'Reliability-Aware Balanced',
reliability_warnings_panel_title: 'Reliability Warnings',
reliability_warnings_panel_empty: 'No reliability concerns for this assignment.',
reliability_warning_low_score: '{playerName} has a low reliability score ({score}%) assigned to {building}.',
reliability_warning_no_show_streak: '{playerName} has {streak} consecutive no-shows.',
reliability_warning_bench_suggestion: 'Consider moving {playerName} to bench (score: {score}%).',
auto_approve_threshold_label: 'Auto-approve if change is under',
auto_approve_toggle_label: 'Auto-approve updates',
event_linked_update_btn: 'Request Updates for This Event',
data_freshness_section: 'Data Freshness',
```

### 5.5 Acceptance Criteria

- [ ] Leader can select `Reliability-Aware Balanced` algorithm in generator
- [ ] After generation, warnings panel appears (may say "no concerns")
- [ ] Warn mode: assignments generated normally, warnings listed below
- [ ] Enforce mode: players with score < 30 excluded from priority-1 buildings
- [ ] Auto-approve: updates within configured threshold approved without leader action
- [ ] "Request Updates for This Event" links tokens to event history record
- [ ] Freshness dots appear in player list (green = <30d, orange = 30-90d, red = >90d, grey = never)

### 5.6 Test Plan

#### Unit Tests — `tests/reliability-algorithm.core.test.js`

Test `DSCoreReliabilityAlgorithm.validateAssignment`:
- Player with score=25 assigned to priority-1 building → warning of type `low_score_at_anchor`
- Player with score=80 assigned to priority-1 building → no warning
- Player with noShowStreak=4 (limit=3) → warning of type `no_show_streak`
- Player with score=null (new) at priority-1 → no warning (null means no history, not unreliable)
- Empty assignments → empty warnings array

Test `DSCoreReliabilityAlgorithm.assignWithReliability` (warn mode):
- Returns same number of assignments as `balanced_round_robin` would
- Returns `warnings` array (may be empty)
- Low-score player still assigned (warn mode does not block)

Test `DSCoreReliabilityAlgorithm.assignWithReliability` (enforce mode):
- Player with score=20 NOT in any priority-1 building assignment
- Player with score=90 IS in priority-1 building assignment
- Player with score=null (new) treated as eligible (grace period)

#### Integration Tests

- Mock player_stats gateway, test full generation flow with reliability algorithm selected
- Verify warnings panel receives correct warning count

#### Regression Strategy

All existing `assignment.core.test.js` tests must pass unchanged after this phase.

---

## 6. Phase 3: Multi-Game Plugin System

### 6.1 Overview

**Goal**: Extend `GAME_CATALOG` with a full plugin contract, add a second game to prove the pattern.

**Effort**: 3–4 weeks
**Dependencies**: Phase 1A (for stable foundation) — does NOT require Phase 2
**Parallel with**: Phase 6 (Dashboard) can run in parallel

### 6.2 New Files to Create

#### `js/games/last-war/last-war-plugin.js`
- **IIFE export**: `window.DSGameLastWarPlugin`
- **Purpose**: All Last War-specific logic extracted from `games.js` into a self-contained plugin
- **Public API**:
```js
{
    id: 'last_war',
    name: 'Last War: Survival',
    troopModel: { categories: [{id:'tank',label:'Tank'},{id:'aero',label:'Aero'},{id:'missile',label:'Missile'}], fallbackCategory: 'unknown' },
    playerImportSchema: { id, templateFileName, sheetName, headerRowIndex, columns },
    assignmentAlgorithmIds: ['balanced_round_robin', 'reliability_aware_balanced', 'aggressive_fill'],
    eventTemplates: [],
    phaseDefinitions: [],
    buildingTypes: [],
    // Validate a player object for this game's schema
    // Returns: { valid: boolean, errors: Array<string> }
    validatePlayer: function(player) { ... },
}
```

#### `js/games/whiteout-survival/whiteout-survival-plugin.js`
- **IIFE export**: `window.DSGameWhiteoutSurvivalPlugin`
- **Purpose**: Second game plugin
- **Public API**: Same shape as last-war plugin
- **Troop model**: `{ categories: [{id:'infantry',label:'Infantry'},{id:'lancer',label:'Lancer'},{id:'marksman',label:'Marksman'}], fallbackCategory: 'unknown' }`
- **Assignment algorithms**: `['balanced_round_robin']`

### 6.3 Existing Files to Modify

#### `js/core/games.js`
- Add `whiteout_survival` entry to `GAME_CATALOG` with all plugin contract fields
- Add `validatePlugin(plugin)` function that checks for required fields: `id`, `name`, `troopModel`, `playerImportSchema`, `assignmentAlgorithmIds`

#### `index.html`
- Add `<script defer>` for new plugin files (after `games.js`):
  ```html
  <script defer src="js/games/last-war/last-war-plugin.js"></script>
  <script defer src="js/games/whiteout-survival/whiteout-survival-plugin.js"></script>
  ```

### 6.4 Firestore Data Model

No new collections. `gameId` field already exists on player records.

### 6.5 Security Rules

No new rules.

### 6.6 i18n Keys

```js
game_whiteout_survival_name: 'Whiteout Survival',
game_whiteout_troop_infantry: 'Infantry',
game_whiteout_troop_lancer: 'Lancer',
game_whiteout_troop_marksman: 'Marksman',
```

### 6.7 Acceptance Criteria

- [ ] `DSCoreGames.listAvailableGames()` returns both `last_war` and `whiteout_survival`
- [ ] Switching game to Whiteout Survival shows correct troop type options (Infantry, Lancer, Marksman)
- [ ] Assignment runs for Whiteout Survival players
- [ ] All Last War existing functionality unchanged
- [ ] `validatePlugin(plugin)` returns `{ ok: false }` for a plugin missing required fields

### 6.8 Test Plan

#### Unit Tests — `tests/games.core.test.js` (extend existing file)

- `listAvailableGames()` returns array with both `last_war` and `whiteout_survival`
- `getGame('whiteout_survival')` returns object with `troopModel.categories` array of length 3
- `getGame('whiteout_survival').troopModel.categories` contains `infantry`, `lancer`, `marksman`
- `getGame('unknown')` returns null
- `validatePlugin({ id: 'test', name: 'Test' })` → `{ ok: false }` (missing required fields)
- `validatePlugin(fullValidPlugin)` → `{ ok: true }`
- Adding a third game: `getGame` returns it, `listAvailableGames` includes it

#### Regression Strategy

All existing `games.core.test.js` tests must pass. Run `npm test` before merge.

---

## 7. Phase 4: Battle Plans & Interactive Maps

### 7.1 Overview

**Goal**: Allow leaders to create alliance-wide battle plans with shareable read-only links. Optionally add Konva.js for drag-and-drop interactive maps.

**Effort**: 4–6 weeks
**Dependencies**: Phase 2 complete
**Parallel with**: Nothing

### 7.2 Firestore Data Model

```
alliances/{allianceId}/battle_plans/{planId}
  Fields:
    name: string
    eventTypeId: string
    gameId: string
    status: string            // "draft" | "active" | "archived"
    shareToken: string | null // null = not shared; 32-char hex = read-only share
    createdBy: string         // uid
    createdAt: Timestamp
    updatedAt: Timestamp
    assignments: {
        teamA: Array<{ playerName, building, role, troops }>,
        teamB: Array<{ playerName, building, role, troops }>
    }
    notes: string

  Subcollection: substitutes/{substituteId}
    Fields:
      playerName: string
      replacesPlayerName: string
      priority: number        // 1 = first sub
      status: string          // "waiting" | "active" | "used"

  Subcollection: map_state/{layerId}
    Fields:
      annotations: Array<{ x, y, text, color }>
      playerPositions: { [playerName]: { x, y } }
      updatedAt: Timestamp
      updatedBy: string

# Share token lookup: a separate lightweight collection for public access
alliances/{allianceId}/shared_plans/{shareToken}
  Fields:
    planId: string            // reference to battle_plans/{planId}
    allianceId: string
    createdAt: Timestamp
    expiresAt: Timestamp | null  // null = no expiry
```

**Why a separate `shared_plans` collection**: Firestore security rules cannot do `request.query.limit <= 1` on document reads (that check only applies to collection queries). To allow anonymous/unauthenticated read of a specific plan by share token, the cleanest pattern is a separate collection keyed on the share token. The `shared_plans` doc stores the `planId` reference; the viewer then reads the battle plan doc as an alliance member would (but using the share token as proof of access). See Section 7.3 for exact rules.

**Firestore Indexes**:
- `alliances/{allianceId}/battle_plans`: composite on `(gameId ASC, status ASC, createdAt DESC)`

### 7.3 Firestore Security Rules

```javascript
// Share token lookup (public read, alliance-member write)
match /alliances/{allianceId}/shared_plans/{shareToken} {
    allow read: if true;  // Anyone with the token URL can look up the planId
    allow create, delete: if isAllianceMember(allianceId);
}

match /alliances/{allianceId}/battle_plans/{planId} {
    // Alliance members always have full access
    // For share token viewers: they must first read shared_plans to get planId,
    // then they can read this doc IF shared_plans/{token}.planId == planId.
    // Enforce this by passing shareToken as a query param and checking it here:
    allow read: if isAllianceMember(allianceId)
                || (resource.data.shareToken != null
                    && request.auth == null);
    // Note: the above rule allows unauthenticated read when shareToken is set.
    // This is intentional: share links are public read-only.
    // Write access is strictly alliance-member only.
    allow create, update: if isAllianceMember(allianceId);
    allow delete: if isAllianceMember(allianceId);
}

match /alliances/{allianceId}/battle_plans/{planId}/substitutes/{substituteId} {
    allow read, write: if isAllianceMember(allianceId);
}

match /alliances/{allianceId}/battle_plans/{planId}/map_state/{layerId} {
    allow read: if isAllianceMember(allianceId)
                || resource.data != null;  // Allow read if doc exists and plan has shareToken
    // Better: allow read if parent plan has shareToken (use get() — OK in subcollection rules)
    allow read: if isAllianceMember(allianceId)
                || get(/databases/$(database)/documents/alliances/$(allianceId)/battle_plans/$(planId)).data.shareToken != null;
    allow write: if isAllianceMember(allianceId);
}
```

**Share link URL format**: `<origin>/battle-plan-view.html?token=<shareToken>&aid=<allianceId>`

Create `battle-plan-view.html` as a lightweight read-only view page (same pattern as `player-update.html`). This page reads `shared_plans/{shareToken}` to get the `planId`, then reads the battle plan.

### 7.4 New Files to Create

#### `js/features/battle-plans/battle-plans-core.js`
- **IIFE export**: `window.DSFeatureBattlePlansCore`
- **Public API**:

```js
// Build a new battle plan document (no id field).
// options: { name: string, eventTypeId: string, gameId: string, assignments?: object, notes?: string }
// createdByUid: string
// Returns: battle_plans document
buildPlanDoc(options, createdByUid)

// Generate a 32-char hex share token.
// Returns: string
generateShareToken()

// Build a read-only share URL.
// shareToken: string, allianceId: string
// Returns: string (URL to battle-plan-view.html)
buildShareUrl(shareToken, allianceId)

// Build a substitute document.
// playerName: string, replacesPlayerName: string, priority: number
// Returns: substitute document
buildSubstituteDoc(playerName, replacesPlayerName, priority)

// Promote a substitute into the assignments (returns new assignments object).
// assignments: { teamA: [], teamB: [] }
// sub: substitute doc — find replacesPlayerName in assignments and swap
// Returns: updated assignments object (does NOT mutate input)
promoteSubstitute(assignments, sub)
```

#### `js/features/battle-plans/battle-plans-view.js`
- **IIFE export**: `window.DSFeatureBattlePlansView`

```js
renderPlanList(container, plans)
renderPlanDetail(container, plan, subs, mapState)
renderSubstituteQueue(container, subs)
renderSharePanel(container, shareUrl)
```

#### `js/features/battle-plans/battle-plans-controller.js`
- **IIFE export**: `window.DSFeatureBattlePlansController`

```js
init(gateway)           // Returns: { destroy() }
createPlanFromCurrentAssignment()
openPlan(planId)
generateShareLink(planId)   // Creates shared_plans doc + sets shareToken on plan
addSubstitute(planId, playerName, replacesPlayerName)
promoteSubstitute(planId, substituteId)
savePlan(planId, changes)
```

#### `js/shared/data/firebase-battle-plans-gateway.js`
- **IIFE export**: `window.DSSharedFirebaseBattlePlansGateway`

```js
createGateway(utils) → {
    savePlan(allianceId, plan)
    loadPlan(allianceId, planId)
    loadPlanList(allianceId, filters)
    updatePlan(allianceId, planId, changes)
    deletePlan(allianceId, planId)
    saveSharedPlanToken(allianceId, shareToken, planId)     // writes to shared_plans
    loadSharedPlanByToken(allianceId, shareToken)           // reads shared_plans + plan
    saveSubstitute(allianceId, planId, sub)
    loadSubstitutes(allianceId, planId)
    updateSubstitute(allianceId, planId, substituteId, changes)
    saveMapState(allianceId, planId, layerId, mapState)
    loadMapState(allianceId, planId, layerId)
}
```

#### `battle-plan-view.html` (read-only share view)
- Same minimal pattern as `player-update.html`
- No auth required to view
- Reads `shared_plans/{shareToken}` → gets `planId` → reads `battle_plans/{planId}`
- Renders assignments in a read-only table

#### `vendor/konva.min.js` (if map feature included)
- Download from https://konvajs.org/ — current stable version, vendored locally
- Verify it does not require `unsafe-eval` (Konva.js does NOT require it for basic operations)

#### `js/features/battle-plans/battle-plans-map.js` (optional)
- **IIFE export**: `window.DSFeatureBattlePlansMap`

```js
initMapStage(container, width, height)  // Returns: { stage, layer, destroy() }
renderPlayerTokens(layer, playerPositions, assignments)
enableDragDrop(layer, onPositionChange)
renderBuildingZones(layer, buildingZones)
```

### 7.5 i18n Keys

```js
battle_plans_nav: 'Battle Plans',
battle_plans_title: 'Battle Plans',
battle_plans_empty: 'No battle plans yet.',
battle_plan_create_btn: 'Create Battle Plan',
battle_plan_from_assignment_btn: 'Save as Battle Plan',
battle_plan_share_btn: 'Share Link',
battle_plan_share_copied: 'Share link copied!',
battle_plan_status_draft: 'Draft',
battle_plan_status_active: 'Active',
battle_plan_status_archived: 'Archived',
substitute_queue_title: 'Substitute Queue',
substitute_add_btn: 'Add Substitute',
substitute_promote_btn: 'Promote',
substitute_waiting: 'Waiting',
substitute_active: 'Active',
battle_plan_view_readonly: 'Read-only view — sign in to edit',
```

### 7.6 Acceptance Criteria

- [ ] Leader can save a generated assignment as a battle plan
- [ ] Battle plan list view shows all plans for the alliance
- [ ] Plan detail shows team assignments and substitute queue
- [ ] Leader can add substitutes with priority ordering
- [ ] Leader can promote a substitute (swaps into assignment)
- [ ] Leader can generate a share link → URL points to `battle-plan-view.html`
- [ ] Anyone with share link can view the plan without signing in
- [ ] Share token lookup goes through `shared_plans` collection (not `request.query.limit` rule)
- [ ] If Konva map included: player tokens draggable, positions saved to Firestore

### 7.7 Test Plan

#### Unit Tests — `tests/battle-plans.core.test.js`

Test `DSFeatureBattlePlansCore.buildPlanDoc`:
- Returns document with `status = 'draft'`, `shareToken = null`, correct `createdBy`

Test `DSFeatureBattlePlansCore.promoteSubstitute`:
- Sub replaces target player in teamA assignments
- Original player removed from assignments
- Sub added with the target's building

Test `DSFeatureBattlePlansCore.generateShareToken`:
- Returns 32-char hex string

Test `DSFeatureBattlePlansCore.buildShareUrl`:
- URL contains `token=` param
- URL contains `aid=` param
- Points to `battle-plan-view.html`

#### Firestore Rules Tests — `tests/firestore-rules/battle-plans.rules.test.js`

- Alliance member can create/read/update `battle_plans`
- Unauthenticated user can read `battle_plans` doc if `shareToken != null`
- Unauthenticated user CANNOT write `battle_plans`
- Anyone can read `shared_plans/{shareToken}`
- Unauthenticated user CANNOT write `shared_plans`
- `map_state` readable if parent plan has `shareToken`

#### Regression Strategy

All previous phase tests must pass. Add `tests/phase4.regression.test.js`.

---

## 8. Phase 5: Timeline/Phase System

### 8.1 Overview

**Goal**: Add phase definitions to battle plans, with an SVG timeline and per-phase assignment overrides.

**Effort**: 3–4 weeks
**Dependencies**: Phase 4 complete
**Parallel with**: Phase 6 (Dashboard)

### 8.2 Firestore Data Model

```
alliances/{allianceId}/battle_plans/{planId}/phases/{phaseId}
  Fields:
    name: string
    order: number             // 1, 2, 3... (used for timeline ordering)
    durationMinutes: number   // duration in minutes (use number, not string)
    startOffset: number       // minutes from event start
    objectives: Array<string>
    playerOverrides: {        // sparse map: only players whose assignment differs
        [playerName]: { building: string, role: string }
    }
    color: string             // hex color e.g. "#1565c0"
```

### 8.3 New Files to Create

#### `js/features/timeline/timeline-core.js`
- **IIFE export**: `window.DSFeatureTimelineCore`

```js
// Build a new phase document (no id field).
// options: { name, order, durationMinutes, startOffset, objectives?, color? }
// Returns: phase document
buildPhaseDoc(options)

// Calculate pixel x and width for a phase on the SVG timeline.
// phase: { startOffset: number, durationMinutes: number }
// totalDuration: number (total event duration in minutes)
// timelineWidth: number (SVG width in pixels)
// Returns: { x: number, width: number }
calculatePhasePosition(phase, totalDuration, timelineWidth)

// Get the active phase for a given current time offset.
// phases: Array<phase docs>
// currentOffset: number (minutes since event start)
// Returns: phase doc | null
getActivePhase(phases, currentOffset)

// Apply phase player overrides to base assignments.
// baseAssignments: { teamA: Array, teamB: Array }
// phase: phase doc (with playerOverrides map)
// Returns: merged assignments object (does NOT mutate input)
applyPhaseOverrides(baseAssignments, phase)
```

#### `js/features/timeline/timeline-view.js`
- **IIFE export**: `window.DSFeatureTimelineView`

```js
// Render SVG timeline bar.
// container: HTMLElement, phases: Array<phase docs>, totalDuration: number, activePhaseId?: string
renderTimeline(container, phases, totalDuration, activePhaseId)

// Update active phase highlight without full re-render.
// Adds/removes 'timeline-phase-active' CSS class on SVG rect elements.
// container: HTMLElement, activePhaseId: string
updateActivePhase(container, activePhaseId)

// Render phase detail panel (name, objectives, override assignments).
// container: HTMLElement, phase: phase doc, resolvedAssignments: object
renderPhaseDetail(container, phase, resolvedAssignments)
```

#### `js/features/timeline/timeline-controller.js`
- **IIFE export**: `window.DSFeatureTimelineController`

### 8.4 i18n Keys

```js
timeline_nav: 'Timeline',
timeline_title: 'Event Timeline',
phase_add_btn: 'Add Phase',
phase_name_label: 'Phase Name',
phase_duration_label: 'Duration (minutes)',
phase_objectives_label: 'Objectives',
phase_overrides_label: 'Assignment Overrides for This Phase',
phase_active_label: 'Active Phase',
phase_no_overrides: 'Same as base assignments',
```

### 8.5 Acceptance Criteria

- [ ] Leader can add phases to a battle plan
- [ ] SVG timeline renders phases as colored segments in order
- [ ] Clicking a phase shows phase-specific assignments
- [ ] Per-phase assignment overrides saved to Firestore
- [ ] Active phase highlighted in timeline

### 8.6 Test Plan

#### Unit Tests — `tests/timeline.core.test.js`

Test `DSFeatureTimelineCore.calculatePhasePosition`:
- `startOffset=0, durationMinutes=30, totalDuration=120, timelineWidth=800` → `{ x: 0, width: 200 }`
- `startOffset=60, durationMinutes=60, totalDuration=120, timelineWidth=800` → `{ x: 400, width: 400 }`
- Phase extending beyond totalDuration → width clamped to available space

Test `DSFeatureTimelineCore.getActivePhase`:
- currentOffset=15, phases=[{startOffset:0, durationMinutes:30}, {startOffset:30, durationMinutes:60}] → first phase
- currentOffset=45 → second phase
- currentOffset=999 → null (past all phases)

Test `DSFeatureTimelineCore.applyPhaseOverrides`:
- PlayerA override changes building from "B1" to "B2" in result
- PlayerB (no override) keeps base assignment unchanged
- Input objects are not mutated

---

## 9. Phase 6: Dashboard & Analytics

### 9.1 Overview

**Goal**: Aggregate event history and reliability data into an alliance health dashboard.

**Effort**: 3–4 weeks
**Dependencies**: Phase 1A complete (player_stats must exist)
**Parallel with**: Phase 5 (Timeline)

### 9.2 New Files to Create

#### `js/features/dashboard/dashboard-core.js`
- **IIFE export**: `window.DSFeatureDashboardCore`

```js
// Calculate alliance-wide health stats from all player_stats.
// playerStats: Array<player_stats docs>
// Returns: { avgScore: number|null, atRiskCount: number, excellentCount: number, noHistoryCount: number }
calculateAllianceHealth(playerStats)

// Identify at-risk players (score below threshold OR consistently declining).
// playerStats: Array, threshold: number (default 50)
// Returns: Array<{ playerName, score, trend: 'improving'|'declining'|'stable', reason: string }>
// trend calculated from recentHistory: compare first 5 vs last 5 events' scores
identifyAtRiskPlayers(playerStats, threshold)

// Calculate composite reliability score from multiple signals.
// attendanceRate: number (0-100), freshnessScore: number (0-100), responseRate: number (0-100)
// Weights: 60% attendance, 25% freshness, 15% response
// Returns: number (0-100)
calculateCompositeScore(attendanceRate, freshnessScore, responseRate)
```

#### `js/features/dashboard/dashboard-view.js`
- **IIFE export**: `window.DSFeatureDashboardView`

```js
// Render alliance health summary card.
renderHealthCard(container, allianceHealth)

// Render at-risk players list.
renderAtRiskPanel(container, atRiskPlayers)

// Render sparkline SVG (inline, no library needed).
// scores: Array<number> (oldest first), width: number, height: number
// Returns: SVGElement
// Test: renderSparkline([100, 80, 60, 40]) should produce SVG with 4 data points
renderSparkline(scores, width, height)

// Render player profile card with history.
renderPlayerProfile(container, playerName, stats, recentHistory)
```

### 9.3 i18n Keys

```js
dashboard_nav: 'Dashboard',
dashboard_title: 'Alliance Dashboard',
dashboard_avg_score: 'Average Reliability Score',
dashboard_at_risk_players: 'At-Risk Players',
dashboard_excellent_players: 'Rock Solid Players',
dashboard_no_history: 'No History Yet',
dashboard_trend_improving: 'Improving',
dashboard_trend_declining: 'Declining',
dashboard_trend_stable: 'Stable',
```

### 9.4 Acceptance Criteria

- [ ] Dashboard shows alliance average reliability score
- [ ] At-risk players listed with reason
- [ ] Player profile shows last 10 events with colored status indicators
- [ ] Sparkline SVG renders correctly with no external library
- [ ] Dashboard refreshes when player_stats collection updates

### 9.5 Test Plan

#### Unit Tests — `tests/dashboard.core.test.js`

Test `DSFeatureDashboardCore.calculateAllianceHealth`:
- 3 players with scores [80, 90, 70] → avgScore = 80
- 1 player with score null → excluded from avg; noHistoryCount = 1
- All null → avgScore = null

Test `DSFeatureDashboardCore.identifyAtRiskPlayers`:
- Player with score=25 → in at-risk list
- Player with score=60 → not in list (above threshold 50)
- Player with declining trend (recent scores lower than old) → in list with trend='declining'

Test `DSFeatureDashboardCore.calculateCompositeScore`:
- `(100, 100, 100)` → 100
- `(0, 0, 0)` → 0
- `(60, 80, 100)` → round(60*0.6 + 80*0.25 + 100*0.15) = round(36+20+15) = 71

#### Sparkline SVG Test

- `renderSparkline([10, 50, 90])` → SVG element with `path` or `polyline` element containing 3 points
- Empty array → SVG with no data points (no error thrown)

---

## 10. Phase 7: Collaboration

### 10.1 Overview

**Goal**: Real-time co-editing of battle plans, presence indicators, live event coordination.

**Effort**: 6–8 weeks
**Dependencies**: Phase 4 complete
**Prerequisite**: Only build if alliance feature demand justifies complexity

### 10.2 Technical Approach

- Firestore listeners (already used) provide ~1500ms update latency — sufficient for planning tools
- Firebase RTDB: add only if presence indicators needed
- No custom WebSocket backend — too complex

### 10.3 Key Concerns

- **Conflict resolution**: Last-write-wins via Firestore transactions for concurrent assignment changes
- **Presence**: RTDB `onDisconnect` hook for online/offline
- **Bandwidth**: Subscribe only to the active plan doc

### 10.4 New Files to Create

#### `js/features/collaboration/collaboration-core.js`
- **IIFE export**: `window.DSFeatureCollaborationCore`

#### `js/shared/data/firebase-rtdb-gateway.js` (if RTDB added)
- **IIFE export**: `window.DSSharedFirebaseRtdbGateway`

### 10.5 Acceptance Criteria

- [ ] Two leaders can edit a battle plan simultaneously without data loss
- [ ] Changes appear for all viewers within 2 seconds
- [ ] Presence indicators show who is currently viewing

---

## 11. Inter-Phase Dependency Graph

```
Phase 0 (Foundation) — optional, improves DX
    ↓ (not blocking)
Phase 1A (Event History)  ←→  Phase 1B (Self-Update)  [parallel, no shared code]
    ↓                               ↓
Phase 2 (Integration) ← requires BOTH 1A and 1B
    ↓
Phase 4 (Battle Plans & Maps) ← requires Phase 2
    ↓
Phase 5 (Timeline/Phases) ← requires Phase 4

Phase 3 (Multi-Game) ← requires Phase 1A only (NOT Phase 2)
Phase 6 (Dashboard) ← requires Phase 1A only; can run parallel with Phases 3, 5
Phase 7 (Collaboration) ← requires Phase 4
```

### Start Order Recommendation

1. Phase 0 (optional, 1 week)
2. Phase 1A + Phase 1B in parallel (3 weeks): two developer agents independently
3. Phase 2 (3 weeks): integration
4. Phase 3 + Phase 6 in parallel (3 weeks each): multi-game + dashboard (both need only Phase 1A)
5. Phase 4 (5 weeks): battle plans (requires Phase 2)
6. Phase 5 (4 weeks): timeline
7. Phase 7 (6-8 weeks, if demand)

### Critical Path

```
Phase 1A (3w) → Phase 2 (3w) → Phase 4 (5w) → Phase 5 (4w)
                                              = ~15 weeks on critical path
```

Phase 1B, Phase 3, Phase 6, Phase 7 are off the critical path.

---

## 12. Review Changelog

This section documents all changes made in response to architect, sr-developer, and sr-QA reviews.

### Architect Review

- **CRITICAL-1 (share token rule)**: Replaced `request.query.limit <= 1` with a separate `shared_plans/{shareToken}` collection. Rules updated in Phase 4 Section 7.3.
- **CRITICAL-2 (anon update fields)**: Added `request.resource.data.diff(resource.data).affectedKeys().hasOnly(['used', 'usedAt', 'usedByAnonUid'])` to the anonymous update rule in Phase 1B Section 4.3.
- **MAJOR-1 (doc ID chars)**: Added `sanitizeDocId` utility in new `js/core/firestore-utils.js` (Section 1.11). All attendance and player_stats doc IDs must use this. Raw name preserved as field.
- **MAJOR-2 (atomic finalization)**: `finalizeAttendance` now explicitly documented as a single Firestore batch write (Section 3.4, controller spec + gateway spec updated).
- **MAJOR-3 (gateway composition)**: Added Section 1.3 explaining the flat `FirebaseService` pattern and exactly how new gateways compose into it, including grep anchors.
- **MINOR-1 (CLAUDE.md)**: Phase 0 now explicitly states CLAUDE.md must be updated if esbuild is adopted (Section 2.1 and 2.3).
- **MINOR-2 (doc ID)**: Covered by MAJOR-1 above.

### Sr-Developer Review

- **CRITICAL-1 (Phase 0 contradicts CLAUDE.md)**: Phase 0 now explicitly acknowledges the override and requires CLAUDE.md update (Section 2.1).
- **CRITICAL-2 (algorithm dispatch)**: Section 5.2 now specifies exactly where the dispatch branch is added (`generator-assignment.js`, grep anchor: `DSCoreAssignment.assignTeamToBuildings`).
- **MAJOR-1 (gateway composition)**: Covered by architect MAJOR-3 above.
- **MAJOR-2 (player-update.html CSP)**: Full CSP spelled out in Section 4.4. Deploy verification step added.
- **MAJOR-3 (script tag order)**: Phase 1B script tags in Section 4.5 now show gateway BEFORE controller.
- **MAJOR-4 (app.js vague wiring)**: Added `// BEGIN FEATURE WIRING` grep anchor pattern throughout all phases.
- **MINOR-1 (null threshold)**: Aligned to `< 3` throughout. Algorithm pseudocode in Section 3.4 is definitive.
- **MINOR-2 (doc ID)**: Covered by architect MAJOR-1.
- **MINOR-3 (Phase 3 dependency)**: Phase 3 now depends on Phase 1A only, not Phase 2 (Section 6.1 and dependency graph Section 11).
- **MINOR-4 (share token rule)**: Covered by architect CRITICAL-1.
- **MINOR-5 (actions 2 methods)**: Phase 1A event-history-actions.js kept with 2 methods, comment added noting this is intentional for folder consistency.
- **SUGGESTION (aggressive_fill)**: `aggressive_fill` algorithm registered in Phase 2 Section 5.3.

### Sr-QA Review

- **CRITICAL-1 (null threshold)**: Aligned to `< 3` throughout, pseudocode in Section 3.4 is authoritative.
- **CRITICAL-2 (share token bypass)**: Covered by architect CRITICAL-1.
- **CRITICAL-3 (rules tests)**: Added Section 1.8 explaining Firestore rules testing setup. Added `tests/firestore-rules/` test files to Phases 1A (Section 3.9), 1B (Section 4.9), and 4 (Section 7.7).
- **MAJOR-1 (recalculatePlayerStats test cases)**: Added 6 additional test cases including all-excused, cancelled+real mix, recentHistory truncation, longestNoShowStreak, lastEventDate (Section 3.9).
- **MAJOR-2 (race condition test)**: Added `tests/player-updates.race.integration.test.js` spec in Section 4.9.
- **MAJOR-3 (regression strategy)**: Added regression strategy subsection to each phase.
- **MAJOR-4 (E2E tooling)**: Added Playwright setup in Section 1.12. E2E tests in each phase now reference Playwright.
- **MAJOR-5 (validateStatusTransition matrix)**: Added complete transition matrix table in Section 3.9.
- **MINOR-1 (buildUpdateLink URL test)**: Enhanced in Section 4.9 with exact URL structure test.
- **MINOR-2 (accessibility)**: Reliability dot `renderReliabilityDot` spec now requires `aria-label`. CSS comment added. Acceptance criteria updated.
- **MINOR-3 (subscription test)**: Integration tests for subscriptions noted in Phases 1A and 1B.
- **MINOR-4 (Phase 3 test plan)**: Added 4 additional test cases in Section 6.8.
- **SUGGESTION (golden snapshot)**: Added golden snapshot test for reliability algorithm in Section 3.9.
- **SUGGESTION (factories)**: Added `tests/helpers/factories.js` in Section 1.13.
- **SUGGESTION (sparkline test)**: Added sparkline SVG test in Section 9.5.
- **SUGGESTION (mobile checklist)**: Added cross-browser/mobile checklist in Section 4.9.

---

*End of Implementation Plan*
