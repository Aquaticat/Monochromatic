import {
  defineConfig,
  devices,
  type PlaywrightTestConfig,
} from '@playwright/test';

/**
 Whether CI was enabled through a nonempty environment value.
 */
const isCi = Boolean(process.env
  .CI,);

/**
 Browser Playwright configuration with an explicit public export type for isolated declarations.
 */
const config: PlaywrightTestConfig = defineConfig({
  testDir: './package',
  testMatch: [
    'module/es/src/**/*.browser.test.ts',
    'module/test/src/**/*.browser.test.ts',
    'module/logger/src/**/*.browser.test.ts',
    'module/logger.fuzz/src/**/*.browser.test.ts',
    'webapp-productivity/wc/src/**/*.browser.test.ts',
  ],
  fullyParallel: true,
  retries: isCi ? 2 : 0,
  reporter: [
    ['dot',],
    [
      'html',
      { open: 'never', },
    ],
  ],

  use: {
    baseURL: 'http://localhost:3005',
    trace: 'on-first-retry',
  },

  webServer: {
    command: 'node playwright/serve.ts',
    url: 'http://localhost:3005',
    reuseExistingServer: !isCi,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'], },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'], },
    },
  ],
},);

export default config;
