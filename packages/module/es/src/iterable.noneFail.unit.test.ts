import {
  describe,
  expect,
  test,
  vi,
} from 'vitest';
import {
  noneFailIterable,
  noneFailIterableAsync,
} from './iterable.noneFail.ts';

//region Synchronous noneFailIterable Tests -- Tests for the synchronous version that processes all elements
describe(noneFailIterable, () => {
  test('returns true when all elements pass the predicate', () => {
    const numbers = [1, 2, 3, 4, 5];
    const result = noneFailIterable((x: number) => x > 0, numbers);
    expect(result).toBe(true);
  });

  test('returns false when at least one element fails the predicate', () => {
    const numbers = [1, 2, -3, 4, 5];
    const result = noneFailIterable((x: number) => x > 0, numbers);
    expect(result).toBe(false);
  });

  test('returns true for empty iterable', () => {
    const empty: number[] = [];
    const result = noneFailIterable((x: number) => x > 0, empty);
    expect(result).toBe(true);
  });

  test('processes all elements even after finding failures', () => {
    let processedCount = 0;
    const numbers = [1, 2, 3, 4, 5];
    const result = noneFailIterable((x: number) => {
      processedCount++;
      return x !== 3; // 3 will fail
    }, numbers);

    expect(result).toBe(false);
    expect(processedCount).toBe(5); // All elements processed
  });

  test('works with string validation', () => {
    const strings = ['hello', 'world', 'test'];
    const allNonEmpty = noneFailIterable((s: string) => s.length > 0, strings);
    expect(allNonEmpty).toBe(true);

    const withEmpty = ['hello', '', 'test'];
    const hasEmpty = noneFailIterable((s: string) => s.length > 0, withEmpty);
    expect(hasEmpty).toBe(false);
  });

  test('provides index parameter to predicate function', () => {
    const items = ['first', 'second', 'third'];
    const validPositions = noneFailIterable(
      (_item: string, index?: number) => index !== undefined && index < 5,
      items,
    );
    expect(validPositions).toBe(true);
  });

  test('provides arrayLike parameter to predicate function', () => {
    const numbers = [1, 2, 3];
    const result = noneFailIterable(
      (_item: number, _index?: number, arrayLike?: number[]) => arrayLike === numbers,
      numbers,
    );
    expect(result).toBe(true);
  });

  test('works with Set iterable', () => {
    const numberSet = new Set([1, 2, 3, 4]);
    const allPositive = noneFailIterable((x: number) => x > 0, numberSet);
    expect(allPositive).toBe(true);

    const mixedSet = new Set([1, -2, 3]);
    const hasNegative = noneFailIterable((x: number) => x > 0, mixedSet);
    expect(hasNegative).toBe(false);
  });

  test('works with string as iterable', () => {
    const text = 'hello';
    const noX = noneFailIterable((char: string) => char !== 'x', text);
    expect(noX).toBe(true);

    const withX = 'heXllo';
    const hasX = noneFailIterable((char: string) => char !== 'X', withX);
    expect(hasX).toBe(false);
  });

  test('works with Map iterable', () => {
    const testMap = new Map([['a', 1], ['b', 2], ['c', 3]]);
    const allValidKeys = noneFailIterable(
      ([key, value]: [string, number]) => key.length > 0 && value > 0,
      testMap,
    );
    expect(allValidKeys).toBe(true);
  });

  test('handles complex object validation', () => {
    const products = [
      { name: 'Laptop', price: 999, inStock: true },
      { name: 'Mouse', price: 25, inStock: true },
      { name: 'Keyboard', price: 75, inStock: false },
    ];
    const allAvailable = noneFailIterable(
      (product: { name: string; price: number; inStock: boolean; }) =>
        product.inStock && product.price > 0,
      products,
    );
    expect(allAvailable).toBe(false); // keyboard isn't in stock
  });

  test('handles boolean predicate results correctly', () => {
    const mixed = [1, 'hello', true, 42];
    const allTruthy = noneFailIterable((x: unknown) => Boolean(x), mixed);
    expect(allTruthy).toBe(true);

    const withFalsy = [1, 'hello', 0, 42];
    const hasFalsy = noneFailIterable((x: unknown) => Boolean(x), withFalsy);
    expect(hasFalsy).toBe(false);
  });
});
//endregion Synchronous noneFailIterable Tests

