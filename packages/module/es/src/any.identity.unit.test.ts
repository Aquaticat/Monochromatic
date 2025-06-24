import { identity } from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  test,
} from 'vitest';

describe(identity, () => {
  test('returns the same value for primitive types', () => {
    expect(identity(42)).toBe(42);
    expect(identity('hello')).toBe('hello');
    expect(identity(true)).toBe(true);
    expect(identity(false)).toBe(false);
    expect(identity(null)).toBeNull();
    const undefinedResult = identity(undefined);
    expect(undefinedResult).toBeUndefined();
  });

  test('returns the same value for special numbers', () => {
    expect(identity(0)).toBe(0);
    expect(identity(-0)).toBe(-0);
    expect(identity(Number.POSITIVE_INFINITY)).toBe(Number.POSITIVE_INFINITY);
    expect(identity(Number.NEGATIVE_INFINITY)).toBe(Number.NEGATIVE_INFINITY);
    expect(Number.isNaN(identity(Number.NaN))).toBe(true);
  });

  test('returns the same value for bigint and symbol', () => {
    const bigIntValue = BigInt(123);
    const symbolValue = Symbol('test');

    expect(identity(bigIntValue)).toBe(bigIntValue);
    expect(identity(symbolValue)).toBe(symbolValue);
  });

  test('preserves reference equality for objects', () => {
    const obj = { a: 1, b: 2 };
    const arr = [1, 2, 3];
    const func = (): void => {
      // Empty function for testing
    };
    const date = new Date();
    const regex = /test/;

    expect(identity(obj)).toBe(obj);
    expect(identity(arr)).toBe(arr);
    expect(identity(func)).toBe(func);
    expect(identity(date)).toBe(date);
    expect(identity(regex)).toBe(regex);
  });

  test('works with complex nested data structures', () => {
    const complex = {
      numbers: [1, 2, 3],
      nested: {
        deep: {
          value: 'test',
        },
      },
      func: (): string => 'hello',
      date: new Date(),
    };

    const result = identity(complex);
    expect(result).toBe(complex);
    expect(result.numbers).toBe(complex.numbers);
    expect(result.nested.deep).toBe(complex.nested.deep);
  });

  test('works with built-in objects and collections', () => {
    const set = new Set([1, 2, 3]);
    const map = new Map([['key', 'value']]);
    const weakSet = new WeakSet();
    const weakMap = new WeakMap();

    expect(identity(set)).toBe(set);
    expect(identity(map)).toBe(map);
    expect(identity(weakSet)).toBe(weakSet);
    expect(identity(weakMap)).toBe(weakMap);
  });

  test('useful in functional programming contexts', () => {
    const numbers = [1, 2, 3, 4, 5];

    // No transformation mapping
    const mapped = numbers.map(identity);
    expect(mapped).toEqual([1, 2, 3, 4, 5]);
    expect(mapped).not.toBe(numbers); // New array created by map

    // Filtering truthy values
    const mixed = [0, 1, '', 'hello', false, true, null, undefined, 42];
    const truthy = mixed.filter(identity);
    expect(truthy).toEqual([1, 'hello', true, 42]);
  });

  test('works as default parameter or placeholder function', () => {
    function processValue<const T,>(value: T, transform: (arg0: T) => any = identity): T {
      return transform(value);
    }

    expect(processValue('test')).toBe('test');
    expect(processValue('test', (s) => s.toUpperCase())).toBe('TEST');
  });

  test('maintains type information', () => {
    // Type-level test to ensure generic type is preserved
    const stringValue: string = identity('test');
    const numberValue: number = identity(42);
    const booleanValue: boolean = identity(true);

    expect(typeof stringValue).toBe('string');
    expect(typeof numberValue).toBe('number');
    expect(typeof booleanValue).toBe('boolean');
  });
});
