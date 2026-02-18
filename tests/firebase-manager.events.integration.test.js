const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const firebaseModulePath = path.resolve(__dirname, '../firebase-module.js');

function resetModule() {
  delete require.cache[require.resolve(firebaseModulePath)];
}

function resetGlobals() {
  delete global.window;
  delete global.document;
  delete global.addEventListener;
  delete global.alert;
  delete global.firebase;
  delete global.FIREBASE_CONFIG;
  delete global.FirebaseManager;
}

test.afterEach(() => {
  resetModule();
  resetGlobals();
});

test('firebase manager supports dynamic event metadata lifecycle', () => {
  global.window = global;
  global.alert = () => {};
  global.document = {
    addEventListener() {},
  };
  global.FIREBASE_CONFIG = {
    apiKey: 'x',
    authDomain: 'x',
    projectId: 'x',
    storageBucket: 'x',
    messagingSenderId: 'x',
    appId: 'x',
  };

  require(firebaseModulePath);

  const initialIds = global.FirebaseManager.getEventIds();
  assert.ok(initialIds.includes('desert_storm'));
  assert.ok(initialIds.includes('canyon_battlefield'));
  const initialData = global.FirebaseManager.getAllEventData();
  assert.ok(Array.isArray(initialData.desert_storm.buildingConfig));
  assert.ok(initialData.desert_storm.buildingConfig.length > 0);
  assert.ok(Array.isArray(initialData.canyon_battlefield.buildingConfig));
  assert.ok(initialData.canyon_battlefield.buildingConfig.length > 0);
  assert.ok(initialData.desert_storm.buildingConfig.every((entry) => typeof entry.name === 'string' && Number.isFinite(Number(entry.slots)) && Number.isFinite(Number(entry.priority))));
  assert.ok(initialData.canyon_battlefield.buildingConfig.every((entry) => typeof entry.name === 'string' && Number.isFinite(Number(entry.slots)) && Number.isFinite(Number(entry.priority))));
  assert.ok(initialData.desert_storm.buildingConfig.every((entry) => typeof entry.showOnMap === 'boolean'));
  assert.ok(initialData.canyon_battlefield.buildingConfig.every((entry) => typeof entry.showOnMap === 'boolean'));

  const created = global.FirebaseManager.upsertEvent('test_event', {
    name: 'Test Event',
    logoDataUrl: 'data:image/png;base64,AAAA',
    mapDataUrl: 'data:image/png;base64,BBBB',
  });
  assert.equal(created.id, 'test_event');
  assert.equal(created.name, 'Test Event');
  assert.equal(created.assignmentAlgorithmId, 'balanced_round_robin');

  global.FirebaseManager.setBuildingConfig('test_event', [{ name: 'HQ', slots: 2, priority: 1 }]);
  global.FirebaseManager.setBuildingPositions('test_event', { HQ: [20, 30] });

  const allEventData = global.FirebaseManager.getAllEventData();
  assert.ok(allEventData.test_event);
  assert.equal(allEventData.test_event.name, 'Test Event');
  assert.equal(allEventData.test_event.assignmentAlgorithmId, 'balanced_round_robin');
  assert.equal(allEventData.test_event.buildingConfig.length, 1);
  assert.deepEqual(allEventData.test_event.buildingPositions.HQ, [20, 30]);

  assert.equal(global.FirebaseManager.removeEvent('test_event'), true);
  assert.equal(global.FirebaseManager.removeEvent('desert_storm'), false);
});

test('firebase manager resolves game-scoped read payload with fallback gated by flag state', () => {
  global.window = global;
  global.alert = () => {};
  global.document = {
    addEventListener() {},
  };
  global.FIREBASE_CONFIG = {
    apiKey: 'x',
    authDomain: 'x',
    projectId: 'x',
    storageBucket: 'x',
    messagingSenderId: 'x',
    appId: 'x',
  };

  require(firebaseModulePath);

  const legacyOnlyFallbackDisabled = global.FirebaseManager.resolveGameScopedReadPayload({
    gameId: 'last_war',
    gameData: null,
    legacyData: { playerDatabase: { Alice: { power: 1 } } },
  });
  assert.equal(legacyOnlyFallbackDisabled.source, 'none');
  assert.equal(legacyOnlyFallbackDisabled.usedLegacyFallback, false);
  assert.equal(legacyOnlyFallbackDisabled.data, null);

  const legacyOnlyFallbackEnabled = global.FirebaseManager.resolveGameScopedReadPayload({
    gameId: 'last_war',
    gameData: null,
    legacyData: { playerDatabase: { Alice: { power: 1 } } },
    allowLegacyFallback: true,
  });
  assert.equal(legacyOnlyFallbackEnabled.source, 'legacy-fallback');
  assert.equal(legacyOnlyFallbackEnabled.usedLegacyFallback, true);
  assert.ok(legacyOnlyFallbackEnabled.data.playerDatabase.Alice);

  const mixed = global.FirebaseManager.resolveGameScopedReadPayload({
    gameId: 'last_war',
    gameData: { playerDatabase: { Bob: { power: 2 } } },
    legacyData: { playerDatabase: { Alice: { power: 1 } } },
  });
  assert.equal(mixed.source, 'game');
  assert.equal(mixed.usedLegacyFallback, false);
  assert.ok(mixed.data.playerDatabase.Bob);

  const nativeOnly = global.FirebaseManager.resolveGameScopedReadPayload({
    gameId: 'last_war',
    gameData: { playerDatabase: { Cara: { power: 3 } } },
    legacyData: null,
  });
  assert.equal(nativeOnly.source, 'game');
  assert.equal(nativeOnly.usedLegacyFallback, false);
  assert.ok(nativeOnly.data.playerDatabase.Cara);
});

