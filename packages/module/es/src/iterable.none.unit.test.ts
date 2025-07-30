import {
  logtapeConfiguration,
  logtapeConfigure,
  noneIterable,
  noneIterableAsync,
} from '@monochromatic-dev/module-es/.js';
import {
  describe,
  expect,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration(),);

describe(noneIterable, () => {
  test('returns true when no elements satisfy the predicate', () => {
    const result = noneIterable((x: number,) => x > 10, [1, 2, 3, 4,],);
    expect(result,).toBe(true,);
  });

  test('returns false when at least one element satisfies the predicate', () => {
    const result = noneIterable((x: number,) => x > 3, [1, 2, 3, 4,],);
    expect(result,).toBe(false,);
  });

  test('short-circuits when finding a matching element', () => {
    let count = 0;
    noneIterable((x: number,) => {
      count++;
      return x === 3;
    }, [1, 2, 3, 4, 5,],);

    expect(count,).toBe(3,); // Should stop after checking the 3rd element
  });

  test('returns true for an empty array', () => {
    const result = noneIterable((x: never,) => x > 0, [],);
    expect(result,).toBe(true,);
  });

  test('works with other iterable types', () => {
    const set = new Set([1, 2, 3, 4,],);
    const result = noneIterable((x: number,) => x > 10, set,);
    expect(result,).toBe(true,);
  });

  test('handles predicates that throw exceptions', () => {
    const result = noneIterable((x: number,) => {
      if (x === 3)
        throw new Error('Test error',);
      return x > 10;
    }, [1, 2, 3, 4,],);

    expect(result,).toBe(true,);
  });
},);

describe(noneIterableAsync, () => {
  test('returns true when no elements satisfy the predicate', async () => {
    const result = await noneIterableAsync(async (x: number,) => x > 10, [1, 2, 3, 4,],);
    expect(result,).toBe(true,);
  });

  test('returns false when at least one element satisfies the predicate', async () => {
    const result = await noneIterableAsync(async (x: number,) => x > 3, [1, 2, 3, 4,],);
    expect(result,).toBe(false,);
  });

  test('returns true for an empty array', async () => {
    const result = await noneIterableAsync(async (x: never,) => x > 0, [],);
    expect(result,).toBe(true,);
  });

  test('handles synchronous predicates', async () => {
    const result = await noneIterableAsync((x: number,) => x > 10, [1, 2, 3, 4,],);
    expect(result,).toBe(true,);
  });

  test('handles predicates that throw exceptions', async () => {
    const result = await noneIterableAsync(async (x: number,) => {
      if (x === 3)
        throw new Error('Test error',);
      return x > 10;
    }, [1, 2, 3, 4,],);

    expect(result,).toBe(true,);
  });

  test('works with async iterables', async () => {
    async function* generateNumbers() {
      yield 1;
      yield 2;
      yield 3;
      yield 4;
    }

    const result = await noneIterableAsync(async (x: number,) => x > 10,
      generateNumbers(),);
    expect(result,).toBe(true,);
  });

  test('handles delayed async predicates', async () => {
    const result = await noneIterableAsync(async (x: number,) => {
      await new Promise(resolve => setTimeout(resolve, 10,));
      return x > 10;
    }, [1, 2, 3, 4,],);

    expect(result,).toBe(true,);
  });
},);
