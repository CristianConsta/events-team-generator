const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const DEFAULT_BATCH_SIZE = 250;
const DEFAULT_EVENT_ID = 'desert_storm';

function usage() {
    console.log('Usage:');
    console.log('  node scripts/migrate_legacy_building_fields_to_events.js --service-account PATH --project-id PROJECT_ID [--apply] [--batch-size N] [--limit N]');
    console.log('');
    console.log('Options:');
    console.log('  --service-account, -s   Path to service account JSON (or set FIREBASE_SERVICE_ACCOUNT)');
    console.log('  --project-id, -p        Firebase project ID (optional if present in service account)');
    console.log(`  --event-id              Target event id for legacy migration (default: ${DEFAULT_EVENT_ID})`);
    console.log(`  --batch-size            Firestore page size (default: ${DEFAULT_BATCH_SIZE})`);
    console.log('  --limit                 Stop after N documents (for testing)');
    console.log('  --apply                 Perform writes (default is dry-run)');
    console.log('  --help, -h              Show this help');
}

function parseArgs(argv) {
    const args = {
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

function normalizeBuildingConfigArray(config) {
    if (!Array.isArray(config)) {
        return null;
    }
    const normalized = [];
    config.forEach((item) => {
        if (!item || typeof item !== 'object') return;
        const name = typeof item.name === 'string' ? item.name.trim() : '';
        if (!name) return;
        const next = { name };
        if (typeof item.label === 'string' && item.label.trim()) {
            next.label = item.label.trim();
        }
        const slots = Number(item.slots);
        if (Number.isFinite(slots)) {
            next.slots = Math.round(slots);
        }
        const priority = Number(item.priority);
        if (Number.isFinite(priority)) {
            next.priority = Math.round(priority);
        }
        normalized.push(next);
    });
    return normalized.length > 0 ? normalized : null;
}

function normalizePositionsMap(positions) {
    const source = positions && typeof positions === 'object' ? positions : {};
    const normalized = {};
    Object.keys(source).forEach((name) => {
        const coords = source[name];
        if (!Array.isArray(coords) || coords.length !== 2) return;
        const x = Number(coords[0]);
        const y = Number(coords[1]);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        normalized[name] = [Math.round(x), Math.round(y)];
    });
    return normalized;
}

function hasLegacyFields(data) {
    if (!data || typeof data !== 'object') return false;
    return (
        Object.prototype.hasOwnProperty.call(data, 'buildingConfig')
        || Object.prototype.hasOwnProperty.call(data, 'buildingConfigVersion')
        || Object.prototype.hasOwnProperty.call(data, 'buildingPositions')
        || Object.prototype.hasOwnProperty.call(data, 'buildingPositionsVersion')
    );
}

function applyLegacyToEvent(eventsMap, legacyData, eventId) {
    const events = eventsMap && typeof eventsMap === 'object' ? eventsMap : {};
    const target = events[eventId] && typeof events[eventId] === 'object' ? events[eventId] : {};
    const migrated = { ...target };

    const legacyConfig = normalizeBuildingConfigArray(legacyData.buildingConfig);
    if (legacyConfig && (!Array.isArray(target.buildingConfig) || target.buildingConfig.length === 0)) {
        migrated.buildingConfig = legacyConfig;
    }
    const legacyConfigVersion = Number(legacyData.buildingConfigVersion);
    if (Number.isFinite(legacyConfigVersion) && legacyConfigVersion > 0 && !Number.isFinite(Number(target.buildingConfigVersion))) {
        migrated.buildingConfigVersion = Math.round(legacyConfigVersion);
    }

    const legacyPositions = normalizePositionsMap(legacyData.buildingPositions);
    if (Object.keys(legacyPositions).length > 0 && (!target.buildingPositions || Object.keys(target.buildingPositions).length === 0)) {
        migrated.buildingPositions = legacyPositions;
    }
    const legacyPositionsVersion = Number(legacyData.buildingPositionsVersion);
    if (Number.isFinite(legacyPositionsVersion) && legacyPositionsVersion > 0 && !Number.isFinite(Number(target.buildingPositionsVersion))) {
        migrated.buildingPositionsVersion = Math.round(legacyPositionsVersion);
    }

    events[eventId] = migrated;
    return events;
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
        projectId,
    });

    const db = admin.firestore();

    console.log(args.apply ? 'Running migration in APPLY mode' : 'Running migration in DRY-RUN mode');
    console.log(`Project: ${projectId}`);
    console.log(`Target event: ${eventId}`);

    let lastDoc = null;
    let scanned = 0;
    let withLegacyFields = 0;
    let migrated = 0;

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
        let pendingOps = 0;

        for (const doc of snapshot.docs) {
            if (args.limit && scanned >= args.limit) {
                break;
            }
            scanned += 1;

            const data = doc.data() || {};
            if (!hasLegacyFields(data)) {
                continue;
            }
            withLegacyFields += 1;

            const events = data.events && typeof data.events === 'object' ? { ...data.events } : {};
            const migratedEvents = applyLegacyToEvent(events, data, eventId);

            if (args.apply) {
                batch.set(doc.ref, {
                    events: migratedEvents,
                    metadata: {
                        ...(data.metadata && typeof data.metadata === 'object' ? data.metadata : {}),
                        lastModified: admin.firestore.FieldValue.serverTimestamp(),
                    }
                }, { merge: true });
                batch.update(doc.ref, {
                    buildingConfig: admin.firestore.FieldValue.delete(),
                    buildingConfigVersion: admin.firestore.FieldValue.delete(),
                    buildingPositions: admin.firestore.FieldValue.delete(),
                    buildingPositionsVersion: admin.firestore.FieldValue.delete(),
                });
                pendingOps += 1;
            }

            migrated += 1;
        }

        if (args.apply && pendingOps > 0) {
            await batch.commit();
        }

        lastDoc = snapshot.docs[snapshot.docs.length - 1];
        if (args.limit && scanned >= args.limit) {
            break;
        }
    }

    console.log('--- Summary ---');
    console.log(`Users scanned: ${scanned}`);
    console.log(`Users with legacy fields: ${withLegacyFields}`);
    console.log(`Users ${args.apply ? 'migrated' : 'to migrate'}: ${migrated}`);
    console.log(args.apply ? 'Migration complete.' : 'Dry-run complete. Use --apply to write changes.');
}

main().catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
});

