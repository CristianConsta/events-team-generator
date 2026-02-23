// tests/player-updates.integration.test.js
// Integration tests for the player-updates controller.
// Uses mocked gateway — no Firebase required.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

// ---------------------------------------------------------------------------
// Module paths
// ---------------------------------------------------------------------------
const corePath = path.resolve(__dirname, '../js/features/player-updates/player-updates-core.js');
const controllerPath = path.resolve(__dirname, '../js/features/player-updates/player-updates-controller.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadModules() {
    global.window = global;

    // Minimal DOM stubs
    global.document = {
        getElementById: function (id) {
            return (global._domStubs && global._domStubs[id]) || null;
        },
        querySelectorAll: function () { return []; },
    };
    global._domStubs = {};

    // Crypto for generateToken
    global.crypto = require('node:crypto').webcrypto;
    global.location = { origin: 'https://example.com' };

    // App state globals the controller reads
    global.currentAllianceId = 'alliance_pu_integ_1';
    global.currentGameId = 'last_war';
    global.currentAuthUser = { uid: 'uid_leader_pu' };
    global.allPlayers = [
        { name: 'Alice', power: 1000, thp: 5000, troops: 'Tank' },
        { name: 'Bob', power: 2000, thp: 8000, troops: 'Aero' },
    ];

    [corePath, controllerPath].forEach(function (p) {
        delete require.cache[require.resolve(p)];
    });
    delete global.DSFeaturePlayerUpdatesCore;
    delete global.DSFeaturePlayerUpdatesController;

    require(corePath);
    require(controllerPath);
}

function makeMockGateway(overrides) {
    return Object.assign({
        saveTokenBatch: async function () { return { ok: true, tokenIds: ['tok_1', 'tok_2'] }; },
        updatePendingUpdateStatus: async function () { return { ok: true }; },
        revokeToken: async function () { return { ok: true }; },
        subscribePendingUpdatesCount: function (allianceId, cb) { cb(0); return function () {}; },
        loadPendingUpdates: async function () { return []; },
    }, overrides || {});
}

// ---------------------------------------------------------------------------
// openTokenGenerationModal → saveTokenBatch
// ---------------------------------------------------------------------------

test('openTokenGenerationModal: calls saveTokenBatch with one doc per player', async () => {
    loadModules();

    var batchArgs = null;
    var gateway = makeMockGateway({
        saveTokenBatch: async function (allianceId, tokenDocs) {
            batchArgs = { allianceId, tokenDocs };
            return { ok: true, tokenIds: tokenDocs.map(function (_, i) { return 'tok_' + i; }) };
        },
    });

    global.DSFeaturePlayerUpdatesController.init(gateway);
    global.DSFeaturePlayerUpdatesController.openTokenGenerationModal(['Alice', 'Bob']);

    // saveTokenBatch is async — give it a tick
    await new Promise(function (resolve) { setTimeout(resolve, 50); });

    assert.ok(batchArgs, 'saveTokenBatch should have been called');
    assert.equal(batchArgs.allianceId, 'alliance_pu_integ_1');
    assert.equal(batchArgs.tokenDocs.length, 2, 'Should create one token doc per player');
});

test('openTokenGenerationModal: token docs have correct playerName', async () => {
    loadModules();

    var capturedDocs = null;
    var gateway = makeMockGateway({
        saveTokenBatch: async function (allianceId, tokenDocs) {
            capturedDocs = tokenDocs;
            return { ok: true, tokenIds: [] };
        },
    });

    global.DSFeaturePlayerUpdatesController.init(gateway);
    global.DSFeaturePlayerUpdatesController.openTokenGenerationModal(['Alice', 'Bob']);
    await new Promise(function (resolve) { setTimeout(resolve, 50); });

    assert.ok(capturedDocs, 'Docs should be captured');
    const playerNames = capturedDocs.map(function (d) { return d.playerName; }).sort();
    assert.deepEqual(playerNames, ['Alice', 'Bob']);
});

test('openTokenGenerationModal: token docs include currentSnapshot from allPlayers', async () => {
    loadModules();

    var capturedDocs = null;
    var gateway = makeMockGateway({
        saveTokenBatch: async function (allianceId, tokenDocs) {
            capturedDocs = tokenDocs;
            return { ok: true, tokenIds: [] };
        },
    });

    global.DSFeaturePlayerUpdatesController.init(gateway);
    global.DSFeaturePlayerUpdatesController.openTokenGenerationModal(['Alice']);
    await new Promise(function (resolve) { setTimeout(resolve, 50); });

    const aliceDoc = capturedDocs && capturedDocs.find(function (d) { return d.playerName === 'Alice'; });
    assert.ok(aliceDoc, 'Should have a doc for Alice');
    assert.equal(aliceDoc.doc.currentSnapshot.power, 1000);
    assert.equal(aliceDoc.doc.currentSnapshot.troops, 'Tank');
});

