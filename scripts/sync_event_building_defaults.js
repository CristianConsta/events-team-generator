const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const DEFAULT_SOURCE_EMAIL = 'constantinescu.cristian@gmail.com';
const DEFAULT_EVENT_ID = 'canyon_battlefield';
const DEFAULT_BATCH_SIZE = 250;
const APP_CONFIG_COLLECTION = 'app_config';
const GLOBAL_BUILDING_CONFIG_DOC_ID = 'default_event_building_config';

function usage() {
    console.log('Usage:');
    console.log('  node scripts/sync_event_building_defaults.js --service-account PATH --project-id PROJECT_ID [options]');
    console.log('');
    console.log('Options:');
    console.log('  --service-account, -s   Path to service account JSON (or set FIREBASE_SERVICE_ACCOUNT)');
    console.log('  --project-id, -p        Firebase project ID (optional if present in service account)');
    console.log(`  --source-email          Source user email (default: ${DEFAULT_SOURCE_EMAIL})`);
    console.log('  --source-uid            Source user UID (optional; overrides email lookup when provided)');
    console.log(`  --event-id              Event id to sync (default: ${DEFAULT_EVENT_ID})`);
    console.log(`  --batch-size            Firestore page size (default: ${DEFAULT_BATCH_SIZE})`);
    console.log('  --limit                 Stop after N users (for testing)');
    console.log('  --apply                 Perform writes (default is dry-run)');
}

