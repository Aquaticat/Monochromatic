import {
  logtapeConfiguration,
  logtapeConfigure,
  takeIterable,
  takeIterableAsync,
  takeIterableAsyncGen,
  takeIterableGen,
  takeWhileIterable,
  takeWhileIterableAsync,
  takeWhileIterableAsyncGen,
  takeWhileIterableGen,
} from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration());

describe('takeIterable', () => {
  test('takes first n elements from array', () => {
    expect(takeIterable(3, [1, 2, 3, 4, 5])).toEqual([1, 2, 3]);
    expect(takeIterable(2, ['a', 'b', 'c', 'd'])).toEqual(['a', 'b']);
  });

  test('takes all elements when count exceeds length', () => {
    expect(takeIterable(10, [1, 2, 3])).toEqual([1, 2, 3]);
    expect(takeIterable(5, ['x', 'y'])).toEqual(['x', 'y']);
  });

  test('returns empty array when count is 0', () => {
    expect(takeIterable(0, [1, 2, 3])).toEqual([]);
    expect(takeIterable(0, [])).toEqual([]);
  });

  test('works with empty iterable', () => {
    expect(takeIterable(5, [])).toEqual([]);
    expect(takeIterable(1, new Set())).toEqual([]);
  });

  test('throws RangeError for negative count', () => {
    expect(() => takeIterable(-1, [1, 2, 3])).toThrow(RangeError);
    expect(() => takeIterable(-5, [])).toThrow('Count must be non-negative');
  });

  test('works with Set', () => {
    const set = new Set(['a', 'b', 'c', 'd']);
    expect(takeIterable(2, set)).toEqual(['a', 'b']);
  });

  test('works with generator', () => {
    function* gen() {
      yield 1;
      yield 2;
      yield 3;
      yield 4;
      yield 5;
    }
    expect(takeIterable(3, gen())).toEqual([1, 2, 3]);
  });

  test('stops early for infinite generator', () => {
    function* infiniteGen() {
      let i = 0;
      while (true) {
        yield i++;
      }
    }
    expect(takeIterable(5, infiniteGen())).toEqual([0, 1, 2, 3, 4]);
  });
});

describe('takeIterableAsync', () => {
  test('takes first n elements from array', async () => {
    expect(await takeIterableAsync(3, [1, 2, 3, 4, 5])).toEqual([1, 2, 3]);
    expect(await takeIterableAsync(2, ['a', 'b', 'c', 'd'])).toEqual(['a', 'b']);
  });

  test('takes all elements when count exceeds length', async () => {
    expect(await takeIterableAsync(10, [1, 2, 3])).toEqual([1, 2, 3]);
    expect(await takeIterableAsync(5, ['x', 'y'])).toEqual(['x', 'y']);
  });

  test('returns empty array when count is 0', async () => {
    expect(await takeIterableAsync(0, [1, 2, 3])).toEqual([]);
    expect(await takeIterableAsync(0, [])).toEqual([]);
  });

  test('works with async generator', async () => {
    async function* asyncGen() {
      yield 1;
      yield 2;
      yield 3;
      yield 4;
      yield 5;
    }
    expect(await takeIterableAsync(3, asyncGen())).toEqual([1, 2, 3]);
  });

  test('throws RangeError for negative count', async () => {
    await expect(takeIterableAsync(-1, [1, 2, 3])).rejects.toThrow(RangeError);
    await expect(takeIterableAsync(-5, [])).rejects.toThrow('Count must be non-negative');
  });

  test('stops early for infinite async generator', async () => {
    async function* infiniteAsyncGen() {
      let i = 0;
      while (true) {
        yield i++;
      }
    }
    expect(await takeIterableAsync(5, infiniteAsyncGen())).toEqual([0, 1, 2, 3, 4]);
  });
});

