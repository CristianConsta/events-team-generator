const { test, expect } = require('@playwright/test');
const { loadApp, injectMockFirebase, waitForMainApp } = require('./helpers');

function makeUploadFixture() {
  return {
    name: 'players.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from('mock-xlsx-content'),
  };
}

test.describe('Player upload routing', () => {
  test('@regression non-alliance user uploads directly to My Database', async ({ page }) => {
    await injectMockFirebase(page, {
      allianceId: null,
      allianceName: null,
      allianceData: null,
    });
    await loadApp(page);
    await waitForMainApp(page);

    await page.setInputFiles('#playerFileInput', makeUploadFixture());

    const modal = page.locator('#uploadTargetModal');
    await expect(modal).toBeHidden();
    await page.waitForTimeout(300);

    const uploadCalls = await page.evaluate(() => (
      window.FirebaseManager && typeof window.FirebaseManager.getUploadCalls === 'function'
        ? window.FirebaseManager.getUploadCalls()
        : []
    ));
    const targets = uploadCalls.map((entry) => entry.target);
    expect(targets).toEqual(['personal']);
  });

  test('@regression alliance member sees target modal and can upload to both databases', async ({ page }) => {
    await injectMockFirebase(page, {
      allianceId: 'alliance-x',
      allianceName: 'Alliance X',
      allianceData: {
        id: 'alliance-x',
        name: 'Alliance X',
        members: {
          'qa-uid-001': { uid: 'qa-uid-001', role: 'owner' },
        },
        playerDatabase: {},
      },
    });
    await loadApp(page);
    await waitForMainApp(page);

    await page.setInputFiles('#playerFileInput', makeUploadFixture());

    const modal = page.locator('#uploadTargetModal');
    await expect(modal).toBeVisible();
    await page.locator('#uploadBothBtn').click();
    await expect(modal).toBeHidden();
    await page.waitForTimeout(300);

    const uploadCalls = await page.evaluate(() => (
      window.FirebaseManager && typeof window.FirebaseManager.getUploadCalls === 'function'
        ? window.FirebaseManager.getUploadCalls()
        : []
    ));
    const targets = uploadCalls.map((entry) => entry.target);
    expect(targets).toEqual(['personal', 'alliance']);
  });
});
