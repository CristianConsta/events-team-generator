'use strict';

/**
 * migrate-to-game-scoped-paths.js
 *
 * Migrates Firestore data from legacy user-scoped paths to game-scoped paths.
 * This is migration version 2.
 *
 * Usage:
 *   node scripts/migrate-to-game-scoped-paths.js [--service-account PATH] [--dry-run] [--limit N] [--help]
 *
 * Options:
 *   --service-account, -s   Path to service account JSON
 *                           (or set GOOGLE_APPLICATION_CREDENTIALS env var)
 *   --dry-run               Log what would be written; no Firestore writes (default)
 *   --apply                 Perform actual Firestore writes
 *   --limit N               Stop after N user docs (for testing)
 *   --help, -h              Show help
 *
 * Migration steps:
 *   A: users/{uid}/games/{gameId} fields → games/{gameId}/user_state/{uid}
 *   B: users/{uid}/games/{gameId}/players/{docId} → games/{gameId}/soloplayers/{uid}/players/{docId}
 *   C: users/{uid}/games/{gameId}/events/{eventId} → games/{gameId}/events/{eventId} (first-write wins)
 *   D: games/{gameId}/alliances/{allianceId}.playerDatabase map → games/{gameId}/alliances/{allianceId}/alliance_players/{docId}
 *   E: alliances/{allianceId}/event_history/{historyId} → games/{gameId}/event_history/{historyId}
 *   F: alliances/{allianceId}/update_tokens/ and pending_updates/ → games/{gameId}/alliances/{allianceId}/...
 *   G: users/{uid}/update_tokens/ and pending_updates/ → games/{gameId}/soloplayers/{uid}/...
 *   H: Write migrationVersion = 2 marker on users/{uid}
 */

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const BATCH_SIZE = 400;
const MIGRATION_VERSION = 2;
const USER_STATE_SUBCOLLECTION = 'user_state';
const SOLOPLAYERS_SUBCOLLECTION = 'soloplayers';
const ALLIANCE_PLAYERS_SUBCOLLECTION = 'alliance_players';
const EVENT_HISTORY_SUBCOLLECTION = 'event_history';
const UPDATE_TOKENS_SUBCOLLECTION = 'update_tokens';
const PENDING_UPDATES_SUBCOLLECTION = 'pending_updates';

// ---------------------------------------------------------------------------
// CLI arg parsing
// ---------------------------------------------------------------------------

function usage() {
    console.log('Usage:');
    console.log('  node scripts/migrate-to-game-scoped-paths.js [options]');
    console.log('');
    console.log('Options:');
    console.log('  --service-account, -s   Path to service account JSON');
    console.log('                          (or set GOOGLE_APPLICATION_CREDENTIALS)');
    console.log('  --dry-run               Log writes, no Firestore changes (default)');
    console.log('  --apply                 Perform actual Firestore writes');
    console.log('  --limit N               Stop after N user docs');
    console.log('  --help, -h              Show this help');
}

function parseArgs(argv) {
    const args = {
        serviceAccount: null,
        dryRun: true,
        limit: null,
    };

    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--service-account' || arg === '-s') {
            args.serviceAccount = argv[i + 1];
            i += 1;
        } else if (arg === '--dry-run') {
            args.dryRun = true;
        } else if (arg === '--apply') {
            args.dryRun = false;
        } else if (arg === '--limit') {
            args.limit = Number(argv[i + 1]);
            i += 1;
        } else if (arg === '--help' || arg === '-h') {
            usage();
            process.exit(0);
        } else if (!arg.startsWith('-') && !args.serviceAccount) {
            args.serviceAccount = arg;
        } else {
            console.error(`Unknown argument: ${arg}`);
            usage();
            process.exit(1);
        }
    }

    return args;
}

// ---------------------------------------------------------------------------
// Stable doc ID — replicates firebase-module.js createStableDocId / getPlayerDocId
// ---------------------------------------------------------------------------

