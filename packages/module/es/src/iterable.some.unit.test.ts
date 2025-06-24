import {
  logtapeConfiguration,
  logtapeConfigure,
  someFailIterable,
  someFailIterableAsync,
  someIterable,
  someIterableAsync,
} from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration());

describe(someIterable, () => {
  test('returns true when at least one element passes the test', () => {
    const array = [1, 3, 5, 8];
    expect(someIterable((num: number) => num % 2 === 0, array)).toBe(true);
  });

  test('returns false when no elements pass the test', () => {
    const array = [1, 3, 5, 7];
    expect(someIterable((num: number) => num % 2 === 0, array)).toBe(false);
  });

  test('short-circuits when finding first passing element', () => {
    let callCount = 0;
    const array = [1, 3, 4, 8];
    someIterable((num: number) => {
      callCount++;
      return num % 2 === 0;
    }, array);
    expect(callCount).toBe(3); // Only calls until the first true result
  });

  test('works with other iterables like Sets', () => {
    const set = new Set([1, 3, 5, 8]);
    expect(someIterable((num: number) => num % 2 === 0, set)).toBe(true);

    const failSet = new Set([1, 3, 5, 7]);
    expect(someIterable((num: number) => num % 2 === 0, failSet)).toBe(false);
  });

  test('works with strings as iterables', () => {
    const str = 'hello';
    expect(someIterable((char: string) => 'aeiou'.includes(char), str)).toBe(true);

    const failStr = 'xyz';
    expect(someIterable((char: string) => 'aeiou'.includes(char), failStr)).toBe(false);
  });

  test('throws error when predicate throws', () => {
    const array = [1, 2, 3];
    expect(() =>
      someIterable(() => {
        throw new Error('Test error');
      }, array)
    )
      .toThrow('Test error');
  });

  test('returns false for empty arrays', () => {
    expect(someIterable(() => true, [])).toBe(false);
  });

  test('works with Maps', () => {
    const map = new Map([[1, 'a'], [2, 'b'], [3, 'c']]);
    expect(someIterable((entry) => {
      const [key, _value] = entry as [number, string];
      return key === 2;
    }, map))
      .toBe(true);
    expect(someIterable((entry) => {
      const [key, _value] = entry as [number, string];
      return key === 4;
    }, map))
      .toBe(false);
  });

  test('works with custom iterables', () => {
    const customIterable = {
      *[Symbol.iterator]() {
        yield 1;
        yield 2;
        yield 3;
      },
    };
    expect(someIterable((num: number) => num === 2, customIterable)).toBe(true);
    expect(someIterable((num: number) => num === 4, customIterable)).toBe(false);
  });
});

describe(someFailIterable, () => {
  test('returns true when at least one element fails the test', () => {
    const array = [2, 4, 5, 8];
    expect(someFailIterable((num: number) => num % 2 === 0, array)).toBe(true);
  });

  test('returns false when all elements pass the test', () => {
    const array = [2, 4, 6, 8];
    expect(someFailIterable((num: number) => num % 2 === 0, array)).toBe(false);
  });

  test('short-circuits when finding first failing element', () => {
    let callCount = 0;
    const array = [2, 4, 5, 8];
    someFailIterable((num: number) => {
      callCount++;
      return num % 2 === 0;
    }, array);
    expect(callCount).toBe(3); // Only calls until the first false result
  });

  test('works with validation scenarios', () => {
    const users = [
      { name: 'Alice', age: 25 },
      { name: 'Bob', age: 17 },
      { name: 'Charlie', age: 30 },
    ];
    expect(someFailIterable((user) => (user as { age: number; }).age >= 18, users)).toBe(
      true,
    );

    const adults = [
      { name: 'Alice', age: 25 },
      { name: 'Charlie', age: 30 },
    ];
    expect(someFailIterable((user) => (user as { age: number; }).age >= 18, adults)).toBe(
      false,
    );
  });

  test('returns false for empty arrays', () => {
    expect(someFailIterable(() => false, [])).toBe(false);
  });

  test('throws error when predicate throws', () => {
    const array = [1, 2, 3];
    expect(() =>
      someFailIterable(() => {
        throw new Error('Test error');
      }, array)
    )
      .toThrow('Test error');
  });

  test('works with Sets', () => {
    const set = new Set(['a', 'b', 'c']);
    expect(someFailIterable((x) => /^[a-z]$/.test(x as string), set)).toBe(false);

    const mixedSet = new Set(['a', 'B', 'c']);
    expect(someFailIterable((x) => /^[a-z]$/.test(x as string), mixedSet)).toBe(true);
  });
});

