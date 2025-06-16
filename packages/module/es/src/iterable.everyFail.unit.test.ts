import {
  describe,
  expect,
  test,
  vi,
} from 'vitest';
import {
  everyFailIterable,
  everyFailIterableAsync,
} from './iterable.everyFail.ts';

describe('everyFailIterable', () => {
  test('returns true when all elements fail the predicate', () => {
    const numbers = [1, 2, 3, 4];
    const result = everyFailIterable((x: number) => x > 100, numbers);
    expect(result).toBe(true);
  });

  test('returns false when any element passes the predicate', () => {
    const numbers = [1, 2, 150, 4];
    const result = everyFailIterable((x: number) => x > 100, numbers);
    expect(result).toBe(false);
  });

  test('returns true for empty arrays', () => {
    const empty: number[] = [];
    const result = everyFailIterable((x: number) => x > 0, empty);
    expect(result).toBe(true);
  });

  test('works with string predicate', () => {
    const strings = ['hello', 'world', 'test'];
    const result = everyFailIterable((s: string) => s.length > 10, strings);
    expect(result).toBe(true);
  });

  test('fails fast and stops on first passing element', () => {
    const mockFn = vi.fn((x: number) => x > 5);
    const numbers = [1, 2, 10, 15, 20]; // Should stop at 10

    const result = everyFailIterable(mockFn, numbers);

    expect(result).toBe(false);
    expect(mockFn).toHaveBeenCalledTimes(3); // Only called for 1, 2, 10
  });

  test('uses index parameter correctly', () => {
    const items = ['a', 'b', 'c'];
    const result = everyFailIterable(
      (_element: string, index?: number) => (index ?? 0) > 5,
      items,
    );
    expect(result).toBe(true); // All indices are < 5
  });

  test('uses arrayLike parameter correctly', () => {
    const items = [1, 2, 3];
    const result = everyFailIterable(
      (_element: number, _index?: number, arrayLike?: number[]) => {
        return (arrayLike?.length ?? 0) < 2; // Array length is 3, so predicate fails
      },
      items,
    );
    expect(result).toBe(true);
  });

  test('works with different iterable types', () => {
    // Set
    const setResult = everyFailIterable(
      (x: number) => x > 100,
      new Set([1, 2, 3]),
    );
    expect(setResult).toBe(true);

    // String
    const stringResult = everyFailIterable(
      (char: string) => char === char.toUpperCase(),
      'hello',
    );
    expect(stringResult).toBe(true); // All lowercase
  });

  test('throws errors from predicate function', () => {
    const numbers = [1, 2, 3];
    expect(() => {
      everyFailIterable((x: number) => {
        if (x === 2) throw new Error('Test error');
        return x > 100;
      }, numbers);
    })
      .toThrow('Test error');
  });

  test('handles boolean return values correctly', () => {
    const booleans = [false, false, false];
    const result = everyFailIterable((x: boolean) => x === true, booleans);
    expect(result).toBe(true); // All are false, so predicate fails for all
  });
});

describe('everyFailIterableAsync', () => {
  test('returns true when all elements fail the predicate', async () => {
    const numbers = [1, 2, 3, 4];
    const result = await everyFailIterableAsync((x: number) => x > 100, numbers);
    expect(result).toBe(true);
  });

  test('returns false when any element passes the predicate', async () => {
    const numbers = [1, 2, 150, 4];
    const result = await everyFailIterableAsync((x: number) => x > 100, numbers);
    expect(result).toBe(false);
  });

  test('returns true for empty arrays', async () => {
    const empty: number[] = [];
    const result = await everyFailIterableAsync((x: number) => x > 0, empty);
    expect(result).toBe(true);
  });

  test('works with async predicate function', async () => {
    const numbers = [1, 2, 3];
    const result = await everyFailIterableAsync(async (x: number) => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      return x > 100;
    }, numbers);
    expect(result).toBe(true);
  });

  test('works with sync predicate function', async () => {
    const numbers = [1, 2, 3];
    const result = await everyFailIterableAsync((x: number) => x > 100, numbers);
    expect(result).toBe(true);
  });

  test('fails fast and stops on first passing element', async () => {
    const mockFn = vi.fn(async (x: number) => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      return x > 5;
    });
    const numbers = [1, 2, 10, 15, 20]; // Should stop at 10

    const result = await everyFailIterableAsync(mockFn, numbers);

    expect(result).toBe(false);
    expect(mockFn).toHaveBeenCalledTimes(3); // Only called for 1, 2, 10
  });

  test('uses index parameter correctly', async () => {
    const items = ['a', 'b', 'c'];
    const result = await everyFailIterableAsync(
      async (_element: string, index?: number) => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return (index ?? 0) > 5;
      },
      items,
    );
    expect(result).toBe(true); // All indices are < 5
  });

  test('uses arrayLike parameter correctly', async () => {
    const items = [1, 2, 3];
    const result = await everyFailIterableAsync(
      async (_element: number, _index?: number, arrayLike?: number[]) => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return (arrayLike?.length ?? 0) < 2; // Array length is 3, so predicate fails
      },
      items,
    );
    expect(result).toBe(true);
  });

  test('works with async iterables', async () => {
    async function* asyncNumbers() {
      yield 1;
      yield 2;
      yield 3;
    }

    const result = await everyFailIterableAsync(
      (x: number) => x > 100,
      asyncNumbers(),
    );
    expect(result).toBe(true);
  });

  test('throws errors from async predicate function', async () => {
    const numbers = [1, 2, 3];
    await expect(async () => {
      await everyFailIterableAsync(async (x: number) => {
        if (x === 2) throw new Error('Test error');
        await new Promise((resolve) => setTimeout(resolve, 1));
        return x > 100;
      }, numbers);
    })
      .rejects
      .toThrow('Test error');
  });

  test('throws errors from sync predicate function', async () => {
    const numbers = [1, 2, 3];
    await expect(async () => {
      await everyFailIterableAsync((x: number) => {
        if (x === 2) throw new Error('Test error');
        return x > 100;
      }, numbers);
    })
      .rejects
      .toThrow('Test error');
  });

  test('handles mixed async/sync behavior', async () => {
    const numbers = [1, 2, 3, 4];
    let callCount = 0;

    const result = await everyFailIterableAsync((x: number) => {
      callCount++;
      // Sometimes return Promise, sometimes return boolean directly
      if (callCount % 2 === 0) {
        return Promise.resolve(x > 100);
      }
      return x > 100;
    }, numbers);

    expect(result).toBe(true);
    expect(callCount).toBe(4);
  });

  test('handles promise rejection in predicate', async () => {
    const numbers = [1, 2, 3];
    await expect(async () => {
      await everyFailIterableAsync(async (x: number) => {
        if (x === 2) return Promise.reject(new Error('Promise rejection'));
        return x > 100;
      }, numbers);
    })
      .rejects
      .toThrow('Promise rejection');
  });
});
