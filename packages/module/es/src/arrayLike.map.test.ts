import {
  logtapeConfiguration,
  logtapeConfigure,
  mapArrayLike,
  mapArrayLikeAsync,
  mapArrayLikeAsyncGen,
  mapArrayLikeGen,
} from '@monochromatic-dev/module-es/.js';
import {
  describe,
  expect,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration());

describe('mapArrayLike', () => {
  test('maps simple array values', () => {
    const result = mapArrayLike((x: number) => x * 2, [1, 2, 3]);
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
    const result = mapArrayLike((x: string) => x.toUpperCase(), arrayLike);
    expect(result).toEqual(['A', 'B', 'C']);
  });

  test('works with other iterables', () => {
    const set = new Set(['a', 'b', 'c']);
    const result = mapArrayLike((x: string) => x.toUpperCase(), set);
    expect(result).toEqual(['A', 'B', 'C']);
  });

  test('provides index argument', () => {
    const result = mapArrayLike((_x: string, i: number): number => i, ['a', 'b', 'c']);
    expect(result).toEqual([0, 1, 2]);
  });

  test('provides array argument', () => {
    const result = mapArrayLike((_x: string, _i, arr) => arr.length, ['a', 'b', 'c']);
    expect(result).toEqual([3, 3, 3]);
  });

  test('handles empty arrays', () => {
    const result = mapArrayLike((x: never) => x * 2, []);
    expect(result).toEqual([]);
  });
});

describe('mapArrayLikeAsync', () => {
  test('maps simple array values asynchronously', async () => {
    const result = await mapArrayLikeAsync(async (x: number) => x * 2, [1, 2, 3]);
    expect(result).toEqual([2, 4, 6]);
  });

  test('works with promises in the mapping function', async () => {
    const result = await mapArrayLikeAsync((x: number) => Promise.resolve(x * 2), [
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

    const result = await mapArrayLikeAsync((x: number) => x * 2, asyncGen());
    expect(result).toEqual([2, 4, 6]);
  });

  test('provides index argument', async () => {
    const result = await mapArrayLikeAsync(async (_x: any, i: number) => i, [
      'a',
      'b',
      'c',
    ]);
    expect(result).toEqual([0, 1, 2]);
  });

  test('provides array argument', async () => {
    const result = await mapArrayLikeAsync(async (_x, _i, arr) => arr.length, [
      'a',
      'b',
      'c',
    ]);
    expect(result).toEqual([3, 3, 3]);
  });

  test('handles empty arrays', async () => {
    const result = await mapArrayLikeAsync(async (x: number) => x * 2, []);
    expect(result).toEqual([]);
  });
});

describe('mapArrayLikeGen', () => {
  test('yields mapped values one by one', () => {
    const generator = mapArrayLikeGen((x: number) => x * 2, [1, 2, 3]);
    expect(generator.next().value).toBe(2);
    expect(generator.next().value).toBe(4);
    expect(generator.next().value).toBe(6);
    expect(generator.next().done).toBe(true);
  });

  test('works with other iterables', () => {
    const set = new Set(['a', 'b', 'c']);
    const generator = mapArrayLikeGen((x: string) => x.toUpperCase(), set);
    expect(generator.next().value).toBe('A');
    expect(generator.next().value).toBe('B');
    expect(generator.next().value).toBe('C');
    expect(generator.next().done).toBe(true);
  });

  test('provides index argument', () => {
    const generator = mapArrayLikeGen((_x, i) => i, ['a', 'b', 'c']);
    expect(generator.next().value).toBe(0);
    expect(generator.next().value).toBe(1);
    expect(generator.next().value).toBe(2);
    expect(generator.next().done).toBe(true);
  });

  test('handles empty arrays', () => {
    const generator = mapArrayLikeGen((x: never) => x * 2, []);
    expect(generator.next().done).toBe(true);
  });

  test('can be consumed with for...of', () => {
    const generator = mapArrayLikeGen((x: number) => x * 2, [1, 2, 3]);
    const results: any[] = [];
    for (const value of generator) {
      results.push(value);
    }
    expect(results).toEqual([2, 4, 6]);
  });
});

describe('mapArrayLikeAsyncGen', () => {
  test('yields mapped values one by one asynchronously', async () => {
    const generator = mapArrayLikeAsyncGen((x: number) => x * 2, [1, 2, 3]);
    expect((await generator.next()).value).toBe(2);
    expect((await generator.next()).value).toBe(4);
    expect((await generator.next()).value).toBe(6);
    expect((await generator.next()).done).toBe(true);
  });

  test('works with async mapping functions', async () => {
    const generator = mapArrayLikeAsyncGen(async (x: number) => x * 2, [1, 2, 3]);
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

    const generator = mapArrayLikeAsyncGen((x: number) => x * 2, asyncGen());
    expect((await generator.next()).value).toBe(2);
    expect((await generator.next()).value).toBe(4);
    expect((await generator.next()).value).toBe(6);
    expect((await generator.next()).done).toBe(true);
  });

  test('provides index argument', async () => {
    const generator = mapArrayLikeAsyncGen(async (_x, i) => i, ['a', 'b', 'c']);
    expect((await generator.next()).value).toBe(0);
    expect((await generator.next()).value).toBe(1);
    expect((await generator.next()).value).toBe(2);
    expect((await generator.next()).done).toBe(true);
  });

  test('handles empty arrays', async () => {
    const generator = mapArrayLikeAsyncGen(async (x: number) => x * 2, []);
    expect((await generator.next()).done).toBe(true);
  });

  test('can be consumed with for await...of', async () => {
    const generator = mapArrayLikeAsyncGen((x: number) => x * 2, [1, 2, 3]);
    const results: any[] = [];
    for await (const value of generator) {
      results.push(value);
    }
    expect(results).toEqual([2, 4, 6]);
  });
});