function createStableDocId(rawValue, prefix) {
    const raw = typeof rawValue === 'string' ? rawValue.trim() : '';
    const base = raw
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 72);
    let hash = 0;
    for (let index = 0; index < raw.length; index += 1) {
        hash = ((hash << 5) - hash) + raw.charCodeAt(index);
        hash |= 0;
    }
    const hashPart = Math.abs(hash).toString(36);
    return `${base || (prefix || 'doc')}_${hashPart}`;
}

function getPlayerDocId(playerName) {
    return createStableDocId(playerName, 'player');
}

// ---------------------------------------------------------------------------
// Batch helpers
// ---------------------------------------------------------------------------

/**
 * Commits pending operations in chunks respecting BATCH_SIZE.
 * `ops` is an array of { ref, data, type } where type is 'set' | 'set-merge' | 'delete'.
 */
async function commitOps(db, ops, dryRun, label) {
    if (ops.length === 0) {
        return;
    }

    if (dryRun) {
        console.log(`  [DRY-RUN] ${label}: would write/delete ${ops.length} document(s)`);
        for (const op of ops) {
            if (op.type === 'delete') {
                console.log(`    DELETE ${op.ref.path}`);
            } else {
                console.log(`    SET${op.type === 'set-merge' ? ' (merge)' : ''} ${op.ref.path}`);
            }
        }
        return;
    }

    let committed = 0;
    while (committed < ops.length) {
        const chunk = ops.slice(committed, committed + BATCH_SIZE);
        const batch = db.batch();
        for (const op of chunk) {
            if (op.type === 'delete') {
                batch.delete(op.ref);
            } else if (op.type === 'set-merge') {
                batch.set(op.ref, op.data, { merge: true });
            } else {
                batch.set(op.ref, op.data);
            }
        }
        await batch.commit();
        committed += chunk.length;
    }

    console.log(`  ${label}: wrote/deleted ${ops.length} document(s)`);
}

// ---------------------------------------------------------------------------
// Step A: Migrate per-user per-game state
//   users/{uid}/games/{gameId} → games/{gameId}/user_state/{uid}
// ---------------------------------------------------------------------------

async function migrateUserGameState(db, uid, userGameDocs, dryRun) {
    const ops = [];

    for (const gameDoc of userGameDocs) {
        const gameId = gameDoc.id;
        const data = gameDoc.data() || {};
        const stateFields = {};

        const STATE_FIELDS = ['userProfile', 'playerSource', 'allianceId', 'allianceName'];
        for (const field of STATE_FIELDS) {
            if (Object.prototype.hasOwnProperty.call(data, field)) {
                stateFields[field] = data[field];
            }
        }

        if (Object.keys(stateFields).length === 0) {
            console.log(`  [A] uid=${uid} gameId=${gameId}: no state fields to migrate`);
            continue;
        }

        const destRef = db
            .collection('games').doc(gameId)
            .collection(USER_STATE_SUBCOLLECTION).doc(uid);

        ops.push({ ref: destRef, data: stateFields, type: 'set-merge' });
        console.log(`  [A] uid=${uid} gameId=${gameId}: queued user_state with fields [${Object.keys(stateFields).join(', ')}]`);
    }

    await commitOps(db, ops, dryRun, `Step A (uid=${uid})`);
}

// ---------------------------------------------------------------------------
// Step B: Migrate personal players
//   users/{uid}/games/{gameId}/players/{docId} → games/{gameId}/soloplayers/{uid}/players/{docId}
// ---------------------------------------------------------------------------

