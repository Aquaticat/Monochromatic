import {
  logtapeConfiguration,
  logtapeConfigure,
  when,
  whenAsync,
} from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration());

//region when tests -- Tests for synchronous conditional transformation

describe(when, () => {
  test('applies transformation when predicate returns true', () => {
    const isEven = (n: number): boolean => n % 2 === 0;
    const double = (n: number): number => n * 2;

    const result = when(isEven, double, 4);
    expect(result).toBe(8);
  });

  test('returns original value when predicate returns false', () => {
    const isEven = (n: number): boolean => n % 2 === 0;
    const double = (n: number): number => n * 2;

    const result = when(isEven, double, 3);
    expect(result).toBe(3);
  });

  test('works with string transformations', () => {
    const isLongString = (s: string): boolean => s.length > 5;
    const toUpperCase = (s: string): string => s.toUpperCase();

    expect(when(isLongString, toUpperCase, 'hello world')).toBe('HELLO WORLD');
    expect(when(isLongString, toUpperCase, 'hi')).toBe('hi');
  });

  test('works with object transformations', () => {
    type User = { name: string; age: number; };
    const isAdult = (user: User): boolean => user.age >= 18;
    const addTitle = (user: User): User & { title: string; } => ({
      ...user,
      title: 'Mr/Ms',
    });

    const adult = { name: 'Alice', age: 25 };
    const minor = { name: 'Bob', age: 16 };

    expect(when(isAdult, addTitle, adult)).toEqual({
      name: 'Alice',
      age: 25,
      title: 'Mr/Ms',
    });
    expect(when(isAdult, addTitle, minor)).toEqual({ name: 'Bob', age: 16 });
  });

  test('works with boolean predicates and transformations', () => {
    const isTrue = (b: boolean): boolean => b;
    const negate = (b: boolean): boolean => !b;

    expect(when(isTrue, negate, true)).toBe(false);
    expect(when(isTrue, negate, false)).toBe(false);
  });

  test('works with array transformations', () => {
    const hasElements = (arr: number[]): boolean => arr.length > 0;
    const sum = (arr: number[]): number => arr.reduce((a, b) => a + b, 0);

    expect(when(hasElements, sum, [1, 2, 3])).toBe(6);
    expect(when(hasElements, sum, [])).toEqual([]);
  });

  test('preserves type information correctly', () => {
    const isPositive = (n: number): boolean => n > 0;
    const toString = (n: number): string => n.toString();

    // Result should be number | string
    const result1: number | string = when(isPositive, toString, 5);
    const result2: number | string = when(isPositive, toString, -3);

    expect(result1).toBe('5');
    expect(result2).toBe(-3);
  });

  test('handles complex predicate logic', () => {
    const isEvenAndPositive = (n: number): boolean => n > 0 && n % 2 === 0;
    const square = (n: number): number => n * n;

    expect(when(isEvenAndPositive, square, 4)).toBe(16);
    expect(when(isEvenAndPositive, square, 3)).toBe(3);
    expect(when(isEvenAndPositive, square, -4)).toBe(-4);
  });
});

//endregion when tests

//region whenAsync tests -- Tests for asynchronous conditional transformation

