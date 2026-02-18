const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const DEFAULT_BATCH_SIZE = 100;
const DEFAULT_GAME_ID = 'last_war';
const MIGRATION_VERSION = 2;
const USER_GAMES_SUBCOLLECTION = 'games';

function usage() {
  console.log('Usage:');
  console.log('  node scripts/migrate_multigame_first_class.js --service-account PATH [--project-id PROJECT_ID] [--apply]');
  console.log('');
  console.log('Options:');
  console.log('  --service-account, -s   Path to service account JSON (or set FIREBASE_SERVICE_ACCOUNT)');
  console.log('  --project-id, -p        Firebase project ID (optional if in service account)');
  console.log(`  --default-game-id        Legacy root game id (default: ${DEFAULT_GAME_ID})`);
  console.log(`  --batch-size             Number of user docs per page (default: ${DEFAULT_BATCH_SIZE})`);
  console.log('  --limit                  Stop after N users');
  console.log('  --report                 Output JSON report path (default: docs/architecture/migration-report-latest.json)');
  console.log('  --apply                  Execute writes (default: dry-run)');
  console.log('  --help, -h              Show help');
}

function parseArgs(argv) {
  const args = {
    apply: false,
    batchSize: DEFAULT_BATCH_SIZE,
    defaultGameId: DEFAULT_GAME_ID,
    limit: null,
    reportPath: path.resolve('docs/architecture/migration-report-latest.json'),
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--service-account' || arg === '-s') {
      args.serviceAccount = argv[i + 1];
      i += 1;
    } else if (arg === '--project-id' || arg === '-p') {
      args.projectId = argv[i + 1];
      i += 1;
    } else if (arg === '--default-game-id') {
      args.defaultGameId = argv[i + 1];
      i += 1;
    } else if (arg === '--batch-size') {
      args.batchSize = Number(argv[i + 1]);
      i += 1;
    } else if (arg === '--limit') {
      args.limit = Number(argv[i + 1]);
      i += 1;
    } else if (arg === '--report') {
      args.reportPath = path.resolve(argv[i + 1]);
      i += 1;
    } else if (arg === '--apply') {
      args.apply = true;
    } else if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    } else if (!arg.startsWith('-') && !args.serviceAccount) {
      args.serviceAccount = arg;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function normalizeGameId(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function cloneJson(value) {
  if (typeof value === 'undefined') {
    return undefined;
  }
  return JSON.parse(JSON.stringify(value));
}

function createStableDocId(rawValue, prefix) {
  const raw = typeof rawValue === 'string' ? rawValue.trim() : '';
  const base = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64) || prefix;
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = ((hash << 5) - hash) + raw.charCodeAt(i);
    hash |= 0;
  }
  const suffix = Math.abs(hash).toString(16).slice(0, 8);
  return `${base}_${suffix || '0'}`;
}

function isNonEmptyObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0;
}

function mergeGamePayloads(existingPayload, incomingPayload) {
  const existing = existingPayload && typeof existingPayload === 'object' ? cloneJson(existingPayload) : {};
  const incoming = incomingPayload && typeof incomingPayload === 'object' ? incomingPayload : {};
  const merged = { ...existing };

  Object.keys(incoming).forEach((field) => {
    const next = incoming[field];
    const current = merged[field];

    // Prevent empty nested maps from overriding populated legacy payload.
    if ((field === 'playerDatabase' || field === 'events') && isNonEmptyObject(current) && !isNonEmptyObject(next)) {
      return;
    }

    if (
      (next === null || typeof next === 'undefined' || next === '')
      && typeof current !== 'undefined'
      && current !== null
      && current !== ''
    ) {
      return;
    }

    merged[field] = cloneJson(next);
  });

  return merged;
}

function extractGamePayloadsFromUserDoc(userData, defaultGameId) {
  const payloads = new Map();
  const normalizedDefault = normalizeGameId(defaultGameId) || DEFAULT_GAME_ID;
  const source = userData && typeof userData === 'object' ? userData : {};

  const rootLegacyPayload = {};
  ['playerDatabase', 'events', 'userProfile', 'playerSource', 'allianceId', 'allianceName', 'metadata'].forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(source, field)) {
      rootLegacyPayload[field] = source[field];
    }
  });
  if (Object.keys(rootLegacyPayload).length > 0) {
    payloads.set(normalizedDefault, rootLegacyPayload);
  }

  if (source.games && typeof source.games === 'object') {
    Object.keys(source.games).forEach((rawGameId) => {
      const normalizedGameId = normalizeGameId(rawGameId);
      const gamePayload = source.games[rawGameId];
      if (!normalizedGameId || !gamePayload || typeof gamePayload !== 'object') {
        return;
      }
      const existing = payloads.get(normalizedGameId) || {};
      payloads.set(normalizedGameId, mergeGamePayloads(existing, gamePayload));
    });
  }

  return payloads;
}

