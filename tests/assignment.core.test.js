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

test('findMixPartner picks different troop from top 3 candidates', () => {
  loadModule();
  const top = { name: 'Top', troops: 'Tank' };
  const available = [
    { name: 'A', troops: 'Tank' },
    { name: 'B', troops: 'Missile' },
    { name: 'C', troops: 'Tank' },
  ];
  const partner = global.DSCoreAssignment.findMixPartner(top, available);
  assert.equal(partner.name, 'B');
});

test('assignTeamToBuildings round-robins anchors across same-priority buildings', () => {
  loadModule();
  const players = [
    { name: 'P1', power: 100, troops: 'Tank' },
    { name: 'P2', power: 99, troops: 'Aero' },
    { name: 'P3', power: 98, troops: 'Missile' },
    { name: 'P4', power: 97, troops: 'Tank' },
  ];
  const config = [
    { name: 'B1', priority: 1, slots: 2 },
    { name: 'B2', priority: 1, slots: 2 },
  ];

  const result = global.DSCoreAssignment.assignTeamToBuildings(players, config);
  assert.equal(result.length, 4);
  const b1 = result.filter((x) => x.building === 'B1').map((x) => x.player);
  const b2 = result.filter((x) => x.building === 'B2').map((x) => x.player);

  assert.ok(b1.includes('P1'));
  assert.ok(b2.includes('P2'));
});

test('assignTeamToBuildings fills odd-slot buildings in phase 3', () => {
  loadModule();
  const players = [
    { name: 'P1', power: 100, troops: 'Tank' },
    { name: 'P2', power: 99, troops: 'Aero' },
    { name: 'P3', power: 98, troops: 'Missile' },
  ];
  const config = [
    { name: 'OddOne', priority: 2, slots: 1 },
    { name: 'Pair', priority: 2, slots: 2 },
  ];

  const result = global.DSCoreAssignment.assignTeamToBuildings(players, config);
  assert.equal(result.length, 3);
  const oddAssignments = result.filter((x) => x.building === 'OddOne');
  assert.equal(oddAssignments.length, 1);
});

test('assignTeamToBuildings emits display label and keeps internal buildingKey', () => {
  loadModule();
  const players = [
    { name: 'P1', power: 100, troops: 'Tank' },
    { name: 'P2', power: 99, troops: 'Aero' },
  ];
  const config = [
    { name: 'Bomb Squad', label: 'BS Main', priority: 1, slots: 2 },
  ];

  const result = global.DSCoreAssignment.assignTeamToBuildings(players, config);
  assert.equal(result.length, 2);
  result.forEach((assignment) => {
    assert.equal(assignment.building, 'BS Main');
    assert.equal(assignment.buildingKey, 'Bomb Squad');
  });
});

test('assignTeamToBuildings preserves troop metadata for rendering icons', () => {
  loadModule();
  const players = [
    { name: 'P1', power: 100, troops: 'Tank', thp: 55 },
    { name: 'P2', power: 99, troops: 'Aero' },
  ];
  const config = [
    { name: 'Frontline', priority: 1, slots: 2 },
  ];

  const result = global.DSCoreAssignment.assignTeamToBuildings(players, config);
  const byName = new Map(result.map((assignment) => [assignment.player, assignment]));

  assert.equal(byName.get('P1').troops, 'Tank');
  assert.equal(byName.get('P2').troops, 'Aero');
  assert.equal(byName.get('P1').power, 100);
  assert.equal(byName.get('P2').power, 99);
  assert.equal(byName.get('P1').thp, 55);
  assert.equal(byName.get('P2').thp, 0);
});

test('assignTeamToBuildings uses THP as tie-break for similar power players (+/-1M)', () => {
  loadModule();
  const players = [
    { name: 'PowerLead', power: 20900000, troops: 'Tank', thp: 120 },
    { name: 'THPLead', power: 20150000, troops: 'Aero', thp: 650 },
  ];
  const config = [
    { name: 'Frontline', priority: 1, slots: 1 },
  ];

  const result = global.DSCoreAssignment.assignTeamToBuildings(players, config);
  assert.equal(result.length, 1);
  assert.equal(result[0].player, 'THPLead');
});

test('assignTeamToBuildingsAggressive fills Team-type buildings first with top players', () => {
  loadModule();
  const players = [
    { name: 'P1', power: 120, thp: 100, troops: 'Tank' },
    { name: 'P2', power: 110, thp: 90, troops: 'Aero' },
    { name: 'P3', power: 100, thp: 80, troops: 'Missile' },
    { name: 'P4', power: 90, thp: 70, troops: 'Tank' },
    { name: 'P5', power: 80, thp: 60, troops: 'Aero' },
  ];
  const config = [
    { name: 'Map-HQ', priority: 1, slots: 2, showOnMap: true },
    { name: 'Map-Outpost', priority: 2, slots: 1, showOnMap: true },
    { name: 'Team-Core', priority: 4, slots: 2, showOnMap: false },
  ];

  const result = global.DSCoreAssignment.assignTeamToBuildingsAggressive(players, config);
  assert.equal(result.length, 5);

  const teamAssignments = result.filter((x) => x.buildingKey === 'Team-Core').map((x) => x.player);
  const hqAssignments = result.filter((x) => x.buildingKey === 'Map-HQ').map((x) => x.player);
  const outpostAssignments = result.filter((x) => x.buildingKey === 'Map-Outpost').map((x) => x.player);

  assert.deepEqual(teamAssignments, ['P1', 'P2']);
  assert.deepEqual(hqAssignments, ['P3', 'P4']);
  assert.deepEqual(outpostAssignments, ['P5']);
});

test('assignTeamToBuildingsAggressive does not enforce troop mix pairing', () => {
  loadModule();
  const players = [
    { name: 'TopTankA', power: 200, thp: 40, troops: 'Tank' },
    { name: 'TopTankB', power: 190, thp: 39, troops: 'Tank' },
    { name: 'MissileC', power: 180, thp: 38, troops: 'Missile' },
  ];
  const config = [
    { name: 'Team-Core', priority: 1, slots: 2, showOnMap: false },
    { name: 'Map-HQ', priority: 1, slots: 1, showOnMap: true },
  ];

  const result = global.DSCoreAssignment.assignTeamToBuildingsAggressive(players, config);
  const teamAssignments = result.filter((x) => x.buildingKey === 'Team-Core').map((x) => x.player);
  assert.deepEqual(teamAssignments, ['TopTankA', 'TopTankB']);
});