describe(whenAsync, () => {
  test('applies transformation when async predicate returns true', async () => {
    const isEvenAsync = async (n: number): Promise<boolean> => n % 2 === 0;
    const doubleAsync = async (n: number): Promise<number> => n * 2;

    const result = await whenAsync(isEvenAsync, doubleAsync, 4);
    expect(result).toBe(8);
  });

  test('returns original value when async predicate returns false', async () => {
    const isEvenAsync = async (n: number): Promise<boolean> => n % 2 === 0;
    const doubleAsync = async (n: number): Promise<number> => n * 2;

    const result = await whenAsync(isEvenAsync, doubleAsync, 3);
    expect(result).toBe(3);
  });

  test('works with sync predicate and async transformation', async () => {
    const isEven = (n: number): boolean => n % 2 === 0;
    const doubleAsync = async (n: number): Promise<number> => n * 2;

    expect(await whenAsync(isEven, doubleAsync, 6)).toBe(12);
    expect(await whenAsync(isEven, doubleAsync, 5)).toBe(5);
  });

  test('works with async predicate and sync transformation', async () => {
    const isEvenAsync = async (n: number): Promise<boolean> => n % 2 === 0;
    const double = (n: number): number => n * 2;

    expect(await whenAsync(isEvenAsync, double, 8)).toBe(16);
    expect(await whenAsync(isEvenAsync, double, 7)).toBe(7);
  });

  test('works with both sync predicate and transformation', async () => {
    const isEven = (n: number): boolean => n % 2 === 0;
    const double = (n: number): number => n * 2;

    expect(await whenAsync(isEven, double, 10)).toBe(20);
    expect(await whenAsync(isEven, double, 9)).toBe(9);
  });

  test('handles async string transformations', async () => {
    const isLongStringAsync = async (s: string): Promise<boolean> => s.length > 5;
    const toUpperCaseAsync = async (s: string): Promise<string> => s.toUpperCase();

    expect(await whenAsync(isLongStringAsync, toUpperCaseAsync, 'hello world')).toBe(
      'HELLO WORLD',
    );
    expect(await whenAsync(isLongStringAsync, toUpperCaseAsync, 'hi')).toBe('hi');
  });

  test('handles async object transformations', async () => {
    type User = { name: string; age: number; };
    const isAdultAsync = async (user: User): Promise<boolean> => user.age >= 18;
    const addTitleAsync = async (user: User): Promise<User & { title: string; }> => ({
      ...user,
      title: 'Mr/Ms',
    });

    const adult = { name: 'Alice', age: 25 };
    const minor = { name: 'Bob', age: 16 };

    expect(await whenAsync(isAdultAsync, addTitleAsync, adult))
      .toEqual({ name: 'Alice', age: 25, title: 'Mr/Ms' });
    expect(await whenAsync(isAdultAsync, addTitleAsync, minor))
      .toEqual({ name: 'Bob', age: 16 });
  });

  test('handles delayed async operations', async () => {
    const delayedPredicate = async (n: number): Promise<boolean> => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return n > 5;
    };
    const delayedTransform = async (n: number): Promise<string> => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return `processed: ${n}`;
    };

    expect(await whenAsync(delayedPredicate, delayedTransform, 10))
      .toBe('processed: 10');
    expect(await whenAsync(delayedPredicate, delayedTransform, 3))
      .toBe(3);
  });

  test('propagates errors from predicate', async () => {
    const errorPredicate = async (): Promise<boolean> => {
      throw new Error('Predicate error');
    };
    const transform = async (n: number): Promise<number> => n * 2;

    await expect(whenAsync(errorPredicate, transform, 5))
      .rejects
      .toThrow('Predicate error');
  });

  test('propagates errors from transformation', async () => {
    const predicate = async (): Promise<boolean> => true;
    const errorTransform = async (): Promise<number> => {
      throw new Error('Transform error');
    };

    await expect(whenAsync(predicate, errorTransform, 5))
      .rejects
      .toThrow('Transform error');
  });

  test('preserves type information correctly with async', async () => {
    const isPositiveAsync = async (n: number): Promise<boolean> => n > 0;
    const toStringAsync = async (n: number): Promise<string> => n.toString();

    // Result should be Promise<number | string>
    const result1: number | string = await whenAsync(isPositiveAsync, toStringAsync, 5);
    const result2: number | string = await whenAsync(isPositiveAsync, toStringAsync, -3);

    expect(result1).toBe('5');
    expect(result2).toBe(-3);
  });

  test('handles complex async predicate logic', async () => {
    const isEvenAndPositiveAsync = async (n: number): Promise<boolean> => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      return n > 0 && n % 2 === 0;
    };
    const squareAsync = async (n: number): Promise<number> => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      return n * n;
    };

    expect(await whenAsync(isEvenAndPositiveAsync, squareAsync, 4)).toBe(16);
    expect(await whenAsync(isEvenAndPositiveAsync, squareAsync, 3)).toBe(3);
    expect(await whenAsync(isEvenAndPositiveAsync, squareAsync, -4)).toBe(-4);
  });
});

//endregion whenAsync tests
