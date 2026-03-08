// tests/player-update.core.test.js
// Unit tests for js/player-update/player-update.js
// Covers: param parsing, Firebase init, auth errors, token states, form submission

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// ---------------------------------------------------------------------------
// Minimal DOM stub for player-update.js (runs in Node, not browser)
// ---------------------------------------------------------------------------

function createMockGlobal(options) {
    const opts = Object.assign({
        search: '',
        firebaseExists: true,
        firebaseApps: [{}],
        configExists: true,
        signInResult: { user: { uid: 'anon-123' } },
        signInError: null,
        tokenSnapshot: null,
        tokenGetError: null,
        addResult: {},
        addError: null,
        updateError: null,
    }, options || {});

    const elements = {};
    const classLists = {};
    const submitButton = { disabled: false, textContent: 'Submit Update' };

    function makeEl(id) {
        const cl = new Set(['hidden']);
        classLists[id] = cl;
        return {
            id: id,
            classList: {
                add: function (c) { cl.add(c); },
                remove: function (c) { cl.delete(c); },
                contains: function (c) { return cl.has(c); },
                toggle: function (c, force) {
                    if (force === true) {
                        cl.add(c);
                        return true;
                    }
                    if (force === false) {
                        cl.delete(c);
                        return false;
                    }
                    if (cl.has(c)) {
                        cl.delete(c);
                        return false;
                    }
                    cl.add(c);
                    return true;
                },
            },
            textContent: '',
            value: '',
            dataset: {},
            _listeners: {},
            addEventListener: function (evt, fn) { this._listeners[evt] = fn; },
            dispatchEvent: function (evt) {
                var type = evt && evt.type ? evt.type : evt;
                if (this._listeners[type]) {
                    this._listeners[type](evt);
                }
            },
            querySelector: function (selector) {
                if (id === 'updateStatsForm' && selector === 'button[type="submit"]') {
                    return submitButton;
                }
                return null;
            },
        };
    }

    ['updateLoading', 'updateForm', 'updateSuccess', 'updateError',
     'updateErrorMessage', 'updatePlayerName', 'updatePower', 'updateThp',
     'updateTroops', 'updateStatsForm', 'currentPowerValue', 'currentThpValue', 'currentTroopsValue', 'languageSelect',
     'errorPower', 'errorThp', 'errorTroops'].forEach(function (id) {
        elements[id] = makeEl(id);
    });

    const initCalls = [];
    const signInCalls = [];
    const collectionPaths = [];

    const mockTokenRef = {
        get: function () {
            if (opts.tokenGetError) {
                return Promise.reject(opts.tokenGetError);
            }
            return Promise.resolve(opts.tokenSnapshot || { exists: false });
        },
        update: function () {
            if (opts.updateError) return Promise.reject(opts.updateError);
            return Promise.resolve();
        },
    };

    const mockFirestore = function () {
        return {
            collection: function (name) {
                collectionPaths.push(name);
                return {
                    doc: function () {
                        return {
                            collection: function (sub) {
                                collectionPaths.push(sub);
                                return {
                                    doc: function () { return mockTokenRef; },
                                    add: function (doc) {
                                        if (opts.addError) return Promise.reject(opts.addError);
                                        return Promise.resolve(opts.addResult);
                                    },
                                };
                            },
                        };
                    },
                };
            },
        };
    };
    mockFirestore.Timestamp = {
        now: function () { return { seconds: Date.now() / 1000 }; },
    };

    const mockAuth = function () {
        return {
            setPersistence: function () { return Promise.resolve(); },
            signInAnonymously: function () {
                signInCalls.push(true);
                if (opts.signInError) {
                    return Promise.reject(opts.signInError);
                }
                return Promise.resolve(opts.signInResult);
            },
        };
    };
    mockAuth.Auth = { Persistence: { NONE: 'none', SESSION: 'session', LOCAL: 'local' } };

    const global = {
        location: { search: opts.search },
        document: {
            getElementById: function (id) { return elements[id] || null; },
            addEventListener: function (evt, fn) {
                // capture DOMContentLoaded handler but don't auto-fire
                if (evt === 'DOMContentLoaded') {
                    global._domReadyHandler = fn;
                }
            },
        },
        FIREBASE_CONFIG: opts.configExists ? { apiKey: 'test', projectId: 'test' } : undefined,
        firebase: opts.firebaseExists ? {
            apps: opts.firebaseApps,
            initializeApp: function (config) { initCalls.push(config); },
            auth: mockAuth,
            firestore: mockFirestore,
        } : undefined,
        DSI18N: null,
        DSPlayerUpdate: null,
        _elements: elements,
        _classLists: classLists,
        _initCalls: initCalls,
        _signInCalls: signInCalls,
        _collectionPaths: collectionPaths,
        _submitButton: submitButton,
    };

    return global;
}

