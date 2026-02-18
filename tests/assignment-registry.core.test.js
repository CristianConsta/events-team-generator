const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const gamesPath = path.resolve(__dirname, '../js/core/games.js');
const registryPath = path.resolve(__dirname, '../js/core/assignment-registry.js');

function loadModules() {
  global.window = global;
  delete global.DSCoreGames;
  delete global.DSAssignmentRegistry;
  delete require.cache[require.resolve(gamesPath)];
  delete require.cache[require.resolve(registryPath)];
  require(gamesPath);
  require(registryPath);
}

test('assignment registry exposes default algorithm', () => {
  loadModules();
  const algorithm = global.DSAssignmentRegistry.getAlgorithm('balanced_round_robin');
  assert.equal(algorithm.id, 'balanced_round_robin');
  assert.equal(algorithm.enabled, true);
});

test('assignment registry lists algorithms scoped to game catalog', () => {
  loadModules();
  const algorithms = global.DSAssignmentRegistry.listAlgorithmsForGame('last_war');
  assert.ok(Array.isArray(algorithms));
  assert.ok(algorithms.length >= 1);
  assert.equal(algorithms[0].id, 'balanced_round_robin');
});

test('assignment registry returns null for unknown algorithm in resolveAlgorithmForEvent', () => {
  loadModules();
  const result = global.DSAssignmentRegistry.resolveAlgorithmForEvent('last_war', 'unknown_algorithm');
  assert.equal(result, null);
});

test('assignment registry returns typed error for unknown algorithm selection', () => {
  loadModules();
  const result = global.DSAssignmentRegistry.resolveAlgorithmSelection('last_war', 'unknown_algorithm');
  assert.deepEqual(result, {
    success: false,
    error: 'unknown-assignment-algorithm',
    algorithmId: 'unknown_algorithm',
    gameId: 'last_war',
  });
});

test('assignment registry resolves default algorithm when selection is missing', () => {
  loadModules();
  const result = global.DSAssignmentRegistry.resolveAlgorithmSelection('last_war', '');
  assert.equal(result.success, true);
  assert.equal(result.algorithmId, 'balanced_round_robin');
  assert.equal(result.gameId, 'last_war');
  assert.equal(result.algorithm.id, 'balanced_round_robin');
});
