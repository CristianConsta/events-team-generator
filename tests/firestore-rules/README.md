# Firestore Rules Tests

This directory contains Firestore security rules tests that run against the Firebase emulator.

## Pattern

Each rules test file uses `@firebase/rules-unit-testing`:

```js
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const fs = require('node:fs');
const path = require('node:path');

const PROJECT_ID = 'demo-desert-storm-generator';
const RULES_PATH = path.resolve(__dirname, '../../firestore.rules');

let testEnv;

test.before(async () => {
    testEnv = await initializeTestEnvironment({
        projectId: PROJECT_ID,
        firestore: {
            rules: fs.readFileSync(RULES_PATH, 'utf8'),
        },
    });
});

test.after(async () => {
    if (testEnv) await testEnv.cleanup();
});

// Helper: seed a doc bypassing rules
async function seedDoc(docPath, data) {
    await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().doc(docPath).set(data);
    });
}

// Helper: get an authenticated Firestore instance
function authedDb(uid, email) {
    return testEnv.authenticatedContext(uid, email ? { email } : undefined).firestore();
}

// Helper: get an unauthenticated Firestore instance
function unauthDb() {
    return testEnv.unauthenticatedContext().firestore();
}

test('example: only owner can read their doc', async () => {
    await assertSucceeds(authedDb('alice').doc('users/alice').get());
    await assertFails(authedDb('bob').doc('users/alice').get());
});
```

## Running

Rules tests require the Firestore emulator:

```bash
npm run test:rules
# Equivalent to: firebase emulators:exec --only firestore "node --test tests/firestore.rules.emulator.js"
```

To run tests from this directory against the emulator:

```bash
firebase emulators:exec --only firestore "node --test tests/firestore-rules/*.rules.test.js"
```

## File Naming

- `{domain}.rules.test.js` — rules tests for a specific Firestore domain
- Example: `event-history.rules.test.js`, `attendance.rules.test.js`

## Existing Tests

The main emulator test file is at `tests/firestore.rules.emulator.js`. It covers:
- `users/{uid}/games/{gameId}` — owner-only access
- `games/{gameId}/alliances/{allianceId}` — member-only read, create/update constraints
- `games/{gameId}/invitations/{inviteId}` — inviter/invitee access
- `games/{gameId}` metadata — super admin only for writes
- Legacy `alliances/` and `invitations/` root collections — read-only for authenticated users

New Phase 1A+ domain tests (attendance, event-history, player-stats, tokens) go in this directory.

## Dependencies

- `@firebase/rules-unit-testing` (already in devDependencies)
- Firebase emulator (installed via `firebase-tools`)
- `firestore.rules` at project root (owned by db-developer)