function loadPlayerUpdate(mockGlobal) {
    // Re-execute the IIFE with our mock global
    const fs = require('fs');
    const path = require('path');
    const code = fs.readFileSync(
        path.join(__dirname, '..', 'js', 'player-update', 'player-update.js'),
        'utf8'
    );
    // Replace (window) with our mock and execute
    const wrappedCode = code.replace(/\}\)\(window\);?\s*$/, '})(mockGlobal);');
    const fn = new Function('mockGlobal', wrappedCode);
    fn(mockGlobal);
    return mockGlobal;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('player-update.js', function () {

    describe('param validation', function () {
        it('normalizes invite lang param to lowercase supported value', function () {
            const g = createMockGlobal({ search: '?token=tok1&uid=user1&lang=EN' });
            let capturedLang = null;
            g.DSI18N = {
                init: function () {},
                setLanguage: function (lang) { capturedLang = lang; },
                getLanguage: function () { return capturedLang || 'en'; },
                t: function (key) { return key; },
            };
            loadPlayerUpdate(g);
            g.DSPlayerUpdate.init();

            assert.equal(capturedLang, 'en');
        });

        it('shows TOKEN_INVALID when no token param', function () {
            const g = createMockGlobal({ search: '?uid=abc' });
            loadPlayerUpdate(g);
            g.DSPlayerUpdate.init();

            assert.equal(g._elements.updateError.classList.contains('hidden'), false);
            assert.equal(g._elements.updateErrorMessage.textContent, 'player_update_error_invalid');
        });

        it('shows TOKEN_INVALID when token present but no uid or alliance', function () {
            const g = createMockGlobal({ search: '?token=abc123' });
            loadPlayerUpdate(g);
            g.DSPlayerUpdate.init();

            assert.equal(g._elements.updateError.classList.contains('hidden'), false);
            assert.equal(g._elements.updateErrorMessage.textContent, 'player_update_error_invalid');
        });

        it('accepts token + uid as valid personal context', async function () {
            const g = createMockGlobal({
                search: '?token=tok1&uid=user1',
                tokenSnapshot: { exists: false },
            });
            loadPlayerUpdate(g);
            g.DSPlayerUpdate.init();
            await new Promise(function (r) { setTimeout(r, 50); });

            // Should have attempted sign-in (past param validation)
            assert.equal(g._signInCalls.length, 1);
        });

        it('accepts token + alliance as valid alliance context', async function () {
            const g = createMockGlobal({
                search: '?token=tok1&alliance=ally1',
                tokenSnapshot: { exists: false },
            });
            loadPlayerUpdate(g);
            g.DSPlayerUpdate.init();
            await new Promise(function (r) { setTimeout(r, 50); });

            assert.equal(g._signInCalls.length, 1);
        });

        it('accepts token + aid as valid alliance context (legacy param)', async function () {
            const g = createMockGlobal({
                search: '?token=tok1&aid=ally1',
                tokenSnapshot: { exists: false },
            });
            loadPlayerUpdate(g);
            g.DSPlayerUpdate.init();
            await new Promise(function (r) { setTimeout(r, 50); });

            assert.equal(g._signInCalls.length, 1);
        });
    });

    describe('Firebase initialization', function () {
        it('shows NETWORK_ERROR when firebase global is missing', function () {
            const g = createMockGlobal({
                search: '?token=abc&uid=user1',
                firebaseExists: false,
            });
            loadPlayerUpdate(g);
            g.DSPlayerUpdate.init();

            assert.equal(g._elements.updateErrorMessage.textContent, 'player_update_error_network');
        });

        it('calls initializeApp when firebase.apps is empty', function () {
            const g = createMockGlobal({
                search: '?token=abc&uid=user1',
                firebaseApps: [],
            });
            loadPlayerUpdate(g);
            g.DSPlayerUpdate.init();

            assert.equal(g._initCalls.length, 1);
            assert.equal(g._initCalls[0].apiKey, 'test');
        });

        it('does not call initializeApp when firebase.apps is non-empty', function () {
            const g = createMockGlobal({
                search: '?token=abc&uid=user1',
                firebaseApps: [{}],
            });
            loadPlayerUpdate(g);
            g.DSPlayerUpdate.init();

            assert.equal(g._initCalls.length, 0);
        });

        it('shows NETWORK_ERROR when FIREBASE_CONFIG is missing and apps is empty', function () {
            const g = createMockGlobal({
                search: '?token=abc&uid=user1',
                firebaseApps: [],
                configExists: false,
            });
            loadPlayerUpdate(g);
            g.DSPlayerUpdate.init();

            assert.equal(g._elements.updateErrorMessage.textContent, 'player_update_error_network');
        });
    });

    describe('anonymous auth', function () {
        it('shows AUTH_FAILED when signInAnonymously fails with auth error', async function () {
            const g = createMockGlobal({
                search: '?token=abc&uid=user1',
                signInError: new Error('Firebase: Error (auth/operation-not-allowed).'),
            });
            loadPlayerUpdate(g);
            g.DSPlayerUpdate.init();
            await new Promise(function (r) { setTimeout(r, 50); });

            assert.equal(g._elements.updateError.classList.contains('hidden'), false);
            assert.equal(g._elements.updateErrorMessage.textContent, 'player_update_error_auth');
        });

        it('shows AUTH_FAILED when signInAnonymously fails with operation-not-allowed', async function () {
            const g = createMockGlobal({
                search: '?token=abc&uid=user1',
                signInError: new Error('operation-not-allowed'),
            });
            loadPlayerUpdate(g);
            g.DSPlayerUpdate.init();
            await new Promise(function (r) { setTimeout(r, 50); });

            assert.equal(g._elements.updateErrorMessage.textContent, 'player_update_error_auth');
        });

        it('shows NETWORK_ERROR for generic signIn failure', async function () {
            const g = createMockGlobal({
                search: '?token=abc&uid=user1',
                signInError: new Error('network timeout'),
            });
            loadPlayerUpdate(g);
            g.DSPlayerUpdate.init();
            await new Promise(function (r) { setTimeout(r, 50); });

            assert.equal(g._elements.updateErrorMessage.textContent, 'player_update_error_network');
        });
    });

    describe('token states', function () {
        it('shows TOKEN_INVALID when token doc does not exist', async function () {
            const g = createMockGlobal({
                search: '?token=abc&uid=user1',
                tokenSnapshot: { exists: false },
            });
            loadPlayerUpdate(g);
            g.DSPlayerUpdate.init();
            await new Promise(function (r) { setTimeout(r, 50); });

            assert.equal(g._elements.updateErrorMessage.textContent, 'player_update_error_invalid');
        });

        it('shows TOKEN_USED when token is already used', async function () {
            const g = createMockGlobal({
                search: '?token=abc&uid=user1',
                tokenSnapshot: {
                    exists: true,
                    data: function () { return { used: true, playerName: 'Test' }; },
                    ref: {},
                },
            });
            loadPlayerUpdate(g);
            g.DSPlayerUpdate.init();
            await new Promise(function (r) { setTimeout(r, 50); });

            assert.equal(g._elements.updateErrorMessage.textContent, 'player_update_error_used');
        });

        it('shows TOKEN_EXPIRED when token has expired', async function () {
            const pastDate = new Date(Date.now() - 86400000);
            const g = createMockGlobal({
                search: '?token=abc&uid=user1',
                tokenSnapshot: {
                    exists: true,
                    data: function () {
                        return {
                            used: false,
                            playerName: 'Test',
                            playerKey: 'test_key',
                            expiresAt: { toDate: function () { return pastDate; } },
                        };
                    },
                    ref: {},
                },
            });
            loadPlayerUpdate(g);
            g.DSPlayerUpdate.init();
            await new Promise(function (r) { setTimeout(r, 50); });

            assert.equal(g._elements.updateErrorMessage.textContent, 'player_update_error_expired');
        });

        it('shows form when token is valid', async function () {
            const futureDate = new Date(Date.now() + 86400000);
            const g = createMockGlobal({
                search: '?token=abc&uid=user1',
                tokenSnapshot: {
                    exists: true,
                    data: function () {
                        return {
                            used: false,
                            playerName: 'HeroPlayer',
                            playerKey: 'hero_player_key',
                            expiresAt: { toDate: function () { return futureDate; } },
                            currentSnapshot: { power: 5000, thp: 200, troops: 'Tank' },
                        };
                    },
                    ref: {},
                },
            });
            loadPlayerUpdate(g);
            g.DSPlayerUpdate.init();
            await new Promise(function (r) { setTimeout(r, 50); });

            assert.equal(g._elements.updateForm.classList.contains('hidden'), false);
            assert.equal(g._elements.updatePlayerName.textContent, 'HeroPlayer');
            assert.equal(String(g._elements.updatePower.value), '');
            assert.equal(String(g._elements.updateThp.value), '');
            assert.equal(g._elements.updateTroops.value, '');
            assert.equal(g._elements.currentPowerValue.textContent, 'Current value: 5000');
            assert.equal(g._elements.currentThpValue.textContent, 'Current value: 200');
            assert.equal(g._elements.currentTroopsValue.textContent, 'Current value: Tank');
        });

        it('shows TOKEN_INVALID when token is missing playerKey', async function () {
            const futureDate = new Date(Date.now() + 86400000);
            const g = createMockGlobal({
                search: '?token=abc&uid=user1',
                tokenSnapshot: {
                    exists: true,
                    data: function () {
                        return {
                            used: false,
                            playerName: 'HeroPlayer',
                            expiresAt: { toDate: function () { return futureDate; } },
                            currentSnapshot: { power: 5000, thp: 200, troops: 'Tank' },
                        };
                    },
                    ref: {},
                },
            });
            loadPlayerUpdate(g);
            g.DSPlayerUpdate.init();
            await new Promise(function (r) { setTimeout(r, 50); });

            assert.equal(g._elements.updateError.classList.contains('hidden'), false);
            assert.equal(g._elements.updateErrorMessage.textContent, 'player_update_error_invalid');
        });
    });

    describe('Firestore paths', function () {
        it('uses users/{uid}/update_tokens for personal context', async function () {
            const g = createMockGlobal({
                search: '?token=abc&uid=user1',
                tokenSnapshot: { exists: false },
            });
            loadPlayerUpdate(g);
            g.DSPlayerUpdate.init();
            await new Promise(function (r) { setTimeout(r, 50); });

            assert.ok(g._collectionPaths.includes('users'));
            assert.ok(g._collectionPaths.includes('update_tokens'));
            assert.ok(!g._collectionPaths.includes('alliances'));
        });

        it('uses alliances/{aid}/update_tokens for alliance context', async function () {
            const g = createMockGlobal({
                search: '?token=abc&alliance=ally1',
                tokenSnapshot: { exists: false },
            });
            loadPlayerUpdate(g);
            g.DSPlayerUpdate.init();
            await new Promise(function (r) { setTimeout(r, 50); });

            assert.ok(g._collectionPaths.includes('alliances'));
            assert.ok(g._collectionPaths.includes('update_tokens'));
            assert.ok(!g._collectionPaths.includes('users'));
        });
    });

    describe('numeric field validation', function () {
        it('sanitizes numeric inputs to 3 integer digits and 2 decimals', function () {
            const g = createMockGlobal({ search: '?token=tok1&uid=user1' });
            loadPlayerUpdate(g);

            assert.equal(g.DSPlayerUpdate.sanitizeNumericStatInput('1234.567abc'), '123.56');
            assert.equal(g.DSPlayerUpdate.sanitizeNumericStatInput('98,765'), '98.76');
            assert.equal(g.DSPlayerUpdate.sanitizeNumericStatInput('..1a2b3'), '.12');
        });

        it('blocks submit when power or thp do not match 999.99 format', async function () {
            const futureDate = new Date(Date.now() + 86400000);
            const g = createMockGlobal({
                search: '?token=abc&uid=user1',
                tokenSnapshot: {
                    exists: true,
                    data: function () {
                        return {
                            used: false,
                            playerName: 'HeroPlayer',
                            playerKey: 'hero_player_key',
                            expiresAt: { toDate: function () { return futureDate; } },
                            currentSnapshot: { power: 500, thp: 200, troops: 'Tank' },
                        };
                    },
                    ref: { update: function () { return Promise.resolve(); } },
                },
            });
            loadPlayerUpdate(g);
            g.DSPlayerUpdate.init();
            await new Promise(function (r) { setTimeout(r, 50); });

            g._elements.updatePower.value = '1000';
            g._elements.updateThp.value = '12.345';
            g._elements.updateTroops.value = 'Tank';

            g._elements.updateStatsForm._listeners.submit({
                preventDefault: function () {},
            });

            assert.equal(g._elements.errorPower.textContent, 'player_update_error_numeric_format');
            assert.equal(g._elements.errorThp.textContent, 'player_update_error_numeric_format');
            assert.equal(g._elements.updateSuccess.classList.contains('hidden'), true);
        });

        it('accepts valid 999.99 values on submit', async function () {
            const futureDate = new Date(Date.now() + 86400000);
            const g = createMockGlobal({
                search: '?token=abc&uid=user1',
                tokenSnapshot: {
                    exists: true,
                    data: function () {
                        return {
                            used: false,
                            playerName: 'HeroPlayer',
                            playerKey: 'hero_player_key',
                            expiresAt: { toDate: function () { return futureDate; } },
                            currentSnapshot: { power: 500, thp: 200, troops: 'Tank' },
                            gameId: 'last_war',
                        };
                    },
                    ref: { update: function () { return Promise.resolve(); } },
                },
            });
            loadPlayerUpdate(g);
            g.DSPlayerUpdate.init();
            await new Promise(function (r) { setTimeout(r, 50); });

            g._elements.updatePower.value = '999.99';
            g._elements.updateThp.value = '0.25';
            g._elements.updateTroops.value = 'Aero';

            g._elements.updateStatsForm._listeners.submit({
                preventDefault: function () {},
            });
            await new Promise(function (r) { setTimeout(r, 50); });

            assert.equal(g._elements.errorPower.textContent, '');
            assert.equal(g._elements.errorThp.textContent, '');
            assert.equal(g._elements.updateSuccess.classList.contains('hidden'), false);
        });
    });
});
