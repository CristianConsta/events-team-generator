# Testing Patterns

**Analysis Date:** 2026-02-25

## Test Framework

**Runner:**
- Node.js built-in `node:test` module (ESM-style, no external test framework)
- Version: Node 18+ (supports built-in test module)
- Config: `.eslintrc.cjs` and `eslint.config.js` have test overrides

**Assertion Library:**
- `node:assert/strict` (Node.js built-in)
- All tests use `const assert = require('node:assert/strict')`

**Coverage:**
- c8 (Istanbul-compatible coverage reporter)
- Target: 80% line coverage for `js/core/**` and `js/shared/data/**`
- Command: `npm run test:coverage` (runs tests with c8 coverage check)
- Coverage report: stdout during test run

**Run Commands:**
```bash
npm test                    # Run all unit/integration/feature tests
npm run test:unit          # Run all .test.js files in tests/ and tests/helpers/
npm run test:coverage      # Run tests with c8 coverage (80% threshold enforced)
npm run test:rules         # Firestore security rules tests (requires emulator)
npm run test:e2e           # All Playwright E2E tests
npm run test:e2e:smoke     # @smoke tagged tests only (subset)
npm run test:e2e:regression # @regression tagged tests
npm run test:e2e:real      # @real tagged tests (real Firebase)
npm run test:e2e:chrome    # Chrome desktop only
npm run test:e2e:mobile    # Edge and Chrome mobile
npm run test:e2e:headed    # Edge desktop with browser visible
```

## Test File Organization

**Location:**
- Unit/integration/feature tests: `/tests/*.test.js` and `/tests/helpers/*.test.js`
- Firestore rules tests: `/tests/firestore-rules/*.rules.test.js`
- E2E tests: `/e2e/*.e2e.js`

**Naming:**
- `.core.test.js` — unit tests for pure business logic (`js/core/**`)
- `.core.extended.test.js` — extended unit tests for complex algorithms (optional variant)
- `.integration.test.js` — integration tests across modules with mocked Firebase
- `.feature.test.js` — controller/feature-level tests
- `.rules.test.js` — Firestore security rules validation
- `.e2e.js` — end-to-end tests using Playwright

**Structure:**
```
tests/
├── assignment.core.test.js           # Test for js/core/assignment.js
├── assignment.core.extended.test.js  # Additional edge cases
├── app-init.integration.test.js      # Integration with multiple modules
├── download-controller.feature.test.js
├── helpers/
│   ├── factories.js                  # Factory functions for test data
│   └── factories.test.js             # Tests of factories themselves
├── firestore-rules/
│   └── *.rules.test.js              # Firestore rule validation
└── ...
e2e/
├── 01-auth.e2e.js
├── 02-player-upload.e2e.js
└── ...
```

## Test Structure

**Suite Organization:**
Tests use two patterns:

**Pattern 1: Simple test() calls (most unit tests):**
```javascript
const test = require('node:test');
const assert = require('node:assert/strict');

test('description of what is tested', () => {
    // Setup
    const input = { ... };

    // Execute
    const result = someFunction(input);

    // Assert
    assert.equal(result.property, expectedValue);
});

test('another case', () => {
    // ...
});
```

**Pattern 2: describe()/it() with hooks (feature/integration tests):**
```javascript
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

describe('FeatureController', () => {
    let deps;

    beforeEach(() => {
        deps = createMockDeps();
    });

    afterEach(() => {
        deps = null;
    });

    it('should handle case 1', () => {
        const result = controller.method(deps);
        assert.ok(result);
    });
});
```

**Module Loading Pattern:**
```javascript
const path = require('node:path');
const modulePath = path.resolve(__dirname, '../js/core/assignment.js');

function loadModule() {
    global.window = global;
    delete global.DSCoreAssignment;           // Clear cached export
    delete require.cache[require.resolve(modulePath)];  // Clear Node cache
    require(modulePath);                       // Execute IIFE, populates global
}

test('something', () => {
    loadModule();  // Load fresh module for each test
    const result = global.DSCoreAssignment.method();
    assert.ok(result);
});
```