async function migratePersonalPlayers(db, uid, userGameDocs, dryRun) {
    const ops = [];

    for (const gameDoc of userGameDocs) {
        const gameId = gameDoc.id;
        const playersSnap = await gameDoc.ref.collection('players').get();

        if (playersSnap.empty) {
            console.log(`  [B] uid=${uid} gameId=${gameId}: no personal players`);
            continue;
        }

        for (const playerDoc of playersSnap.docs) {
            const destRef = db
                .collection('games').doc(gameId)
                .collection(SOLOPLAYERS_SUBCOLLECTION).doc(uid)
                .collection('players').doc(playerDoc.id);

            ops.push({ ref: destRef, data: playerDoc.data(), type: 'set-merge' });
        }

        console.log(`  [B] uid=${uid} gameId=${gameId}: queued ${playersSnap.size} personal player(s)`);
    }

    await commitOps(db, ops, dryRun, `Step B (uid=${uid})`);
}

// ---------------------------------------------------------------------------
// Step C: Migrate personal events
//   users/{uid}/games/{gameId}/events/{eventId} → games/{gameId}/events/{eventId} (first-write wins)
// ---------------------------------------------------------------------------

async function migratePersonalEvents(db, uid, userGameDocs, dryRun) {
    const ops = [];

    for (const gameDoc of userGameDocs) {
        const gameId = gameDoc.id;
        const eventsSnap = await gameDoc.ref.collection('events').get();

        if (eventsSnap.empty) {
            console.log(`  [C] uid=${uid} gameId=${gameId}: no personal events`);
            continue;
        }

        for (const eventDoc of eventsSnap.docs) {
            const destRef = db
                .collection('games').doc(gameId)
                .collection('events').doc(eventDoc.id);

            // First-write wins: only set if destination does not already exist.
            if (!dryRun) {
                const existing = await destRef.get();
                if (existing.exists) {
                    console.log(`  [C] uid=${uid} gameId=${gameId} eventId=${eventDoc.id}: destination exists, skipping`);
                    continue;
                }
            }

            ops.push({ ref: destRef, data: eventDoc.data(), type: 'set' });
        }

        console.log(`  [C] uid=${uid} gameId=${gameId}: queued ${eventsSnap.size} personal event(s)`);
    }

    await commitOps(db, ops, dryRun, `Step C (uid=${uid})`);
}

// ---------------------------------------------------------------------------
// Step C2: Migrate personal event media
//   users/{uid}/games/{gameId}/event_media/{eventId} → games/{gameId}/events/{eventId} (merge media fields)
// ---------------------------------------------------------------------------

async function migratePersonalEventMedia(db, uid, userGameDocs, dryRun) {
    const ops = [];

    for (const gameDoc of userGameDocs) {
        const gameId = gameDoc.id;
        const mediaSnap = await gameDoc.ref.collection('event_media').get();

        if (mediaSnap.empty) {
            continue;
        }

        for (const mediaDoc of mediaSnap.docs) {
            const data = mediaDoc.data() || {};
            const logoDataUrl = typeof data.logoDataUrl === 'string' ? data.logoDataUrl : '';
            const mapDataUrl = typeof data.mapDataUrl === 'string' ? data.mapDataUrl : '';
            if (!logoDataUrl && !mapDataUrl) {
                continue;
            }

            const destRef = db
                .collection('games').doc(gameId)
                .collection('events').doc(mediaDoc.id);

            // Merge media fields onto the game-scoped event doc
            ops.push({
                ref: destRef,
                data: { logoDataUrl, mapDataUrl },
                type: 'set-merge',
            });
        }

        if (mediaSnap.size > 0) {
            console.log(`  [C2] uid=${uid} gameId=${gameId}: queued ${mediaSnap.size} event media doc(s)`);
        }
    }

    await commitOps(db, ops, dryRun, `Step C2 (uid=${uid})`);
}

// ---------------------------------------------------------------------------
// Step D: Migrate alliance player DB map → subcollection
//   games/{gameId}/alliances/{allianceId}.playerDatabase → games/{gameId}/alliances/{allianceId}/alliance_players/{docId}
// ---------------------------------------------------------------------------

