const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const firebaseModulePath = path.resolve(__dirname, '../firebase-module.js');
const firebaseServicePath = path.resolve(__dirname, '../js/services/firebase-service.js');
const translationsPath = path.resolve(__dirname, '../translations.js');

function resetModule(modulePath) {
  delete require.cache[require.resolve(modulePath)];
}

function resetGlobals() {
  delete global.window;
  delete global.document;
  delete global.alert;
  delete global.FIREBASE_CONFIG;
  delete global.FirebaseManager;
  delete global.FirebaseService;
  delete global.translations;
}

test.afterEach(() => {
  resetModule(firebaseModulePath);
  resetModule(firebaseServicePath);
  resetModule(translationsPath);
  resetGlobals();
});

test('phase0 guardrail: firebase API surface for critical flows is preserved', () => {
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
  require(firebaseServicePath);

  assert.ok(global.FirebaseManager, 'FirebaseManager should be available');
  assert.ok(global.FirebaseService, 'FirebaseService should be available');

  const managerMethods = [
    'signInWithGoogle',
    'signInWithEmail',
    'signUpWithEmail',
    'resetPassword',
    'signOut',
    'deleteUserAccountAndData',
    'uploadPlayerDatabase',
    'upsertPlayerEntry',
    'removePlayerEntry',
    'upsertEvent',
    'removeEvent',
    'setBuildingConfig',
    'setBuildingPositions',
    'createAlliance',
    'leaveAlliance',
    'sendInvitation',
    'checkInvitations',
    'acceptInvitation',
    'rejectInvitation',
    'getInvitationNotifications',
    'getActivePlayerDatabase',
  ];
  managerMethods.forEach((method) => {
    assert.equal(typeof global.FirebaseManager[method], 'function', `FirebaseManager.${method} should exist`);
  });

  const serviceMethods = [
    'signInWithGoogle',
    'signInWithEmail',
    'signUpWithEmail',
    'resetPassword',
    'signOut',
    'deleteUserAccountAndData',
    'loadUserData',
    'uploadPlayerDatabase',
    'upsertPlayerEntry',
    'removePlayerEntry',
    'upsertEvent',
    'removeEvent',
    'setBuildingConfig',
    'setBuildingPositions',
    'createAlliance',
    'leaveAlliance',
    'sendInvitation',
    'checkInvitations',
    'acceptInvitation',
    'rejectInvitation',
    'getInvitationNotifications',
    'getActivePlayerDatabase',
  ];
  serviceMethods.forEach((method) => {
    assert.equal(typeof global.FirebaseService[method], 'function', `FirebaseService.${method} should exist`);
  });
});

test('phase0 guardrail: critical translations are available in all supported languages', () => {
  global.window = global;
  require(translationsPath);

  const supported = ['en', 'fr', 'de', 'it', 'ko', 'ro'];
  const criticalKeys = [
    'login_title',
    'generator_button',
    'players_management_button',
    'players_list_title',
    'players_list_add_button',
    'players_list_delete_button',
    'events_manager_title',
    'alliance_button',
    'notifications_title',
    'select_players_for_event_title',
    'assignment_algorithm_label',
    'assignment_algorithm_balanced',
    'assignment_algorithm_aggressive',
    'assignment_algorithm_help',
    'download_map',
    'download_excel',
  ];

  supported.forEach((lang) => {
    const pack = global.translations[lang];
    assert.ok(pack, `missing language pack: ${lang}`);
    criticalKeys.forEach((key) => {
      assert.equal(typeof pack[key], 'string', `${lang}.${key} should be a string`);
      assert.ok(pack[key].trim().length > 0, `${lang}.${key} should not be empty`);
    });
  });
});