**Cleanup Pattern (after tests):**
```javascript
test.afterEach(() => {
    resetModule(appInitPath);
    resetGlobals();  // Delete all globals touched by test
});

function resetGlobals() {
    delete global.window;
    delete global.document;
    delete global.FirebaseService;
    // ... delete all globals set during test
}
```

## Mocking

**Framework:** Manual mocking with object literals (no mock library)

**Pattern for mocking dependencies:**
```javascript
function makeMockGateway(overrides) {
    return {
        saveHistoryRecord: async function(record) {
            return overrides && overrides.saveHistoryRecord
                ? overrides.saveHistoryRecord(record)
                : { success: true };
        },
        loadHistoryRecords: async function() {
            return overrides && overrides.loadHistoryRecords
                ? overrides.loadHistoryRecords()
                : [];
        },
    };
}
```

**Pattern for mocking Firebase:**
```javascript
global.FirebaseService = {
    isAvailable: () => false,  // Or true for positive tests
    init: () => false,
    getActivePlayerDatabase: () => ({}),
    // ... other methods return defaults or mocks
};
```

**Pattern for mocking DOM elements:**
```javascript
const mockElement = (id) => ({
    id: id,
    textContent: '',
    innerHTML: '',
    classList: { toggle: () => {}, remove: () => {}, add: () => {} },
    click: () => {},
});

global.document = {
    getElementById: (id) => {
        return id === 'someId' ? mockElement(id) : null;
    },
    querySelectorAll: (selector) => {
        return selector === '[data-i18n]' ? [mockElement('i18n')] : [];
    },
};
```

**What to Mock:**
- Firebase/Firestore operations (gateway methods)
- DOM elements (getElementById, querySelector, etc.)
- Storage (localStorage, sessionStorage)
- Global dependencies (FirebaseManager, FirebaseService)
- Timers if testing async behavior (setTimeout)

**What NOT to Mock:**
- Pure functions in `js/core/**` — test their actual output
- Array/string methods — use real implementations
- Object operations — test real behavior
- Date operations — use real `new Date()` unless testing time-dependent logic

**Example from `firebase-service.test.js`:**
```javascript
// Don't mock — test actual behavior
const result = global.DSCoreAssignment.assignTeamToBuildings(
    [{ name: 'P1', power: 100, troops: 'Tank' }, ...],
    [{ name: 'HQ', priority: 1, slots: 2 }, ...]
);
assert.equal(result.length, 2);
assert.ok(result[0].building === 'HQ');

// Do mock — Firebase calls are external
global.FirebaseService = {
    loadUserData: async () => ({ uid: 'test-uid', ... }),
};
```

## Fixtures and Factories

**Test Data:**

Located in `/tests/helpers/factories.js` — CommonJS module (not IIFE):

```javascript
function makePlayer(overrides) {
    return Object.assign({
        name: 'TestPlayer',
        power: 100,
        thp: 500,
        troops: 'Tank',
        reliabilityScore: null,
    }, overrides || {});
}

function makeHistoryRecord(overrides) {
    return Object.assign({
        eventTypeId: 'desert_storm',
        eventName: 'Desert Storm #1',
        gameId: 'last_war',
        scheduledAt: new Date('2026-01-01T18:00:00Z'),
        // ... more fields
    }, overrides || {});
}

module.exports = { makePlayer, makeHistoryRecord, makePlayerStats, ... };
```

**Usage in tests:**
```javascript
const { makePlayer, makeHistoryRecord } = require('./helpers/factories.js');

test('complex scenario', () => {
    const player = makePlayer({ name: 'Alpha', power: 200 });
    const history = makeHistoryRecord({ gameId: 'other_game' });

    const result = process(player, history);
    assert.ok(result.success);
});
```

