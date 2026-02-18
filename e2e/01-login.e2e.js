const { test, expect } = require('@playwright/test');
const { loadApp, injectMockFirebase, waitForMainApp } = require('./helpers');

test.describe('Auth workflows', () => {
  test('@smoke @auth email/password login shows main app', async ({ page }) => {
    await injectMockFirebase(page, { isSignedIn: false });
    await loadApp(page);

    await expect(page.locator('#loginScreen')).toBeVisible();
    await page.locator('#emailInput').fill('qa@example.com');
    await page.locator('#passwordInput').fill('secret123');
    await page.locator('#loginForm button[type="submit"]').click();

    await waitForMainApp(page);
    await expect(page.locator('#mainApp')).toBeVisible();
    await expect(page.locator('#loginScreen')).toBeHidden();
  });

  test('@regression @auth sign-out returns to login screen', async ({ page }) => {
    await injectMockFirebase(page);
    await loadApp(page);
    await waitForMainApp(page);

    await page.locator('#navMenuBtn').click();
    await expect(page.locator('#navMenuPanel')).toBeVisible();
    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('#navSignOutBtn').click();

    await expect(page.locator('#loginScreen')).toBeVisible();
    await expect(page.locator('#mainApp')).toBeHidden();
  });
});
