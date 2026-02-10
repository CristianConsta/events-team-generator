const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const DEFAULT_DOC_ID = '2z2BdO8aVsUovqQWWL9WCRMdV933';

function usage() {
    console.log('Usage:');
    console.log('  node scripts/inspect_user_buildings.js --service-account PATH --project-id PROJECT_ID [options]');
    console.log('');
    console.log('Options:');
    console.log('  --service-account, -s   Path to service account JSON (or set FIREBASE_SERVICE_ACCOUNT)');
    console.log('  --project-id, -p        Firebase project ID (optional if present in service account)');
    console.log(`  --doc-id, -d            User document id (default: ${DEFAULT_DOC_ID})`);
    console.log('  --help, -h              Show this help');
}

function parseArgs(argv) {
    const args = {
        docId: DEFAULT_DOC_ID,
    };

    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--service-account' || arg === '-s') {
            args.serviceAccount = argv[i + 1];
            i += 1;
        } else if (arg === '--project-id' || arg === '-p') {
            args.projectId = argv[i + 1];
            i += 1;
        } else if (arg === '--doc-id' || arg === '-d') {
            args.docId = argv[i + 1];
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

function normalizeBuildingConfig(config) {
    if (!Array.isArray(config)) {
        return [];
    }
    return config
        .filter((item) => item && typeof item === 'object')
        .map((item) => ({
            name: typeof item.name === 'string' ? item.name : '',
            label: typeof item.label === 'string' ? item.label : '',
            slots: Number.isFinite(Number(item.slots)) ? Number(item.slots) : null,
            priority: Number.isFinite(Number(item.priority)) ? Number(item.priority) : null,
            showOnMap: item.showOnMap !== false,
        }))
        .filter((item) => item.name);
}

function printLegacyFields(data) {
    const legacyConfig = normalizeBuildingConfig(data.buildingConfig);
    const legacyPositions = data.buildingPositions && typeof data.buildingPositions === 'object'
        ? data.buildingPositions
        : null;

    console.log('');
    console.log('Legacy top-level fields:');
    console.log(`- buildingConfig entries: ${legacyConfig.length}`);
    if (legacyConfig.length > 0) {
        legacyConfig.forEach((entry, index) => {
            console.log(`  ${index + 1}. ${entry.name} | #Players=${entry.slots ?? 'n/a'} | priority=${entry.priority ?? 'n/a'} | onMap=${entry.showOnMap}`);
        });
    }
    console.log(`- buildingConfigVersion: ${data.buildingConfigVersion ?? 'missing'}`);
    console.log(`- buildingPositions entries: ${legacyPositions ? Object.keys(legacyPositions).length : 0}`);
    console.log(`- buildingPositionsVersion: ${data.buildingPositionsVersion ?? 'missing'}`);
}

function printEvents(data) {
    const events = data.events && typeof data.events === 'object' ? data.events : {};
    const eventIds = Object.keys(events);

    console.log('');
    console.log(`Events found: ${eventIds.length}`);
    if (eventIds.length === 0) {
        return;
    }

    eventIds.forEach((eventId) => {
        const eventData = events[eventId] && typeof events[eventId] === 'object' ? events[eventId] : {};
        const name = typeof eventData.name === 'string' ? eventData.name : '(unnamed)';
        const config = normalizeBuildingConfig(eventData.buildingConfig);
        const positions = eventData.buildingPositions && typeof eventData.buildingPositions === 'object'
            ? eventData.buildingPositions
            : {};

        console.log('');
        console.log(`Event: ${eventId} (${name})`);
        console.log(`- buildingConfig entries: ${config.length}`);
        console.log(`- buildingConfigVersion: ${eventData.buildingConfigVersion ?? 'missing'}`);
        console.log(`- buildingPositions entries: ${Object.keys(positions).length}`);
        console.log(`- buildingPositionsVersion: ${eventData.buildingPositionsVersion ?? 'missing'}`);

        if (config.length > 0) {
            console.log('  Building config:');
            config.forEach((entry, index) => {
                console.log(`    ${index + 1}. ${entry.name} | #Players=${entry.slots ?? 'n/a'} | priority=${entry.priority ?? 'n/a'} | onMap=${entry.showOnMap}`);
            });
        }
    });
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const servicePath = args.serviceAccount || process.env.FIREBASE_SERVICE_ACCOUNT;

    if (!servicePath) {
        usage();
        process.exit(1);
    }
    if (!args.docId || typeof args.docId !== 'string') {
        console.error('Invalid --doc-id');
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
    const docRef = db.collection('users').doc(args.docId);
    const snap = await docRef.get();

    console.log(`Project: ${projectId}`);
    console.log(`Doc: users/${args.docId}`);
    if (!snap.exists) {
        console.log('Result: document not found.');
        process.exit(2);
    }

    const data = snap.data() || {};
    const metadata = data.metadata && typeof data.metadata === 'object' ? data.metadata : {};
    console.log('Result: found');
    console.log(`- metadata.email: ${metadata.email ?? 'missing'}`);
    console.log(`- metadata.emailLower: ${metadata.emailLower ?? 'missing'}`);
    console.log(`- metadata.totalPlayers: ${metadata.totalPlayers ?? 'missing'}`);

    printEvents(data);
    printLegacyFields(data);
}

main().catch((error) => {
    console.error('Inspection failed:', error);
    process.exit(1);
});
