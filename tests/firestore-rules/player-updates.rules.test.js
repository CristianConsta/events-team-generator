// tests/firestore-rules/player-updates.rules.test.js
// Firestore security rules tests for update_tokens and pending_updates.
// Requires the Firestore emulator:
//   firebase emulators:exec --only firestore "node --test tests/firestore-rules/player-updates.rules.test.js"

const test = require('node:test');
const assert = require('node:assert/strict');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const fs = require('node:fs');
const path = require('node:path');

const PROJECT_ID = 'demo-desert-storm-generator-pu';
const RULES_PATH = path.resolve(__dirname, '../../firestore.rules');

const ALLIANCE_ID = 'alliance_pu_test_1';
const MEMBER_UID = 'uid_member_pu_leader';
const OUTSIDER_UID = 'uid_outsider_pu';
const TOKEN_ID = 'token_abc_1';
const UPDATE_ID = 'update_pu_1';

let testEnv;

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function seedDoc(docPath, data) {
    await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().doc(docPath).set(data);
    });
}

function authedDb(uid) {
    return testEnv.authenticatedContext(uid).firestore();
}

function anonDb(anonUid) {
    return testEnv.authenticatedContext(anonUid || 'anon_uid_pu_1', {
        firebase: { sign_in_provider: 'anonymous' },
    }).firestore();
}

function unauthDb() {
    return testEnv.unauthenticatedContext().firestore();
}

// Helper: get a future timestamp (server-side Firestore Timestamp-like object)
function futureTimestamp() {
    // Use a plain JS Date far in the future — rules compare against request.time
    return new Date(Date.now() + 48 * 60 * 60 * 1000);
}

function pastTimestamp() {
    return new Date(Date.now() - 48 * 60 * 60 * 1000);
}

// ---------------------------------------------------------------------------
// Setup: seed the alliance doc with MEMBER_UID as a member.
// ---------------------------------------------------------------------------

test.before(async () => {
    await seedDoc(`games/last_war/alliances/${ALLIANCE_ID}`, {
        gameId: 'last_war',
        createdBy: MEMBER_UID,
        members: { [MEMBER_UID]: true },
    });
});

// ---------------------------------------------------------------------------
// update_tokens — create
// ---------------------------------------------------------------------------

test('update_tokens: alliance member can create update_tokens', async () => {
    const db = authedDb(MEMBER_UID);
    await assertSucceeds(
        db.doc(`alliances/${ALLIANCE_ID}/update_tokens/${TOKEN_ID}`).set({
            token: 'abcdef1234567890abcdef1234567890',
            allianceId: ALLIANCE_ID,
            playerName: 'Alice',
            gameId: 'last_war',
            createdBy: MEMBER_UID,
            expiresAt: futureTimestamp(),
            used: false,
            usedAt: null,
            usedByAnonUid: null,
        })
    );
});

test('update_tokens: non-member CANNOT create update_tokens', async () => {
    const db = authedDb(OUTSIDER_UID);
    await assertFails(
        db.doc(`alliances/${ALLIANCE_ID}/update_tokens/token_outsider`).set({
            token: 'aaaa',
            used: false,
            expiresAt: futureTimestamp(),
        })
    );
});

test('update_tokens: anonymous user CANNOT create update_tokens', async () => {
    const db = anonDb();
    await assertFails(
        db.doc(`alliances/${ALLIANCE_ID}/update_tokens/token_anon`).set({
            token: 'anon_token',
            used: false,
            expiresAt: futureTimestamp(),
        })
    );
});

// ---------------------------------------------------------------------------
// update_tokens — read (anonymous access for valid tokens)
// ---------------------------------------------------------------------------

