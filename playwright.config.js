// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * Playwright E2E configuration - Events Team Generator
 *
 * Runs against a local file:// URL (no dev server needed).
 * Primary browser: Microsoft Edge (msedge).
 * Also runs in a mobile viewport project for responsive workflow checks.
 *
 * Usage:
 *   npm run test:e2e        - run Edge desktop + Edge mobile viewport projects
 *   npm run test:e2e:edge   - Edge desktop only
 *   npm run test:e2e:mobile - mobile viewport only
 *   npm run test:e2e:headed - Edge desktop in headed mode
 */

/** Absolute path to index.html served as a file:// URL */
const INDEX_URL = `file://${__dirname}/index.html`.replace(/\\/g, '/');

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
        ...devices['Desktop Edge'],
        channel: 'msedge',
        viewport: { width: 1280, height: 800 },
      },
    },
    {
      name: 'edge-mobile',
      use: {
        ...devices['Pixel 5'],
        channel: 'msedge',
      },
    },
  ],
});

module.exports.INDEX_URL = INDEX_URL;
