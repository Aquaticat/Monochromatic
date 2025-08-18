import {
  arrayFromBasic,
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

describe(arrayFromBasic, () => {
  test('returns arrays as-is', () => {
    const arr = [1, 2, 3,];
    const result = arrayFromBasic({ iterable: arr, },);
    expect(result,).toBe(arr,);
  });

  test('converts iterables to arrays', () => {
    const set = new Set([1, 2, 3,],);
    const result = arrayFromBasic({ iterable: set, },);
    expect(result,).toEqual([1, 2, 3,],);

    const map = new Map([['a', 1,], ['b', 2,],],);
    const result2 = arrayFromBasic({ iterable: map, },);
    expect(result2,).toEqual([['a', 1,], ['b', 2,],],);
  });

  test('handles empty iterables', () => {
    const emptySet = new Set();
    const result = arrayFromBasic({ iterable: emptySet, },);
    expect(result,).toEqual([],);
    expect(result.length,).toBe(0,);
  });

  test('performs faster than Array.from when input is already an array', () => {
    const arr = Array.from({ length: 10000, }, (_, i,) => i,);

    // Measure arrayFromBasic performance
    const start1 = performance.now();
    const result = arrayFromBasic({ iterable: arr, },);
    const end1 = performance.now();
    const time1 = end1 - start1;

    // Measure Array.from performance
    const start2 = performance.now();
    const fromResult = Array.from(arr,);
    const end2 = performance.now();
    const time2 = end2 - start2;

    // arrayFromBasic should be faster because it returns the same reference
    expect(result,).toBe(arr,);
    expect(fromResult,).not.toBe(arr,);
    expect(time1,).toBeLessThan(time2,);
  });

  test('performs faster than spread syntax when input is already an array', () => {
    const arr = Array.from({ length: 10000, }, (_, i,) => i,);

    // Measure arrayFromBasic performance
    const start1 = performance.now();
    const result = arrayFromBasic({ iterable: arr, },);
    const end1 = performance.now();
    const time1 = end1 - start1;

    // Measure spread syntax performance
    const start2 = performance.now();
    const spreadResult = [...arr,];
    const end2 = performance.now();
    const time2 = end2 - start2;

    // arrayFromBasic should be faster because it returns the same reference
    expect(result,).toBe(arr,);
    expect(spreadResult,).not.toBe(arr,);
    expect(time1,).toBeLessThan(time2,);
  });

  test('reference equality with Array.from', () => {
    const arr = [1, 2, 3, 4, 5,];

    // When input is already an array, arrayFromBasic should return it directly
    const result = arrayFromBasic({ iterable: arr, },);
    expect(result,).toBe(arr,); // Same reference

    // Array.from always creates a new array even when input is already an array
    const fromResult = Array.from(arr,);
    expect(fromResult,).not.toBe(arr,); // Different reference
    expect(fromResult,).toEqual(arr,); // Same content
  });

  test('reference equality with spread syntax', () => {
    const arr = [1, 2, 3, 4, 5,];

    // When input is already an array, arrayFromBasic should return it directly
    const result = arrayFromBasic({ iterable: arr, },);
    expect(result,).toBe(arr,); // Same reference

    // Spread syntax always creates a new array even when input is already an array
    const spreadResult = [...arr,];
    expect(spreadResult,).not.toBe(arr,); // Different reference
    expect(spreadResult,).toEqual(arr,); // Same content
  });
},);