function splitEventMedia(eventsMap) {
  const events = {};
  const eventMedia = {};
  const source = eventsMap && typeof eventsMap === 'object' ? eventsMap : {};
  Object.keys(source).forEach((eventId) => {
    const raw = source[eventId];
    if (!raw || typeof raw !== 'object') {
      return;
    }
    const eventCopy = cloneJson(raw);
    const logoDataUrl = typeof eventCopy.logoDataUrl === 'string' ? eventCopy.logoDataUrl : '';
    const mapDataUrl = typeof eventCopy.mapDataUrl === 'string' ? eventCopy.mapDataUrl : '';
    delete eventCopy.logoDataUrl;
    delete eventCopy.mapDataUrl;
    events[eventId] = eventCopy;
    if (logoDataUrl || mapDataUrl) {
      eventMedia[eventId] = { logoDataUrl, mapDataUrl };
    }
  });
  return { events, eventMedia };
}

function buildGameDocPatch(payload) {
  const source = payload && typeof payload === 'object' ? payload : {};
  const patch = {};
  ['playerSource', 'allianceId', 'allianceName'].forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(source, field)) {
      patch[field] = source[field];
    }
  });
  if (source.userProfile && typeof source.userProfile === 'object') {
    patch.userProfile = cloneJson(source.userProfile);
  }
  patch.metadata = {
    migrationVersion: MIGRATION_VERSION,
    migratedByScript: 'migrate_multigame_first_class',
    migratedAt: admin.firestore.FieldValue.serverTimestamp(),
    lastModified: admin.firestore.FieldValue.serverTimestamp(),
  };
  return patch;
}

async function migrateUserGame(db, userRef, gameId, payload, apply, report) {
  const gameRef = userRef.collection(USER_GAMES_SUBCOLLECTION).doc(gameId);
  const gamePatch = buildGameDocPatch(payload);
  const playersMap = payload && payload.playerDatabase && typeof payload.playerDatabase === 'object'
    ? payload.playerDatabase
    : {};
  const eventsMap = payload && payload.events && typeof payload.events === 'object'
    ? payload.events
    : {};
  const split = splitEventMedia(eventsMap);

  report.gameDocsPrepared += 1;
  report.playersPrepared += Object.keys(playersMap).length;
  report.eventsPrepared += Object.keys(split.events).length;
  report.eventMediaPrepared += Object.keys(split.eventMedia).length;

  if (!apply) {
    return;
  }

  await gameRef.set(gamePatch, { merge: true });

  const playerEntries = Object.entries(playersMap);
  for (const [playerName, playerData] of playerEntries) {
    const docId = createStableDocId(playerName, 'player');
    await gameRef.collection('players').doc(docId).set(cloneJson(playerData || {}), { merge: true });
  }

  const eventEntries = Object.entries(split.events);
  for (const [eventId, eventData] of eventEntries) {
    await gameRef.collection('events').doc(String(eventId)).set(cloneJson(eventData || {}), { merge: true });
  }

  const mediaEntries = Object.entries(split.eventMedia);
  for (const [eventId, mediaData] of mediaEntries) {
    await gameRef.collection('event_media').doc(String(eventId)).set(cloneJson(mediaData || {}), { merge: true });
  }
}

async function migrateLegacyAllianceCollections(db, defaultGameId, apply, report) {
  const normalizedDefault = normalizeGameId(defaultGameId) || DEFAULT_GAME_ID;
  const legacyAllianceSnapshot = await db.collection('alliances').get();
  const legacyInvitationSnapshot = await db.collection('invitations').get();

  report.legacyAlliancesScanned = legacyAllianceSnapshot.size;
  report.legacyInvitationsScanned = legacyInvitationSnapshot.size;

  for (const doc of legacyAllianceSnapshot.docs) {
    const data = doc.data() || {};
    const gameId = normalizeGameId(data.gameId) || normalizedDefault;
    report.legacyAlliancesPrepared += 1;
    if (apply) {
      await db.collection('games').doc(gameId).collection('alliances').doc(doc.id).set({
        ...cloneJson(data),
        gameId,
        migrationVersion: MIGRATION_VERSION,
      }, { merge: true });
    }
  }

  for (const doc of legacyInvitationSnapshot.docs) {
    const data = doc.data() || {};
    const gameId = normalizeGameId(data.gameId) || normalizedDefault;
    report.legacyInvitationsPrepared += 1;
    if (apply) {
      await db.collection('games').doc(gameId).collection('invitations').doc(doc.id).set({
        ...cloneJson(data),
        gameId,
        migrationVersion: MIGRATION_VERSION,
      }, { merge: true });
    }
  }
}