**Location:**
- Factories: `tests/helpers/factories.js`
- Factory tests: `tests/helpers/factories.test.js` (validates factory defaults)

## Test Types

**Unit Tests (`.core.test.js`):**
- Test pure functions in isolation
- No Firebase, no DOM, no network
- Examples: `assignment.core.test.js`, `buildings.core.test.js`, `i18n.core.test.js`
- Typical pattern: load module, call function, assert result
- ~5-20 tests per file, each <50 LOC

```javascript
test('findMixPartner picks different troop from top 3 candidates', () => {
    loadModule();
    const top = { name: 'Top', troops: 'Tank' };
    const available = [
        { name: 'A', troops: 'Tank' },
        { name: 'B', troops: 'Missile' },
        { name: 'C', troops: 'Tank' },
    ];
    const partner = global.DSCoreAssignment.findMixPartner(top, available);
    assert.equal(partner.name, 'B');
});
```

**Integration Tests (`.integration.test.js`):**
- Test interactions across multiple modules
- Mock Firebase, use real core logic
- Examples: `app-init.integration.test.js`, `bootstrap.integration.test.js`, `event-history.integration.test.js`
- Typical pattern: load dependencies, call controllers with mocked gateways, assert outcomes
- ~10-30 tests per file

```javascript
test('app init executes auth, data-load, and alliance callback flows', () => {
    global.window = global;
    global.document = { /* mock */ };
    global.FirebaseService = { /* mock */ };

    require(appInitPath);

    assert.equal(initLanguageCalls, 1);
    assert.equal(updateLabelsCalls, 1);
});
```

**Feature Tests (`.feature.test.js`):**
- Test controller behavior end-to-end within feature
- Mock Firebase gateways, DOM, test user interactions
- Examples: `download-controller.feature.test.js`, `events-manager-controller.feature.test.js`
- Typical pattern: create controller with mocked deps, call methods, verify state changes
- ~10-20 tests per file

```javascript
describe('DSDownloadController', () => {
    it('exports all expected methods', () => {
        const ctrl = global.DSDownloadController;
        assert.ok(ctrl);
        assert.equal(typeof ctrl.openDownloadModal, 'function');
    });

    it('getMapHeaderTitle returns correct format', () => {
        const deps = { getCurrentEvent: () => 'desert_storm', ... };
        const title = ctrl.getMapHeaderTitle('A', deps);
        assert.equal(title, 'TEAM A ASSIGNMENTS - Desert Storm');
    });
});
```

**Firestore Rules Tests (`.rules.test.js`):**
- Validate security rules using `@firebase/rules-unit-testing`
- Requires Firestore emulator running
- Command: `npm run test:rules` (emulator runs via Firebase Tools)
- Pattern: Use `testEnv` to set rules, create test database, verify allow/deny
- Typical: test read, write, delete permissions for various users

```javascript
// Requires: firebase emulators:start (running separately)
const testEnv = await initializeTestEnvironment({ projectId: '...' });
const db = testEnv.unauthenticatedContext().db();
await assertFails(setDoc(...));  // Expect deny
await assertSucceeds(setDoc(...)); // Expect allow
```

**E2E Tests (Playwright):**
- Full browser tests against live Firebase (or mock)
- Uses Playwright with file:// URLs (no dev server)
- Tagged: `@smoke` (CI), `@regression`, `@real` (live Firebase)
- Pattern: navigate, interact with UI, verify visible outcomes
- Not file-based; require running `npm run build` first

## Common Patterns

**Async Testing:**
```javascript
test('async operation succeeds', async () => {
    const result = await controller.submitForm(data);
    assert.ok(result.success);
});

test('async operation handles errors', async () => {
    const result = await controller.submitForm(badData);
    assert.equal(result.success, false);
    assert.ok(result.error);
});
```

