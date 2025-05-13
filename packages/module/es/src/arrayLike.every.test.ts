import {
  logtapeConfiguration,
  logtapeConfigure,
} from '@monochromatic-dev/module-es/ts';
import {
  describe,
  expect,
  test,
} from 'vitest';
import {
  everyArrayLike,
  everyArrayLikeAsync,
} from './arrayLike.every.ts';
import { equal } from './boolean.equal.ts';

await logtapeConfigure(await logtapeConfiguration());

describe('everyArrayLike', () => {
  test('returns true when all elements pass the test', () => {
    const array = [2, 4, 6, 8];
    expect(everyArrayLike((num: number) => num % 2 === 0, array)).toBe(true);
  });

  test('returns false when any element fails the test', () => {
    const array = [2, 4, 5, 8];
    expect(everyArrayLike((num: number) => num % 2 === 0, array)).toBe(false);
  });

  test('short-circuits when finding first failing element', () => {
    let callCount = 0;
    const array = [2, 4, 5, 8];
    everyArrayLike((num: number) => {
      callCount++;
      return num % 2 === 0;
    }, array);
    expect(callCount).toBe(3); // Only calls until the first false result
  });

  test('correctly passes index as second argument', () => {
    const array = [10, 20, 30];
    expect(
      everyArrayLike((num: number, index: number) => num === (index + 1) * 10, array),
    )
      .toBe(true);
  });

  test('correctly passes array as third argument', () => {
    const array = [1, 2, 3];
    expect(
      everyArrayLike((_num: number, _index: number, arr) => equal(arr, array), array),
    )
      .toBe(true);
  });

  test('works with other iterables like Sets', () => {
    const set = new Set([2, 4, 6, 8]);
    expect(everyArrayLike((num: number) => num % 2 === 0, set)).toBe(true);

    const failSet = new Set([2, 3, 6, 8]);
    expect(everyArrayLike((num: number) => num % 2 === 0, failSet)).toBe(false);
  });

  test('works with strings as iterables', () => {
    const str = 'aabb';
    expect(everyArrayLike((char: string) => /[ab]/.test(char), str)).toBe(true);

    const failStr = 'aabc';
    expect(everyArrayLike((char: string) => /[ab]/.test(char), failStr)).toBe(false);
  });

  test('throws error when testing function throws', () => {
    const array = [1, 2, 3];
    expect(() =>
      everyArrayLike(() => {
        throw new Error('Test error');
      }, array)
    )
      .toThrow('Test error');
  });

  test('returns true for empty arrays', () => {
    expect(everyArrayLike(() => false, [])).toBe(true);
  });
});