async function runMigration(db, args) {
  const report = {
    startedAt: new Date().toISOString(),
    mode: args.apply ? 'apply' : 'dry-run',
    defaultGameId: normalizeGameId(args.defaultGameId) || DEFAULT_GAME_ID,
    usersScanned: 0,
    usersWithLegacyPayload: 0,
    gameDocsPrepared: 0,
    playersPrepared: 0,
    eventsPrepared: 0,
    eventMediaPrepared: 0,
    legacyAlliancesScanned: 0,
    legacyInvitationsScanned: 0,
    legacyAlliancesPrepared: 0,
    legacyInvitationsPrepared: 0,
    rollbackNotes: [
      'Rollback path: keep strict mode OFF, redeploy previous firestore.rules, and stop dual-write/cutover clients.',
      'No destructive deletes are performed by this migration script.',
      'Data copied into game-scoped paths is idempotent (merge writes).',
    ],
  };

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
      if (args.limit && report.usersScanned >= args.limit) {
        break;
      }
      report.usersScanned += 1;
      const userData = userDoc.data() || {};
      const gamePayloads = extractGamePayloadsFromUserDoc(userData, args.defaultGameId);
      if (gamePayloads.size === 0) {
        continue;
      }
      report.usersWithLegacyPayload += 1;

      const migratedGameIds = [];
      for (const [gameId, payload] of gamePayloads.entries()) {
        migratedGameIds.push(gameId);
        await migrateUserGame(db, userDoc.ref, gameId, payload, args.apply, report);
      }

      if (args.apply && migratedGameIds.length > 0) {
        await userDoc.ref.set({
          migrationVersion: MIGRATION_VERSION,
          migratedToGameSubcollectionsAt: admin.firestore.FieldValue.serverTimestamp(),
          lastActiveGameId: migratedGameIds[0],
          multigameMigration: {
            version: MIGRATION_VERSION,
            gameIds: migratedGameIds,
            migratedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
        }, { merge: true });
      }
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    if (args.limit && report.usersScanned >= args.limit) {
      break;
    }
  }

  await migrateLegacyAllianceCollections(db, args.defaultGameId, args.apply, report);
  report.completedAt = new Date().toISOString();
  return report;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const useEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;
  if (!Number.isFinite(args.batchSize) || args.batchSize <= 0) {
    throw new Error('Invalid --batch-size value.');
  }

  const servicePath = args.serviceAccount || process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!servicePath && !useEmulator) {
    usage();
    throw new Error('Missing --service-account (or run against emulator with FIRESTORE_EMULATOR_HOST).');
  }
  let serviceAccount = null;
  if (servicePath) {
    const resolvedServicePath = path.resolve(servicePath);
    if (!fs.existsSync(resolvedServicePath)) {
      throw new Error(`Service account file not found: ${resolvedServicePath}`);
    }
    serviceAccount = JSON.parse(fs.readFileSync(resolvedServicePath, 'utf8'));
  }
  const projectId = args.projectId || (serviceAccount && serviceAccount.project_id);
  if (!projectId) {
    throw new Error('Project ID is required (use --project-id or include project_id in service account).');
  }

  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId,
    });
  } else {
    admin.initializeApp({ projectId });
  }

  const db = admin.firestore();
  const report = await runMigration(db, args);
  fs.mkdirSync(path.dirname(args.reportPath), { recursive: true });
  fs.writeFileSync(args.reportPath, JSON.stringify(report, null, 2), 'utf8');

  console.log(args.apply ? 'Migration APPLY completed.' : 'Migration dry-run completed.');
  console.log(`Report written to: ${args.reportPath}`);
  console.log(JSON.stringify(report, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
}

module.exports = {
  parseArgs,
  normalizeGameId,
  createStableDocId,
  extractGamePayloadsFromUserDoc,
  mergeGamePayloads,
  isNonEmptyObject,
  splitEventMedia,
  buildGameDocPatch,
  runMigration,
};