async function migrateAlliancePlayerDatabases(db, dryRun) {
    console.log('\n[Step D] Migrating alliance playerDatabase maps → subcollections...');

    const gamesSnap = await db.collection('games').get();
    let totalAlliances = 0;
    let totalPlayers = 0;

    for (const gameDoc of gamesSnap.docs) {
        const gameId = gameDoc.id;
        const alliancesSnap = await gameDoc.ref.collection('alliances').get();

        for (const allianceDoc of alliancesSnap.docs) {
            const allianceId = allianceDoc.id;
            const data = allianceDoc.data() || {};
            const playerDatabase = data.playerDatabase;

            if (!playerDatabase || typeof playerDatabase !== 'object' || Array.isArray(playerDatabase)) {
                console.log(`  [D] gameId=${gameId} allianceId=${allianceId}: no playerDatabase map, skipping`);
                continue;
            }

            const playerNames = Object.keys(playerDatabase);
            if (playerNames.length === 0) {
                console.log(`  [D] gameId=${gameId} allianceId=${allianceId}: playerDatabase is empty, skipping`);
                continue;
            }

            const ops = [];
            const alliancePlayersRef = allianceDoc.ref.collection(ALLIANCE_PLAYERS_SUBCOLLECTION);

            for (const playerName of playerNames) {
                const playerData = playerDatabase[playerName];
                if (!playerData || typeof playerData !== 'object') {
                    console.log(`  [D] gameId=${gameId} allianceId=${allianceId} player=${playerName}: invalid data, skipping`);
                    continue;
                }

                const docId = getPlayerDocId(playerName);
                const docData = Object.assign({}, playerData, { name: playerData.name || playerName });
                ops.push({ ref: alliancePlayersRef.doc(docId), data: docData, type: 'set-merge' });
            }

            await commitOps(db, ops, dryRun, `Step D (gameId=${gameId} allianceId=${allianceId}, ${playerNames.length} players)`);

            // Optionally clear the playerDatabase map field after successful write.
            if (!dryRun && ops.length > 0) {
                await allianceDoc.ref.update({
                    playerDatabase: admin.firestore.FieldValue.delete(),
                });
                console.log(`  [D] gameId=${gameId} allianceId=${allianceId}: cleared playerDatabase map field`);
            }

            totalAlliances += 1;
            totalPlayers += playerNames.length;
        }
    }

    console.log(`[Step D] Done. alliances=${totalAlliances}, players migrated=${totalPlayers}`);
}

// ---------------------------------------------------------------------------
// Step E: Migrate alliance event history
//   alliances/{allianceId}/event_history/{historyId} → games/{gameId}/event_history/{historyId}
// ---------------------------------------------------------------------------

async function migrateAllianceEventHistory(db, dryRun) {
    console.log('\n[Step E] Migrating alliance event_history → game-scoped event_history...');

    const alliancesSnap = await db.collection('alliances').get();
    let totalDocs = 0;

    for (const allianceDoc of alliancesSnap.docs) {
        const allianceId = allianceDoc.id;
        const allianceData = allianceDoc.data() || {};
        const gameId = allianceData.gameId;

        if (!gameId) {
            console.log(`  [E] allianceId=${allianceId}: no gameId on alliance doc, skipping event_history`);
            continue;
        }

        const historySnap = await allianceDoc.ref.collection(EVENT_HISTORY_SUBCOLLECTION).get();
        if (historySnap.empty) {
            console.log(`  [E] allianceId=${allianceId}: no event_history docs`);
            continue;
        }

        const ops = [];
        for (const historyDoc of historySnap.docs) {
            const destRef = db
                .collection('games').doc(gameId)
                .collection(EVENT_HISTORY_SUBCOLLECTION).doc(historyDoc.id);

            ops.push({ ref: destRef, data: historyDoc.data(), type: 'set-merge' });

            // Also migrate player_stats sub-subcollection if present.
            const playerStatsSnap = await historyDoc.ref.collection('player_stats').get();
            for (const statsDoc of playerStatsSnap.docs) {
                const statsDestRef = destRef.collection('player_stats').doc(statsDoc.id);
                ops.push({ ref: statsDestRef, data: statsDoc.data(), type: 'set-merge' });
            }
        }

        await commitOps(db, ops, dryRun, `Step E (allianceId=${allianceId} gameId=${gameId}, ${historySnap.size} history doc(s))`);
        totalDocs += historySnap.size;
    }

    console.log(`[Step E] Done. event_history docs migrated=${totalDocs}`);
}

