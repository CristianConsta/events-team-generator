const { test, expect } = require('@playwright/test');
const { loadApp, injectMockFirebase, waitForMainApp } = require('./helpers');

const MULTIGAME_GAMES = [
  { id: 'last_war', name: 'Last War: Survival', logo: '' },
  { id: 'desert_ops', name: 'Desert Ops', logo: '' },
];

test.describe('Game selector workflows', () => {
  test('@smoke @auth post-auth selector allows choosing active game', async ({ page }) => {
    await injectMockFirebase(page, {
      isSignedIn: false,
      games: MULTIGAME_GAMES,
      featureFlags: {
        MULTIGAME_GAME_SELECTOR_ENABLED: true,
      },
    });
    await loadApp(page);

    await page.locator('#emailInput').fill('qa@example.com');
    await page.locator('#passwordInput').fill('secret123');
    await page.locator('#loginForm button[type="submit"]').click();

    await waitForMainApp(page, { dismissGameSelector: false });
    await expect(page.locator('#gameSelectorOverlay')).toBeVisible();
    await page.locator('#gameSelectorList .game-selector-option[data-game-id="desert_ops"]').click();

    await expect(page.locator('#gameSelectorOverlay')).toBeHidden();
    await expect(page.locator('#activeGameBadge')).toHaveAttribute('title', 'Desert Ops');
    await expect(page.locator('#activeGameBadge')).not.toHaveClass(/hidden/);
  });

  test('@regression @navigation manual switch resets transient generator planning state', async ({ page }) => {
    await injectMockFirebase(page, {
      games: MULTIGAME_GAMES,
    });
    await loadApp(page);
    await waitForMainApp(page, { dismissGameSelector: false });

    await page.locator('#playersTableBody .team-a-btn').first().click();
    await expect(page.locator('#teamAStarterCount')).not.toHaveText('0');

    await page.locator('#navMenuBtn').click();
    await page.locator('#navSwitchGameBtn').click();
    await expect(page.locator('#gameSelectorOverlay')).toBeVisible();
    await page.locator('#gameSelectorList .game-selector-option[data-game-id="desert_ops"]').click();

    await expect(page.locator('#gameSelectorOverlay')).toBeHidden();
    await expect(page.locator('#teamAStarterCount')).toHaveText('0');
    await expect(page.locator('#activeGameBadge')).toHaveAttribute('title', 'Desert Ops');
    await expect(page.locator('#activeGameBadge')).not.toHaveClass(/hidden/);
  });
});
