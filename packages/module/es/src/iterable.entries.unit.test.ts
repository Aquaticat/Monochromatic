import {
  entriesIterable,
  entriesIterableAsync,
  logtapeConfiguration,
  logtapeConfigure,
} from '@monochromatic-dev/module-es/.js';
import {
  describe,
  expect,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration());

describe(entriesIterable, () => {
  test('yields indices and elements for arrays', () => {
    const arr = [10, 20, 30];
    const result = [...entriesIterable(arr)];

    expect(result).toEqual([[0, 10], [1, 20], [2, 30]]);
  });

  test('works with empty arrays', () => {
    const result = [...entriesIterable([])];
    expect(result).toEqual([]);
  });

  test('works with strings (iterable)', () => {
    const str = 'abc';
    const result = [...entriesIterable(str)];

    expect(result).toEqual([[0, 'a'], [1, 'b'], [2, 'c']]);
  });

  test('works with Set', () => {
    const set = new Set([5, 10, 15]);
    const result = [...entriesIterable(set)];

    expect(result).toEqual([[0, 5], [1, 10], [2, 15]]);
  });

  test('works with Map values', () => {
    const map = new Map([['a', 1], ['b', 2]]);
    const result = [...entriesIterable(map.values())];

    expect(result).toEqual([[0, 1], [1, 2]]);
  });

  test('can be used in a for...of loop', () => {
    const arr = ['a', 'b', 'c'];
    const result: [number, string][] = [];

    for (const entry of entriesIterable(arr)) {
      result.push(entry);
    }

    expect(result).toEqual([[0, 'a'], [1, 'b'], [2, 'c']]);
  });

  test('maintains order of the original iterable', () => {
    const iterable = {
      *[Symbol.iterator]() {
        yield 'first';
        yield 'second';
        yield 'third';
      },
    };

    const result = [...entriesIterable(iterable)];
    expect(result).toEqual([[0, 'first'], [1, 'second'], [2, 'third']]);
  });
});

describe(entriesIterableAsync, () => {
  test('yields indices and elements for arrays', async () => {
    const arr = [10, 20, 30];
    const result: [number, number][] = [];

    for await (const entry of entriesIterableAsync(arr)) {
      result.push(entry);
    }

    expect(result).toEqual([[0, 10], [1, 20], [2, 30]]);
  });

  test('works with empty arrays', async () => {
    const result: [number, unknown][] = [];

    for await (const entry of entriesIterableAsync([])) {
      result.push(entry);
    }

    expect(result).toEqual([]);
  });

  test('works with async iterables', async () => {
    const asyncIterable = {
      async *[Symbol.asyncIterator]() {
        yield 'first';
        yield 'second';
        yield 'third';
      },
    };

    const result: [number, string][] = [];

    for await (const entry of entriesIterableAsync(asyncIterable)) {
      result.push(entry);
    }

    expect(result).toEqual([[0, 'first'], [1, 'second'], [2, 'third']]);
  });

  test('works with mixed delay async iterables', async () => {
    const asyncIterable = {
      async *[Symbol.asyncIterator]() {
        yield 'quick';
        await new Promise((resolve) => setTimeout(resolve, 10));
        yield 'delayed';
        yield 'immediate';
      },
    };

    const result: [number, string][] = [];

    for await (const entry of entriesIterableAsync(asyncIterable)) {
      result.push(entry);
    }

    expect(result).toEqual([[0, 'quick'], [1, 'delayed'], [2, 'immediate']]);
  });

  test('correctly handles synchronous iterables passed to async function', async () => {
    const set = new Set([5, 10, 15]);
    const result: [number, number][] = [];

    for await (const entry of entriesIterableAsync(set)) {
      result.push(entry);
    }

    expect(result).toEqual([[0, 5], [1, 10], [2, 15]]);
  });
});
