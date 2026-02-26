// e2e/11-invite-flow.e2e.js
// Invite button → popover → generated link → player-update.html E2E tests.
// @tags: @smoke @regression

const { test, expect } = require('@playwright/test');
const { loadApp, injectMockFirebase, waitForMainApp, navigateTo } = require('./helpers');

// ---------------------------------------------------------------------------
// Shared setup: inject mock Firebase with createUpdateToken / createPersonalUpdateToken
// stubs that return a predictable tokenId.
// ---------------------------------------------------------------------------

async function setupWithInviteMocks(page, options) {
    const opts = Object.assign({ playerSource: 'personal' }, options || {});

    await injectMockFirebase(page, {
        isSignedIn: true,
        uid: 'test-uid-invite',
        allianceId: opts.playerSource === 'alliance' ? 'ally_e2e_1' : null,
        allianceName: opts.playerSource === 'alliance' ? 'E2E Alliance' : null,
        playerSource: opts.playerSource,
        players: {
            AlphaPlayer: { name: 'AlphaPlayer', power: 5000000, troops: 'Tank' },
            BravoPlayer: { name: 'BravoPlayer', power: 4000000, troops: 'Aero' },
        },
        alliancePlayers: opts.playerSource === 'alliance' ? {
            AlphaPlayer: { name: 'AlphaPlayer', power: 5000000, troops: 'Tank' },
            BravoPlayer: { name: 'BravoPlayer', power: 4000000, troops: 'Aero' },
        } : {},
    });

    // Mock token creation on FirebaseService (resolved after firebase-service.js loads)
    await page.addInitScript((source) => {
        window.__E2E_INVITE_CALLS = [];
        document.addEventListener('DOMContentLoaded', function () {
            var interval = setInterval(function () {
                if (!window.FirebaseService) return;
                clearInterval(interval);

                window.FirebaseService.createPersonalUpdateToken = async function (uid, playerName, opts) {
                    window.__E2E_INVITE_CALLS.push({ type: 'personal', uid: uid, playerName: playerName });
                    return { success: true, tokenId: 'e2e_personal_tok_123' };
                };

                window.FirebaseService.createUpdateToken = async function (allianceId, playerName, opts) {
                    window.__E2E_INVITE_CALLS.push({ type: 'alliance', allianceId: allianceId, playerName: playerName });
                    return { success: true, tokenId: 'e2e_alliance_tok_456' };
                };
            }, 50);
        });
    }, opts.playerSource);
}

async function navigateToPlayers(page) {
    await navigateTo(page, 'navPlayersBtn');
    await expect(page.locator('#playersManagementPage')).toBeVisible({ timeout: 5000 });
    // Expand player list panel if collapsed
    const tableBody = page.locator('#playersMgmtTableBody');
    if (!(await tableBody.isVisible().catch(() => false))) {
        const header = page.locator('#playersListPanelHeader');
        if (await header.isVisible().catch(() => false)) {
            await header.click();
        }
    }
    await expect(tableBody).toBeVisible({ timeout: 3000 });
}

// ---------------------------------------------------------------------------
// Smoke: Invite button is visible on player rows
// ---------------------------------------------------------------------------

test('@smoke @invite invite button is visible on player rows', async ({ page }) => {
    await setupWithInviteMocks(page);
    await loadApp(page);
    await waitForMainApp(page);
    await navigateToPlayers(page);

    const inviteBtn = page.locator('button[data-pm-action="invite"]').first();
    await expect(inviteBtn).toBeVisible({ timeout: 3000 });
});

// ---------------------------------------------------------------------------
// Smoke: Click invite opens popover with link containing player-update.html
// ---------------------------------------------------------------------------