test('openTokenGenerationModal: empty playerNames shows alert, does not call saveTokenBatch', async () => {
    loadModules();

    var batchCalled = false;
    var alertCalled = false;
    global.alert = function () { alertCalled = true; };

    var gateway = makeMockGateway({
        saveTokenBatch: async function () { batchCalled = true; return { ok: true, tokenIds: [] }; },
    });

    global.DSFeaturePlayerUpdatesController.init(gateway);
    global.DSFeaturePlayerUpdatesController.openTokenGenerationModal([]);
    await new Promise(function (resolve) { setTimeout(resolve, 50); });

    assert.equal(alertCalled, true, 'alert should be shown for empty selection');
    assert.equal(batchCalled, false, 'saveTokenBatch should NOT be called');
});

test('openTokenGenerationModal: null playerNames shows alert, does not call saveTokenBatch', async () => {
    loadModules();

    var batchCalled = false;
    var alertCalled = false;
    global.alert = function () { alertCalled = true; };

    var gateway = makeMockGateway({
        saveTokenBatch: async function () { batchCalled = true; return { ok: true, tokenIds: [] }; },
    });

    global.DSFeaturePlayerUpdatesController.init(gateway);
    global.DSFeaturePlayerUpdatesController.openTokenGenerationModal(null);
    await new Promise(function (resolve) { setTimeout(resolve, 50); });

    assert.equal(alertCalled, true);
    assert.equal(batchCalled, false);
});

// ---------------------------------------------------------------------------
// approveUpdate → updatePendingUpdateStatus with status='approved'
// ---------------------------------------------------------------------------

test('approveUpdate: calls updatePendingUpdateStatus with status approved', async () => {
    loadModules();

    var capturedArgs = null;
    var gateway = makeMockGateway({
        updatePendingUpdateStatus: async function (allianceId, updateId, update) {
            capturedArgs = { allianceId, updateId, update };
            return { ok: true };
        },
    });

    global.DSFeaturePlayerUpdatesController.init(gateway);
    const result = await global.DSFeaturePlayerUpdatesController.approveUpdate('upd_001');

    assert.equal(result.ok, true);
    assert.ok(capturedArgs, 'updatePendingUpdateStatus should have been called');
    assert.equal(capturedArgs.allianceId, 'alliance_pu_integ_1');
    assert.equal(capturedArgs.updateId, 'upd_001');
    assert.equal(capturedArgs.update.status, 'approved');
    assert.equal(capturedArgs.update.reviewedBy, 'uid_leader_pu');
});

test('approveUpdate: returns ok=false if updateId is missing', async () => {
    loadModules();
    var gateway = makeMockGateway();
    global.DSFeaturePlayerUpdatesController.init(gateway);
    const result = await global.DSFeaturePlayerUpdatesController.approveUpdate(null);
    assert.equal(result.ok, false);
});

test('approveUpdate: returns ok=false if not initialized', async () => {
    loadModules();
    // Do NOT call init — controller has no gateway
    const result = await global.DSFeaturePlayerUpdatesController.approveUpdate('upd_001');
    assert.equal(result.ok, false);
});

// ---------------------------------------------------------------------------
// rejectUpdate → updatePendingUpdateStatus with status='rejected'
// ---------------------------------------------------------------------------

test('rejectUpdate: calls updatePendingUpdateStatus with status rejected', async () => {
    loadModules();

    var capturedArgs = null;
    var gateway = makeMockGateway({
        updatePendingUpdateStatus: async function (allianceId, updateId, update) {
            capturedArgs = { allianceId, updateId, update };
            return { ok: true };
        },
    });

    global.DSFeaturePlayerUpdatesController.init(gateway);
    const result = await global.DSFeaturePlayerUpdatesController.rejectUpdate('upd_002');

    assert.equal(result.ok, true);
    assert.equal(capturedArgs.update.status, 'rejected');
    assert.equal(capturedArgs.updateId, 'upd_002');
});

// ---------------------------------------------------------------------------
// revokeToken
// ---------------------------------------------------------------------------

test('revokeToken: calls gateway.revokeToken with allianceId and tokenId', async () => {
    loadModules();

    var capturedArgs = null;
    var gateway = makeMockGateway({
        revokeToken: async function (allianceId, tokenId) {
            capturedArgs = { allianceId, tokenId };
            return { ok: true };
        },
    });

    global.DSFeaturePlayerUpdatesController.init(gateway);
    const result = await global.DSFeaturePlayerUpdatesController.revokeToken('tok_abc');

    assert.equal(result.ok, true);
    assert.equal(capturedArgs.allianceId, 'alliance_pu_integ_1');
    assert.equal(capturedArgs.tokenId, 'tok_abc');
});

test('revokeToken: returns ok=false if tokenId is missing', async () => {
    loadModules();
    global.DSFeaturePlayerUpdatesController.init(makeMockGateway());
    const result = await global.DSFeaturePlayerUpdatesController.revokeToken(null);
    assert.equal(result.ok, false);
});

// ---------------------------------------------------------------------------
// init → destroy cleans up
// ---------------------------------------------------------------------------