test.before(async () => {
    // Seed a valid (unexpired, unused) token
    await seedDoc(`alliances/${ALLIANCE_ID}/update_tokens/token_valid`, {
        token: 'valid_token_1234',
        playerName: 'Alice',
        used: false,
        expiresAt: futureTimestamp(),
    });

    // Seed an expired token
    await seedDoc(`alliances/${ALLIANCE_ID}/update_tokens/token_expired`, {
        token: 'expired_token_1234',
        playerName: 'Bob',
        used: false,
        expiresAt: pastTimestamp(),
    });

    // Seed an already-used token
    await seedDoc(`alliances/${ALLIANCE_ID}/update_tokens/token_used`, {
        token: 'used_token_1234',
        playerName: 'Charlie',
        used: true,
        expiresAt: futureTimestamp(),
    });
});

test('update_tokens: anonymous user can read unexpired, unused token', async () => {
    const db = anonDb();
    await assertSucceeds(
        db.doc(`alliances/${ALLIANCE_ID}/update_tokens/token_valid`).get()
    );
});

test('update_tokens: anonymous user CANNOT read expired token', async () => {
    const db = anonDb();
    await assertFails(
        db.doc(`alliances/${ALLIANCE_ID}/update_tokens/token_expired`).get()
    );
});

test('update_tokens: anonymous user CANNOT read already-used token', async () => {
    const db = anonDb();
    await assertFails(
        db.doc(`alliances/${ALLIANCE_ID}/update_tokens/token_used`).get()
    );
});

test('update_tokens: unauthenticated user CANNOT read any token', async () => {
    const db = unauthDb();
    await assertFails(
        db.doc(`alliances/${ALLIANCE_ID}/update_tokens/token_valid`).get()
    );
});

test('update_tokens: alliance member can read any token', async () => {
    const db = authedDb(MEMBER_UID);
    await assertSucceeds(
        db.doc(`alliances/${ALLIANCE_ID}/update_tokens/token_expired`).get()
    );
});

// ---------------------------------------------------------------------------
// update_tokens — update (anonymous can only mark as used)
// ---------------------------------------------------------------------------

test('update_tokens: anonymous user can update token to mark as used (only used, usedAt, usedByAnonUid)', async () => {
    // Seed a fresh valid token to update
    await seedDoc(`alliances/${ALLIANCE_ID}/update_tokens/token_to_use`, {
        token: 'token_to_use_value',
        playerName: 'Diana',
        used: false,
        expiresAt: futureTimestamp(),
        usedAt: null,
        usedByAnonUid: null,
    });

    const db = anonDb('anon_uid_uses_token');
    await assertSucceeds(
        db.doc(`alliances/${ALLIANCE_ID}/update_tokens/token_to_use`).update({
            used: true,
            usedAt: new Date(),
            usedByAnonUid: 'anon_uid_uses_token',
        })
    );
});

test('update_tokens: anonymous user CANNOT update token playerName field', async () => {
    // Seed another valid token
    await seedDoc(`alliances/${ALLIANCE_ID}/update_tokens/token_tamper`, {
        token: 'token_tamper_value',
        playerName: 'Eve',
        used: false,
        expiresAt: futureTimestamp(),
        usedAt: null,
        usedByAnonUid: null,
    });

    const db = anonDb('anon_uid_tampers');
    await assertFails(
        db.doc(`alliances/${ALLIANCE_ID}/update_tokens/token_tamper`).update({
            used: true,
            usedAt: new Date(),
            usedByAnonUid: 'anon_uid_tampers',
            playerName: 'Hacked',  // not allowed
        })
    );
});

test('update_tokens: anonymous user CANNOT update already-used token', async () => {
    const db = anonDb();
    await assertFails(
        db.doc(`alliances/${ALLIANCE_ID}/update_tokens/token_used`).update({
            used: true,
            usedAt: new Date(),
            usedByAnonUid: 'anon_uid_pu_1',
        })
    );
});

// ---------------------------------------------------------------------------
// pending_updates — create (anonymous only, with validation)
// ---------------------------------------------------------------------------

