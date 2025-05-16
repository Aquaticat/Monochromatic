import {
  logtapeConfiguration,
  logtapeConfigure,
  wait,
} from '@monochromatic-dev/module-es/.js';
import {
  describe,
  expect,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration());

describe('wait', () => {
  test('resolves after the specified time', async () => {
    const startTime = Date.now();
    const waitTime = 100;

    await wait(waitTime);

    const elapsedTime = Date.now() - startTime;
    expect(elapsedTime).toBeGreaterThanOrEqual(waitTime);
  });

  test('resolves to undefined', async () => {
    const result = await wait(10);
    expect(result).toBe(undefined);
  });

  test('waits for different durations correctly', async () => {
    const timings = [50, 100];

    for (const timing of timings) {
      const startTime = Date.now();
      // eslint-disable-next-line no-await-in-loop
      await wait(timing);
      const elapsedTime = Date.now() - startTime;
      expect(elapsedTime).toBeGreaterThanOrEqual(timing);
    }
  });

  test('handles zero delay', async () => {
    const startTime = Date.now();
    await wait(0);
    const elapsedTime = Date.now() - startTime;
    expect(elapsedTime).toBeGreaterThanOrEqual(0);
  });
});