**Error Testing:**
```javascript
test('rejects invalid input', () => {
    const result = assignTeamToBuildings(null, null);
    assert.deepEqual(result, []);  // Returns empty, doesn't throw
});

test('recovers from storage failure', () => {
    global.localStorage.setItem = () => { throw new Error('blocked'); };

    const originalWarn = console.warn;
    const warnings = [];
    console.warn = (...args) => warnings.push(args.join(' '));

    try {
        DSI18N.setLanguage('fr');
    } finally {
        console.warn = originalWarn;
    }

    assert.ok(warnings.some(line => line.includes('Unable to persist')));
});
```

**State Verification:**
```javascript
test('store updates and notifies subscribers', () => {
    const store = global.DSAppStateStore.createDefaultStore();

    let notifyCount = 0;
    const unsubscribe = store.subscribe(() => { notifyCount += 1; });

    store.setState({ navigation: { currentView: 'players' } });
    assert.equal(notifyCount, 1);

    const next = store.getState();
    assert.equal(next.navigation.currentView, 'players');

    unsubscribe();
    store.setState({ navigation: { currentView: 'support' } });
    assert.equal(notifyCount, 1);  // Still 1, unsubscribed
});
```

**Testing with Real Snapshots (integration tests):**
```javascript
function makeMockSnapshot(data) {
    return {
        exists: function() { return !!data; },
        data: function() { return data; },
        id: 'doc-id',
    };
}

test('controller processes snapshot', () => {
    const snap = makeMockSnapshot({ eventName: 'Desert Storm', status: 'planned' });
    const ctrl = createController({ ... });

    ctrl.onSnapshot(snap);

    const state = ctrl.getState();
    assert.equal(state.eventName, 'Desert Storm');
});
```

## Coverage

**Requirements:**
- 80% line coverage enforced on `js/core/**` and `js/shared/data/**`
- Monitored via c8 during `npm run test:coverage`
- Enforced in CI: if coverage drops below 80%, tests fail

**View Coverage:**
```bash
npm run test:coverage    # Shows coverage summary in stdout
# Output includes:
# -------|---------|---------|---------|---------|------|
# File   | % Stmts | % Branch| % Funcs | % Lines |Uncov |
# -------|---------|---------|---------|---------|------|
```

**Gap identification:**
- Check stdout for uncovered lines
- Rerun with `--reporter=text-lcov` for detailed line mapping (not in script, manual only)
- Focus on `js/core/**` and `js/shared/data/**` — these have 80% target
- `js/features/**`, `js/shell/**`, `js/ui/**`, controllers tested via feature/integration tests but not required to reach 80%

## Test Execution Flow

**Command: `npm test` / `npm run test:unit`**
```bash
node --test tests/*.test.js tests/helpers/*.test.js
# Executes all .test.js files in tests/ directory
# Timing: ~10-20 seconds
# Reports: TAP-style output (Test Anything Protocol) to stdout
# Exit code: 0 if all pass, 1 if any fail
```

**Command: `npm run test:coverage`**
```bash
c8 --check-coverage --lines 80 --include 'js/core/**' --include 'js/shared/data/**' \
  node --test tests/*.test.js tests/helpers/*.test.js
# Same as test:unit but wraps with c8 coverage tool
# Fails if coverage < 80% for included paths
# Reports coverage to stdout before test results
```

**Command: `npm run test:rules`**
```bash
firebase emulators:exec --only firestore "node --test tests/firestore.rules.emulator.js"
# Starts Firestore emulator, runs rules tests, stops emulator
# Requires: JDK installed, Firebase CLI installed
# Timing: ~30-60 seconds (emulator startup overhead)
```

**Command: `npm run test:e2e:smoke`**
```bash
playwright test --project=edge-desktop --project=edge-mobile --project=chrome-desktop --project=chrome-mobile --grep @smoke
# Runs only tests tagged @smoke (subset of full E2E suite)
# Projects: edge-desktop (fails locally—not installed), chrome-desktop, chrome-mobile, edge-mobile
# Only chrome-* succeed locally
# Timing: ~5-10 minutes
```

---

*Testing analysis: 2026-02-25*
