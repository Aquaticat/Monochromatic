import {
  expect,
  test,
} from '@playwright/test';

test.describe('onLoadRedirectingTo', () => {
  test.beforeEach(async ({ page, }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.moduleEs !== undefined);
  });

  test('placeholder test', async ({ page, }) => {
    const hasFunction = await page.evaluate(() => typeof window.moduleEs.onLoadRedirectingTo === 'function');
    expect(hasFunction).toBe(true);
  });
});
