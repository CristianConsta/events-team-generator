const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const modulePath = path.resolve(__dirname, '../js/core/assignment.js');

function loadModule() {
  global.window = global;
  delete global.DSCoreAssignment;
  delete require.cache[require.resolve(modulePath)];
  require(modulePath);
}

// ── findMixPartner ──────────────────────────────────────────────────────────

test('findMixPartner returns null for empty available list', () => {
  loadModule();
  const top = { name: 'Top', troops: 'Tank' };
  assert.equal(global.DSCoreAssignment.findMixPartner(top, []), null);
});

test('findMixPartner returns null for non-array available', () => {
  loadModule();
  const top = { name: 'Top', troops: 'Tank' };
  assert.equal(global.DSCoreAssignment.findMixPartner(top, null), null);
  assert.equal(global.DSCoreAssignment.findMixPartner(top, undefined), null);
});

test('findMixPartner falls back to first candidate when no different troop type in top 3', () => {
  loadModule();
  const top = { name: 'Top', troops: 'Tank' };
  const available = [
    { name: 'A', troops: 'Tank' },
    { name: 'B', troops: 'Tank' },
    { name: 'C', troops: 'Tank' },
    { name: 'D', troops: 'Aero' }, // outside top-3 window
  ];
  const partner = global.DSCoreAssignment.findMixPartner(top, available);
  assert.equal(partner.name, 'A');
});

test('findMixPartner only inspects first 3 candidates for mix', () => {
  loadModule();
  const top = { name: 'Top', troops: 'Aero' };
  const available = [
    { name: 'A', troops: 'Aero' },
    { name: 'B', troops: 'Aero' },
    { name: 'C', troops: 'Tank' }, // position 3 — within window
    { name: 'D', troops: 'Missile' },
  ];
  const partner = global.DSCoreAssignment.findMixPartner(top, available);
  assert.equal(partner.name, 'C');
});

// ── assignTeamToBuildings ───────────────────────────────────────────────────

test('assignTeamToBuildings returns empty array when players list is empty', () => {
  loadModule();
  const config = [{ name: 'HQ', priority: 1, slots: 4 }];
  const result = global.DSCoreAssignment.assignTeamToBuildings([], config);
  assert.deepEqual(result, []);
});

test('assignTeamToBuildings returns empty array when config is empty', () => {
  loadModule();
  const players = [{ name: 'P1', power: 100, troops: 'Tank' }];
  const result = global.DSCoreAssignment.assignTeamToBuildings(players, []);
  assert.deepEqual(result, []);
});

test('assignTeamToBuildings handles non-array inputs gracefully', () => {
  loadModule();
  assert.deepEqual(global.DSCoreAssignment.assignTeamToBuildings(null, null), []);
  assert.deepEqual(global.DSCoreAssignment.assignTeamToBuildings(undefined, undefined), []);
});

test('assignTeamToBuildings skips buildings with zero slots', () => {
  loadModule();
  const players = [{ name: 'P1', power: 100, troops: 'Tank' }];
  const config = [
    { name: 'Empty', priority: 1, slots: 0 },
    { name: 'Active', priority: 2, slots: 2 },
  ];
  const result = global.DSCoreAssignment.assignTeamToBuildings(players, config);
  assert.ok(result.every((a) => a.buildingKey !== 'Empty'));
  assert.ok(result.some((a) => a.buildingKey === 'Active'));
});

test('assignTeamToBuildings does not assign more players than slots allow', () => {
  loadModule();
  const players = Array.from({ length: 10 }, (_, i) => ({
    name: `P${i + 1}`,
    power: 100 - i,
    troops: i % 2 === 0 ? 'Tank' : 'Aero',
  }));
  const config = [{ name: 'HQ', priority: 1, slots: 2 }];
  const result = global.DSCoreAssignment.assignTeamToBuildings(players, config);
  const hqAssignments = result.filter((a) => a.buildingKey === 'HQ');
  assert.ok(hqAssignments.length <= 2);
});

