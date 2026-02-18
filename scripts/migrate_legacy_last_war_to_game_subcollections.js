const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const DEFAULT_BATCH_SIZE = 200;
const DEFAULT_GAME_ID = 'last_war';
const USER_GAMES_SUBCOLLECTION = 'games';
const COPY_FIELDS = [
    'playerDatabase',
    'events',
    'userProfile',
    'playerSource',
    'allianceId',
    'allianceName',
];

function usage() {
    console.log('Usage:');
    console.log('  node scripts/migrate_legacy_last_war_to_game_subcollections.js --service-account PATH [--project-id PROJECT_ID] [--apply] [--batch-size N] [--limit N]');
    console.log('');
    console.log('Options:');
    console.log('  --service-account, -s   Path to service account JSON (or set FIREBASE_SERVICE_ACCOUNT)');
    console.log('  --project-id, -p        Firebase project ID (optional if in service account)');
    console.log(`  --batch-size            Batch size for paging (default ${DEFAULT_BATCH_SIZE})`);
    console.log('  --limit                 Stop after N user docs (for testing)');
    console.log('  --apply                 Perform writes (default dry-run)');
    console.log('  --help, -h              Show help');
}

function parseArgs(argv) {
    const args = {
        batchSize: DEFAULT_BATCH_SIZE,
        limit: null,
        apply: false,
    };

    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--service-account' || arg === '-s') {
            args.serviceAccount = argv[i + 1];
            i += 1;
        } else if (arg === '--project-id' || arg === '-p') {
            args.projectId = argv[i + 1];
            i += 1;
        } else if (arg === '--batch-size') {
            args.batchSize = Number(argv[i + 1]);
            i += 1;
        } else if (arg === '--limit') {
            args.limit = Number(argv[i + 1]);
            i += 1;
        } else if (arg === '--apply') {
            args.apply = true;
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

function isNonEmptyObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0;
}

function shouldCopyField(field, legacyData, gameData) {
    if (!Object.prototype.hasOwnProperty.call(legacyData, field)) {
        return false;
    }
    const legacyValue = legacyData[field];
    const gameValue = gameData[field];
    if (gameValue === undefined || gameValue === null || gameValue === '') {
        return true;
    }
    if (isNonEmptyObject(legacyValue) && !isNonEmptyObject(gameValue)) {
        return true;
    }
    return false;
}

function buildGamePatch(legacyData, currentGameData) {
    const source = legacyData && typeof legacyData === 'object' ? legacyData : {};
    const gameData = currentGameData && typeof currentGameData === 'object' ? currentGameData : {};
    const patch = {};

    COPY_FIELDS.forEach((field) => {
        if (shouldCopyField(field, source, gameData)) {
            patch[field] = source[field];
        }
    });

    if (Object.keys(patch).length > 0) {
        patch.metadata = {
            migratedFromLegacyRootAt: admin.firestore.FieldValue.serverTimestamp(),
            lastModified: admin.firestore.FieldValue.serverTimestamp(),
        };
    }

    return patch;
}

function hasLegacyPayload(data) {
    if (!data || typeof data !== 'object') {
        return false;
    }
    return COPY_FIELDS.some((field) => Object.prototype.hasOwnProperty.call(data, field));
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const servicePath = args.serviceAccount || process.env.FIREBASE_SERVICE_ACCOUNT;

    if (!servicePath) {
        usage();
        process.exit(1);
    }
    if (!Number.isFinite(args.batchSize) || args.batchSize <= 0) {
        console.error('Invalid --batch-size');
        process.exit(1);
    }

    const resolvedPath = path.resolve(servicePath);
    if (!fs.existsSync(resolvedPath)) {
        console.error(`Service account file not found: ${resolvedPath}`);
        process.exit(1);
    }

    const serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
    const projectId = args.projectId || serviceAccount.project_id;
    if (!projectId) {
        console.error('Project ID is required (use --project-id or include project_id in service account).');
        process.exit(1);
    }

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId,
    });

    const db = admin.firestore();
    console.log(args.apply ? 'Running in APPLY mode' : 'Running in DRY-RUN mode');
    console.log(`Project: ${projectId}`);

    let scanned = 0;
    let usersWithLegacyData = 0;
    let usersAlreadyNative = 0;
    let usersToMigrate = 0;
    let migrated = 0;
    let lastDoc = null;

    while (true) {
        let query = db.collection('users')
            .orderBy(admin.firestore.FieldPath.documentId())
            .limit(args.batchSize);
        if (lastDoc) {
            query = query.startAfter(lastDoc);
        }

        const snapshot = await query.get();
        if (snapshot.empty) {
            break;
        }

        for (const userDoc of snapshot.docs) {
            if (args.limit && scanned >= args.limit) {
                break;
            }

            scanned += 1;
            const legacyData = userDoc.data() || {};
            if (!hasLegacyPayload(legacyData)) {
                continue;
            }
            usersWithLegacyData += 1;

            const gameRef = userDoc.ref.collection(USER_GAMES_SUBCOLLECTION).doc(DEFAULT_GAME_ID);
            const gameSnap = await gameRef.get();
            const gameData = gameSnap.exists ? (gameSnap.data() || {}) : {};
            const patch = buildGamePatch(legacyData, gameData);

            if (Object.keys(patch).length === 0) {
                usersAlreadyNative += 1;
                continue;
            }

            usersToMigrate += 1;

            if (args.apply) {
                await gameRef.set(patch, { merge: true });
                await userDoc.ref.set({
                    migrationVersion: 1,
                    migratedToGameSubcollectionsAt: admin.firestore.FieldValue.serverTimestamp(),
                    lastActiveGameId: DEFAULT_GAME_ID,
                }, { merge: true });
                migrated += 1;
            }
        }

        lastDoc = snapshot.docs[snapshot.docs.length - 1];
        if (args.limit && scanned >= args.limit) {
            break;
        }
    }

    console.log('--- Summary ---');
    console.log(`Users scanned: ${scanned}`);
    console.log(`Users with legacy payload: ${usersWithLegacyData}`);
    console.log(`Users already native/no-op: ${usersAlreadyNative}`);
    console.log(`Users ${args.apply ? 'migrated' : 'to migrate'}: ${args.apply ? migrated : usersToMigrate}`);
    console.log(args.apply ? 'Migration complete.' : 'Dry-run complete. Use --apply to perform writes.');
}

if (require.main === module) {
    main().catch((error) => {
        console.error('Migration failed:', error);
        process.exit(1);
    });
}

module.exports = {
    parseArgs,
    buildGamePatch,
    hasLegacyPayload,
    shouldCopyField,
};