function parseArgs(argv) {
    const args = {
        sourceEmail: DEFAULT_SOURCE_EMAIL,
        sourceUid: '',
        eventId: DEFAULT_EVENT_ID,
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
        } else if (arg === '--source-email') {
            args.sourceEmail = argv[i + 1];
            i += 1;
        } else if (arg === '--source-uid') {
            args.sourceUid = argv[i + 1];
            i += 1;
        } else if (arg === '--event-id') {
            args.eventId = argv[i + 1];
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

function normalizeEventId(value) {
    if (typeof value !== 'string') {
        return '';
    }
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

function normalizeBuildingConfig(config) {
    if (!Array.isArray(config)) {
        return [];
    }
    return config
        .filter((item) => item && typeof item === 'object')
        .map((item) => {
            const name = typeof item.name === 'string' ? item.name.trim() : '';
            if (!name) {
                return null;
            }
            const label = typeof item.label === 'string' && item.label.trim() ? item.label.trim() : name;
            const slots = Number(item.slots);
            const priority = Number(item.priority);
            return {
                name: name,
                label: label,
                slots: Number.isFinite(slots) ? Math.round(slots) : 0,
                priority: Number.isFinite(priority) ? Math.round(priority) : 1,
            };
        })
        .filter(Boolean);
}

async function resolveSourceDocId({ db, auth, sourceEmail, sourceUid }) {
    const candidates = new Set();
    const normalizedEmail = typeof sourceEmail === 'string' ? sourceEmail.trim().toLowerCase() : '';

    if (sourceUid) {
        candidates.add(sourceUid);
    }

    if (normalizedEmail) {
        try {
            const userRecord = await auth.getUserByEmail(normalizedEmail);
            if (userRecord && userRecord.uid) {
                candidates.add(userRecord.uid);
            }
        } catch (error) {
            console.warn(`Source auth user not found for email: ${normalizedEmail}. Falling back to Firestore lookup.`);
        }

        candidates.add(normalizedEmail);
        candidates.add(sourceEmail);

        const byEmailLower = await db.collection('users')
            .where('metadata.emailLower', '==', normalizedEmail)
            .limit(1)
            .get();
        if (!byEmailLower.empty) {
            candidates.add(byEmailLower.docs[0].id);
        }

        const byEmail = await db.collection('users')
            .where('metadata.email', '==', sourceEmail)
            .limit(1)
            .get();
        if (!byEmail.empty) {
            candidates.add(byEmail.docs[0].id);
        }
    }

    for (const docId of candidates) {
        if (!docId) continue;
        const snap = await db.collection('users').doc(docId).get();
        if (snap.exists) {
            return docId;
        }
    }

    return '';
}

function readSourceEventConfig(sourceData, eventId) {
    const events = sourceData && sourceData.events && typeof sourceData.events === 'object' ? sourceData.events : {};
    const entry = events[eventId];
    if (!entry || typeof entry !== 'object') {
        return null;
    }
    const config = normalizeBuildingConfig(entry.buildingConfig);
    if (config.length === 0) {
        return null;
    }
    return config;
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const eventId = normalizeEventId(args.eventId);
    const servicePath = args.serviceAccount || process.env.FIREBASE_SERVICE_ACCOUNT;

    if (!servicePath) {
        usage();
        process.exit(1);
    }
    if (!eventId) {
        console.error('Invalid --event-id');
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
        projectId: projectId,
    });

    const db = admin.firestore();
    const auth = admin.auth();

    const sourceDocId = await resolveSourceDocId({
        db,
        auth,
        sourceEmail: args.sourceEmail,
        sourceUid: args.sourceUid,
    });

    if (!sourceDocId) {
        console.error(`Source user document not found for email=${args.sourceEmail || 'n/a'} uid=${args.sourceUid || 'n/a'}`);
        process.exit(1);
    }

    const sourceSnap = await db.collection('users').doc(sourceDocId).get();
    const sourceData = sourceSnap.data() || {};
    const sourceConfig = readSourceEventConfig(sourceData, eventId);
    if (!sourceConfig) {
        console.error(`Source user does not have a valid events.${eventId}.buildingConfig`);
        process.exit(1);
    }

    const version = Date.now();
    const sourceEmailNormalized = typeof args.sourceEmail === 'string' ? args.sourceEmail.trim().toLowerCase() : '';

    console.log(args.apply ? 'Running sync in APPLY mode' : 'Running sync in DRY-RUN mode');
    console.log(`Project: ${projectId}`);
    console.log(`Event: ${eventId}`);
    console.log(`Source user doc: ${sourceDocId}`);
    console.log(`Config entries: ${sourceConfig.length}`);

    if (args.apply) {
        await db.collection(APP_CONFIG_COLLECTION).doc(GLOBAL_BUILDING_CONFIG_DOC_ID).set({
            sourceEmail: sourceEmailNormalized || null,
            version: version,
            events: {
                [eventId]: sourceConfig,
            },
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        console.log(`Updated ${APP_CONFIG_COLLECTION}/${GLOBAL_BUILDING_CONFIG_DOC_ID}`);
    } else {
        console.log(`[Dry-run] Would update ${APP_CONFIG_COLLECTION}/${GLOBAL_BUILDING_CONFIG_DOC_ID}`);
    }

    let lastDoc = null;
    let scanned = 0;
    let updated = 0;

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

        const batch = db.batch();
        let batchOps = 0;

        for (const userDoc of snapshot.docs) {
            if (args.limit && scanned >= args.limit) {
                break;
            }
            scanned += 1;
            const payload = {};
            payload[`events.${eventId}.buildingConfig`] = sourceConfig;
            payload[`events.${eventId}.buildingConfigVersion`] = version;
            payload['metadata.lastModified'] = admin.firestore.FieldValue.serverTimestamp();

            if (args.apply) {
                batch.update(userDoc.ref, payload);
                batchOps += 1;
            }
            updated += 1;
        }

        if (args.apply && batchOps > 0) {
            await batch.commit();
        }

        lastDoc = snapshot.docs[snapshot.docs.length - 1];
        if (args.limit && scanned >= args.limit) {
            break;
        }
    }

    console.log('--- Summary ---');
    console.log(`Users scanned: ${scanned}`);
    console.log(`Users ${args.apply ? 'updated' : 'to update'}: ${updated}`);
    console.log(args.apply ? 'Sync complete.' : 'Dry-run complete. Use --apply to write changes.');
}

main().catch((error) => {
    console.error('Sync failed:', error);
    process.exit(1);
});
