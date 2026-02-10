const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const DEFAULT_BATCH_SIZE = 250;
const APP_CONFIG_COLLECTION = 'app_config';
const GLOBAL_BUILDING_CONFIG_DOC_ID = 'default_event_building_config';
const GLOBAL_BUILDING_POSITIONS_DOC_ID = 'default_event_positions';

function usage() {
    console.log('Usage:');
    console.log('  node scripts/sync_event_building_defaults.js --service-account PATH --project-id PROJECT_ID [options]');
    console.log('');
    console.log('Options:');
    console.log('  --service-account, -s   Path to service account JSON (or set FIREBASE_SERVICE_ACCOUNT)');
    console.log('  --project-id, -p        Firebase project ID (optional if present in service account)');
    console.log('  --source-doc-id         Source user document id (required)');
    console.log('  --event-id              Sync one event id only (optional; default is all source events)');
    console.log('  --preserve-existing     Skip users who already have building config for any synced event');
    console.log(`  --batch-size            Firestore page size (default: ${DEFAULT_BATCH_SIZE})`);
    console.log('  --limit                 Stop after N scanned users (for testing)');
    console.log('  --apply                 Perform writes (default is dry-run)');
    console.log('  --help, -h              Show this help');
}

function parseArgs(argv) {
    const args = {
        sourceDocId: '',
        eventId: '',
        batchSize: DEFAULT_BATCH_SIZE,
        limit: null,
        apply: false,
        preserveExisting: false,
    };

    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--service-account' || arg === '-s') {
            args.serviceAccount = argv[i + 1];
            i += 1;
        } else if (arg === '--project-id' || arg === '-p') {
            args.projectId = argv[i + 1];
            i += 1;
        } else if (arg === '--source-doc-id') {
            args.sourceDocId = argv[i + 1];
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
        } else if (arg === '--preserve-existing') {
            args.preserveExisting = true;
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
                showOnMap: item.showOnMap !== false,
            };
        })
        .filter(Boolean);
}

function normalizeBuildingPositions(positions) {
    if (!positions || typeof positions !== 'object' || Array.isArray(positions)) {
        return {};
    }

    const result = {};
    Object.keys(positions).forEach((key) => {
        const pair = positions[key];
        if (!Array.isArray(pair) || pair.length < 2) {
            return;
        }
        const x = Number(pair[0]);
        const y = Number(pair[1]);
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            return;
        }
        result[key] = [x, y];
    });
    return result;
}

function readSourceEvents(sourceData) {
    const events = sourceData && sourceData.events && typeof sourceData.events === 'object' ? sourceData.events : {};
    const result = {};

    Object.keys(events).forEach((rawEventId) => {
        const normalizedId = normalizeEventId(rawEventId);
        if (!normalizedId) {
            return;
        }

        const eventEntry = events[rawEventId];
        if (!eventEntry || typeof eventEntry !== 'object') {
            return;
        }

        const buildingConfig = normalizeBuildingConfig(eventEntry.buildingConfig);
        if (buildingConfig.length === 0) {
            return;
        }

        result[normalizedId] = {
            buildingConfig: buildingConfig,
            buildingPositions: normalizeBuildingPositions(eventEntry.buildingPositions),
        };
    });

    return result;
}

function printSourcePreview(eventIds, sourceConfigs, sourcePositions) {
    console.log('--- Source Values Preview ---');
    eventIds.forEach((eventId) => {
        const config = sourceConfigs[eventId] || [];
        const positions = sourcePositions[eventId] || {};
        const positionKeys = Object.keys(positions);

        console.log(`Event: ${eventId}`);
        console.log(`  Building config entries: ${config.length}`);
        config.forEach((item, index) => {
            console.log(`    ${index + 1}. ${item.name} | #Players=${item.slots} | Priority=${item.priority}`);
        });

        console.log(`  Building position entries: ${positionKeys.length}`);
        positionKeys.forEach((name) => {
            const pair = positions[name];
            console.log(`    - ${name}: [${pair[0]}, ${pair[1]}]`);
        });
    });
    console.log('--- End Source Preview ---');
}

