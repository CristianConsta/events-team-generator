const { test, expect } = require('@playwright/test');
const { loadApp, navigateTo, waitForMainApp } = require('./helpers');

const REAL_EMAIL = (process.env.E2E_REAL_EMAIL || '').trim();
const REAL_PASSWORD = process.env.E2E_REAL_PASSWORD || '';

test.describe('Real Firebase smoke workflows', () => {
  test.skip(!REAL_EMAIL || !REAL_PASSWORD, 'Set E2E_REAL_EMAIL and E2E_REAL_PASSWORD to run @real suite');

  test('@real login, navigate pages, and validate core data renders', async ({ page }) => {
    await loadApp(page);

    const mainApp = page.locator('#mainApp');
    if (!(await mainApp.isVisible().catch(() => false))) {
      await page.locator('#emailInput').fill(REAL_EMAIL);
      await page.locator('#passwordInput').fill(REAL_PASSWORD);
      await page.locator('#loginForm button[type="submit"]').click();
    }

    await waitForMainApp(page);
    await expect(page.locator('#mainApp')).toBeVisible();

    await navigateTo(page, 'navPlayersManagementBtn');
    await expect(page.locator('#playersManagementPage')).toBeVisible();
    const playerRows = await page.locator('#playersMgmtTableBody tr').count();
    expect(playerRows).toBeGreaterThan(0);

    await navigateTo(page, 'navConfigBtn');
    await expect(page.locator('#configurationPage')).toBeVisible();
    await expect(page.locator('#eventsList')).toBeVisible();

    await navigateTo(page, 'navAllianceBtn');
    await expect(page.locator('#alliancePage')).toBeVisible();
  });
});