test('@smoke @invite click invite shows popover with correct link for personal context', async ({ page }) => {
    await setupWithInviteMocks(page, { playerSource: 'personal' });
    await loadApp(page);
    await waitForMainApp(page);
    await navigateToPlayers(page);

    // Click invite for first player
    const inviteBtn = page.locator('button[data-pm-action="invite"]').first();
    await inviteBtn.click();

    // Popover should appear
    const popover = page.locator('.invite-link-popover');
    await expect(popover).toBeVisible({ timeout: 5000 });

    // Popover input should contain the invite link
    const linkInput = popover.locator('input[type="text"]');
    await expect(linkInput).toBeVisible();
    const linkValue = await linkInput.inputValue();

    // Verify link structure: should contain player-update.html, token, and uid params
    expect(linkValue).toContain('player-update.html');
    expect(linkValue).toContain('token=e2e_personal_tok_123');
    expect(linkValue).toContain('uid=test-uid-invite');
    expect(linkValue).not.toContain('alliance=');

    // Verify createPersonalUpdateToken was called with the right player
    const calls = await page.evaluate(() => window.__E2E_INVITE_CALLS);
    expect(calls.length).toBe(1);
    expect(calls[0].type).toBe('personal');
    expect(calls[0].playerName).toBeTruthy();
});

// ---------------------------------------------------------------------------
// Smoke: Invite link uses relative path (not just origin)
// ---------------------------------------------------------------------------

test('@smoke @invite generated link includes full base path not just origin', async ({ page }) => {
    await setupWithInviteMocks(page, { playerSource: 'personal' });
    await loadApp(page);
    await waitForMainApp(page);
    await navigateToPlayers(page);

    const inviteBtn = page.locator('button[data-pm-action="invite"]').first();
    await inviteBtn.click();

    const popover = page.locator('.invite-link-popover');
    await expect(popover).toBeVisible({ timeout: 5000 });

    const linkInput = popover.locator('input[type="text"]');
    const linkValue = await linkInput.inputValue();

    // The link should be a valid URL with player-update.html in the path
    const url = new URL(linkValue);
    expect(url.pathname).toContain('player-update.html');
    // Must NOT be just /player-update.html if running from a subdirectory
    // (the relative URL resolution should preserve the directory path)
});

// ---------------------------------------------------------------------------
// Regression: Alliance context invite includes alliance param
// ---------------------------------------------------------------------------

test('@regression @invite click invite shows popover with alliance param for alliance context', async ({ page }) => {
    await setupWithInviteMocks(page, { playerSource: 'alliance' });
    await loadApp(page);
    await waitForMainApp(page);
    await navigateToPlayers(page);

    const inviteBtn = page.locator('button[data-pm-action="invite"]').first();
    await inviteBtn.click();

    const popover = page.locator('.invite-link-popover');
    await expect(popover).toBeVisible({ timeout: 5000 });

    const linkInput = popover.locator('input[type="text"]');
    const linkValue = await linkInput.inputValue();

    expect(linkValue).toContain('player-update.html');
    expect(linkValue).toContain('token=e2e_alliance_tok_456');
    expect(linkValue).toContain('alliance=ally_e2e_1');
    expect(linkValue).not.toContain('uid=');

    const calls = await page.evaluate(() => window.__E2E_INVITE_CALLS);
    expect(calls.length).toBe(1);
    expect(calls[0].type).toBe('alliance');
    expect(calls[0].allianceId).toBe('ally_e2e_1');
});

// ---------------------------------------------------------------------------
// Regression: Popover close on Escape key
// ---------------------------------------------------------------------------

test('@regression @invite popover closes on Escape key', async ({ page }) => {
    await setupWithInviteMocks(page);
    await loadApp(page);
    await waitForMainApp(page);
    await navigateToPlayers(page);

    const inviteBtn = page.locator('button[data-pm-action="invite"]').first();
    await inviteBtn.click();

    const popover = page.locator('.invite-link-popover');
    await expect(popover).toBeVisible({ timeout: 5000 });

    await page.keyboard.press('Escape');
    await expect(popover).toBeHidden({ timeout: 3000 });
});

// ---------------------------------------------------------------------------
// Regression: Invite button re-enables after popover shows
// ---------------------------------------------------------------------------

test('@regression @invite button re-enables after token generation', async ({ page }) => {
    await setupWithInviteMocks(page);
    await loadApp(page);
    await waitForMainApp(page);
    await navigateToPlayers(page);

    const inviteBtn = page.locator('button[data-pm-action="invite"]').first();
    await inviteBtn.click();

    // Wait for popover to confirm token generation completed
    const popover = page.locator('.invite-link-popover');
    await expect(popover).toBeVisible({ timeout: 5000 });

    // Button should be re-enabled
    await expect(inviteBtn).toBeEnabled({ timeout: 2000 });
});

