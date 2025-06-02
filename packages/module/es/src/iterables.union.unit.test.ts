import {
  unionIterables,
  unionIterablesAsync,
  unionIterablesAsyncGen,
  unionIterablesGen,
} from '@monochromatic-dev/module-es/.js';
import {
  describe,
  expect,
  expectTypeOf,
  it,
} from 'vitest';

describe(unionIterables, () => {
  it('returns an empty Set when no arguments are provided', () => {
    const result = unionIterables();
    expect(result).toBeInstanceOf(Set);
    expect(result.size).toBe(0);
  });

  it('returns a Set of unique elements from a single iterable', () => {
    const result = unionIterables([1, 2, 3, 3, 2, 1]);
    expect([...result]).toEqual([1, 2, 3]);
  });

  it('returns a Set of unique elements from multiple iterables', () => {
    const result = unionIterables([1, 2, 3], [3, 4, 5], [5, 6, 7]);
    expect([...result]).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('works with different types of iterables', () => {
    const set = new Set([3, 4, 5]);
    const map = new Map([[1, 'a'], [2, 'b']]);
    const result = unionIterables([1, 2], set, map.keys());
    expect([...result]).toEqual([1, 2, 3, 4, 5]);
  });

  it('works with string iterables', () => {
    const result = unionIterables('abc', 'def', 'cba');
    expect([...result]).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });

  it('preserves the correct types with type inference', () => {
    // These tests check typing, not runtime behavior
    const numResult = unionIterables([1, 2, 3], [4, 5, 6]);
    const strResult = unionIterables(['a', 'b'], ['c', 'd']);
    const mixedResult = unionIterables([1, 2], ['a', 'b']);

    // Type assertions - these won't run at runtime but verify types compile
    expectTypeOf(numResult).toEqualTypeOf<Set<1 | 2 | 3 | 4 | 5 | 6>>();
    expectTypeOf(strResult).toEqualTypeOf<Set<'a' | 'b' | 'c' | 'd'>>();
    expectTypeOf(mixedResult).toEqualTypeOf<Set<1 | 2 | 'a' | 'b'>>();

    // Runtime checks
    expect([...numResult]).toEqual([1, 2, 3, 4, 5, 6]);
    expect([...strResult]).toEqual(['a', 'b', 'c', 'd']);
    expect([...mixedResult]).toContain(1);
    expect([...mixedResult]).toContain('a');
  });
});

describe(unionIterablesAsync, () => {
  it('returns an empty Set when no arguments are provided', async () => {
    const result = await unionIterablesAsync();
    expect(result).toBeInstanceOf(Set);
    expect(result.size).toBe(0);
  });

  it('returns a Set of unique elements from a single async iterable', async () => {
    async function* singleAsyncIterable() {
      yield 1;
      yield 2;
      yield 3;
      yield 3;
      yield 2;
      yield 1;
    }
    const result = await unionIterablesAsync(singleAsyncIterable());
    expect([...result]).toEqual([1, 2, 3]);
  });

  it('returns a Set of unique elements from multiple async iterables', async () => {
    async function* asyncIterable1() {
      yield 1;
      yield 2;
    }
    async function* asyncIterable2() {
      yield 2;
      yield 3;
    }
    const result = await unionIterablesAsync(asyncIterable1(), asyncIterable2(), [3, 4]);
    expect([...result]).toEqual([1, 2, 3, 4]);
  });

  it('works with mixed sync and async iterables', async () => {
    const set = new Set([3, 4, 5]);
    async function* asyncGen() {
      yield 5;
      yield 6;
    }
    const result = await unionIterablesAsync([1, 2], set, asyncGen());
    expect([...result]).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('preserves the correct types with type inference', async () => {
    async function* genNums() {
      yield 1;
      yield 2;
    }
    async function* genStrs() {
      yield 'a';
      yield 'b';
    }
    const numResult = await unionIterablesAsync(genNums(), [3, 4]);
    const strResult = await unionIterablesAsync(genStrs(), ['c', 'd']);
    const mixedResult = await unionIterablesAsync(genNums(), ['a', 'b']);

    expectTypeOf(numResult).toEqualTypeOf<Set<1 | 2 | 3 | 4>>();
    expectTypeOf(strResult).toEqualTypeOf<Set<'a' | 'b' | 'c' | 'd'>>();
    expectTypeOf(mixedResult).toEqualTypeOf<Set<1 | 2 | 'a' | 'b'>>();

    expect([...numResult]).toEqual([1, 2, 3, 4]);
    expect([...strResult]).toEqual(['a', 'b', 'c', 'd']);
    expect([...mixedResult]).toContain(1);
    expect([...mixedResult]).toContain('a');
  });
});

describe(unionIterablesGen, () => {
  it('yields nothing when no arguments are provided', () => {
    const result = [...unionIterablesGen()];
    expect(result).toEqual([]);
  });

  it('yields unique elements from a single iterable in order', () => {
    const result = [...unionIterablesGen([1, 2, 3, 3, 2, 1])];
    expect(result).toEqual([1, 2, 3]);
  });

  it('yields unique elements from multiple iterables in order', () => {
    const result = [...unionIterablesGen([1, 2, 3], [3, 4, 5], [5, 6, 1, 7])];
    expect(result).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('works with different types of iterables', () => {
    const set = new Set([3, 4, 5]);
    const map = new Map([[1, 'a'], [2, 'b']]);
    const result = [...unionIterablesGen([1, 2], set, map.keys())];
    expect(result).toEqual([1, 2, 3, 4, 5]);
  });

  it('works with string iterables', () => {
    const result = [...unionIterablesGen('abc', 'def', 'cba')];
    expect(result).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });

  it('preserves the correct types with type inference', () => {
    const numResultGen = unionIterablesGen([1, 2, 3], [4, 5, 6]);
    const strResultGen = unionIterablesGen(['a', 'b'], ['c', 'd']);
    const mixedResultGen = unionIterablesGen([1, 2], ['a', 'b']);

    expectTypeOf(numResultGen).toEqualTypeOf<Generator<1 | 2 | 3 | 4 | 5 | 6, void, undefined>>();
    expectTypeOf(strResultGen).toEqualTypeOf<Generator<'a' | 'b' | 'c' | 'd', void, undefined>>();
    expectTypeOf(mixedResultGen).toEqualTypeOf<Generator<1 | 2 | 'a' | 'b', void, undefined>>();

    expect([...numResultGen]).toEqual([1, 2, 3, 4, 5, 6]);
    expect([...strResultGen]).toEqual(['a', 'b', 'c', 'd']);
    const mixedArr = [...mixedResultGen];
    expect(mixedArr).toContain(1);
    expect(mixedArr).toContain('a');
  });
});

describe(unionIterablesAsyncGen, () => {
  it('yields nothing when no arguments are provided', async () => {
    const result = [];
    for await (const item of unionIterablesAsyncGen()) {
      result.push(item);
    }
    expect(result).toEqual([]);
  });

  it('yields unique elements from a single async iterable in order', async () => {
    async function* singleAsyncIterable() {
      yield 1;
      yield 2;
      yield 3;
      yield 3;
      yield 2;
      yield 1;
    }
    const result = [];
    for await (const item of unionIterablesAsyncGen(singleAsyncIterable())) {
      result.push(item);
    }
    expect(result).toEqual([1, 2, 3]);
  });

  it('yields unique elements from multiple async iterables in order', async () => {
    async function* asyncIterable1() {
      yield 1;
      yield 2;
    }
    async function* asyncIterable2() {
      yield 2;
      yield 3;
    }
    const result = [];
    for await (const item of unionIterablesAsyncGen(asyncIterable1(), asyncIterable2(), [3, 4, 1])) {
      result.push(item);
    }
    expect(result).toEqual([1, 2, 3, 4]);
  });

  it('works with mixed sync and async iterables', async () => {
    const set = new Set([3, 4, 5]);
    async function* asyncGen() {
      yield 5;
      yield 6;
    }
    const result = [];
    for await (const item of unionIterablesAsyncGen([1, 2], set, asyncGen())) {
      result.push(item);
    }
    expect(result).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('preserves the correct types with type inference', async () => {
    async function* genNums() {
      yield 1;
      yield 2;
    }
    async function* genStrs() {
      yield 'a';
      yield 'b';
    }
    const numResultGen = unionIterablesAsyncGen(genNums(), [3, 4]);
    const strResultGen = unionIterablesAsyncGen(genStrs(), ['c', 'd']);
    const mixedResultGen = unionIterablesAsyncGen(genNums(), ['a', 'b']);

    expectTypeOf(numResultGen).toEqualTypeOf<AsyncGenerator<1 | 2 | 3 | 4, void, undefined>>();
    expectTypeOf(strResultGen).toEqualTypeOf<AsyncGenerator<'a' | 'b' | 'c' | 'd', void, undefined>>();
    expectTypeOf(mixedResultGen).toEqualTypeOf<AsyncGenerator<1 | 2 | 'a' | 'b', void, undefined>>();

    const numResult = [];
    for await (const item of numResultGen) numResult.push(item);
    expect(numResult).toEqual([1, 2, 3, 4]);

    const strResult = [];
    for await (const item of strResultGen) strResult.push(item);
    expect(strResult).toEqual(['a', 'b', 'c', 'd']);

    const mixedResult = [];
    for await (const item of mixedResultGen) mixedResult.push(item);
    expect(mixedResult).toContain(1);
    expect(mixedResult).toContain('a');
  });
});