test('pending_updates: anonymous user can create pending_updates with valid values', async () => {
    const db = anonDb('anon_uid_creates_update');
    await assertSucceeds(
        db.doc(`alliances/${ALLIANCE_ID}/pending_updates/${UPDATE_ID}`).set({
            tokenId: TOKEN_ID,
            submittedAt: new Date(),
            status: 'pending',
            proposedValues: {
                power: 5000,
                thp: 50000,
                troops: 'Tank',
            },
        })
    );
});

test('pending_updates: anonymous user CANNOT create pending_updates with power > 9999', async () => {
    const db = anonDb();
    await assertFails(
        db.doc(`alliances/${ALLIANCE_ID}/pending_updates/update_bad_power`).set({
            proposedValues: {
                power: 10000,
                thp: 50000,
                troops: 'Tank',
            },
        })
    );
});

test('pending_updates: anonymous user CANNOT create pending_updates with power < 0', async () => {
    const db = anonDb();
    await assertFails(
        db.doc(`alliances/${ALLIANCE_ID}/pending_updates/update_neg_power`).set({
            proposedValues: {
                power: -1,
                thp: 50000,
                troops: 'Missile',
            },
        })
    );
});

test('pending_updates: anonymous user CANNOT create pending_updates with thp > 99999', async () => {
    const db = anonDb();
    await assertFails(
        db.doc(`alliances/${ALLIANCE_ID}/pending_updates/update_bad_thp`).set({
            proposedValues: {
                power: 5000,
                thp: 100000,
                troops: 'Aero',
            },
        })
    );
});

test('pending_updates: anonymous user CANNOT create pending_updates with invalid troops value', async () => {
    const db = anonDb();
    await assertFails(
        db.doc(`alliances/${ALLIANCE_ID}/pending_updates/update_bad_troops`).set({
            proposedValues: {
                power: 5000,
                thp: 50000,
                troops: 'Cavalry',  // not in ['Tank', 'Aero', 'Missile']
            },
        })
    );
});

test('pending_updates: alliance member CANNOT create pending_updates (not anonymous)', async () => {
    const db = authedDb(MEMBER_UID);
    await assertFails(
        db.doc(`alliances/${ALLIANCE_ID}/pending_updates/update_by_member`).set({
            proposedValues: {
                power: 5000,
                thp: 50000,
                troops: 'Tank',
            },
        })
    );
});

// ---------------------------------------------------------------------------
// pending_updates — read and update (alliance member)
// ---------------------------------------------------------------------------

test.before(async () => {
    await seedDoc(`alliances/${ALLIANCE_ID}/pending_updates/update_seeded`, {
        tokenId: TOKEN_ID,
        status: 'pending',
        proposedValues: { power: 3000, thp: 30000, troops: 'Tank' },
    });
});

test('pending_updates: alliance member can read pending_updates', async () => {
    const db = authedDb(MEMBER_UID);
    await assertSucceeds(
        db.doc(`alliances/${ALLIANCE_ID}/pending_updates/update_seeded`).get()
    );
});

test('pending_updates: alliance member can update pending_updates (approve)', async () => {
    const db = authedDb(MEMBER_UID);
    await assertSucceeds(
        db.doc(`alliances/${ALLIANCE_ID}/pending_updates/update_seeded`).update({
            status: 'approved',
            reviewedBy: MEMBER_UID,
            reviewedAt: new Date(),
        })
    );
});

test('pending_updates: non-member CANNOT read pending_updates', async () => {
    const db = authedDb(OUTSIDER_UID);
    await assertFails(
        db.doc(`alliances/${ALLIANCE_ID}/pending_updates/update_seeded`).get()
    );
});

test('pending_updates: anonymous user CANNOT read pending_updates', async () => {
    const db = anonDb();
    await assertFails(
        db.doc(`alliances/${ALLIANCE_ID}/pending_updates/update_seeded`).get()
    );
});

test('pending_updates: unauthenticated user CANNOT read pending_updates', async () => {
    const db = unauthDb();
    await assertFails(
        db.doc(`alliances/${ALLIANCE_ID}/pending_updates/update_seeded`).get()
    );
});