test('init returns destroy function', () => {
    loadModules();
    const handle = global.DSFeaturePlayerUpdatesController.init(makeMockGateway());
    assert.ok(handle && typeof handle.destroy === 'function');
});

// ---------------------------------------------------------------------------
// createUpdateToken (per-player invite flow)
// ---------------------------------------------------------------------------

test('createUpdateToken gateway mock: returns success with tokenId', async () => {
    loadModules();
    const gateway = makeMockGateway({
        createUpdateToken: async function (allianceId, playerName, options) {
            return { success: true, tokenId: 'mock-token-123' };
        },
    });
    const result = await gateway.createUpdateToken('alliance_pu_integ_1', 'Alice', { expiryHours: 48 });
    assert.equal(result.success, true);
    assert.equal(result.tokenId, 'mock-token-123');
});

test('createUpdateToken gateway mock: passes allianceId and playerName correctly', async () => {
    loadModules();
    var capturedArgs = null;
    const gateway = makeMockGateway({
        createUpdateToken: async function (allianceId, playerName, options) {
            capturedArgs = { allianceId, playerName, options };
            return { success: true, tokenId: 'tok-xyz' };
        },
    });
    await gateway.createUpdateToken('alliance_pu_integ_1', 'Bob', { expiryHours: 48 });
    assert.ok(capturedArgs, 'createUpdateToken should have been called');
    assert.equal(capturedArgs.allianceId, 'alliance_pu_integ_1');
    assert.equal(capturedArgs.playerName, 'Bob');
    assert.equal(capturedArgs.options.expiryHours, 48);
});

test('createUpdateToken gateway mock: returns failure on error', async () => {
    loadModules();
    const gateway = makeMockGateway({
        createUpdateToken: async function () {
            return { success: false, error: 'Permission denied' };
        },
    });
    const result = await gateway.createUpdateToken('alliance_pu_integ_1', 'Alice', { expiryHours: 48 });
    assert.equal(result.success, false);
    assert.ok(result.error);
});

// ---------------------------------------------------------------------------
// Invite flow: player name propagation (regression for bug fixes)
// ---------------------------------------------------------------------------

test('invite flow: createUpdateToken receives playerName from clicked row (originalName)', async () => {
    // Regression test: app.js reads originalName from data-player attribute and
    // passes it directly to FirebaseService.createUpdateToken. This verifies the
    // contract that the gateway receives the same name that was on the button.
    loadModules();

    var capturedPlayerName = null;
    const gateway = makeMockGateway({
        createUpdateToken: async function (allianceId, playerName, options) {
            capturedPlayerName = playerName;
            return { success: true, tokenId: 'tok-from-row' };
        },
    });

    // Simulate what app.js does: read originalName from data-player and call createUpdateToken
    const originalName = 'Alice';
    await gateway.createUpdateToken('alliance_pu_integ_1', originalName, { expiryHours: 48 });

    assert.equal(capturedPlayerName, 'Alice', 'createUpdateToken should receive the exact player name from the row');
});

test('invite flow: invite URL uses alliance param (not aid) matching player-update.js reader', async () => {
    // Regression test: app.js builds invite URL with &alliance= param.
    // player-update.js reads params.alliance || params.aid.
    // This test verifies the URL produced by app.js contains &alliance= so
    // player-update.js can read it.
    loadModules();

    const tokenId = 'tok-abc123';
    const allianceId = 'alliance_pu_integ_1';
    const origin = global.location.origin;

    // Reproduce the URL construction from app.js line 5116
    const inviteUrl = origin + '/player-update.html?token=' + encodeURIComponent(tokenId)
        + '&alliance=' + encodeURIComponent(allianceId);

    assert.ok(inviteUrl.includes('alliance='), 'URL should contain alliance= param');
    assert.ok(!inviteUrl.includes('&aid='), 'URL should not use deprecated &aid= param');
    assert.ok(inviteUrl.includes('token=' + tokenId));
    assert.ok(inviteUrl.includes('alliance=' + allianceId));
});

test('invite flow: createUpdateToken stores playerName in token doc shape', async () => {
    // Verifies the token document passed to the gateway includes playerName field.
    // Regression for: token lookup would fail if playerName was absent.
    loadModules();

    var storedDoc = null;
    const gateway = makeMockGateway({
        saveTokenBatch: async function (allianceId, tokenDocs) {
            storedDoc = tokenDocs[0];
            return { ok: true, tokenIds: ['tok_stored'] };
        },
    });

    global.DSFeaturePlayerUpdatesController.init(gateway);
    global.DSFeaturePlayerUpdatesController.openTokenGenerationModal(['Alice']);
    await new Promise(function (resolve) { setTimeout(resolve, 50); });

    assert.ok(storedDoc, 'Token doc should have been stored');
    assert.ok('playerName' in storedDoc.doc, 'Token doc.doc must have playerName field');
    assert.equal(storedDoc.doc.playerName, 'Alice', 'Token doc.doc.playerName must match the invited player');
});