// ---------------------------------------------------------------------------
// Step F: Migrate alliance update_tokens and pending_updates
//   alliances/{allianceId}/update_tokens/{tokenId} → games/{gameId}/alliances/{allianceId}/update_tokens/{tokenId}
//   alliances/{allianceId}/pending_updates/{updateId} → games/{gameId}/alliances/{allianceId}/pending_updates/{updateId}
// ---------------------------------------------------------------------------

async function migrateAllianceTokensAndPending(db, dryRun) {
    console.log('\n[Step F] Migrating alliance update_tokens and pending_updates...');

    const alliancesSnap = await db.collection('alliances').get();
    let totalTokens = 0;
    let totalPending = 0;

    for (const allianceDoc of alliancesSnap.docs) {
        const allianceId = allianceDoc.id;
        const allianceData = allianceDoc.data() || {};
        const gameId = allianceData.gameId;

        if (!gameId) {
            console.log(`  [F] allianceId=${allianceId}: no gameId, skipping tokens/pending`);
            continue;
        }

        const destAllianceRef = db
            .collection('games').doc(gameId)
            .collection('alliances').doc(allianceId);

        // update_tokens
        const tokensSnap = await allianceDoc.ref.collection(UPDATE_TOKENS_SUBCOLLECTION).get();
        if (!tokensSnap.empty) {
            const ops = tokensSnap.docs.map((doc) => ({
                ref: destAllianceRef.collection(UPDATE_TOKENS_SUBCOLLECTION).doc(doc.id),
                data: doc.data(),
                type: 'set-merge',
            }));
            await commitOps(db, ops, dryRun, `Step F tokens (allianceId=${allianceId} gameId=${gameId}, ${tokensSnap.size} doc(s))`);
            totalTokens += tokensSnap.size;
        } else {
            console.log(`  [F] allianceId=${allianceId}: no update_tokens`);
        }

        // pending_updates
        const pendingSnap = await allianceDoc.ref.collection(PENDING_UPDATES_SUBCOLLECTION).get();
        if (!pendingSnap.empty) {
            const ops = pendingSnap.docs.map((doc) => ({
                ref: destAllianceRef.collection(PENDING_UPDATES_SUBCOLLECTION).doc(doc.id),
                data: doc.data(),
                type: 'set-merge',
            }));
            await commitOps(db, ops, dryRun, `Step F pending (allianceId=${allianceId} gameId=${gameId}, ${pendingSnap.size} doc(s))`);
            totalPending += pendingSnap.size;
        } else {
            console.log(`  [F] allianceId=${allianceId}: no pending_updates`);
        }
    }

    console.log(`[Step F] Done. tokens=${totalTokens}, pending=${totalPending}`);
}

// ---------------------------------------------------------------------------
// Step G: Migrate personal update_tokens and pending_updates
//   users/{uid}/update_tokens/{tokenId} → games/{gameId}/soloplayers/{uid}/update_tokens/{tokenId}
//   users/{uid}/pending_updates/{updateId} → games/{gameId}/soloplayers/{uid}/pending_updates/{updateId}
//
// gameId is determined from the token/update doc's `gameId` field, or from the
// user's active game (last game in users/{uid}/games/ subcollection).
// ---------------------------------------------------------------------------