describe('takeIterableGen', () => {
  test('yields first n elements lazily', () => {
    const gen = takeIterableGen(3, [1, 2, 3, 4, 5]);
    expect([...gen]).toEqual([1, 2, 3]);
  });

  test('yields all elements when count exceeds length', () => {
    const gen = takeIterableGen(10, [1, 2, 3]);
    expect([...gen]).toEqual([1, 2, 3]);
  });

  test('yields nothing when count is 0', () => {
    const gen = takeIterableGen(0, [1, 2, 3]);
    expect([...gen]).toEqual([]);
  });

  test('throws RangeError for negative count', () => {
    expect(() => [...takeIterableGen(-1, [1, 2, 3])]).toThrow(RangeError);
  });

  test('allows early termination', () => {
    const gen = takeIterableGen(5, [1, 2, 3, 4, 5, 6, 7]);
    const result: number[] = [];
    for (const value of gen) {
      result.push(value);
      if (value === 3) break;
    }
    expect(result).toEqual([1, 2, 3]);
  });

  test('works with infinite generator', () => {
    function* infiniteGen() {
      let i = 0;
      while (true) {
        yield i++;
      }
    }
    const gen = takeIterableGen(5, infiniteGen());
    expect([...gen]).toEqual([0, 1, 2, 3, 4]);
  });
});

describe('takeIterableAsyncGen', () => {
  test('yields first n elements lazily', async () => {
    const gen = takeIterableAsyncGen(3, [1, 2, 3, 4, 5]);
    const result: number[] = [];
    for await (const value of gen) {
      result.push(value);
    }
    expect(result).toEqual([1, 2, 3]);
  });

  test('yields all elements when count exceeds length', async () => {
    const gen = takeIterableAsyncGen(10, [1, 2, 3]);
    const result: number[] = [];
    for await (const value of gen) {
      result.push(value);
    }
    expect(result).toEqual([1, 2, 3]);
  });

  test('yields nothing when count is 0', async () => {
    const gen = takeIterableAsyncGen(0, [1, 2, 3]);
    const result: number[] = [];
    for await (const value of gen) {
      result.push(value);
    }
    expect(result).toEqual([]);
  });

  test('throws RangeError for negative count', async () => {
    const gen = takeIterableAsyncGen(-1, [1, 2, 3]);
    await expect(async () => {
      for await (const _ of gen) {
        // Should throw before yielding
      }
    }).rejects.toThrow(RangeError);
  });

  test('works with async generator', async () => {
    async function* asyncGen() {
      yield 1;
      yield 2;
      yield 3;
      yield 4;
      yield 5;
    }
    const gen = takeIterableAsyncGen(3, asyncGen());
    const result: number[] = [];
    for await (const value of gen) {
      result.push(value);
    }
    expect(result).toEqual([1, 2, 3]);
  });
});


describe('takeWhileIterable', () => {
  test('takes elements while predicate is true', () => {
    expect(takeWhileIterable(x => x < 5, [1, 2, 3, 4, 5, 6, 7])).toEqual([1, 2, 3, 4]);
    expect(takeWhileIterable(s => s.length > 0, ['hello', 'world', '', 'hidden'])).toEqual(['hello', 'world']);
  });

  test('returns empty array when first element fails predicate', () => {
    expect(takeWhileIterable(x => x > 10, [1, 2, 3])).toEqual([]);
    expect(takeWhileIterable(s => s === 'z', ['a', 'b', 'c'])).toEqual([]);
  });

  test('takes all elements when all pass predicate', () => {
    expect(takeWhileIterable(x => x > 0, [1, 2, 3, 4, 5])).toEqual([1, 2, 3, 4, 5]);
    expect(takeWhileIterable(s => s.length < 10, ['a', 'bb', 'ccc'])).toEqual(['a', 'bb', 'ccc']);
  });

  test('works with empty iterable', () => {
    expect(takeWhileIterable(x => x > 0, [])).toEqual([]);
    expect(takeWhileIterable(() => true, [])).toEqual([]);
  });

  test('provides index and array to predicate', () => {
    const result = takeWhileIterable(
      (x, i, arr) => i < 3 && x < arr[arr.length - 1],
      [1, 2, 3, 4, 5]
    );
    expect(result).toEqual([1, 2, 3]);
  });

  test('works with Set', () => {
    const set = new Set([2, 4, 6, 7, 8, 10]);
    expect(takeWhileIterable(n => n % 2 === 0, set)).toEqual([2, 4, 6]);
  });

  test('checks ascending order', () => {
    const nums = [1, 3, 5, 4, 7, 2];
    const ascending = takeWhileIterable(
      (x, i, arr) => i === 0 || x > arr[i - 1],
      nums
    );
    expect(ascending).toEqual([1, 3, 5]);
  });
});