// ---------------------------------------------------------------------------
// Regression: Each player row gets its own invite for the correct player
// ---------------------------------------------------------------------------

test('@regression @invite each row invites the correct player', async ({ page }) => {
    await setupWithInviteMocks(page);
    await loadApp(page);
    await waitForMainApp(page);
    await navigateToPlayers(page);

    // Close any popover from previous actions
    const inviteBtns = page.locator('button[data-pm-action="invite"]');
    const count = await inviteBtns.count();
    expect(count).toBeGreaterThanOrEqual(2);

    // Click first player's invite
    await inviteBtns.nth(0).click();
    await expect(page.locator('.invite-link-popover')).toBeVisible({ timeout: 5000 });

    // Dismiss popover
    await page.keyboard.press('Escape');
    await expect(page.locator('.invite-link-popover')).toBeHidden({ timeout: 3000 });

    // Click second player's invite
    await inviteBtns.nth(1).click();
    await expect(page.locator('.invite-link-popover')).toBeVisible({ timeout: 5000 });

    // Verify two different calls were made
    const calls = await page.evaluate(() => window.__E2E_INVITE_CALLS);
    expect(calls.length).toBe(2);
    expect(calls[0].playerName).not.toBe(calls[1].playerName);
});

// ---------------------------------------------------------------------------
// Regression: player-update.html shows error for missing token
// ---------------------------------------------------------------------------

test('@regression @invite player-update page shows error for missing token param', async ({ page }) => {
    // Navigate directly to player-update.html without token
    await page.goto('player-update.html');
    await page.waitForLoadState('domcontentloaded');

    const errorEl = page.locator('#updateError');
    await expect(errorEl).toBeVisible({ timeout: 5000 });
});

// ---------------------------------------------------------------------------
// Regression: player-update.html shows error for token without context
// ---------------------------------------------------------------------------

test('@regression @invite player-update page shows error for token without uid or alliance', async ({ page }) => {
    await page.goto('player-update.html?token=abc123');
    await page.waitForLoadState('domcontentloaded');

    const errorEl = page.locator('#updateError');
    await expect(errorEl).toBeVisible({ timeout: 5000 });
});

// ---------------------------------------------------------------------------
// Helper: inject a mock window.firebase for player-update.html.
// Must be called via page.addInitScript BEFORE page.goto.
//
// options is a plain-JSON-serializable object:
//   {
//     snapshotExists: boolean,          // whether the token doc exists
//     tokenData: {                      // token doc fields (plain values only)
//       used: boolean,
//       expiresAtMs: number,            // epoch ms — converted to { toDate() } inside
//       playerName: string,
//       currentSnapshot: { power, thp, troops }
//     } | null
//     hangAuth: boolean                 // if true, signInAnonymously never resolves
//   }
//
// All values must be JSON-serializable (no functions) because addInitScript
// serialises the second argument via JSON before injecting it.
// ---------------------------------------------------------------------------

