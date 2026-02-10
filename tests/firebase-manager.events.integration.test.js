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
  delete global.alert;
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

  const created = global.FirebaseManager.upsertEvent('test_event', {
    name: 'Test Event',
    logoDataUrl: 'data:image/png;base64,AAAA',
    mapDataUrl: 'data:image/png;base64,BBBB',
  });
  assert.equal(created.id, 'test_event');
  assert.equal(created.name, 'Test Event');

  global.FirebaseManager.setBuildingConfig('test_event', [{ name: 'HQ', slots: 2, priority: 1 }]);
  global.FirebaseManager.setBuildingPositions('test_event', { HQ: [20, 30] });

  const allEventData = global.FirebaseManager.getAllEventData();
  assert.ok(allEventData.test_event);
  assert.equal(allEventData.test_event.name, 'Test Event');
  assert.equal(allEventData.test_event.buildingConfig.length, 1);
  assert.deepEqual(allEventData.test_event.buildingPositions.HQ, [20, 30]);

  assert.equal(global.FirebaseManager.removeEvent('test_event'), true);
  assert.equal(global.FirebaseManager.removeEvent('desert_storm'), false);
});
