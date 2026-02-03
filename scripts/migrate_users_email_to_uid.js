const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

function usage() {
    console.log('Usage:');
    console.log('  node scripts/migrate_users_email_to_uid.js --service-account PATH --project-id PROJECT_ID [--apply] [--delete-old]');
    console.log('Options:');
    console.log('  --service-account, -s   Path to service account JSON (or set FIREBASE_SERVICE_ACCOUNT)');
    console.log('  --project-id, -p        Firebase project ID (optional if in service account)');
    console.log('  --batch-size            Batch size for paging (default 200)');
    console.log('  --limit                 Stop after N documents (for testing)');
    console.log('  --apply                 Perform writes (default is dry run)');
    console.log('  --delete-old            Delete old email-based docs after successful write');
    console.log('  --include-non-email     Attempt migration for non-email doc IDs');
}

function parseArgs(argv) {
    const args = {
        batchSize: 200,
        apply: false,
        deleteOld: false,
        includeNonEmail: false,
        limit: null,
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
        } else if (arg === '--delete-old') {
            args.deleteOld = true;
        } else if (arg === '--include-non-email') {
            args.includeNonEmail = true;
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

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const servicePath = args.serviceAccount || process.env.FIREBASE_SERVICE_ACCOUNT;

    if (!servicePath) {
        usage();
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
        console.error('Project ID is required (use --project-id or ensure project_id in service account)');
        process.exit(1);
    }

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: projectId,
    });

    const db = admin.firestore();
    const auth = admin.auth();
    const usersCollection = db.collection('users');

    let lastDoc = null;
    let scanned = 0;
    let migrated = 0;
    let skipped = 0;
    let missingUser = 0;
    let conflicts = 0;

    console.log(args.apply ? 'Running migration (apply mode)' : 'Running migration (dry run)');

    while (true) {
        let query = usersCollection
            .orderBy(admin.firestore.FieldPath.documentId())
            .limit(args.batchSize);

        if (lastDoc) {
            query = query.startAfter(lastDoc);
        }

        const snapshot = await query.get();
        if (snapshot.empty) {
            break;
        }

        for (const doc of snapshot.docs) {
            if (args.limit && scanned >= args.limit) {
                break;
            }

            scanned += 1;
            const docId = doc.id;
            const looksLikeEmail = docId.includes('@');

            if (!looksLikeEmail && !args.includeNonEmail) {
                skipped += 1;
                continue;
            }

            let userRecord;
            try {
                userRecord = await auth.getUserByEmail(docId);
            } catch (error) {
                missingUser += 1;
                console.warn(`No auth user for: ${docId}`);
                continue;
            }

            const uid = userRecord.uid;
            const destRef = usersCollection.doc(uid);
            const destSnap = await destRef.get();

            if (destSnap.exists) {
                conflicts += 1;
                console.warn(`Destination exists for uid: ${uid} (email: ${docId})`);
                continue;
            }

            const data = doc.data();
            const migratedData = {
                ...data,
                metadata: {
                    ...(data.metadata || {}),
                    migratedFromEmail: docId,
                    migratedAt: admin.firestore.FieldValue.serverTimestamp(),
                },
            };

            if (args.apply) {
                await destRef.set(migratedData, { merge: true });
                if (args.deleteOld) {
                    await doc.ref.delete();
                }
            }

            migrated += 1;
        }

        lastDoc = snapshot.docs[snapshot.docs.length - 1];

        if (args.limit && scanned >= args.limit) {
            break;
        }
    }

    console.log('--- Migration Summary ---');
    console.log(`Scanned: ${scanned}`);
    console.log(`Migrated: ${migrated}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Missing auth user: ${missingUser}`);
    console.log(`Conflicts (uid doc exists): ${conflicts}`);
    console.log(args.apply ? 'Apply mode complete.' : 'Dry run complete. Use --apply to write changes.');
}

main().catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
});