function injectPlayerUpdateFirebaseMock(page, options) {
    return page.addInitScript((opts) => {
        // Provide FIREBASE_CONFIG so the script doesn't bail on missing config.
        window.FIREBASE_CONFIG = {
            apiKey: 'mock-key',
            authDomain: 'mock.firebaseapp.com',
            projectId: 'mock-project',
            storageBucket: 'mock.appspot.com',
            messagingSenderId: '000000000000',
            appId: '1:000000000000:web:000000000000000000000000',
        };

        // Build the snapshot object the page code will call .exists / .data() on.
        function buildSnapshot(snapshotExists, tokenData) {
            if (!snapshotExists) {
                return { exists: false, data: function () { return null; } };
            }
            return {
                exists: true,
                ref: { update: function () { return Promise.resolve(); } },
                data: function () {
                    var td = tokenData || {};
                    return {
                        used: td.used === true,
                        expiresAt: {
                            toDate: function () { return new Date(td.expiresAtMs || 0); },
                        },
                        playerName: td.playerName || '',
                        currentSnapshot: td.currentSnapshot || {},
                    };
                },
            };
        }

        var snapshot = buildSnapshot(opts.snapshotExists, opts.tokenData);

        // Chainable Firestore mock — every collection/doc call returns the same
        // snapshot regardless of path depth.
        function makeFirestoreMock() {
            function docChain() {
                return {
                    collection: function () { return { doc: docChain }; },
                    get: function () { return Promise.resolve(snapshot); },
                    update: function () { return Promise.resolve(); },
                };
            }
            return {
                collection: function () { return { doc: docChain }; },
            };
        }

        var mockFirebase = {
            apps: [],
            initializeApp: function (config) {
                mockFirebase.apps.push({ name: '[DEFAULT]', options: config });
            },
            auth: function () {
                return {
                    signInAnonymously: function () {
                        if (opts.hangAuth) {
                            return new Promise(function () { /* intentionally never resolves */ });
                        }
                        if (opts.authError) {
                            return Promise.reject(new Error(opts.authError));
                        }
                        return Promise.resolve({ user: { uid: 'anon-test-uid' } });
                    },
                };
            },
            firestore: function () {
                return makeFirestoreMock();
            },
        };
        mockFirebase.firestore.Timestamp = {
            now: function () { return { toDate: function () { return new Date(); } }; },
        };

        // Protect the mock from being overwritten by vendor scripts loaded later.
        try {
            Object.defineProperty(window, 'firebase', {
                configurable: true,
                enumerable: true,
                get: function () { return mockFirebase; },
                set: function () { /* ignore vendor attempts to overwrite */ },
            });
        } catch (_) {
            window.firebase = mockFirebase;
        }
    }, options);
}

// Shared helper: wait until the loading spinner has been hidden.
async function waitForLoadingHidden(page, timeout) {
    await page.waitForFunction(() => {
        var el = document.getElementById('updateLoading');
        return el && el.classList.contains('hidden');
    }, { timeout: timeout || 8000 });
}

// ---------------------------------------------------------------------------
// Smoke: player-update page initialises Firebase without a "no-app" crash
// ---------------------------------------------------------------------------

test('@smoke @invite player-update page initializes Firebase without errors', async ({ page }) => {
    // Token not found — page should reach an error state, NOT a Firebase crash.
    await injectPlayerUpdateFirebaseMock(page, { snapshotExists: false });

    const consoleErrors = [];
    page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('player-update.html?token=testtoken&uid=testuid');
    await page.waitForLoadState('domcontentloaded');
    await waitForLoadingHidden(page);

    // Must be in error state (token invalid), not crashed.
    await expect(page.locator('#updateError')).toBeVisible({ timeout: 3000 });

    // Must not have a Firebase "no-app" error in the console.
    const firebaseNoAppErrors = consoleErrors.filter((e) =>
        /no firebase app/i.test(e) || /no-app/i.test(e)
    );
    expect(firebaseNoAppErrors).toHaveLength(0);
});

// ---------------------------------------------------------------------------
// Regression: loading state is visible immediately on navigation
// ---------------------------------------------------------------------------

test('@regression @invite player-update page shows loading state initially', async ({ page }) => {
    // hangAuth: true means signInAnonymously never resolves — loading persists.
    await injectPlayerUpdateFirebaseMock(page, {
        snapshotExists: false,
        hangAuth: true,
    });

    await page.goto('player-update.html?token=testtoken&uid=testuid');
    await page.waitForLoadState('domcontentloaded');

    // Loading indicator must be visible right after DOM is ready.
    await expect(page.locator('#updateLoading')).toBeVisible({ timeout: 3000 });

    // Form and error panels must be hidden at this point.
    await expect(page.locator('#updateForm')).toBeHidden();
    await expect(page.locator('#updateError')).toBeHidden();
});

// ---------------------------------------------------------------------------
// Regression: form is shown when the token document is valid
// ---------------------------------------------------------------------------