describe('takeWhileIterableAsync', () => {
  test('takes elements while predicate is true', async () => {
    expect(await takeWhileIterableAsync(async x => x < 5, [1, 2, 3, 4, 5, 6, 7])).toEqual([1, 2, 3, 4]);
    expect(await takeWhileIterableAsync(s => s.length > 0, ['hello', 'world', '', 'hidden'])).toEqual(['hello', 'world']);
  });

  test('returns empty array when first element fails predicate', async () => {
    expect(await takeWhileIterableAsync(x => x > 10, [1, 2, 3])).toEqual([]);
    expect(await takeWhileIterableAsync(async s => s === 'z', ['a', 'b', 'c'])).toEqual([]);
  });

  test('takes all elements when all pass predicate', async () => {
    expect(await takeWhileIterableAsync(x => x > 0, [1, 2, 3, 4, 5])).toEqual([1, 2, 3, 4, 5]);
    expect(await takeWhileIterableAsync(async s => s.length < 10, ['a', 'bb', 'ccc'])).toEqual(['a', 'bb', 'ccc']);
  });

  test('works with async generator', async () => {
    async function* asyncGen() {
      yield 1;
      yield 3;
      yield 5;
      yield 4;
      yield 7;
    }
    expect(await takeWhileIterableAsync(async x => x < 6, asyncGen())).toEqual([1, 3, 5, 4]);
  });

  test('works with mixed sync/async predicates', async () => {
    const nums = [1, 2, 3, 4, 5];
    const syncResult = await takeWhileIterableAsync(x => x < 4, nums);
    const asyncResult = await takeWhileIterableAsync(async x => x < 4, nums);
    expect(syncResult).toEqual(asyncResult);
    expect(syncResult).toEqual([1, 2, 3]);
  });
});

describe('takeWhileIterableGen', () => {
  test('yields elements while predicate is true', () => {
    const gen = takeWhileIterableGen(x => x < 5, [1, 2, 3, 4, 5, 6, 7]);
    expect([...gen]).toEqual([1, 2, 3, 4]);
  });

  test('yields nothing when first element fails', () => {
    const gen = takeWhileIterableGen(x => x > 10, [1, 2, 3]);
    expect([...gen]).toEqual([]);
  });

  test('allows early termination', () => {
    const gen = takeWhileIterableGen(x => x < 10, [1, 2, 3, 4, 5, 6, 7]);
    const result: number[] = [];
    for (const value of gen) {
      result.push(value);
      if (value === 3) break;
    }
    expect(result).toEqual([1, 2, 3]);
  });

  test('works with infinite generator', () => {
    function* infiniteGen() {
      let i = 1;
      while (true) {
        yield i++;
      }
    }
    const gen = takeWhileIterableGen(x => x <= 5, infiniteGen());
    expect([...gen]).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('takeWhileIterableAsyncGen', () => {
  test('yields elements while predicate is true', async () => {
    const gen = takeWhileIterableAsyncGen(async x => x < 5, [1, 2, 3, 4, 5, 6, 7]);
    const result: number[] = [];
    for await (const value of gen) {
      result.push(value);
    }
    expect(result).toEqual([1, 2, 3, 4]);
  });

  test('yields nothing when first element fails', async () => {
    const gen = takeWhileIterableAsyncGen(x => x > 10, [1, 2, 3]);
    const result: number[] = [];
    for await (const value of gen) {
      result.push(value);
    }
    expect(result).toEqual([]);
  });

  test('works with async generator and async predicate', async () => {
    async function* asyncGen() {
      yield 1;
      yield 2;
      yield 3;
      yield 4;
      yield 5;
    }
    const gen = takeWhileIterableAsyncGen(
      async x => {
        await new Promise(resolve => setTimeout(resolve, 1));
        return x < 4;
      },
      asyncGen()
    );
    const result: number[] = [];
    for await (const value of gen) {
      result.push(value);
    }
    expect(result).toEqual([1, 2, 3]);
  });

  test('allows early termination', async () => {
    const gen = takeWhileIterableAsyncGen(x => x < 10, [1, 2, 3, 4, 5, 6, 7]);
    const result: number[] = [];
    for await (const value of gen) {
      result.push(value);
      if (value === 3) break;
    }
    expect(result).toEqual([1, 2, 3]);
  });
});