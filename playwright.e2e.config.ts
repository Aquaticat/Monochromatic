import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testMatch: '**/*.e2e.test.ts',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [['dot'], ['html', { open: 'never' }]],

  use: {
    trace: 'on-first-retry',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
});
