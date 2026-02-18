const { test, expect } = require('@playwright/test');
const {
  loadApp,
  injectMockFirebase,
  waitForMainApp,
  navigateTo,
  assertOnlyPageVisible,
} = require('./helpers');

test.describe('Navigation workflows', () => {
  test.beforeEach(async ({ page }) => {
    await injectMockFirebase(page);
    await loadApp(page);
    await waitForMainApp(page);
  });

  test('@smoke @navigation can cycle through all 4 pages', async ({ page }) => {
    await assertOnlyPageVisible(page, 'generatorPage');

    await navigateTo(page, 'navPlayersBtn');
    await assertOnlyPageVisible(page, 'playersManagementPage');

    await navigateTo(page, 'navConfigBtn');
    await assertOnlyPageVisible(page, 'configurationPage');

    await navigateTo(page, 'navAllianceBtn');
    await assertOnlyPageVisible(page, 'alliancePage');

    await navigateTo(page, 'navGeneratorBtn');
    await assertOnlyPageVisible(page, 'generatorPage');
  });

  test('@regression @navigation settings modal opens from menu and closes cleanly', async ({ page }) => {
    await navigateTo(page, 'navSettingsBtn');
    await expect(page.locator('#settingsModal')).toBeVisible();

    await page.locator('#settingsModalCloseBtn').click();
    await expect(page.locator('#settingsModal')).toBeHidden();
  });
});