async function migratePersonalTokensAndPending(db, uid, userGameDocs, dryRun) {
    // Build a fallback gameId — use the first game the user has, preferring last_war.
    let fallbackGameId = null;
    for (const gd of userGameDocs) {
        if (gd.id === 'last_war') {
            fallbackGameId = 'last_war';
            break;
        }
    }
    if (!fallbackGameId && userGameDocs.length > 0) {
        fallbackGameId = userGameDocs[0].id;
    }

    const userRef = db.collection('users').doc(uid);

    // update_tokens
    const tokensSnap = await userRef.collection(UPDATE_TOKENS_SUBCOLLECTION).get();
    if (!tokensSnap.empty) {
        const ops = [];
        for (const tokenDoc of tokensSnap.docs) {
            const tokenData = tokenDoc.data() || {};
            const gameId = tokenData.gameId || fallbackGameId;
            if (!gameId) {
                console.log(`  [G] uid=${uid} tokenId=${tokenDoc.id}: no gameId, skipping`);
                continue;
            }
            const destRef = db
                .collection('games').doc(gameId)
                .collection(SOLOPLAYERS_SUBCOLLECTION).doc(uid)
                .collection(UPDATE_TOKENS_SUBCOLLECTION).doc(tokenDoc.id);
            ops.push({ ref: destRef, data: tokenData, type: 'set-merge' });
        }
        await commitOps(db, ops, dryRun, `Step G tokens (uid=${uid}, ${tokensSnap.size} doc(s))`);
    } else {
        console.log(`  [G] uid=${uid}: no personal update_tokens`);
    }

    // pending_updates
    const pendingSnap = await userRef.collection(PENDING_UPDATES_SUBCOLLECTION).get();
    if (!pendingSnap.empty) {
        const ops = [];
        for (const pendingDoc of pendingSnap.docs) {
            const pendingData = pendingDoc.data() || {};
            const gameId = pendingData.gameId || fallbackGameId;
            if (!gameId) {
                console.log(`  [G] uid=${uid} pendingId=${pendingDoc.id}: no gameId, skipping`);
                continue;
            }
            const destRef = db
                .collection('games').doc(gameId)
                .collection(SOLOPLAYERS_SUBCOLLECTION).doc(uid)
                .collection(PENDING_UPDATES_SUBCOLLECTION).doc(pendingDoc.id);
            ops.push({ ref: destRef, data: pendingData, type: 'set-merge' });
        }
        await commitOps(db, ops, dryRun, `Step G pending (uid=${uid}, ${pendingSnap.size} doc(s))`);
    } else {
        console.log(`  [G] uid=${uid}: no personal pending_updates`);
    }
}

// ---------------------------------------------------------------------------
// Step H: Write migration marker
//   users/{uid}.migrationVersion = 2
// ---------------------------------------------------------------------------