//region Asynchronous noneFailIterableAsync Tests -- Tests for the async version that processes all elements
describe(noneFailIterableAsync, () => {
  test('returns true when all elements pass the async predicate', async () => {
    const numbers = [1, 2, 3, 4, 5];
    const result = await noneFailIterableAsync(
      async (x: number) => x > 0,
      numbers,
    );
    expect(result).toBe(true);
  });

  test('returns false when at least one element fails the async predicate', async () => {
    const numbers = [1, 2, -3, 4, 5];
    const result = await noneFailIterableAsync(
      async (x: number) => x > 0,
      numbers,
    );
    expect(result).toBe(false);
  });

  test('returns true for empty async iterable', async () => {
    const empty: number[] = [];
    const result = await noneFailIterableAsync(
      async (x: number) => x > 0,
      empty,
    );
    expect(result).toBe(true);
  });

  test('processes all elements even after finding failures', async () => {
    let processedCount = 0;
    const numbers = [1, 2, 3, 4, 5];
    const result = await noneFailIterableAsync(async (x: number) => {
      processedCount++;
      return x !== 3; // 3 will fail
    }, numbers);

    expect(result).toBe(false);
    expect(processedCount).toBe(5); // All elements processed
  });

  test('works with async generator', async () => {
    async function* asyncNumbers() {
      yield 1;
      yield 2;
      yield 3;
    }

    const result = await noneFailIterableAsync(
      async (x: number) => x > 0,
      asyncNumbers(),
    );
    expect(result).toBe(true);
  });

  test('handles async validation with delays', async () => {
    const items = ['valid', 'data', 'test'];
    const result = await noneFailIterableAsync(
      async (item: string) => {
        // Simulate async processing
        await new Promise<void>((resolve) => setTimeout(resolve, 1));
        return item.length > 0;
      },
      items,
    );
    expect(result).toBe(true);
  });

  test('provides index parameter to async predicate function', async () => {
    const items = ['first', 'second', 'third'];
    const validPositions = await noneFailIterableAsync(
      async (_item: string, index?: number) => index !== undefined && index < 5,
      items,
    );
    expect(validPositions).toBe(true);
  });

  test('provides arrayLike parameter to async predicate function', async () => {
    const numbers = [1, 2, 3];
    const result = await noneFailIterableAsync(
      async (_item: number, _index?: number, arrayLike?: number[]) =>
        arrayLike === numbers,
      numbers,
    );
    expect(result).toBe(true);
  });

  test('handles mixed sync and async predicates', async () => {
    const numbers = [1, 2, 3, 4, 5];
    const result = await noneFailIterableAsync(
      (x: number) => x > 0, // sync predicate
      numbers,
    );
    expect(result).toBe(true);
  });

  test('handles async predicate errors gracefully', async () => {
    const numbers = [1, 2, 3];

    await expect(
      noneFailIterableAsync(
        async (x: number) => {
          if (x === 2) { throw new Error('Test error'); }
          return x > 0;
        },
        numbers,
      ),
    )
      .rejects
      .toThrow('Test error');
  });

  test('works with async iterable from async generator with failures', async () => {
    async function* asyncUsers() {
      yield { name: 'Alice', age: 25 };
      yield { name: 'Bob', age: 17 }; // Minor
      yield { name: 'Charlie', age: 30 };
    }

    const allAdults = await noneFailIterableAsync(
      async (user: { name: string; age: number; }) => user.age >= 18,
      asyncUsers(),
    );
    expect(allAdults).toBe(false); // Bob fails the age check
  });

  test('handles complex async validation scenarios', async () => {
    const users = [
      { name: 'Alice', email: 'alice@example.com' },
      { name: 'Bob', email: 'bob@example.com' },
      { name: 'Charlie', email: 'charlie@example.com' },
    ];

    const allValidEmails = await noneFailIterableAsync(
      async (user: { name: string; email: string; }) => {
        // Simulate async email validation
        await new Promise<void>((resolve) => setTimeout(resolve, 1));
        return user.email.includes('@');
      },
      users,
    );
    expect(allValidEmails).toBe(true);
  });

  test('processes all elements in async generator even with failures', async () => {
    let processedCount = 0;

    async function* asyncNumbers() {
      yield 1;
      yield 2;
      yield 3;
      yield 4;
    }

    const result = await noneFailIterableAsync(async (x: number) => {
      processedCount++;
      return x !== 2; // 2 will fail
    }, asyncNumbers());

    expect(result).toBe(false);
    expect(processedCount).toBe(4); // All elements processed
  });
});
//endregion Asynchronous noneFailIterableAsync Tests