test('@regression @invite player-update page shows form when token is valid', async ({ page }) => {
    await injectPlayerUpdateFirebaseMock(page, {
        snapshotExists: true,
        tokenData: {
            used: false,
            expiresAtMs: Date.now() + 24 * 60 * 60 * 1000, // 24 h from now
            playerName: 'TestHero',
            currentSnapshot: { power: 1234, thp: 5678, troops: 'Aero' },
        },
    });

    await page.goto('player-update.html?token=validtoken&uid=owneruid');
    await page.waitForLoadState('domcontentloaded');
    await waitForLoadingHidden(page);

    await expect(page.locator('#updateForm')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#updatePlayerName')).toContainText('TestHero', { timeout: 2000 });
    await expect(page.locator('#updatePower')).toHaveValue('1234');
    await expect(page.locator('#updateThp')).toHaveValue('5678');
    await expect(page.locator('#updateTroops')).toHaveValue('Aero');
});

// ---------------------------------------------------------------------------
// Regression: expired token shows error state
// ---------------------------------------------------------------------------

test('@regression @invite player-update page shows expired error for expired token', async ({ page }) => {
    await injectPlayerUpdateFirebaseMock(page, {
        snapshotExists: true,
        tokenData: {
            used: false,
            expiresAtMs: Date.now() - 24 * 60 * 60 * 1000, // 24 h ago
            playerName: 'ExpiredHero',
            currentSnapshot: {},
        },
    });

    await page.goto('player-update.html?token=expiredtoken&uid=owneruid');
    await page.waitForLoadState('domcontentloaded');
    await waitForLoadingHidden(page);

    await expect(page.locator('#updateError')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#updateForm')).toBeHidden();

    const msgEl = page.locator('#updateErrorMessage');
    await expect(msgEl).toBeVisible({ timeout: 2000 });
    expect((await msgEl.textContent()).trim().length).toBeGreaterThan(0);
});

// ---------------------------------------------------------------------------
// Regression: already-used token shows error state
// ---------------------------------------------------------------------------

test('@regression @invite player-update page shows used error for already-used token', async ({ page }) => {
    await injectPlayerUpdateFirebaseMock(page, {
        snapshotExists: true,
        tokenData: {
            used: true,
            expiresAtMs: Date.now() + 24 * 60 * 60 * 1000,
            playerName: 'UsedHero',
            currentSnapshot: {},
        },
    });

    await page.goto('player-update.html?token=usedtoken&uid=owneruid');
    await page.waitForLoadState('domcontentloaded');
    await waitForLoadingHidden(page);

    await expect(page.locator('#updateError')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#updateForm')).toBeHidden();

    const msgEl = page.locator('#updateErrorMessage');
    await expect(msgEl).toBeVisible({ timeout: 2000 });
    expect((await msgEl.textContent()).trim().length).toBeGreaterThan(0);
});

// ---------------------------------------------------------------------------
// Regression: anonymous auth failure shows auth error (not crash)
// ---------------------------------------------------------------------------

test('@regression @invite player-update page shows auth error when anonymous sign-in fails', async ({ page }) => {
    await injectPlayerUpdateFirebaseMock(page, {
        authError: 'Firebase: Error (auth/operation-not-allowed).',
    });

    await page.goto('player-update.html?token=testtoken&uid=owneruid');
    await page.waitForLoadState('domcontentloaded');
    await waitForLoadingHidden(page);

    await expect(page.locator('#updateError')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#updateForm')).toBeHidden();

    const msgEl = page.locator('#updateErrorMessage');
    await expect(msgEl).toBeVisible({ timeout: 2000 });
    const text = (await msgEl.textContent()).trim();
    expect(text.length).toBeGreaterThan(0);
    // Should show auth-specific error, not generic network error
    expect(text.toLowerCase()).toContain('authenticat');
});

// ---------------------------------------------------------------------------
// Regression: generic network error still shows network error message
// ---------------------------------------------------------------------------

test('@regression @invite player-update page shows network error for non-auth failures', async ({ page }) => {
    await injectPlayerUpdateFirebaseMock(page, {
        authError: 'network timeout',
    });

    await page.goto('player-update.html?token=testtoken&uid=owneruid');
    await page.waitForLoadState('domcontentloaded');
    await waitForLoadingHidden(page);

    await expect(page.locator('#updateError')).toBeVisible({ timeout: 3000 });

    const msgEl = page.locator('#updateErrorMessage');
    const text = (await msgEl.textContent()).trim();
    expect(text.toLowerCase()).toContain('network');
});