async function writeMigrationMarker(db, uid, dryRun) {
    const markerData = {
        migrationVersion: MIGRATION_VERSION,
        migratedToNewGamePathsAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (dryRun) {
        console.log(`  [H] [DRY-RUN] Would write migration marker to users/${uid}`);
        return;
    }

    await db.collection('users').doc(uid).set(markerData, { merge: true });
    console.log(`  [H] Wrote migration marker to users/${uid} (migrationVersion=${MIGRATION_VERSION})`);
}

// ---------------------------------------------------------------------------
// Step I: Migrate root alliance docs → game-scoped alliance docs
//   alliances/{allianceId} → games/{gameId}/alliances/{allianceId}
//   Only copies if game-scoped doc does NOT already exist or is missing members.
// ---------------------------------------------------------------------------

async function migrateRootAllianceDocs(db, dryRun) {
    console.log('\n[Step I] Migrating root alliance docs → game-scoped alliances...');

    const alliancesSnap = await db.collection('alliances').get();
    let migrated = 0;
    let skipped = 0;

    for (const allianceDoc of alliancesSnap.docs) {
        const allianceId = allianceDoc.id;
        const data = allianceDoc.data() || {};
        const gameId = data.gameId;

        if (!gameId) {
            console.log(`  [I] allianceId=${allianceId}: no gameId on root doc, skipping`);
            skipped += 1;
            continue;
        }

        const destRef = db.collection('games').doc(gameId)
            .collection('alliances').doc(allianceId);

        // Check if game-scoped doc already has data
        const destSnap = await destRef.get();
        if (destSnap.exists) {
            const destData = destSnap.data() || {};
            if (destData.members && typeof destData.members === 'object' && Object.keys(destData.members).length > 0) {
                console.log(`  [I] allianceId=${allianceId}: game-scoped doc already has members, skipping`);
                skipped += 1;
                continue;
            }
        }

        // Copy root doc data (members, name, metadata, etc.) to game-scoped path
        const ops = [{ ref: destRef, data: data, type: 'set-merge' }];
        await commitOps(db, ops, dryRun, `Step I (allianceId=${allianceId} → games/${gameId}/alliances/${allianceId})`);
        migrated += 1;
    }

    console.log(`[Step I] Done. migrated=${migrated}, skipped=${skipped}`);
}

// ---------------------------------------------------------------------------
// Step J: Migrate root invitations → game-scoped alliance invitations
//   invitations/{invitationId} → games/{gameId}/alliances/{allianceId}/invitations/{invitationId}
// ---------------------------------------------------------------------------

async function migrateRootInvitations(db, dryRun) {
    console.log('\n[Step J] Migrating root invitations → alliance-scoped invitations...');

    const invitationsSnap = await db.collection('invitations').get();
    if (invitationsSnap.empty) {
        console.log('  [J] No root invitations found');
        return;
    }

    let migrated = 0;
    let skipped = 0;
    const ops = [];

    for (const invDoc of invitationsSnap.docs) {
        const data = invDoc.data() || {};
        const gameId = data.gameId;
        const invAllianceId = data.allianceId;

        if (!gameId || !invAllianceId) {
            console.log(`  [J] invitationId=${invDoc.id}: missing gameId or allianceId, skipping`);
            skipped += 1;
            continue;
        }

        const destRef = db.collection('games').doc(gameId)
            .collection('alliances').doc(invAllianceId)
            .collection('invitations').doc(invDoc.id);

        ops.push({ ref: destRef, data: data, type: 'set-merge' });
        migrated += 1;
    }

    await commitOps(db, ops, dryRun, `Step J (${migrated} invitation(s))`);
    console.log(`[Step J] Done. migrated=${migrated}, skipped=${skipped}`);
}

// ---------------------------------------------------------------------------
// Per-user migration orchestration
// ---------------------------------------------------------------------------

async function migrateUser(db, userDoc, dryRun) {
    const uid = userDoc.id;
    const userData = userDoc.data() || {};

    // Idempotency check
    const existingVersion = typeof userData.migrationVersion === 'number' ? userData.migrationVersion : 0;
    if (existingVersion >= MIGRATION_VERSION) {
        console.log(`  uid=${uid}: already at migrationVersion=${existingVersion}, skipping`);
        return { skipped: true };
    }

    console.log(`\n--- Migrating uid=${uid} (current migrationVersion=${existingVersion}) ---`);

    // Fetch all game sub-docs for this user
    const gamesSnap = await userDoc.ref.collection('games').get();
    const userGameDocs = gamesSnap.docs;

    if (userGameDocs.length === 0) {
        console.log(`  uid=${uid}: no games subcollection docs found`);
    }

    try {
        // Step A: user state
        await migrateUserGameState(db, uid, userGameDocs, dryRun);

        // Step B: personal players
        await migratePersonalPlayers(db, uid, userGameDocs, dryRun);

        // Step C: personal events
        await migratePersonalEvents(db, uid, userGameDocs, dryRun);

        // Step C2: personal event media → merge into game-scoped event docs
        await migratePersonalEventMedia(db, uid, userGameDocs, dryRun);

        // Step G: personal tokens and pending (D, E, F run globally after all users)
        await migratePersonalTokensAndPending(db, uid, userGameDocs, dryRun);

        // Step H: migration marker
        await writeMigrationMarker(db, uid, dryRun);
    } catch (err) {
        console.error(`  ERROR migrating uid=${uid}:`, err.message || err);
        return { error: true };
    }

    return { migrated: true };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
    const args = parseArgs(process.argv.slice(2));

    const servicePath = args.serviceAccount || process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!servicePath) {
        console.error('Error: service account path required via --service-account or GOOGLE_APPLICATION_CREDENTIALS env var');
        usage();
        process.exit(1);
    }

    const resolvedPath = path.resolve(servicePath);
    if (!fs.existsSync(resolvedPath)) {
        console.error(`Service account file not found: ${resolvedPath}`);
        process.exit(1);
    }

    const serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
    const projectId = serviceAccount.project_id;
    if (!projectId) {
        console.error('project_id missing from service account file');
        process.exit(1);
    }

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId,
    });

    const db = admin.firestore();

    const mode = args.dryRun ? 'DRY-RUN' : 'APPLY';
    console.log(`=== migrate-to-game-scoped-paths (v${MIGRATION_VERSION}) ===`);
    console.log(`Mode: ${mode}`);
    console.log(`Project: ${projectId}`);
    if (args.limit) {
        console.log(`Limit: ${args.limit} users`);
    }
    console.log('');

    // --- Per-user steps (A, B, C, G, H) ---

    console.log('[Steps A/B/C/G/H] Processing users collection...\n');

    let scanned = 0;
    let migrated = 0;
    let skipped = 0;
    let errors = 0;
    let lastDoc = null;

    while (true) {
        let query = db.collection('users')
            .orderBy(admin.firestore.FieldPath.documentId())
            .limit(BATCH_SIZE);

        if (lastDoc) {
            query = query.startAfter(lastDoc);
        }

        const snapshot = await query.get();
        if (snapshot.empty) {
            break;
        }

        for (const userDoc of snapshot.docs) {
            if (args.limit !== null && scanned >= args.limit) {
                break;
            }

            scanned += 1;
            const result = await migrateUser(db, userDoc, args.dryRun);

            if (result.skipped) {
                skipped += 1;
            } else if (result.error) {
                errors += 1;
            } else {
                migrated += 1;
            }
        }

        lastDoc = snapshot.docs[snapshot.docs.length - 1];

        if (args.limit !== null && scanned >= args.limit) {
            break;
        }
    }

    // --- Global steps (D, E, F) — run after all users ---

    await migrateAlliancePlayerDatabases(db, args.dryRun);
    await migrateAllianceEventHistory(db, args.dryRun);
    await migrateAllianceTokensAndPending(db, args.dryRun);
    await migrateRootAllianceDocs(db, args.dryRun);
    await migrateRootInvitations(db, args.dryRun);

    // --- Summary ---

    console.log('\n=== Summary ===');
    console.log(`Users scanned:  ${scanned}`);
    console.log(`Users migrated: ${migrated}`);
    console.log(`Users skipped (already at v${MIGRATION_VERSION}): ${skipped}`);
    console.log(`Users with errors: ${errors}`);
    console.log('');

    if (args.dryRun) {
        console.log('DRY-RUN complete. No data was written. Re-run with --apply to perform writes.');
    } else {
        console.log('Migration complete.');
    }

    if (errors > 0) {
        process.exit(1);
    }
}

if (require.main === module) {
    main().catch((err) => {
        console.error('Fatal error:', err);
        process.exit(1);
    });
}

module.exports = {
    createStableDocId,
    getPlayerDocId,
    parseArgs,
};