describe('everyArrayLikeAsync', () => {
  test('returns true when all elements pass the test', async () => {
    const array = [2, 4, 6, 8];
    expect(await everyArrayLikeAsync(async (num: number) => num % 2 === 0, array)).toBe(
      true,
    );
  });

  test('returns false when any element fails the test', async () => {
    const array = [2, 4, 5, 8];
    expect(everyArrayLikeAsync(async (num: number) => num % 2 === 0, array))
      .resolves
      .toBe(
        false,
      );
  });

  test('correctly passes index as second argument', async () => {
    const array = [10, 20, 30];
    expect(
      await everyArrayLikeAsync(
        async (num: number, index: number) => num === (index + 1) * 10,
        array,
      ),
    )
      .toBe(true);
  });

  test('correctly passes array as third argument', async () => {
    const array = [1, 2, 3];
    expect(everyArrayLikeAsync(async (_num, _index, arr) => equal(arr, array), array))
      .resolves
      .toBe(true);
  });

  test('works with async iterables', async () => {
    const asyncIterable = {
      async *[Symbol.asyncIterator]() {
        yield 2;
        yield 4;
        yield 6;
      },
    };

    expect(everyArrayLikeAsync(async (num: number) => num % 2 === 0, asyncIterable))
      .resolves
      .toBe(
        true,
      );

    const failAsyncIterable = {
      async *[Symbol.asyncIterator]() {
        yield 2;
        yield 3;
        yield 6;
      },
    };

    expect(
      everyArrayLikeAsync(async (num: number) => num % 2 === 0, failAsyncIterable),
    )
      .resolves
      .toBe(false);
  });

  test('throws error when testing function throws', async () => {
    const array = [1, 2, 3];
    expect(everyArrayLikeAsync(async (_element: any) => {
      throw new Error('Async test error');
    }, array))
      .rejects
      .toThrow('Async test error');
  });

  test('returns true for empty arrays', async () => {
    expect(await everyArrayLikeAsync(async () => false, [])).toBe(true);
  });

  test('handles mixed synchronous and asynchronous predicates', async () => {
    const array = [1, 2, 3, 4];

    const result = await everyArrayLikeAsync((num: number, index: number) => {
      if (index % 2 === 0) {
        return Promise.resolve(num < 5);
      }
      return num < 5;
    }, array);

    expect(result).toBe(true);
  });

  test('handles delayed async responses correctly', async () => {
    const array = [1, 2, 3, 4];

    const slowTrue = async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return true;
    };

    const fastFalse = async () => {
      return false;
    };

    // Should return false quickly because of parallel execution
    const start = performance.now();
    const result = await everyArrayLikeAsync(async (num: number) => {
      return num === 3 ? fastFalse() : slowTrue();
    }, array);
    const elapsed = performance.now() - start;

    expect(result).toBe(false);

    // This should complete faster than it would take for all slow functions to resolve
    expect(elapsed).toBeLessThan(40);
  });
});

describe('everyArrayLike with mixed predicate behavior', () => {
  test('should throw error if it encounters throwing item before false item', () => {
    const array = ['throw', 'false', 'true'];

    expect(() =>
      everyArrayLike((item: string) => {
        if (item === 'throw') { throw new Error('Predicate error'); }
        return item !== 'false';
      }, array)
    )
      .toThrow('Predicate error');
  });

  test('should return false if it encounters false item before throwing item', () => {
    const array = ['false', 'throw', 'true'];

    expect(() =>
      everyArrayLike((item: string) => {
        if (item === 'throw') { throw new Error('Predicate error'); }
        return item !== 'false';
      }, array)
    )
      .not
      .toThrow();

    expect(everyArrayLike((item: string) => {
      if (item === 'throw') { throw new Error('Predicate error'); }
      return item !== 'false';
    }, array))
      .toBe(false);
  });
});

describe('everyArrayLikeAsync with mixed predicate behavior', () => {
  test('can handle mixed predicate behaviors (true, false, throwing)', async () => {
    const array = ['true', 'false', 'throw'];

    // Since execution is parallel, either outcome is acceptable
    try {
      const result = await everyArrayLikeAsync(async (item: string) => {
        if (item === 'throw') { throw new Error('Async predicate error'); }
        return item !== 'false';
      }, array);

      // If it completes without throwing, it should be false
      expect(result).toBe(false);
    } catch (error: any) {
      // If it throws, it should be the predicate error
      expect(error.message).toBe('Async predicate error');
    }
  });

  test('ensures non-deterministic result is either false or throws', async () => {
    const array = ['true', 'false', 'throw'];
    let threw = false;
    let resultIfNotThrown: null | boolean = null;

    // Run multiple times to account for race conditions
    for (let i = 0; i < 5; i++) {
      try {
        // eslint-disable-next-line no-await-in-loop
        resultIfNotThrown = await everyArrayLikeAsync(async (item: string) => {
          if (item === 'throw') { throw new Error('Async predicate error'); }
          return item !== 'false';
        }, array);
      } catch {
        threw = true;
        break;
      }
    }

    // Either it threw at least once, or always returned false
    expect(threw || resultIfNotThrown === false).toBe(true);
  });
});
