import {
  filterArrayLike,
  filterArrayLikeAsync,
  filterFailArrayLike,
  filterFailArrayLikeAsync,
  logtapeConfiguration,
  logtapeConfigure,
} from '@monochromatic-dev/module-es/.js';
import {
  describe,
  expect,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration());

describe('filterArrayLike', () => {
  test('filters values based on predicate', () => {
    const isEven = (x: number) => x % 2 === 0;
    const result = filterArrayLike(isEven, [1, 2, 3, 4, 5]);
    expect(result).toEqual([2, 4]);
  });

  test('works with empty array', () => {
    const isEven = (x: number) => x % 2 === 0;
    const result = filterArrayLike(isEven, []);
    expect(result).toEqual([]);
  });

  test('works with all values matching', () => {
    const isPositive = (x: number) => x > 0;
    const result = filterArrayLike(isPositive, [1, 2, 3]);
    expect(result).toEqual([1, 2, 3]);
  });

  test('works with no values matching', () => {
    const isNegative = (x: number) => x < 0;
    const result = filterArrayLike(isNegative, [1, 2, 3]);
    expect(result).toEqual([]);
  });

  test('works with other iterables', () => {
    const isEven = (x: number) => x % 2 === 0;
    const set = new Set([1, 2, 3, 4, 5]);
    const result = filterArrayLike(isEven, set);
    expect(result).toEqual([2, 4]);
  });
});

describe('filterArrayLikeAsync', () => {
  test('filters values based on async predicate', async () => {
    const isEvenAsync = async (x: number) => x % 2 === 0;
    const result = await filterArrayLikeAsync(isEvenAsync, [1, 2, 3, 4, 5]);
    expect(result).toEqual([2, 4]);
  });

  test('works with empty array', async () => {
    const isEvenAsync = async (x: number) => x % 2 === 0;
    const result = await filterArrayLikeAsync(isEvenAsync, []);
    expect(result).toEqual([]);
  });

  test('works with sync predicate', async () => {
    const isEven = (x: number) => x % 2 === 0;
    const result = await filterArrayLikeAsync(isEven, [1, 2, 3, 4, 5]);
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
    const result = await filterArrayLikeAsync(isEven, asyncIterable);
    expect(result).toEqual([2, 4]);
  });
});

describe('filterFailArrayLike', () => {
  test('keeps values that fail the predicate', () => {
    const isEven = (x: number) => x % 2 === 0;
    const result = filterFailArrayLike(isEven, [1, 2, 3, 4, 5]);
    expect(result).toEqual([1, 3, 5]);
  });

  test('works with empty array', () => {
    const isEven = (x: number) => x % 2 === 0;
    const result = filterFailArrayLike(isEven, []);
    expect(result).toEqual([]);
  });

  test('works with all values failing', () => {
    const isNegative = (x: number) => x < 0;
    const result = filterFailArrayLike(isNegative, [1, 2, 3]);
    expect(result).toEqual([1, 2, 3]);
  });

  test('works with no values failing', () => {
    const isPositive = (x: number) => x > 0;
    const result = filterFailArrayLike(isPositive, [1, 2, 3]);
    expect(result).toEqual([]);
  });
});

describe('filterFailArrayLikeAsync', () => {
  test('keeps values that fail the async predicate', async () => {
    const isEvenAsync = async (x: number) => x % 2 === 0;
    const result = await filterFailArrayLikeAsync(isEvenAsync, [1, 2, 3, 4, 5]);
    expect(result).toEqual([1, 3, 5]);
  });

  test('works with empty array', async () => {
    const isEvenAsync = async (x: number) => x % 2 === 0;
    const result = await filterFailArrayLikeAsync(isEvenAsync, []);
    expect(result).toEqual([]);
  });

  test('works with sync predicate', async () => {
    const isEven = (x: number) => x % 2 === 0;
    const result = await filterFailArrayLikeAsync(isEven, [1, 2, 3, 4, 5]);
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
    const result = await filterFailArrayLikeAsync(isEven, asyncIterable);
    expect(result).toEqual([1, 3, 5]);
  });
});
