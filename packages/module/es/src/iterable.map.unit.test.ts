import {
  logtapeConfiguration,
  logtapeConfigure,
  mapIterable,
  mapIterableAsync,
  mapIterableAsyncGen,
  mapIterableGen,
} from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration());

describe(mapIterable, () => {
  test('maps simple array values', () => {
    const result = mapIterable((x: number) => x * 2, [1, 2, 3]);
    expect(result).toEqual([2, 4, 6]);
  });

  test('works with array-like objects', () => {
    const arrayLike = {
      0: 'a',
      1: 'b',
      2: 'c',
      length: 3,
      [Symbol.iterator]: Array.prototype[Symbol.iterator],
    };
    const result = mapIterable((x: string) => x.toUpperCase(), arrayLike);
    expect(result).toEqual(['A', 'B', 'C']);
  });

  test('works with other iterables', () => {
    const set = new Set(['a', 'b', 'c']);
    const result = mapIterable((x: string) => x.toUpperCase(), set);
    expect(result).toEqual(['A', 'B', 'C']);
  });

  test('provides index argument', () => {
    const result = mapIterable((_x: string, i: number): number => i, ['a', 'b', 'c']);
    expect(result).toEqual([0, 1, 2]);
  });

  test('provides array argument', () => {
    const result = mapIterable((_x: string, _i: number, arr) => arr.length,
      ['a', 'b', 'c'] as const);
    expect(result).toEqual([3, 3, 3]);
  });

  test('handles empty arrays', () => {
    const result = mapIterable((x: never) => x * 2, []);
    expect(result).toEqual([]);
  });
});

describe(mapIterableAsync, () => {
  test('maps simple array values asynchronously', async () => {
    const result = await mapIterableAsync(async (x: number) => x * 2, [1, 2, 3]);
    expect(result).toEqual([2, 4, 6]);
  });

  test('works with promises in the mapping function', async () => {
    const result = await mapIterableAsync((x: number) => Promise.resolve(x * 2), [
      1,
      2,
      3,
    ]);
    expect(result).toEqual([2, 4, 6]);
  });

  test('works with async iterables', async () => {
    async function* asyncGen() {
      yield 1;
      yield 2;
      yield 3;
    }

    const result = await mapIterableAsync((x: number) => x * 2, asyncGen());
    expect(result).toEqual([2, 4, 6]);
  });

  test('provides index argument', async () => {
    const result = await mapIterableAsync(async (_x: any, i: number) => i, [
      'a',
      'b',
      'c',
    ]);
    expect(result).toEqual([0, 1, 2]);
  });

  test('provides array argument', async () => {
    const result = await mapIterableAsync(async (_x, _i, arr) => arr.length, [
      'a',
      'b',
      'c',
    ]);
    expect(result).toEqual([3, 3, 3]);
  });

  test('handles empty arrays', async () => {
    const result = await mapIterableAsync(async (x: number) => x * 2, []);
    expect(result).toEqual([]);
  });
});

describe('mapIterableGen', () => {
  test('yields mapped values one by one', () => {
    const generator = mapIterableGen((x: number) => x * 2, [1, 2, 3]);
    expect(generator.next().value).toBe(2);
    expect(generator.next().value).toBe(4);
    expect(generator.next().value).toBe(6);
    expect(generator.next().done).toBe(true);
  });

  test('works with other iterables', () => {
    const set = new Set(['a', 'b', 'c']);
    const generator = mapIterableGen((x: string) => x.toUpperCase(), set);
    expect(generator.next().value).toBe('A');
    expect(generator.next().value).toBe('B');
    expect(generator.next().value).toBe('C');
    expect(generator.next().done).toBe(true);
  });

  test('provides index argument', () => {
    const generator = mapIterableGen((_x, i) => i, ['a', 'b', 'c']);
    expect(generator.next().value).toBe(0);
    expect(generator.next().value).toBe(1);
    expect(generator.next().value).toBe(2);
    expect(generator.next().done).toBe(true);
  });

  test('handles empty arrays', () => {
    const generator = mapIterableGen((x: never) => x * 2, []);
    expect(generator.next().done).toBe(true);
  });

  test('can be consumed with for...of', () => {
    const generator = mapIterableGen((x: number) => x * 2, [1, 2, 3]);
    const results: any[] = [];
    for (const value of generator) {
      results.push(value);
    }
    expect(results).toEqual([2, 4, 6]);
  });
});

describe('mapIterableAsyncGen', () => {
  test('yields mapped values one by one asynchronously', async () => {
    const generator = mapIterableAsyncGen((x: number) => x * 2, [1, 2, 3]);
    expect((await generator.next()).value).toBe(2);
    expect((await generator.next()).value).toBe(4);
    expect((await generator.next()).value).toBe(6);
    expect((await generator.next()).done).toBe(true);
  });

  test('works with async mapping functions', async () => {
    const generator = mapIterableAsyncGen(async (x: number) => x * 2, [1, 2, 3]);
    expect((await generator.next()).value).toBe(2);
    expect((await generator.next()).value).toBe(4);
    expect((await generator.next()).value).toBe(6);
    expect((await generator.next()).done).toBe(true);
  });

  test('works with async iterables', async () => {
    async function* asyncGen() {
      yield 1;
      yield 2;
      yield 3;
    }

    const generator = mapIterableAsyncGen((x: number) => x * 2, asyncGen());
    expect((await generator.next()).value).toBe(2);
    expect((await generator.next()).value).toBe(4);
    expect((await generator.next()).value).toBe(6);
    expect((await generator.next()).done).toBe(true);
  });

  test('provides index argument', async () => {
    const generator = mapIterableAsyncGen(async (_x, i) => i, ['a', 'b', 'c']);
    expect((await generator.next()).value).toBe(0);
    expect((await generator.next()).value).toBe(1);
    expect((await generator.next()).value).toBe(2);
    expect((await generator.next()).done).toBe(true);
  });

  test('handles empty arrays', async () => {
    const generator = mapIterableAsyncGen(async (x: number) => x * 2, []);
    expect((await generator.next()).done).toBe(true);
  });

  test('can be consumed with for await...of', async () => {
    const generator = mapIterableAsyncGen((x: number) => x * 2, [1, 2, 3]);
    const results: any[] = [];
    for await (const value of generator) {
      results.push(value);
    }
    expect(results).toEqual([2, 4, 6]);
  });
});
