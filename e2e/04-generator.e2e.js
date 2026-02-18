const { test, expect } = require('@playwright/test');
const {
  loadApp,
  injectMockFirebase,
  waitForMainApp,
  navigateTo,
  assertOnlyPageVisible,
} = require('./helpers');

test.describe('Generator and events workflows', () => {
  test.skip(({ isMobile }) => isMobile, 'Desktop-only workflow tests');

  test.beforeEach(async ({ page }) => {
    await injectMockFirebase(page);
    await loadApp(page);
    await waitForMainApp(page);
  });

  test('@smoke @generator select players and generate Team A assignments', async ({ page }) => {
    await assertOnlyPageVisible(page, 'generatorPage');

    const teamAButtons = page.locator('#playersTableBody .team-a-btn');
    await expect(teamAButtons.first()).toBeVisible();
    await teamAButtons.first().click();
    await teamAButtons.nth(1).click();

    await expect(page.locator('#teamAStarterCount')).not.toHaveText('0');
    await expect(page.locator('#generateBtnA')).toBeEnabled();

    await page.locator('#generateBtnA').click();
    await expect(page.locator('#downloadModalOverlay')).toBeVisible();
    await expect(page.locator('#downloadMapBtn')).toBeVisible();
    await expect(page.locator('#downloadExcelBtn')).toBeVisible();

    await page.locator('#downloadModalCloseBtn').click();
    await expect(page.locator('#downloadModalOverlay')).toBeHidden();
  });

  test('@regression @events create and edit event with buildings', async ({ page }) => {
    await navigateTo(page, 'navConfigBtn');
    await assertOnlyPageVisible(page, 'configurationPage');

    const eventName = `WF-${Date.now().toString().slice(-8)}`;
    const updatedName = `${eventName}-UPD`;

    await page.locator('#eventsList .events-list-new').click();
    await page.locator('#eventNameInput').fill(eventName);

    await page.locator('#eventBuildingsEditorBody tr:first-child input[data-field="name"]').fill('HQ');
    await page.locator('#eventBuildingsEditorBody tr:first-child input[data-field="slots"]').fill('2');
    await page.locator('#eventBuildingsEditorBody tr:first-child input[data-field="priority"]').fill('1');

    await page.locator('#eventAddBuildingBtn').click();
    await page.locator('#eventBuildingsEditorBody tr:nth-child(2) input[data-field="name"]').fill('Tower');
    await page.locator('#eventBuildingsEditorBody tr:nth-child(2) input[data-field="slots"]').fill('1');
    await page.locator('#eventBuildingsEditorBody tr:nth-child(2) input[data-field="priority"]').fill('2');

    await page.locator('#eventSaveBtn').click();
    await expect(page.locator('#eventsList')).toContainText(eventName);

    await page.locator(`#eventsList .events-list-item:has-text("${eventName}")`).first().click();
    await page.locator('#eventEditModeBtn').click();
    await page.locator('#eventNameInput').fill(updatedName);
    await page.locator('#eventSaveBtn').click();
    await expect(page.locator('#eventsList')).toContainText(updatedName);
  });

  test('@regression @i18n language switching from settings updates active language', async ({ page }) => {
    await navigateTo(page, 'navSettingsBtn');
    await expect(page.locator('#settingsModal')).toBeVisible();

    await page.locator('#languageSelect').selectOption('fr');
    await expect.poll(async () => page.evaluate(() => window.DSI18N.getLanguage())).toBe('fr');

    await page.locator('#settingsModalCloseBtn').click();
    await expect(page.locator('#settingsModal')).toBeHidden();
  });
});

test.describe('Mobile workflow smoke', () => {
  test.skip(({ isMobile }) => !isMobile, 'Mobile-only test');

  test('@smoke @mobile open menu, navigate, and enable generator action', async ({ page }) => {
    await injectMockFirebase(page);
    await loadApp(page);
    await waitForMainApp(page);

    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(viewportWidth).toBeLessThan(500);

    await page.locator('#navMenuBtn').click();
    await expect(page.locator('#navMenuPanel')).toBeVisible();
    await page.locator('#navPlayersBtn').click();
    await assertOnlyPageVisible(page, 'playersManagementPage');

    await navigateTo(page, 'navGeneratorBtn');
    await assertOnlyPageVisible(page, 'generatorPage');

    await page.locator('#playersTableBody .team-a-btn').first().click();
    await expect(page.locator('#generateBtnA')).toBeEnabled();
  });
});
