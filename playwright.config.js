// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * Playwright E2E configuration - Events Team Generator
 *
 * Runs against a local file:// URL (no dev server needed).
 * Browsers: Microsoft Edge + Google Chrome (both Chromium-based).
 * Also runs in mobile viewport projects for responsive workflow checks.
 *
 * Usage:
 *   npm run test:e2e          - run all projects (Edge + Chrome, desktop + mobile)
 *   npm run test:e2e:edge     - Edge desktop only
 *   npm run test:e2e:chrome   - Chrome desktop only
 *   npm run test:e2e:mobile   - mobile viewports only (Edge + Chrome)
 *   npm run test:e2e:headed   - Edge desktop in headed mode
 */

/** Absolute path to index.html served as a file:// URL */
const INDEX_URL = `file://${__dirname}/index.html`.replace(/\\/g, '/');
const PLAYWRIGHT_CHANNEL = (process.env.PLAYWRIGHT_CHANNEL || '').trim();

function withChannel(useConfig, defaultChannel) {
  const channel = PLAYWRIGHT_CHANNEL || defaultChannel;
  if (!channel || channel === 'default') {
    return Object.assign({}, useConfig);
  }
  return Object.assign({}, useConfig, { channel: channel });
}

module.exports = defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.js',

  timeout: 30_000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,

  // Keep single worker because app state/auth callbacks are global.
  workers: 1,

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],

  use: {
    baseURL: INDEX_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },

  projects: [
    {
      name: 'edge-desktop',
      use: {
        ...withChannel(devices['Desktop Edge'], 'msedge'),
        viewport: { width: 1280, height: 800 },
      },
    },
    {
      name: 'edge-mobile',
      use: {
        ...withChannel(devices['Pixel 5'], 'msedge'),
      },
    },
    {
      name: 'chrome-desktop',
      use: {
        ...withChannel(devices['Desktop Chrome'], 'chrome'),
        viewport: { width: 1280, height: 800 },
      },
    },
    {
      name: 'chrome-mobile',
      use: {
        ...withChannel(devices['Pixel 5'], 'chrome'),
      },
    },
  ],
});

module.exports.INDEX_URL = INDEX_URL;