test('assignTeamToBuildings processes higher priority groups before lower priority', () => {
  loadModule();
  const players = [
    { name: 'Best', power: 1000, troops: 'Tank' },
    { name: 'Second', power: 500, troops: 'Aero' },
    { name: 'Third', power: 100, troops: 'Missile' },
  ];
  const config = [
    { name: 'Low', priority: 5, slots: 1 },
    { name: 'High', priority: 1, slots: 1 },
  ];
  const result = global.DSCoreAssignment.assignTeamToBuildings(players, config);
  const highAssigned = result.filter((a) => a.buildingKey === 'High').map((a) => a.player);
  // The top player should be assigned to the high-priority building
  assert.ok(highAssigned.includes('Best'));
});

test('assignTeamToBuildings uses label as display building name', () => {
  loadModule();
  const players = [
    { name: 'P1', power: 100, troops: 'Tank' },
    { name: 'P2', power: 90, troops: 'Aero' },
  ];
  const config = [{ name: 'internal_key', label: 'Display Name', priority: 1, slots: 2 }];
  const result = global.DSCoreAssignment.assignTeamToBuildings(players, config);
  result.forEach((a) => {
    assert.equal(a.building, 'Display Name');
    assert.equal(a.buildingKey, 'internal_key');
  });
});

test('assignTeamToBuildings falls back to name when label is absent', () => {
  loadModule();
  const players = [{ name: 'P1', power: 100, troops: 'Tank' }];
  const config = [{ name: 'Frontline', priority: 1, slots: 1 }];
  const result = global.DSCoreAssignment.assignTeamToBuildings(players, config);
  assert.equal(result[0].building, 'Frontline');
  assert.equal(result[0].buildingKey, 'Frontline');
});

test('assignTeamToBuildings each assignment has required fields', () => {
  loadModule();
  const players = [
    { name: 'P1', power: 100, troops: 'Tank' },
    { name: 'P2', power: 90, troops: 'Aero' },
  ];
  const config = [{ name: 'HQ', priority: 1, slots: 2 }];
  const result = global.DSCoreAssignment.assignTeamToBuildings(players, config);
  result.forEach((a) => {
    assert.ok(typeof a.building === 'string', 'building must be string');
    assert.ok(typeof a.buildingKey === 'string', 'buildingKey must be string');
    assert.ok(typeof a.player === 'string', 'player must be string');
    assert.ok(typeof a.priority === 'number', 'priority must be number');
    assert.ok(typeof a.troops === 'string', 'troops must be string');
    assert.ok(typeof a.power === 'number', 'power must be number');
  });
});

test('assignTeamToBuildings does not assign the same player twice', () => {
  loadModule();
  const players = [
    { name: 'Solo', power: 100, troops: 'Tank' },
  ];
  const config = [
    { name: 'A', priority: 1, slots: 2 },
    { name: 'B', priority: 2, slots: 2 },
  ];
  const result = global.DSCoreAssignment.assignTeamToBuildings(players, config);
  const names = result.map((a) => a.player);
  const unique = new Set(names);
  assert.equal(unique.size, names.length);
});

test('assignTeamToBuildings sorts same-priority buildings alphabetically', () => {
  loadModule();
  const players = [
    { name: 'P1', power: 100, troops: 'Tank' },
    { name: 'P2', power: 99, troops: 'Aero' },
  ];
  // 'Zebra' would come after 'Alpha' alphabetically
  const config = [
    { name: 'Zebra', priority: 1, slots: 1 },
    { name: 'Alpha', priority: 1, slots: 1 },
  ];
  const result = global.DSCoreAssignment.assignTeamToBuildings(players, config);
  // First anchor should go to 'Alpha' (alphabetically first at same priority)
  const alphaPlayer = result.find((a) => a.buildingKey === 'Alpha');
  assert.ok(alphaPlayer, 'Alpha should receive an assignment');
  assert.equal(alphaPlayer.player, 'P1', 'Highest power player should be assigned to Alpha (alphabetically first)');
});
