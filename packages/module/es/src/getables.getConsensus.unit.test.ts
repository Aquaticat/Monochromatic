import {
  getablesGetConsensus,
  logtapeConfiguration,
  logtapeConfigure,
} from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  test,
  vi,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration(),);

describe('getablesGetConsensus', () => {
  test('returns value from single getable with default weight', async () => {
    const result = await getablesGetConsensus({
      getables: [{ get: ({key}: {key: string}) => 'b', },],
      key: 'a',
    },);

    expect(result,).toBe('b',);
  });

  test('returns consensus value based on weights', async () => {
    const result = await getablesGetConsensus({
      getables: [
        { get: ({key}: {key: string}) => 'b', weight: 1, },
        { get: ({key}: {key: string}) => 'b', weight: 2, },
        { get: ({key}: {key: string}) => 'c', weight: 10, },
      ],
      key: 'a',
    },);

    expect(result,).toBe('c',);
  });

  test('handles async getables with generators', async () => {
    async function* getablesGenerator() {
      yield { get: async ({key}: {key: string}) => 'async-value', };
      yield { get: async ({key}: {key: string}) => 'async-value', weight: 5, };
    }

    const result = await getablesGetConsensus({
      getables: getablesGenerator(),
      key: 'test',
    },);

    expect(result,).toBe('async-value',);
  });

  test('handles complex value types with deep equality', async () => {
    const complexValue = { nested: { array: [1, 2, 3,], },
      date: new Date('2023-01-01',), };

    const result = await getablesGetConsensus({
      getables: [
        { get: ({key}: {key: string}) => complexValue, weight: 1, },
        { get: ({key}: {key: string}) => complexValue, weight: 2, }, // Use same object to avoid readonly issues
        { get: ({key}: {key: string}) => 'different' as unknown, weight: 1, },
      ],
      key: 'complex',
    },);

    expect(result,).toEqual(complexValue,);
  });

  test('throws error when multiple values tie for highest weight', async () => {
    await expect(
      getablesGetConsensus({
        getables: [
          { get: ({key}: {key: string}) => 'a', weight: 5, },
          { get: ({key}: {key: string}) => 'b', weight: 5, },
        ],
        key: 'test',
      },),
    )
      .rejects
      .toThrow('Consensus tie detected',);
  });

  test('throws error when no getables provided', async () => {
    await expect(
      getablesGetConsensus({
        getables: [],
        key: 'test',
      },),
    )
      .rejects
      .toThrow('No getables provided for consensus',);
  });

  test('propagates errors from individual getables', async () => {
    const errorMessage = 'Getable failed';

    await expect(
      getablesGetConsensus({
        getables: [
          { get: ({key}: {key: string}) => {
            throw new Error(errorMessage,);
          }, },
        ],
        key: 'test',
      },),
    )
      .rejects
      .toThrow(errorMessage,);
  });

  test('handles async errors from getables', async () => {
    const errorMessage = 'Async getable failed';

    await expect(
      getablesGetConsensus({
        getables: [
          { get: async ({key}: {key: string}) => {
            throw new Error(errorMessage,);
          }, },
        ],
        key: 'test',
      },),
    )
      .rejects
      .toThrow(errorMessage,);
  });

  test('handles zero weight getables', async () => {
    const result = await getablesGetConsensus({
      getables: [
        { get: ({key}: {key: string}) => 'zero-weight', weight: 0, },
        { get: ({key}: {key: string}) => 'winner', weight: 1, },
      ],
      key: 'test',
    },);

    expect(result,).toBe('winner',);
  });

  test('handles zero weight vs negative weight', async () => {
    const result = await getablesGetConsensus({
      getables: [
        { get: ({key: string}) => 'zero-weight', weight: 0},
        { get: ({key: string}) => 'loser', weight: -1},
      ],
      key: 'test',
    });

    expect(result).toBe('zero-weight');
  });

  test('groups identical values correctly', async () => {
    const result = await getablesGetConsensus({
      getables: [
        { get: ({key: string}) => 'same', weight: 1},
        { get: ({key: string}) => 'same', weight: 1},
        { get: ({key: string}) => 'same', weight: 1},
        { get: ({key: string}) => 'different', weight: 2},
      ],
      key: 'test',
    });

    // 'same' has total weight 3, 'different' has weight 2
    expect(result).toBe('same');
  });

  test('handles single getable that returns undefined', async () => {
    const result = await getablesGetConsensus({
      getables: [
        { get: ({key}: {key: string,}) => undefined, },
      ],
      key: 'test',
    },);

    expect(result,).toBeUndefined();
  });

  test('handles single getable that returns null', async () => {
    const result = await getablesGetConsensus({
      getables: [
        { get: ({key}: {key: string,}) => null, },
      ],
      key: 'test',
    },);

    expect(result,).toBeNull();
  });

  test('handles promises returned by get methods', async () => {
    const result = await getablesGetConsensus({
      getables: [
        { get: ({key}: {key: string,}) => Promise.resolve('promised-value',), },
      ],
      key: 'test',
    },);

    expect(result,).toBe('promised-value',);
  });

  test('handles different keys passed to getables', async () => {
    const spy = vi.fn().mockReturnValue('value',);

    await getablesGetConsensus({
      getables: [{ get: spy, },],
      key: 'specific-key',
    },);

    expect(spy,).toHaveBeenCalledWith({key: 'specific-key'});
  });

  test('uses custom logger when provided', async () => {
    const customLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      trace: vi.fn(),
      fatal: vi.fn(),
    };

    await getablesGetConsensus({
      getables: [{ get: ({key}: {key: string,}) => 'test', },],
      key: 'test',
      l: customLogger,
    },);

    expect(customLogger.trace,).toHaveBeenCalledWith('getablesGetConsensus');
  });

  test('handles fractional weights', async () => {
    const result = await getablesGetConsensus({
      getables: [
        { get: ({key}: {key: string,}) => 'fractional', weight: 0.5, },
        { get: ({key}: {key: string,}) => 'winner', weight: 0.6, },
      ],
      key: 'test',
    },);

    expect(result,).toBe('winner',);
  });

  test('handles negative weights', async () => {
    const result = await getablesGetConsensus({
      getables: [
        { get: ({key}: {key: string,}) => 'negative', weight: -1, },
        { get: ({key}: {key: string,}) => 'positive', weight: 1, },
      ],
      key: 'test',
    },);

    expect(result,).toBe('positive',);
  });

  test('handles large weights', async () => {
    const LARGE_WEIGHT = 1000000;

    const result = await getablesGetConsensus({
      getables: [
        { get: ({key}: {key: string,}) => 'small', weight: 1, },
        { get: ({key}: {key: string,}) => 'large', weight: LARGE_WEIGHT, },
      ],
      key: 'test',
    },);

    expect(result,).toBe('large',);
  });

  test('handles Map objects as values', async () => {
    const map1 = new Map([['a', 1,], ['b', 2,],],);
    const map2 = new Map([['b', 2,], ['a', 1,],],); // Same content, different order

    const result = await getablesGetConsensus({
      getables: [
        { get: ({key}: {key: string,}) => map1, weight: 1, },
        { get: ({key}: {key: string,}) => map2, weight: 2, }, // Should be considered equal to map1
      ],
      key: 'test',
    },);

    expect(result,).toEqual(map1,);
  });

  test('handles Set objects as values', async () => {
    const set1 = new Set([1, 2, 3,],);
    const set2 = new Set([3, 2, 1,],); // Same content, different order

    const result = await getablesGetConsensus({
      getables: [
        { get: ({key}: {key: string,}) => set1, weight: 1, },
        { get: ({key}: {key: string,}) => set2, weight: 2, }, // Should be considered equal to set1
      ],
      key: 'test',
    },);

    expect(result,).toEqual(set1,);
  });

  test('handles Date objects as values', async () => {
    const date1 = new Date('2023-01-01',);
    const date2 = new Date('2023-01-01',); // Same time

    const result = await getablesGetConsensus({
      getables: [
        { get: ({key}: {key: string,}) => date1, weight: 1, },
        { get: ({key}: {key: string,}) => date2, weight: 2, }, // Should be considered equal to date1
      ],
      key: 'test',
    },);

    expect(result,).toEqual(date1,);
  });

  test('concurrent execution of get methods', async () => {
    const DELAY_MS = 50;
    const CONCURRENT_COUNT = 3;

    const startTime = Date.now();

    await getablesGetConsensus({
      getables: Array.from({ length: CONCURRENT_COUNT, }, () => ({
        get: async ({key}: {key: string,}) => {
          await new Promise(resolve => setTimeout(resolve, DELAY_MS,));
          return 'concurrent-result';
        },
      }),),
      key: 'test',
    },);

    const endTime = Date.now();
    const elapsed = endTime - startTime;

    // Should complete in roughly DELAY_MS time, not DELAY_MS * CONCURRENT_COUNT
    // Allow some buffer for test execution overhead
    expect(elapsed,).toBeLessThan(DELAY_MS * 2,);
  });
});