test('firebase manager resolves gameplay context with optional gameId signatures', () => {
  global.window = global;
  global.alert = () => {};
  global.document = {
    addEventListener() {},
  };
  global.FIREBASE_CONFIG = {
    apiKey: 'x',
    authDomain: 'x',
    projectId: 'x',
    storageBucket: 'x',
    messagingSenderId: 'x',
    appId: 'x',
  };

  require(firebaseModulePath);

  const explicit = global.FirebaseManager.resolveGameplayContext('getPlayerDatabase', { gameId: 'last_war' });
  assert.deepEqual(explicit, { gameId: 'last_war', explicit: true });

  const legacy = global.FirebaseManager.resolveGameplayContext('getPlayerDatabase');
  assert.deepEqual(legacy, { gameId: 'last_war', explicit: false });
});

test('firebase manager exposes observability counters shape', () => {
  global.window = global;
  global.alert = () => {};
  global.document = {
    addEventListener() {},
  };
  global.FIREBASE_CONFIG = {
    apiKey: 'x',
    authDomain: 'x',
    projectId: 'x',
    storageBucket: 'x',
    messagingSenderId: 'x',
    appId: 'x',
  };

  require(firebaseModulePath);

  const counters = global.FirebaseManager.getObservabilityCounters();
  assert.deepEqual(counters, {
    dualWriteMismatchCount: 0,
    invitationContextMismatchCount: 0,
    fallbackReadHitCount: 0,
  });
  global.FirebaseManager.resetObservabilityCounters();
  assert.deepEqual(global.FirebaseManager.getObservabilityCounters(), {
    dualWriteMismatchCount: 0,
    invitationContextMismatchCount: 0,
    fallbackReadHitCount: 0,
  });
});

test('firebase manager gracefully falls back when user read is permission-denied', async () => {
  global.window = global;
  global.addEventListener = () => {};
  global.alert = () => {};
  global.document = {
    addEventListener() {},
  };
  global.FIREBASE_CONFIG = {
    apiKey: 'x',
    authDomain: 'x',
    projectId: 'x',
    storageBucket: 'x',
    messagingSenderId: 'x',
    appId: 'x',
  };

  function permissionDeniedError() {
    const error = new Error('Missing or insufficient permissions.');
    error.code = 'permission-denied';
    return error;
  }

  function makeDocRef() {
    return {
      collection: () => ({
        doc: () => makeDocRef(),
      }),
      get: async () => {
        throw permissionDeniedError();
      },
      set: async () => {},
      update: async () => {},
    };
  }

  const authMock = {
    onAuthStateChanged() {},
  };

  const firestoreFactory = () => ({
    collection: () => ({
      doc: () => makeDocRef(),
    }),
    batch: () => ({
      set() {},
      update() {},
      commit: async () => {},
    }),
  });
  firestoreFactory.FieldValue = {
    serverTimestamp: () => ({}),
    delete: () => ({}),
  };

  global.firebase = {
    initializeApp() {},
    auth: () => authMock,
    firestore: firestoreFactory,
  };
  global.firebase.auth.GoogleAuthProvider = function GoogleAuthProvider() {};

  const originalConsoleError = console.error;
  const consoleErrors = [];
  console.error = (...args) => {
    consoleErrors.push(args.map((item) => String(item)).join(' '));
  };

  try {
    require(firebaseModulePath);
    assert.equal(global.FirebaseManager.init(), true);

    const loadedPayloads = [];
    global.FirebaseManager.setDataLoadCallback((payload) => {
      loadedPayloads.push(payload);
    });

    const result = await global.FirebaseManager.loadUserData({
      uid: 'qa-user',
      email: 'qa@example.com',
      providerData: [{ providerId: 'google.com' }],
    });

    assert.equal(result.success, true);
    assert.equal(result.limitedByPermissions, true);
    assert.equal(result.playerCount, 0);
    assert.equal(loadedPayloads.length, 1);
    assert.deepEqual(loadedPayloads[0], {});
    assert.equal(
      consoleErrors.some((entry) => entry.includes('Failed to load data')),
      false
    );
  } finally {
    console.error = originalConsoleError;
  }
});