describe(someIterableAsync, () => {
  test('returns true when at least one element passes the test', async () => {
    const array = [1, 3, 5, 8];
    expect(await someIterableAsync(async (num: number) => num % 2 === 0, array)).toBe(
      true,
    );
  });

  test('returns false when no elements pass the test', async () => {
    const array = [1, 3, 5, 7];
    await expect(someIterableAsync(async (num: number) => num % 2 === 0, array))
      .resolves
      .toBe(false);
  });

  test('works with async iterables', async () => {
    const asyncIterable = {
      async *[Symbol.asyncIterator]() {
        yield 1;
        yield 3;
        yield 5;
        yield 8;
      },
    };

    await expect(someIterableAsync(async (num: number) => num % 2 === 0, asyncIterable))
      .resolves
      .toBe(true);

    const failAsyncIterable = {
      async *[Symbol.asyncIterator]() {
        yield 1;
        yield 3;
        yield 5;
      },
    };

    await expect(
      someIterableAsync(async (num: number) => num % 2 === 0, failAsyncIterable),
    )
      .resolves
      .toBe(false);
  });

  test('returns false for empty arrays', async () => {
    expect(await someIterableAsync(async () => true, [])).toBe(false);
  });

  test('handles mixed synchronous and asynchronous predicates', async () => {
    const array = [1, 2, 3, 4];

    const result = await someIterableAsync((num: number, index?: number) => {
      if (index !== undefined && index % 2 === 0) {
        return Promise.resolve(num > 3);
      }
      return num > 3;
    }, array);

    expect(result).toBe(true);
  });

  test('handles delayed async responses correctly', async () => {
    const array = [1, 2, 3, 4];

    const slowFalse = async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return false;
    };

    const fastTrue = async () => {
      return true;
    };

    // Should return true quickly because of efficient handling
    const start = performance.now();
    const result = await someIterableAsync(async (num: number) => {
      return num === 3 ? fastTrue() : slowFalse();
    }, array);
    const elapsed = performance.now() - start;

    expect(result).toBe(true);

    // This should complete faster than it would take for all slow functions to resolve
    expect(elapsed).toBeLessThan(40);
  });

  test('properly handles errors from predicate', async () => {
    const array = [1, 2, 3];

    // The somePromises implementation catches errors, so it doesn't throw
    const result = await someIterableAsync(async (num: number) => {
      if (num === 2) {
        throw new Error('Predicate error');
      }
      return num === 4;
    }, array);

    expect(result).toBe(false);
  });
});

describe(someFailIterableAsync, () => {
  test('returns true when at least one element fails the test', async () => {
    const array = [2, 4, 5, 8];
    expect(await someFailIterableAsync(async (num: number) => num % 2 === 0, array)).toBe(
      true,
    );
  });

  test('returns false when all elements pass the test', async () => {
    const array = [2, 4, 6, 8];
    await expect(someFailIterableAsync(async (num: number) => num % 2 === 0, array))
      .resolves
      .toBe(false);
  });

  test('works with validation scenarios', async () => {
    const users = [
      { name: 'Alice', age: 25 },
      { name: 'Bob', age: 17 },
      { name: 'Charlie', age: 30 },
    ];
    expect(await someFailIterableAsync(async (user) => user.age >= 18, users)).toBe(true);

    const adults = [
      { name: 'Alice', age: 25 },
      { name: 'Charlie', age: 30 },
    ];
    expect(await someFailIterableAsync(async (user) => user.age >= 18, adults)).toBe(
      false,
    );
  });

  test('returns false for empty arrays', async () => {
    expect(await someFailIterableAsync(async () => false, [])).toBe(false);
  });

  test('works with async iterables', async () => {
    const asyncIterable = {
      async *[Symbol.asyncIterator]() {
        yield { pass: true };
        yield { pass: false };
        yield { pass: true };
      },
    };

    await expect(someFailIterableAsync(async (item) => item.pass, asyncIterable))
      .resolves
      .toBe(true);

    const allPassAsyncIterable = {
      async *[Symbol.asyncIterator]() {
        yield { pass: true };
        yield { pass: true };
      },
    };

    await expect(
      someFailIterableAsync(async (item) => item.pass, allPassAsyncIterable),
    )
      .resolves
      .toBe(false);
  });

  test('short-circuits on first failure', async () => {
    let callCount = 0;
    const asyncIterable = {
      async *[Symbol.asyncIterator]() {
        yield 2;
        yield 4;
        yield 5;
        yield 8;
      },
    };

    await someFailIterableAsync(async (num: number) => {
      callCount++;
      return num % 2 === 0;
    }, asyncIterable);

    expect(callCount).toBe(3); // Only processes until first odd number
  });

  test('handles synchronous predicates', async () => {
    const array = [1, 2, 3, 4];
    const result = await someFailIterableAsync((num: number) => num < 3, array);
    expect(result).toBe(true); // 3 and 4 fail the test
  });
});
