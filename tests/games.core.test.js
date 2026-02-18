const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const modulePath = path.resolve(__dirname, '../js/core/games.js');

function loadModule() {
  global.window = global;
  delete global.DSCoreGames;
  delete require.cache[require.resolve(modulePath)];
  require(modulePath);
}

test('games core exposes last_war catalog entry with required metadata', () => {
  loadModule();
  const game = global.DSCoreGames.getGame('last_war');
  assert.equal(game.id, 'last_war');
  assert.equal(typeof game.name, 'string');
  assert.equal(typeof game.logo, 'string');
  assert.equal(typeof game.company, 'string');
  assert.ok(Array.isArray(game.assignmentAlgorithmIds));
  assert.ok(Array.isArray(game.troopModel.categories));
  assert.ok(Array.isArray(game.playerImportSchema.columns));
});

test('listAvailableGames returns deep copies', () => {
  loadModule();
  const first = global.DSCoreGames.listAvailableGames();
  const second = global.DSCoreGames.listAvailableGames();
  assert.ok(first.length > 0);
  first[0].name = 'mutated';
  assert.notEqual(second[0].name, 'mutated');
});

test('super-admin policy allows only fixed uid for metadata editing', () => {
  loadModule();
  const adminUid = '2z2BdO8aVsUovqQWWL9WCRMdV933';
  assert.equal(global.DSCoreGames.isGameMetadataSuperAdmin(adminUid), true);
  assert.equal(global.DSCoreGames.isGameMetadataSuperAdmin('someone-else'), false);
  assert.equal(global.DSCoreGames.canEditGameMetadata({ uid: adminUid }, 'last_war'), true);
  assert.equal(global.DSCoreGames.canEditGameMetadata({ uid: 'someone-else' }, 'last_war'), false);
});
