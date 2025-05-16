import {
  logtapeConfiguration,
  logtapeConfigure,
  somePromises,
} from '@monochromatic-dev/module-es/.js';
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration());

describe('somePromises', () => {
  test('returns true when at least one value passes the predicate', async () => {
    const result = await somePromises(
      (val) => val > 5,
      [1, 3, 7, 2],
    );
    expect(result).toBe(true);
  });

  test('returns false when no values pass the predicate', async () => {
    const result = await somePromises(
      (val) => val > 10,
      [1, 3, 7, 2],
    );
    expect(result).toBe(false);
  });

  test('works with promises as inputs', async () => {
    const result = await somePromises(
      (val) => val > 5,
      [Promise.resolve(1), Promise.resolve(7), Promise.resolve(3)],
    );
    expect(result).toBe(true);
  });

  test('works with async predicates', { timeout: 15_000 }, async ({ expect }) => {
    const result = await somePromises(
      async (val) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return val > 5;
      },
      [1, 3, 7, 2],
    );
    expect(result).toBe(true);
  });

  test('handles empty arrays', async () => {
    const result = await somePromises(
      (val) => val > 5,
      [],
    );
    expect(result).toBe(false);
  });

  test('handles AsyncIterable inputs', async () => {
    async function* generator() {
      yield 1;
      yield 3;
      yield 7;
      yield 2;
    }

    const result = await somePromises(
      (val) => val > 5,
      generator(),
    );
    expect(result).toBe(true);
  });

  test('continues after predicate throws an error', async () => {
    const result = await somePromises(
      (val) => {
        if (val === 3) { throw new Error('Test error'); }
        return val > 5;
      },
      [1, 3, 7, 2],
    );
    expect(result).toBe(true);
  });

  test('handles sharding for large arrays', async () => {
    const largeArray = Array.from({ length: 500 }, (_, i) => i);

    const result = await somePromises(
      (val) => val === 450,
      largeArray,
      100,
    );
    expect(result).toBe(true);
  });

  test('returns false if all shards reject', async () => {
    const largeArray = Array.from({ length: 500 }, () => 0); // All zeros

    const result = await somePromises(
      (val) => val > 0,
      largeArray,
      100,
    );
    expect(result).toBe(false);
  });

  // We're doing benchmarks instead of performance tests
  describe('performance tests', { timeout: 15_000, skip: true }, () => {
    const SMALL_SIZE = 100;
    const MEDIUM_SIZE = 100_000;
    const LARGE_SIZE = 1_000_000;

    // eslint-disable-next-line init-declarations
    let smallArray: number[];
    // eslint-disable-next-line init-declarations
    let mediumArray: number[];
    // eslint-disable-next-line init-declarations
    let largeArray: number[];

    beforeAll(() => {
      smallArray = Array.from({ length: SMALL_SIZE }, (_, i) => i);
      mediumArray = Array.from({ length: MEDIUM_SIZE }, (_, i) => i);
      largeArray = Array.from({ length: LARGE_SIZE }, (_, i) => i);
    });

    test('performs well with matching item at beginning', async ({ expect }) => {
      const startTime = performance.now();

      const result = await somePromises(
        (val) => val === 0,
        largeArray,
      );

      const endTime = performance.now();
      const elapsedMs = endTime - startTime;

      expect(result).toBe(true);
      expect(elapsedMs).toBeLessThan(15_000);
      // expect(elapsedMs).toBeLessThan(2000);
    });

    // TODO Migrate to bench tests.
    test('performs well with matching item at end', async ({ expect }) => {
      const startTime = performance.now();

      const result = await somePromises(
        (val) => val === LARGE_SIZE - 1,
        largeArray,
      );

      const endTime = performance.now();
      const elapsedMs = endTime - startTime;

      expect(result).toBe(true);
      expect(elapsedMs).toBeLessThan(15_000);
      // expect(elapsedMs).toBeLessThan(2000);
    });

    test('performs well when no match exists', async ({ expect }) => {
      const startTime = performance.now();

      const result = await somePromises(
        (val) => val > LARGE_SIZE,
        largeArray,
      );

      const endTime = performance.now();
      const elapsedMs = endTime - startTime;

      expect(result).toBe(false);
      expect(elapsedMs).toBeLessThan(15_000);
      // expect(elapsedMs).toBeLessThan(2000);
    });

    test('sharding improves performance for medium arrays', async () => {
      // With default sharding
      const startTimeWithSharding = performance.now();
      await somePromises(
        (val) => val === MEDIUM_SIZE - 1,
        mediumArray,
      );
      const endTimeWithSharding = performance.now();
      const elapsedWithSharding = endTimeWithSharding - startTimeWithSharding;

      // Force no sharding by setting a very large shard size
      const startTimeNoSharding = performance.now();
      await somePromises(
        (val) => val === MEDIUM_SIZE - 1,
        mediumArray,
        MEDIUM_SIZE + 1,
      );
      const endTimeNoSharding = performance.now();
      const elapsedNoSharding = endTimeNoSharding - startTimeNoSharding;

      // Log the timings for debugging
      console.log(
        `Sharding: ${elapsedWithSharding}ms, No sharding: ${elapsedNoSharding}ms`,
      );

      // This may not always hold true for small datasets,
      // but it should generally be faster with sharding for medium-to-large arrays
      // when the matching element is near the end
      expect(elapsedWithSharding).toBeLessThanOrEqual(elapsedNoSharding * 1.5);
    });

    test('handles async predicates efficiently', async () => {
      const startTime = performance.now();

      const result = await somePromises(
        async (val) => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return val === 50;
        },
        smallArray,
      );

      const endTime = performance.now();
      const elapsedMs = endTime - startTime;

      expect(result).toBe(true);
      // This should be roughly the time for the first 51 items with 100ms delay each
      // but with parallelization it should be much faster than 5100ms
      expect(elapsedMs).toBeLessThan(300);
    });
  });
});
