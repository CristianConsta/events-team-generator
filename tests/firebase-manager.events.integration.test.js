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

test('firebase manager resolves game-scoped read payload with legacy fallback when enabled', () => {
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
  assert.equal(legacyOnlyFallbackEnabled.source, 'legacy');
  assert.equal(legacyOnlyFallbackEnabled.usedLegacyFallback, true);
  assert.ok(legacyOnlyFallbackEnabled.data.playerDatabase.Alice);

  const mappedLegacyFallback = global.FirebaseManager.resolveGameScopedReadPayload({
    gameId: 'desert_ops',
    gameData: null,
    legacyData: {
      games: {
        desert_ops: { playerDatabase: { DesertAlice: { power: 5 } } },
      },
    },
    allowLegacyFallback: true,
  });
  assert.equal(mappedLegacyFallback.source, 'legacy');
  assert.equal(mappedLegacyFallback.usedLegacyFallback, true);
  assert.ok(mappedLegacyFallback.data.playerDatabase.DesertAlice);

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

test('firebase manager keeps local defaults when game doc read is denied', async () => {
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

  function createSnapshot() {
    return {
      empty: true,
      docs: [],
      forEach() {},
    };
  }

  function resolveDocGet(pathParts) {
    const joined = pathParts.join('/');
    if (joined === 'users/qa-user/games/last_war') {
      throw permissionDeniedError();
    }
    return {
      exists: false,
      data: () => ({}),
    };
  }

  function makeCollection(pathParts) {
    return {
      doc(id) {
        return makeDocRef(pathParts.concat(id));
      },
      where() {
        return this;
      },
      limit() {
        return this;
      },
      get: async () => createSnapshot(),
    };
  }

  function makeDocRef(pathParts) {
    return {
      collection(name) {
        return makeCollection(pathParts.concat(name));
      },
      get: async () => resolveDocGet(pathParts),
      set: async () => {},
      update: async () => {},
    };
  }

  const authMock = {
    onAuthStateChanged() {},
  };

  const firestoreFactory = () => ({
    collection(name) {
      return makeCollection([name]);
    },
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
  assert.equal(result.playerCount, 0);
  assert.equal(result.limitedByPermissions, true);
  assert.equal(loadedPayloads.length, 1);
  assert.deepEqual(loadedPayloads[0], {});
});

test('game metadata save falls back to app_config when games write is permission-denied', async () => {
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

  const setCalls = [];
  let authStateChanged = null;

  function createSnapshot() {
    return {
      empty: true,
      docs: [],
      forEach() {},
    };
  }

  function resolveDocGet(pathParts) {
    const joined = pathParts.join('/');
    if (joined === 'users/2z2BdO8aVsUovqQWWL9WCRMdV933') {
      return {
        exists: false,
        data: () => ({}),
      };
    }
    if (joined === 'users/2z2BdO8aVsUovqQWWL9WCRMdV933/games/last_war') {
      return {
        exists: false,
        data: () => ({}),
      };
    }
    if (joined === 'app_config/default_event_positions' || joined === 'app_config/default_event_building_config') {
      return {
        exists: false,
        data: () => ({}),
      };
    }
    if (joined === 'app_config/game_metadata_overrides') {
      return {
        exists: true,
        data: () => ({ games: {} }),
      };
    }
    return {
      exists: false,
      data: () => ({}),
    };
  }

  function resolveDocSet(pathParts, payload, options) {
    const joined = pathParts.join('/');
    setCalls.push({ path: joined, payload, options });
    if (joined === 'games/last_war') {
      throw permissionDeniedError();
    }
    return undefined;
  }

  function makeCollection(pathParts) {
    return {
      doc(id) {
        return makeDocRef(pathParts.concat(id));
      },
      where() {
        return this;
      },
      limit() {
        return this;
      },
      get: async () => createSnapshot(),
    };
  }

  function makeDocRef(pathParts) {
    return {
      collection(name) {
        return makeCollection(pathParts.concat(name));
      },
      get: async () => resolveDocGet(pathParts),
      set: async (payload, options) => resolveDocSet(pathParts, payload, options),
      update: async () => {},
    };
  }

  const authMock = {
    onAuthStateChanged(cb) {
      authStateChanged = cb;
    },
    async signOut() {},
  };

  const firestoreFactory = () => ({
    collection(name) {
      return makeCollection([name]);
    },
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

  require(firebaseModulePath);
  assert.equal(global.FirebaseManager.init(), true);
  assert.equal(typeof authStateChanged, 'function');
  await authStateChanged({
    uid: '2z2BdO8aVsUovqQWWL9WCRMdV933',
    email: 'super-admin@example.com',
    emailVerified: true,
    providerData: [{ providerId: 'password' }],
  });

  const result = await global.FirebaseManager.setGameMetadata('last_war', {
    name: 'Last War QA',
    logo: 'data:image/png;base64,AAAA',
    company: 'QA Labs',
  });

  assert.equal(result.success, true);
  assert.equal(result.game.id, 'last_war');
  assert.equal(result.game.name, 'Last War QA');
  assert.equal(
    setCalls.some((entry) => entry.path === 'games/last_war'),
    true
  );
  assert.equal(
    setCalls.some((entry) => entry.path === 'app_config/game_metadata_overrides'),
    true
  );
});

test('game metadata list reads app_config overrides when games collection read is denied', async () => {
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
  global.DSCoreGames = {
    listAvailableGames: () => ([
      { id: 'last_war', name: 'Last War: Survival', logo: '', company: '' },
    ]),
  };

  function permissionDeniedError() {
    const error = new Error('Missing or insufficient permissions.');
    error.code = 'permission-denied';
    return error;
  }

  function makeCollection(pathParts) {
    return {
      doc(id) {
        return makeDocRef(pathParts.concat(id));
      },
      where() {
        return this;
      },
      limit() {
        return this;
      },
      get: async () => {
        const joined = pathParts.join('/');
        if (joined === 'games') {
          throw permissionDeniedError();
        }
        return {
          empty: true,
          docs: [],
          forEach() {},
        };
      },
    };
  }

  function makeDocRef(pathParts) {
    return {
      collection(name) {
        return makeCollection(pathParts.concat(name));
      },
      get: async () => {
        const joined = pathParts.join('/');
        if (joined === 'app_config/game_metadata_overrides') {
          return {
            exists: true,
            data: () => ({
              games: {
                last_war: {
                  name: 'Last War Override',
                  logo: 'data:image/png;base64,BBBB',
                  company: 'Override Inc',
                },
              },
            }),
          };
        }
        return {
          exists: false,
          data: () => ({}),
        };
      },
      set: async () => {},
      update: async () => {},
    };
  }

  const authMock = {
    onAuthStateChanged() {},
  };
  const firestoreFactory = () => ({
    collection(name) {
      return makeCollection([name]);
    },
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

  require(firebaseModulePath);
  assert.equal(global.FirebaseManager.init(), true);

  const games = await global.FirebaseManager.listGameMetadata();
  assert.equal(Array.isArray(games), true);
  assert.equal(games.length, 1);
  assert.equal(games[0].id, 'last_war');
  assert.equal(games[0].name, 'Last War Override');
  assert.equal(games[0].company, 'Override Inc');
  assert.equal(games[0].logo, 'data:image/png;base64,BBBB');
});

test('loadUserData prefers game subcollections over legacy/root map payloads', async () => {
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

  function createQuerySnapshot(docs) {
    return {
      empty: docs.length === 0,
      docs,
      forEach(callback) {
        docs.forEach((doc) => callback(doc));
      },
    };
  }

  function resolveDocGet(pathParts) {
    const joined = pathParts.join('/');
    if (joined === 'users/qa-user') {
      return {
        exists: true,
        data: () => ({
          playerDatabase: {
            LegacyOnly: { power: 1, troops: 'Tank', thp: 1 },
          },
          events: {
            desert_storm: {
              name: 'Legacy Desert',
              buildingConfig: [{ name: 'Legacy HQ', slots: 1, priority: 1 }],
              buildingPositions: { 'Legacy HQ': [1, 1] },
            },
          },
        }),
      };
    }
    if (joined === 'users/qa-user/games/desert_ops') {
      return {
        exists: true,
        data: () => ({
          playerDatabase: {
            RootGameDocPlayer: { power: 3, troops: 'Aero', thp: 2 },
          },
          events: {
            desert_storm: {
              name: 'Root Game Desert',
              buildingConfig: [{ name: 'Root HQ', slots: 1, priority: 1 }],
              buildingPositions: { 'Root HQ': [2, 2] },
            },
          },
        }),
      };
    }
    if (joined === 'app_config/default_event_positions' || joined === 'app_config/default_event_building_config') {
      return {
        exists: false,
        data: () => ({}),
      };
    }
    return {
      exists: false,
      data: () => ({}),
    };
  }

  function resolveCollectionGet(pathParts) {
    const joined = pathParts.join('/');
    if (joined === 'users/qa-user/games/desert_ops/players') {
      return createQuerySnapshot([
        {
          id: 'player_sub_1',
          data: () => ({
            name: 'SubcollectionPlayer',
            power: 99,
            troops: 'Missile',
            thp: 77,
          }),
        },
      ]);
    }
    if (joined === 'users/qa-user/games/desert_ops/events') {
      return createQuerySnapshot([
        {
          id: 'desert_storm',
          data: () => ({
            id: 'desert_storm',
            name: 'Subcollection Desert',
            logoDataUrl: '',
            mapDataUrl: '',
            assignmentAlgorithmId: 'balanced_round_robin',
            buildingConfig: [{ name: 'Sub HQ', slots: 1, priority: 1 }],
            buildingConfigVersion: 1,
            buildingPositions: { 'Sub HQ': [9, 9] },
            buildingPositionsVersion: 1,
          }),
        },
      ]);
    }
    return createQuerySnapshot([]);
  }

  function makeCollection(pathParts) {
    return {
      doc(id) {
        return makeDocRef(pathParts.concat(id));
      },
      where() {
        return this;
      },
      limit() {
        return this;
      },
      get: async () => resolveCollectionGet(pathParts),
      add: async () => ({ id: 'mock-id' }),
    };
  }

  function makeDocRef(pathParts) {
    return {
      collection(name) {
        return makeCollection(pathParts.concat(name));
      },
      get: async () => resolveDocGet(pathParts),
      set: async () => {},
      update: async () => {},
      delete: async () => {},
      path: pathParts.join('/'),
    };
  }

  const authMock = {
    onAuthStateChanged() {},
  };

  const firestoreFactory = () => ({
    collection(name) {
      return makeCollection([name]);
    },
    batch: () => ({
      set() {},
      update() {},
      delete() {},
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

  require(firebaseModulePath);
  assert.equal(global.FirebaseManager.init(), true);

  const result = await global.FirebaseManager.loadUserData(
    {
      uid: 'qa-user',
      email: 'qa@example.com',
      providerData: [{ providerId: 'password' }],
    },
    { gameId: 'desert_ops' }
  );

  assert.equal(result.success, true);

  const players = global.FirebaseManager.getPlayerDatabase({ gameId: 'desert_ops' });
  assert.equal(Object.prototype.hasOwnProperty.call(players, 'SubcollectionPlayer'), true);
  assert.equal(Object.prototype.hasOwnProperty.call(players, 'LegacyOnly'), false);

  const eventMeta = global.FirebaseManager.getEventMeta('desert_storm', { gameId: 'desert_ops' });
  assert.equal(eventMeta.name, 'Subcollection Desert');
});

test('saveUserData persists players and events into game subcollections for selected game', async () => {
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

  const setPaths = [];
  const batchSetPaths = [];

  function createSnapshot(docs) {
    return {
      empty: docs.length === 0,
      docs,
      forEach(callback) {
        docs.forEach((doc) => callback(doc));
      },
    };
  }

  function resolveDocGet(pathParts) {
    const joined = pathParts.join('/');
    if (joined === 'users/qa-user') {
      return { exists: false, data: () => ({}) };
    }
    if (joined === 'users/qa-user/games/desert_ops') {
      return { exists: false, data: () => ({}) };
    }
    if (joined === 'app_config/default_event_positions' || joined === 'app_config/default_event_building_config') {
      return { exists: false, data: () => ({}) };
    }
    return { exists: false, data: () => ({}) };
  }

  function resolveCollectionGet(pathParts) {
    const joined = pathParts.join('/');
    if (joined === 'users/qa-user/games/desert_ops/players') {
      return createSnapshot([]);
    }
    if (joined === 'users/qa-user/games/desert_ops/events') {
      return createSnapshot([]);
    }
    return createSnapshot([]);
  }

  function makeCollection(pathParts) {
    return {
      doc(id) {
        return makeDocRef(pathParts.concat(id));
      },
      where() {
        return this;
      },
      limit() {
        return this;
      },
      get: async () => resolveCollectionGet(pathParts),
      add: async () => ({ id: 'mock-id' }),
    };
  }

  function makeDocRef(pathParts) {
    return {
      collection(name) {
        return makeCollection(pathParts.concat(name));
      },
      get: async () => resolveDocGet(pathParts),
      set: async () => {
        setPaths.push(pathParts.join('/'));
      },
      update: async () => {},
      delete: async () => {},
      path: pathParts.join('/'),
    };
  }

  let authStateChanged = null;
  const authMock = {
    onAuthStateChanged(cb) {
      authStateChanged = cb;
    },
    async signOut() {},
  };

  const firestoreFactory = () => ({
    collection(name) {
      return makeCollection([name]);
    },
    batch: () => ({
      set(ref) {
        batchSetPaths.push(ref.path);
      },
      update() {},
      delete(ref) {
        batchSetPaths.push(ref.path);
      },
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

  require(firebaseModulePath);
  assert.equal(global.FirebaseManager.init(), true);
  assert.equal(typeof authStateChanged, 'function');

  await authStateChanged({
    uid: 'qa-user',
    email: 'qa@example.com',
    emailVerified: true,
    providerData: [{ providerId: 'password' }],
  });

  const gameContext = { gameId: 'desert_ops' };
  const upsertPlayerResult = await global.FirebaseManager.upsertPlayerEntry('personal', '', {
    name: 'SubDoc QA Player',
    power: 123,
    troops: 'Tank',
    thp: 44,
  }, gameContext);
  assert.equal(upsertPlayerResult.success, true);

  global.FirebaseManager.upsertEvent('desert_storm', {
    name: 'SubDoc Event',
    logoDataUrl: 'data:image/png;base64,AAAA',
    mapDataUrl: 'data:image/png;base64,BBBB',
    assignmentAlgorithmId: 'balanced_round_robin',
    buildingConfig: [{ name: 'HQ', slots: 1, priority: 1 }],
    buildingPositions: { HQ: [10, 20] },
  }, gameContext);

  const saveResult = await global.FirebaseManager.saveUserData({ immediate: true }, gameContext);
  assert.equal(saveResult.success, true);

  const combinedPaths = setPaths.concat(batchSetPaths);
  assert.equal(
    combinedPaths.some((path) => path.startsWith('users/qa-user/games/desert_ops/players/')),
    true
  );
  assert.equal(
    combinedPaths.some((path) => path.startsWith('users/qa-user/games/desert_ops/events/')),
    true
  );
  assert.equal(
    combinedPaths.some((path) => path.startsWith('users/qa-user/games/desert_ops/event_media/')),
    true
  );
});

test('loadUserData alliance reads stay game-scoped and do not hit legacy root alliance path', async () => {
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

  let authStateChanged = null;
  let legacyAllianceReads = 0;

  function createSnapshot(docs) {
    return {
      empty: docs.length === 0,
      docs,
      forEach(callback) {
        docs.forEach((doc) => callback(doc));
      },
    };
  }

  function resolveDocGet(pathParts) {
    const joined = pathParts.join('/');
    if (joined === 'users/qa-user/games/desert_ops') {
      return {
        exists: true,
        data: () => ({
          playerDatabase: {},
          events: {},
          allianceId: 'alliance-x',
          allianceName: 'Alliance X',
          playerSource: 'alliance',
        }),
      };
    }
    if (joined === 'games/desert_ops/alliances/alliance-x') {
      return {
        exists: true,
        data: () => ({
          gameId: 'desert_ops',
          name: 'Alliance X',
          members: {
            'qa-user': { email: 'qa@example.com' },
          },
          playerDatabase: {},
        }),
      };
    }
    if (joined === 'alliances/alliance-x') {
      legacyAllianceReads += 1;
      return {
        exists: true,
        data: () => ({
          name: 'Legacy Alliance',
          members: {
            'qa-user': { email: 'qa@example.com' },
          },
          playerDatabase: {},
        }),
      };
    }
    if (joined === 'app_config/default_event_positions' || joined === 'app_config/default_event_building_config') {
      return { exists: false, data: () => ({}) };
    }
    return { exists: false, data: () => ({}) };
  }

  function resolveCollectionGet() {
    return createSnapshot([]);
  }

  function makeCollection(pathParts) {
    return {
      doc(id) {
        return makeDocRef(pathParts.concat(id));
      },
      where() {
        return this;
      },
      limit() {
        return this;
      },
      get: async () => resolveCollectionGet(pathParts),
      add: async () => ({ id: 'mock-id' }),
    };
  }

  function makeDocRef(pathParts) {
    return {
      collection(name) {
        return makeCollection(pathParts.concat(name));
      },
      get: async () => resolveDocGet(pathParts),
      set: async () => {},
      update: async () => {},
      delete: async () => {},
      onSnapshot(callback) {
        callback({
          exists: true,
          data: () => ({
            gameId: 'desert_ops',
            name: 'Alliance X',
            members: {
              'qa-user': { email: 'qa@example.com' },
            },
            playerDatabase: {},
          }),
        });
        return () => {};
      },
      path: pathParts.join('/'),
    };
  }

  const authMock = {
    onAuthStateChanged(cb) {
      authStateChanged = cb;
    },
    async signOut() {},
  };

  const firestoreFactory = () => ({
    collection(name) {
      return makeCollection([name]);
    },
    batch: () => ({
      set() {},
      update() {},
      delete() {},
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

  require(firebaseModulePath);
  assert.equal(global.FirebaseManager.init(), true);
  assert.equal(typeof authStateChanged, 'function');

  const authUser = {
    uid: 'qa-user',
    email: 'qa@example.com',
    emailVerified: true,
    providerData: [{ providerId: 'password' }],
  };
  await authStateChanged(authUser);
  const result = await global.FirebaseManager.loadUserData(authUser, { gameId: 'desert_ops' });

  assert.equal(result.success, true);
  assert.equal(legacyAllianceReads, 0);
});

test('loadUserData reads legacy alliance doc when game-scoped alliance is denied', async () => {
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

  let authStateChanged = null;

  function createSnapshot(docs) {
    return {
      empty: docs.length === 0,
      docs,
      forEach(callback) {
        docs.forEach((doc) => callback(doc));
      },
    };
  }

  function resolveDocGet(pathParts) {
    const joined = pathParts.join('/');
    if (joined === 'users/qa-user/games/desert_ops') {
      return {
        exists: true,
        data: () => ({
          playerDatabase: {},
          events: {},
          allianceId: 'alliance-x',
          allianceName: 'Alliance X',
          playerSource: 'alliance',
        }),
      };
    }
    if (joined === 'games/desert_ops/alliances/alliance-x') {
      throw permissionDeniedError();
    }
    if (joined === 'alliances/alliance-x') {
      return {
        exists: true,
        data: () => ({
          name: 'Legacy Alliance X',
          members: {
            'qa-user': { email: 'qa@example.com' },
          },
          playerDatabase: {
            LegacyMember: { power: 25, troops: 'Tank', thp: 11 },
          },
        }),
      };
    }
    if (joined === 'app_config/default_event_positions' || joined === 'app_config/default_event_building_config') {
      return { exists: false, data: () => ({}) };
    }
    return { exists: false, data: () => ({}) };
  }

  function makeCollection(pathParts) {
    return {
      doc(id) {
        return makeDocRef(pathParts.concat(id));
      },
      where() {
        return this;
      },
      limit() {
        return this;
      },
      get: async () => createSnapshot([]),
      add: async () => ({ id: 'mock-id' }),
    };
  }

  function makeDocRef(pathParts) {
    return {
      collection(name) {
        return makeCollection(pathParts.concat(name));
      },
      get: async () => resolveDocGet(pathParts),
      set: async () => {},
      update: async () => {},
      delete: async () => {},
      onSnapshot(callback) {
        callback({
          exists: true,
          data: () => resolveDocGet(pathParts).data(),
        });
        return () => {};
      },
      path: pathParts.join('/'),
    };
  }

  const authMock = {
    onAuthStateChanged(cb) {
      authStateChanged = cb;
    },
    async signOut() {},
  };

  const firestoreFactory = () => ({
    collection(name) {
      return makeCollection([name]);
    },
    batch: () => ({
      set() {},
      update() {},
      delete() {},
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

  require(firebaseModulePath);
  assert.equal(global.FirebaseManager.init(), true);
  assert.equal(typeof authStateChanged, 'function');

  const authUser = {
    uid: 'qa-user',
    email: 'qa@example.com',
    emailVerified: true,
    providerData: [{ providerId: 'password' }],
  };
  await authStateChanged(authUser);
  const context = { gameId: 'desert_ops' };
  const result = await global.FirebaseManager.loadUserData(authUser, context);

  assert.equal(result.success, true);
  assert.equal(
    ['Legacy Alliance X', 'Alliance X'].includes(global.FirebaseManager.getAllianceName(context)),
    true
  );
  assert.equal(global.FirebaseManager.getPlayerSource(context), 'alliance');
  assert.ok(global.FirebaseManager.getAllianceMembers(context)['qa-user']);
  assert.ok(global.FirebaseManager.getAlliancePlayerDatabase(context).LegacyMember);
});

test('loadUserData falls back to personal source when alliance read is permission-denied', async () => {
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

  let authStateChanged = null;

  function createSnapshot(docs) {
    return {
      empty: docs.length === 0,
      docs,
      forEach(callback) {
        docs.forEach((doc) => callback(doc));
      },
    };
  }

  function resolveDocGet(pathParts) {
    const joined = pathParts.join('/');
    if (joined === 'users/qa-user/games/desert_ops') {
      return {
        exists: true,
        data: () => ({
          playerDatabase: {
            PersonalA: { power: 100, troops: 'Tank', thp: 45 },
          },
          events: {},
          allianceId: 'alliance-x',
          allianceName: 'Alliance X',
          playerSource: 'alliance',
        }),
      };
    }
    if (joined === 'games/desert_ops/alliances/alliance-x') {
      throw permissionDeniedError();
    }
    if (joined === 'app_config/default_event_positions' || joined === 'app_config/default_event_building_config') {
      return { exists: false, data: () => ({}) };
    }
    return { exists: false, data: () => ({}) };
  }

  function makeCollection(pathParts) {
    return {
      doc(id) {
        return makeDocRef(pathParts.concat(id));
      },
      where() {
        return this;
      },
      limit() {
        return this;
      },
      get: async () => createSnapshot([]),
      add: async () => ({ id: 'mock-id' }),
    };
  }

  function makeDocRef(pathParts) {
    return {
      collection(name) {
        return makeCollection(pathParts.concat(name));
      },
      get: async () => resolveDocGet(pathParts),
      set: async () => {},
      update: async () => {},
      delete: async () => {},
      path: pathParts.join('/'),
    };
  }

  const authMock = {
    onAuthStateChanged(cb) {
      authStateChanged = cb;
    },
    async signOut() {},
  };

  const firestoreFactory = () => ({
    collection(name) {
      return makeCollection([name]);
    },
    batch: () => ({
      set() {},
      update() {},
      delete() {},
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

  require(firebaseModulePath);
  assert.equal(global.FirebaseManager.init(), true);
  assert.equal(typeof authStateChanged, 'function');

  const authUser = {
    uid: 'qa-user',
    email: 'qa@example.com',
    emailVerified: true,
    providerData: [{ providerId: 'password' }],
  };
  await authStateChanged(authUser);
  const context = { gameId: 'desert_ops' };
  const result = await global.FirebaseManager.loadUserData(authUser, context);

  assert.equal(result.success, true);
  assert.equal(global.FirebaseManager.getPlayerSource(context), 'personal');
  const activePlayers = global.FirebaseManager.getActivePlayerDatabase(context);
  assert.equal(Object.prototype.hasOwnProperty.call(activePlayers, 'PersonalA'), true);
});

test('loadUserData strict mode blocks legacy fallback when game-scoped profile is denied', async () => {
  global.window = global;
  global.window.__MULTIGAME_FLAGS = { MULTIGAME_STRICT_MODE: true };
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

  let authStateChanged = null;

  function makeCollection(pathParts) {
    return {
      doc(id) {
        return makeDocRef(pathParts.concat(id));
      },
      where() {
        return this;
      },
      limit() {
        return this;
      },
      get: async () => ({ empty: true, docs: [] }),
      add: async () => ({ id: 'mock-id' }),
    };
  }

  function resolveDocGet(pathParts) {
    const joined = pathParts.join('/');
    if (joined === 'users/qa-user/games/desert_ops') {
      throw permissionDeniedError();
    }
    if (joined === 'users/qa-user') {
      return {
        exists: true,
        data: () => ({
          playerDatabase: {
            LegacyPlayer: { power: 999, troops: 'Tank' },
          },
          playerSource: 'personal',
        }),
      };
    }
    return { exists: false, data: () => ({}) };
  }

  function makeDocRef(pathParts) {
    return {
      collection(name) {
        return makeCollection(pathParts.concat(name));
      },
      get: async () => resolveDocGet(pathParts),
      set: async () => {},
      update: async () => {},
      delete: async () => {},
      path: pathParts.join('/'),
    };
  }

  const authMock = {
    onAuthStateChanged(cb) {
      authStateChanged = cb;
    },
    async signOut() {},
  };

  const firestoreFactory = () => ({
    collection(name) {
      return makeCollection([name]);
    },
    batch: () => ({
      set() {},
      update() {},
      delete() {},
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

  require(firebaseModulePath);
  assert.equal(global.FirebaseManager.init(), true);
  assert.equal(typeof authStateChanged, 'function');

  const authUser = {
    uid: 'qa-user',
    email: 'qa@example.com',
    emailVerified: true,
    providerData: [{ providerId: 'password' }],
  };
  await authStateChanged(authUser);
  const result = await global.FirebaseManager.loadUserData(authUser, { gameId: 'desert_ops' });

  assert.equal(result.success, false);
  assert.equal(result.strictMode, true);
  assert.equal(result.errorKey, 'strict_mode_game_profile_unavailable');
});
