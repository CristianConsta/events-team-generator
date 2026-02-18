const { test, expect } = require('@playwright/test');
const { loadApp, injectMockFirebase, waitForMainApp, navigateTo } = require('./helpers');

test.describe('Strict mode workflow', () => {
  test('@regression @strict player source switch shows explicit sync error when persistence is denied', async ({ page }) => {
    await injectMockFirebase(page, {
      allianceId: 'alliance-1',
      allianceName: 'Alliance One',
      games: [{ id: 'last_war', name: 'Last War: Survival', logo: '' }],
      featureFlags: {
        MULTIGAME_STRICT_MODE: true,
        MULTIGAME_GAME_SELECTOR_ENABLED: true,
      },
    });
    await loadApp(page);
    await waitForMainApp(page);
    const selectorOverlay = page.locator('#gameSelectorOverlay');
    if (await selectorOverlay.isVisible().catch(() => false)) {
      await page.locator('#gameSelectorList .game-selector-option[data-game-id="last_war"]').click();
      await expect(selectorOverlay).toBeHidden();
    }
    await navigateTo(page, 'navPlayersBtn');

    await page.evaluate(() => {
      const manager = window.FirebaseManager;
      if (!manager) return;
      manager.setPlayerSource = async () => ({
        success: false,
        strictMode: true,
        error: 'MULTIGAME_STRICT_MODE: unable to persist users/qa-uid-001/games/last_war.playerSource',
      });
    });

    await page.locator('#playersMgmtSourceAllianceBtn').click();
    await expect(page.locator('#playersMgmtSourceStatus')).toContainText('MULTIGAME_STRICT_MODE');
    await expect(page.locator('#playersMgmtSourceStatus')).not.toContainText('not synced');
  });
});