function hasExistingBuildingConfig(userEvents, eventIds) {
    return eventIds.some((eventId) => {
        const eventEntry = userEvents[eventId];
        if (!eventEntry || typeof eventEntry !== 'object') {
            return false;
        }
        return Array.isArray(eventEntry.buildingConfig) && eventEntry.buildingConfig.length > 0;
    });
}

async function loadServiceAccount(servicePath) {
    const resolvedPath = path.resolve(servicePath);
    if (!fs.existsSync(resolvedPath)) {
        throw new Error(`Service account file not found: ${resolvedPath}`);
    }
    return JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const servicePath = args.serviceAccount || process.env.FIREBASE_SERVICE_ACCOUNT;
    const sourceDocId = typeof args.sourceDocId === 'string' ? args.sourceDocId.trim() : '';
    const requestedEventId = normalizeEventId(args.eventId || '');

    if (!servicePath) {
        usage();
        process.exit(1);
    }
    if (!sourceDocId) {
        console.error('Missing required --source-doc-id');
        process.exit(1);
    }
    if (args.eventId && !requestedEventId) {
        console.error('Invalid --event-id');
        process.exit(1);
    }
    if (!Number.isFinite(args.batchSize) || args.batchSize <= 0) {
        console.error('Invalid --batch-size');
        process.exit(1);
    }
    if (args.limit != null && (!Number.isFinite(args.limit) || args.limit <= 0)) {
        console.error('Invalid --limit');
        process.exit(1);
    }

    const serviceAccount = await loadServiceAccount(servicePath);
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
    const sourceRef = db.collection('users').doc(sourceDocId);
    const sourceSnap = await sourceRef.get();
    if (!sourceSnap.exists) {
        console.error(`Source user document not found: users/${sourceDocId}`);
        process.exit(1);
    }

    const sourceData = sourceSnap.data() || {};
    const sourceEmail = sourceData && sourceData.metadata && typeof sourceData.metadata === 'object'
        ? (sourceData.metadata.emailLower || sourceData.metadata.email || null)
        : null;
    const sourceEvents = readSourceEvents(sourceData);

    let syncedEvents = sourceEvents;
    if (requestedEventId) {
        if (!sourceEvents[requestedEventId]) {
            console.error(`Source user does not have valid events.${requestedEventId}.buildingConfig`);
            process.exit(1);
        }
        syncedEvents = {
            [requestedEventId]: sourceEvents[requestedEventId],
        };
    }

    const eventIds = Object.keys(syncedEvents);
    if (eventIds.length === 0) {
        console.error('Source user does not have any valid events.{eventId}.buildingConfig entries');
        process.exit(1);
    }

    const version = Date.now();
    const sourceConfigs = {};
    const sourcePositions = {};
    const eventsWithPositions = {};
    eventIds.forEach((eventId) => {
        sourceConfigs[eventId] = syncedEvents[eventId].buildingConfig;
        sourcePositions[eventId] = syncedEvents[eventId].buildingPositions;
        eventsWithPositions[eventId] = Object.keys(sourcePositions[eventId]).length > 0;
    });

    console.log(args.apply ? 'Running sync in APPLY mode' : 'Running sync in DRY-RUN mode');
    console.log(args.preserveExisting
        ? 'Preserve mode: users with existing building config for synced events will be skipped.'
        : 'Overwrite mode: existing users will be forced to source values.');
    console.log(`Project: ${projectId}`);
    console.log(`Source user doc: ${sourceDocId}`);
    console.log('Safety guard: source user is always excluded from updates.');
    console.log(`Events to sync (${eventIds.length}):`);
    eventIds.forEach((eventId) => {
        const configEntries = sourceConfigs[eventId].length;
        const positionEntries = Object.keys(sourcePositions[eventId]).length;
        console.log(`  - ${eventId}: configEntries=${configEntries}, positionEntries=${positionEntries}`);
        if (!eventsWithPositions[eventId]) {
            console.log(`    ! No source positions for ${eventId}; existing user coordinates will be preserved.`);
        }
    });
    printSourcePreview(eventIds, sourceConfigs, sourcePositions);

    if (args.apply) {
        await db.collection(APP_CONFIG_COLLECTION).doc(GLOBAL_BUILDING_CONFIG_DOC_ID).set({
            sourceDocId: sourceDocId,
            sourceEmail: sourceEmail,
            version: version,
            events: sourceConfigs,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        const positionEventsToWrite = {};
        eventIds.forEach((eventId) => {
            if (eventsWithPositions[eventId]) {
                positionEventsToWrite[eventId] = sourcePositions[eventId];
            }
        });
        await db.collection(APP_CONFIG_COLLECTION).doc(GLOBAL_BUILDING_POSITIONS_DOC_ID).set({
            sourceDocId: sourceDocId,
            sourceEmail: sourceEmail,
            version: version,
            events: positionEventsToWrite,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        console.log(`Updated ${APP_CONFIG_COLLECTION}/${GLOBAL_BUILDING_CONFIG_DOC_ID}`);
        console.log(`Updated ${APP_CONFIG_COLLECTION}/${GLOBAL_BUILDING_POSITIONS_DOC_ID}`);
    } else {
        console.log(`[Dry-run] Would update ${APP_CONFIG_COLLECTION}/${GLOBAL_BUILDING_CONFIG_DOC_ID}`);
        console.log(`[Dry-run] Would update ${APP_CONFIG_COLLECTION}/${GLOBAL_BUILDING_POSITIONS_DOC_ID}`);
    }

    let scanned = 0;
    let updated = 0;
    let skippedSource = 0;
    let skippedPreserveExisting = 0;
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

        const batch = db.batch();
        let batchOps = 0;

        for (const userDoc of snapshot.docs) {
            if (args.limit && scanned >= args.limit) {
                break;
            }
            scanned += 1;

            if (userDoc.id === sourceDocId) {
                skippedSource += 1;
                continue;
            }

            const userData = userDoc.data() || {};
            const userEvents = userData.events && typeof userData.events === 'object' ? userData.events : {};

            if (args.preserveExisting && hasExistingBuildingConfig(userEvents, eventIds)) {
                skippedPreserveExisting += 1;
                continue;
            }

            const payload = {
                'metadata.lastModified': admin.firestore.FieldValue.serverTimestamp(),
                buildingConfig: admin.firestore.FieldValue.delete(),
                buildingConfigVersion: admin.firestore.FieldValue.delete(),
                buildingPositions: admin.firestore.FieldValue.delete(),
                buildingPositionsVersion: admin.firestore.FieldValue.delete(),
            };

            eventIds.forEach((eventId) => {
                payload[`events.${eventId}.buildingConfig`] = sourceConfigs[eventId];
                payload[`events.${eventId}.buildingConfigVersion`] = version;
                if (eventsWithPositions[eventId]) {
                    payload[`events.${eventId}.buildingPositions`] = sourcePositions[eventId];
                    payload[`events.${eventId}.buildingPositionsVersion`] = version;
                }
            });

            if (args.apply) {
                if (userDoc.id === sourceDocId) {
                    throw new Error(`Safety check failed: attempted write on source user ${sourceDocId}`);
                }
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
    console.log(`Source user skipped: ${skippedSource}`);
    console.log(`Preserve-existing skipped: ${skippedPreserveExisting}`);
    console.log(`Users ${args.apply ? 'updated' : 'to update'}: ${updated}`);
    console.log(`Events synced per user: ${eventIds.length}`);
    console.log(args.apply ? 'Sync complete.' : 'Dry-run complete. Use --apply to write changes.');
}

main().catch((error) => {
    console.error('Sync failed:', error);
    process.exit(1);
});
