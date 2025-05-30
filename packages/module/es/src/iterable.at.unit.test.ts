import {
  atIterable,
  atIterableAsync,
  logtapeConfiguration,
  logtapeConfigure,
} from '@monochromatic-dev/module-es/.js';
import {
  describe,
  expect,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration());

describe(atIterable, () => {
  test('returns element at positive index in array', () => {
    const array = [1, 2, 3, 4, 5] as const;
    expect(atIterable(0, array)).toBe(1);
    expect(atIterable(2, array)).toBe(3);
    expect(atIterable(4, array)).toBe(5);
  });

  test('returns element at negative index in array', () => {
    const array = [1, 2, 3, 4, 5] as const;
    expect(atIterable(-1, array)).toBe(5);
    expect(atIterable(-3, array)).toBe(3);
    expect(atIterable(-5, array)).toBe(1);
  });

  test('returns undefined for out-of-range positive index in array', () => {
    const array = [1, 2, 3] as const;
    expect(atIterable(3, array)).toBeUndefined();
    expect(atIterable(10, array)).toBeUndefined();
  });

  test('returns undefined for out-of-range negative index in array', () => {
    const array = [1, 2, 3] as const;
    expect(atIterable(-4, array)).toBeUndefined();
    expect(atIterable(-10, array)).toBeUndefined();
  });

  test('works with empty arrays', () => {
    const array: number[] = [];
    expect(atIterable(0, array)).toBeUndefined();
    expect(atIterable(-1, array)).toBeUndefined();
  });

  test('handles non-array iterables', () => {
    const set = new Set([10, 20, 30, 40]);
    expect(atIterable(0, set)).toBe(10);
    expect(atIterable(2, set)).toBe(30);
    expect(atIterable(-1, set)).toBe(40);
    expect(atIterable(-2, set)).toBe(30);
  });

  test('handles out-of-range indices with non-array iterables', () => {
    const set = new Set([10, 20, 30]);
    expect(atIterable(3, set)).toBeUndefined();
    expect(atIterable(-4, set)).toBeUndefined();
  });

  test('handles strings as iterables', () => {
    const str = 'hello';
    expect(atIterable(0, str)).toBe('h');
    expect(atIterable(4, str)).toBe('o');
    expect(atIterable(-1, str)).toBe('o');
  });

  test('works with custom iterables', () => {
    const customIterable = {
      *[Symbol.iterator]() {
        yield 'a';
        yield 'b';
        yield 'c';
      },
    };

    expect(atIterable(0, customIterable)).toBe('a');
    expect(atIterable(2, customIterable)).toBe('c');
    expect(atIterable(-1, customIterable)).toBe('c');
    expect(atIterable(3, customIterable)).toBeUndefined();
  });
});

describe(atIterableAsync, () => {
  test('returns element at positive index in array', async () => {
    const array = [1, 2, 3, 4, 5];
    expect(await atIterableAsync(0, array)).toBe(1);
    expect(await atIterableAsync(2, array)).toBe(3);
    expect(await atIterableAsync(4, array)).toBe(5);
  });

  test('returns element at negative index in array', async () => {
    const array = [1, 2, 3, 4, 5];
    expect(await atIterableAsync(-1, array)).toBe(5);
    expect(await atIterableAsync(-3, array)).toBe(3);
    expect(await atIterableAsync(-5, array)).toBe(1);
  });

  test('returns undefined for out-of-range indices in array', async () => {
    const array = [1, 2, 3];
    expect(await atIterableAsync(3, array)).toBeUndefined();
    expect(await atIterableAsync(-4, array)).toBeUndefined();
  });

  test('works with empty arrays', async () => {
    const array: number[] = [];
    expect(await atIterableAsync(0, array)).toBeUndefined();
    expect(await atIterableAsync(-1, array)).toBeUndefined();
  });

  test('handles async iterables', async () => {
    const asyncIterable = {
      async *[Symbol.asyncIterator]() {
        yield 'a';
        yield 'b';
        yield 'c';
      },
    };

    expect(await atIterableAsync(0, asyncIterable)).toBe('a');
    expect(await atIterableAsync(2, asyncIterable)).toBe('c');
    expect(await atIterableAsync(-1, asyncIterable)).toBe('c');
    expect(await atIterableAsync(3, asyncIterable)).toBeUndefined();
  });

  test('handles regular iterables with async function', async () => {
    const set = new Set([10, 20, 30, 40]);
    expect(await atIterableAsync(0, set)).toBe(10);
    expect(await atIterableAsync(2, set)).toBe(30);
    expect(await atIterableAsync(-1, set)).toBe(40);
  });

  test('optimizes for early return with async iterables', async () => {
    let iterationCount = 0;
    const asyncIterable = {
      async *[Symbol.asyncIterator]() {
        iterationCount++;
        yield 'a';
        iterationCount++;
        yield 'b';
        iterationCount++;
        yield 'c';
        iterationCount++;
        yield 'd';
      },
    };

    // Should return early after finding index 1
    expect(await atIterableAsync(1, asyncIterable)).toBe('b');
    expect(iterationCount).toBe(2); // Only iterated through 'a' and 'b'
  });

  test('handles mixed type arrays', async () => {
    const mixedArray = [1, 'two', true, { key: 'value' }];
    expect(await atIterableAsync(0, mixedArray)).toBe(1);
    expect(await atIterableAsync(1, mixedArray)).toBe('two');
    expect(await atIterableAsync(2, mixedArray)).toBe(true);
    expect(await atIterableAsync(3, mixedArray)).toEqual({ key: 'value' });
  });
});
