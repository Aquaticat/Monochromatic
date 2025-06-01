import {
  filterFailIterable,
  filterFailIterableAsync,
  filterIterable,
  filterIterableAsync,
  logtapeConfiguration,
  logtapeConfigure,
} from '@monochromatic-dev/module-es/.js';
import {
  describe,
  expect,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration());

describe(filterIterable, () => {
  test('filters values based on predicate', () => {
    const isEven = (x: number) => x % 2 === 0;
    const result = filterIterable(isEven, [1, 2, 3, 4, 5]);
    expect(result).toEqual([2, 4]);
  });

  test('works with empty array', () => {
    const isEven = (x: number) => x % 2 === 0;
    const result = filterIterable(isEven, []);
    expect(result).toEqual([]);
  });

  test('works with all values matching', () => {
    const isPositive = (x: number) => x > 0;
    const result = filterIterable(isPositive, [1, 2, 3]);
    expect(result).toEqual([1, 2, 3]);
  });

  test('works with no values matching', () => {
    const isNegative = (x: number) => x < 0;
    const result = filterIterable(isNegative, [1, 2, 3]);
    expect(result).toEqual([]);
  });

  test('works with other iterables', () => {
    const isEven = (x: number) => x % 2 === 0;
    const set = new Set([1, 2, 3, 4, 5]);
    const result = filterIterable(isEven, set);
    expect(result).toEqual([2, 4]);
  });
});

describe(filterIterableAsync, () => {
  test('filters values based on async predicate', async () => {
    const isEvenAsync = async (x: number) => x % 2 === 0;
    const result = await filterIterableAsync(isEvenAsync, [1, 2, 3, 4, 5]);
    expect(result).toEqual([2, 4]);
  });

  test('works with empty array', async () => {
    const isEvenAsync = async (x: number) => x % 2 === 0;
    const result = await filterIterableAsync(isEvenAsync, []);
    expect(result).toEqual([]);
  });

  test('works with sync predicate', async () => {
    const isEven = (x: number) => x % 2 === 0;
    const result = await filterIterableAsync(isEven, [1, 2, 3, 4, 5]);
    expect(result).toEqual([2, 4]);
  });

  test('works with async iterable', async () => {
    const isEven = (x: number) => x % 2 === 0;
    const asyncIterable = {
      [Symbol.asyncIterator]: async function*() {
        yield 1;
        yield 2;
        yield 3;
        yield 4;
        yield 5;
      },
    };
    const result = await filterIterableAsync(isEven, asyncIterable);
    expect(result).toEqual([2, 4]);
  });
});

describe(filterFailIterable, () => {
  test('keeps values that fail the predicate', () => {
    const isEven = (x: number) => x % 2 === 0;
    const result = filterFailIterable(isEven, [1, 2, 3, 4, 5]);
    expect(result).toEqual([1, 3, 5]);
  });

  test('works with empty array', () => {
    const isEven = (x: number) => x % 2 === 0;
    const result = filterFailIterable(isEven, []);
    expect(result).toEqual([]);
  });

  test('works with all values failing', () => {
    const isNegative = (x: number) => x < 0;
    const result = filterFailIterable(isNegative, [1, 2, 3]);
    expect(result).toEqual([1, 2, 3]);
  });

  test('works with no values failing', () => {
    const isPositive = (x: number) => x > 0;
    const result = filterFailIterable(isPositive, [1, 2, 3]);
    expect(result).toEqual([]);
  });
});

describe(filterFailIterableAsync, () => {
  test('keeps values that fail the async predicate', async () => {
    const isEvenAsync = async (x: number) => x % 2 === 0;
    const result = await filterFailIterableAsync(isEvenAsync, [1, 2, 3, 4, 5]);
    expect(result).toEqual([1, 3, 5]);
  });

  test('works with empty array', async () => {
    const isEvenAsync = async (x: number) => x % 2 === 0;
    const result = await filterFailIterableAsync(isEvenAsync, []);
    expect(result).toEqual([]);
  });

  test('works with sync predicate', async () => {
    const isEven = (x: number) => x % 2 === 0;
    const result = await filterFailIterableAsync(isEven, [1, 2, 3, 4, 5]);
    expect(result).toEqual([1, 3, 5]);
  });

  test('works with async iterable', async () => {
    const isEven = (x: number) => x % 2 === 0;
    const asyncIterable = {
      [Symbol.asyncIterator]: async function*() {
        yield 1;
        yield 2;
        yield 3;
        yield 4;
        yield 5;
      },
    };
    const result = await filterFailIterableAsync(isEven, asyncIterable);
    expect(result).toEqual([1, 3, 5]);
  });
});
