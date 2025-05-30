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
    const startTime = performance.now();
    const waitTime = 100;

    await wait(waitTime);

    const elapsedTime = performance.now() - startTime;
    expect(elapsedTime).toBeGreaterThanOrEqual(waitTime - 1);
  });

  test('resolves to undefined', async () => {
    const result = await wait(10);
    expect(result).toBe(undefined);
  });

  test('waits for different durations correctly', async () => {
    const timings = [50, 100];

    for (const timing of timings) {
      const startTime = performance.now();
      // oxlint-disable-next-line no-await-in-loop
      await wait(timing);
      const elapsedTime = performance.now() - startTime;
      expect(elapsedTime).toBeGreaterThanOrEqual(timing - 1);
    }
  });

  test('handles zero delay', async () => {
    const startTime = performance.now();
    await wait(0);
    const elapsedTime = performance.now() - startTime;
    expect(elapsedTime).toBeGreaterThanOrEqual(0);
  });
});
