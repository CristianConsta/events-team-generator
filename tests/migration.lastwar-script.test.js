const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const scriptPath = path.resolve(__dirname, '../scripts/migrate_legacy_last_war_to_game_subcollections.js');
const migrationScript = require(scriptPath);

test('hasLegacyPayload detects legacy root fields', () => {
  assert.equal(migrationScript.hasLegacyPayload({ playerDatabase: {} }), true);
  assert.equal(migrationScript.hasLegacyPayload({ events: {} }), true);
  assert.equal(migrationScript.hasLegacyPayload({ foo: 'bar' }), false);
});

test('buildGamePatch copies only missing fields into game payload', () => {
  const legacyData = {
    playerDatabase: { Alice: { power: 1 } },
    events: { desert_storm: { name: 'Desert Storm' } },
    playerSource: 'personal',
  };
  const gameData = {
    playerDatabase: { Bob: { power: 2 } },
  };

  const patch = migrationScript.buildGamePatch(legacyData, gameData);
  assert.equal(Object.prototype.hasOwnProperty.call(patch, 'playerDatabase'), false);
  assert.deepEqual(patch.events, { desert_storm: { name: 'Desert Storm' } });
  assert.equal(patch.playerSource, 'personal');
  assert.ok(patch.metadata);
});

test('buildGamePatch is idempotent when game doc already has migrated fields', () => {
  const legacyData = {
    playerDatabase: { Alice: { power: 1 } },
    events: { desert_storm: { name: 'Desert Storm' } },
    playerSource: 'personal',
  };
  const gameData = {
    playerDatabase: { Alice: { power: 1 } },
    events: { desert_storm: { name: 'Desert Storm' } },
    playerSource: 'personal',
  };

  const patch = migrationScript.buildGamePatch(legacyData, gameData);
  assert.equal(Object.keys(patch).length, 0);
});
