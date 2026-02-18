const { test, expect } = require('@playwright/test');
const { loadApp, injectMockFirebase, waitForMainApp, navigateTo } = require('./helpers');

async function ensureAddPanelVisible(page) {
  const nameInput = page.locator('#playersMgmtNewName');
  if (await nameInput.isVisible()) {
    return;
  }
  await page.locator('#playersMgmtAddPanelHeader').click();
  await expect(nameInput).toBeVisible();
}

test.describe('Players workflows', () => {
  test.beforeEach(async ({ page }) => {
    await injectMockFirebase(page);
    await loadApp(page);
    await waitForMainApp(page);
    await navigateTo(page, 'navPlayersBtn');
  });

  test('@smoke @players add player and search/filter in players management', async ({ page }) => {
    await ensureAddPanelVisible(page);

    await page.locator('#playersMgmtNewName').fill('WorkflowPlayer');
    await page.locator('#playersMgmtNewPower').fill('7777777');
    await page.locator('#playersMgmtNewTroops').selectOption('Missile');
    await page.locator('#playersMgmtAddForm').press('Enter');

    // App can switch back to generator after add; return to players panel.
    await navigateTo(page, 'navPlayersBtn');

    const searchInput = page.locator('#playersMgmtSearchFilter');
    if (!(await searchInput.isVisible())) {
      await page.locator('#playersListPanelHeader').click();
    }

    await searchInput.fill('workflow');
    await expect(page.locator('#playersMgmtTableBody tr')).toHaveCount(1);

    await page.locator('#playersMgmtTroopsFilter').selectOption('Missile');
    await expect(page.locator('#playersMgmtTableBody')).toContainText('WorkflowPlayer');
  });

  test('@regression @players sort and clear filters preserves list stability', async ({ page }) => {
    const searchInput = page.locator('#playersMgmtSearchFilter');
    if (!(await searchInput.isVisible())) {
      await page.locator('#playersListPanelHeader').click();
    }

    await page.locator('#playersMgmtSortFilter').selectOption('name-asc');
    await expect(page.locator('#playersMgmtTableBody tr:first-child td:first-child')).toContainText('Alpha');

    await searchInput.fill('a');
    await page.locator('#playersMgmtTroopsFilter').selectOption('Tank');
    await page.locator('#playersMgmtClearFiltersBtn').click();

    const rowCount = await page.locator('#playersMgmtTableBody tr').count();
    expect(rowCount).toBeGreaterThan(1);
  });
});
