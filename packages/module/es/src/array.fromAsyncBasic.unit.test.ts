import {
  arrayFromAsyncBasic,
  type MonochromaticGlobalThis,
  noopLogger,
} from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  test,
} from 'vitest';

// Turn off logging to remove overhead for performance testing.
(globalThis as MonochromaticGlobalThis).monochromatic = { logger: noopLogger, };

describe(arrayFromAsyncBasic, () => {
  test('returns arrays as-is', async () => {
    const arr = [1, 2, 3,];
    const result = await arrayFromAsyncBasic({ iterable: arr, },);
    expect(result,).toBe(arr,);
  });

  test('converts async iterables to arrays', async () => {
    const asyncIterable = {
      async *[Symbol.asyncIterator]() {
        yield 1;
        yield 2;
        yield 3;
      },
    };
    const result = await arrayFromAsyncBasic({ iterable: asyncIterable, },);
    expect(result,).toEqual([1, 2, 3,],);
  });

  test('converts regular iterables to arrays', async () => {
    const set = new Set([1, 2, 3,],);
    const result = await arrayFromAsyncBasic({ iterable: set, },);
    expect(result,).toEqual([1, 2, 3,],);

    const map = new Map([['a', 1,], ['b', 2,],],);
    const result2 = await arrayFromAsyncBasic({ iterable: map, },);
    expect(result2,).toEqual([['a', 1,], ['b', 2,],],);
  });

  test('handles empty iterables', async () => {
    const emptySet = new Set();
    const result = await arrayFromAsyncBasic({ iterable: emptySet, },);
    expect(result,).toEqual([],);
    expect(result.length,).toBe(0,);
  });

  test('performs faster than Array.fromAsync when input is already an array', async () => {
    const arr = Array.from({ length: 10000, }, (_, i,) => i,);

    // Measure arrayFromAsyncBasic performance
    const start1 = performance.now();
    const result = await arrayFromAsyncBasic({ iterable: arr, },);
    const end1 = performance.now();
    const time1 = end1 - start1;

    // Measure Array.fromAsync performance
    const start2 = performance.now();
    const fromResult = await Array.fromAsync(arr,);
    const end2 = performance.now();
    const time2 = end2 - start2;

    // arrayFromAsyncBasic should be faster because it returns the same reference
    expect(result,).toBe(arr,);
    expect(fromResult,).not.toBe(arr,);
    expect(time1,).toBeLessThan(time2,);
  });

  test('reference equality with Array.fromAsync', async () => {
    const arr = [1, 2, 3, 4, 5,];

    // When input is already an array, arrayFromAsyncBasic should return it directly
    const result = await arrayFromAsyncBasic({ iterable: arr, },);
    expect(result,).toBe(arr,); // Same reference

    // Array.fromAsync always creates a new array even when input is already an array
    const fromResult = await Array.fromAsync(arr,);
    expect(fromResult,).not.toBe(arr,); // Different reference
    expect(fromResult,).toEqual(arr,); // Same content
  });
},);
