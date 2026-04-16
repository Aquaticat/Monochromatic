import {
  defineConfig,
  devices,
} from '@playwright/test';

export default defineConfig({
  testDir: './packages/module/es/src',
  testMatch: '**/*.browser.test.ts',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
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
    command: 'bun playwright/serve.ts',
    url: 'http://localhost:3005',
    reuseExistingServer: !process.env.CI,
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
  ],
},);
