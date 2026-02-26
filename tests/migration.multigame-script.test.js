const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const scriptPath = path.resolve(__dirname, '../scripts/migrate_multigame_first_class.js');
const migrationScript = require(scriptPath);

test('normalizeGameId canonicalizes mixed values', () => {
  assert.equal(migrationScript.normalizeGameId(' Last War: Survival '), 'last_war_survival');
  assert.equal(migrationScript.normalizeGameId(''), '');
  assert.equal(migrationScript.normalizeGameId(null), '');
});

test('extractGamePayloadsFromUserDoc merges root legacy payload and games map', () => {
  const payloads = migrationScript.extractGamePayloadsFromUserDoc({
    playerDatabase: { Alpha: { power: 1 } },
    playerSource: 'personal',
    games: {
      desert_ops: {
        playerSource: 'alliance',
        allianceId: 'a1',
      },
    },
  }, 'last_war');

  assert.equal(payloads.has('last_war'), true);
  assert.equal(payloads.has('desert_ops'), true);
  assert.equal(payloads.get('last_war').playerSource, 'personal');
  assert.equal(payloads.get('desert_ops').allianceId, 'a1');
});

test('extractGamePayloadsFromUserDoc preserves non-empty root playerDatabase when games map has empty playerDatabase', () => {
  const payloads = migrationScript.extractGamePayloadsFromUserDoc({
    playerDatabase: { RootOnly: { power: 123 } },
    games: {
      last_war: {
        playerDatabase: {},
        playerSource: 'alliance',
      },
    },
  }, 'last_war');

  assert.equal(payloads.has('last_war'), true);
  assert.equal(Object.keys(payloads.get('last_war').playerDatabase).length, 1);
  assert.equal(payloads.get('last_war').playerSource, 'alliance');
});

test('splitEventMedia moves logo/map blobs into dedicated event_media payload', () => {
  const result = migrationScript.splitEventMedia({
    desert_storm: {
      name: 'Desert Storm',
      logoDataUrl: 'data:image/png;base64,AAAA',
      mapDataUrl: 'data:image/png;base64,BBBB',
      assignmentAlgorithmId: 'balanced_round_robin',
    },
  });

  assert.equal(Object.prototype.hasOwnProperty.call(result.events.desert_storm, 'logoDataUrl'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result.events.desert_storm, 'mapDataUrl'), false);
  assert.equal(result.eventMedia.desert_storm.logoDataUrl.length > 0, true);
  assert.equal(result.eventMedia.desert_storm.mapDataUrl.length > 0, true);
});

test('applyLegacyBuildingFieldsToEvents promotes root legacy building fields into desert_storm event', () => {
  const result = migrationScript.applyLegacyBuildingFieldsToEvents({}, {
    buildingConfig: [{ name: 'Legacy HQ', slots: 1, priority: 2 }],
    buildingConfigVersion: 3,
    buildingPositions: { 'Legacy HQ': [10, 20] },
    buildingPositionsVersion: 4,
  }, 'desert_storm');

  assert.equal(Array.isArray(result.desert_storm.buildingConfig), true);
  assert.equal(result.desert_storm.buildingConfig[0].name, 'Legacy HQ');
  assert.equal(result.desert_storm.buildingConfigVersion, 3);
  assert.deepEqual(result.desert_storm.buildingPositions['Legacy HQ'], [10, 20]);
  assert.equal(result.desert_storm.buildingPositionsVersion, 4);
});

test('mergeEventMediaMaps overlays legacy media onto split media payload', () => {
  const merged = migrationScript.mergeEventMediaMaps(
    { desert_storm: { logoDataUrl: 'data:image/png;base64,AAA', mapDataUrl: '' } },
    { canyon_battlefield: { logoDataUrl: '', mapDataUrl: 'data:image/png;base64,BBB' } }
  );
  assert.equal(Object.keys(merged).length, 2);
  assert.equal(merged.desert_storm.logoDataUrl.length > 0, true);
  assert.equal(merged.canyon_battlefield.mapDataUrl.length > 0, true);
});

test('buildGameDocPatch always stamps migration metadata and keeps association fields', () => {
  const patch = migrationScript.buildGameDocPatch({
    playerSource: 'alliance',
    allianceId: 'a1',
    allianceName: 'Alliance A',
    userProfile: { displayName: 'Cristi' },
  });

  assert.equal(patch.playerSource, 'alliance');
  assert.equal(patch.allianceId, 'a1');
  assert.equal(patch.allianceName, 'Alliance A');
  assert.equal(patch.userProfile.displayName, 'Cristi');
  assert.ok(patch.metadata);
  assert.equal(typeof patch.metadata.migrationVersion, 'number');
});

test('createStableDocId is deterministic for identical names', () => {
  const a = migrationScript.createStableDocId('Player One', 'player');
  const b = migrationScript.createStableDocId('Player One', 'player');
  const c = migrationScript.createStableDocId('Player Two', 'player');
  assert.equal(a, b);
  assert.notEqual(a, c);
});
