import { defineConfig, devices } from '@playwright/test';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// require('dotenv').config();

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    // baseURL: 'http://127.0.0.1:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'chromium HiDPI',
      use: { ...devices['Desktop Chrome HiDPI'] },
    },

    {
      name: 'firefox HiDPI',
      use: { ...devices['Desktop Firefox HiDPI'] },
    },

    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 7'] },
    },

    {
      name: 'Mobile Chrome Landscape',
      use: { ...devices['Pixel 7'] },
    },

    {
      name: 'Submobile Chrome HiDPI',
      use: { ...devices['Galaxy S9+'] },
    },
    {
      name: 'Submobile Chrome HiDPI Landscape',
      use: { ...devices['Galaxy S9+ landscape'] },
    },

    {
      name: 'Tablet Chrome',
      use: { ...devices['Galaxy Tab S4'] },
    },

    {
      name: 'Tablet Chrome Landscape',
      use: { ...devices['Galaxy Tab S4 landscape'] },
    },

    {
      name: 'Mobile Firefox',
      use: { ...devices['Pixel 7'], defaultBrowserType: 'firefox' },
    },

    {
      name: 'Mobile Firefox Landscape',
      use: { ...devices['Pixel 7'], defaultBrowserType: 'firefox' },
    },

    {
      name: 'Submobile Firefox HiDPI',
      use: { ...devices['Galaxy S9+'], defaultBrowserType: 'firefox' },
    },
    {
      name: 'Submobile Firefox HiDPI Landscape',
      use: { ...devices['Galaxy S9+ landscape'], defaultBrowserType: 'firefox' },
    },

    {
      name: 'Tablet Firefox',
      use: { ...devices['Galaxy Tab S4'], defaultBrowserType: 'firefox' },
    },

    {
      name: 'Tablet Firefox Landscape',
      use: { ...devices['Galaxy Tab S4 landscape'], defaultBrowserType: 'firefox' },
    },
  ],

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://127.0.0.1:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});
