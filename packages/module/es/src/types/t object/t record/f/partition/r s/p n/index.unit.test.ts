import {
  describe,
  expect,
  test,
} from 'vitest';
import { $ as partition } from './index.ts';

describe('partition (sync named)', () => {
  test('partitions with sync predicate and sync iterable', () => {
    const numbers = [1, 2, 3, 4, 5];
    const result = partition({
      predicate: (n: number) => n % 2 === 0,
      iterable: numbers,
    });

    expect(result.pass).toEqual([2, 4]);
    expect(result.fail).toEqual([1, 3, 5]);
    expect(result.thrown).toEqual([]);
  });

  test('catches errors and places items in thrown array', () => {
    const items = ['1', 'invalid', '3', 'bad', '5'];
    const result = partition({
      predicate: (s: string) => {
        const num = Number.parseInt(s, 10);
        if (Number.isNaN(num)) {
          throw new Error('Invalid number');
        }
        return num > 2;
      },
      iterable: items,
    });

    expect(result.pass).toEqual(['3', '5']);
    expect(result.fail).toEqual(['1']);
    expect(result.thrown).toEqual(['invalid', 'bad']);
  });

  test('handles empty iterable', () => {
    const result = partition({
      predicate: (n: number) => n > 0,
      iterable: [],
    });

    expect(result.pass).toEqual([]);
    expect(result.fail).toEqual([]);
    expect(result.thrown).toEqual([]);
  });

  test('handles all items passing', () => {
    const numbers = [2, 4, 6, 8];
    const result = partition({
      predicate: (n: number) => n % 2 === 0,
      iterable: numbers,
    });

    expect(result.pass).toEqual([2, 4, 6, 8]);
    expect(result.fail).toEqual([]);
    expect(result.thrown).toEqual([]);
  });

  test('handles all items failing', () => {
    const numbers = [1, 3, 5, 7];
    const result = partition({
      predicate: (n: number) => n % 2 === 0,
      iterable: numbers,
    });

    expect(result.pass).toEqual([]);
    expect(result.fail).toEqual([1, 3, 5, 7]);
    expect(result.thrown).toEqual([]);
  });

  test('handles all items throwing', () => {
    const items = ['a', 'b', 'c'];
    const result = partition({
      predicate: () => {
        throw new Error('Always throws');
      },
      iterable: items,
    });

    expect(result.pass).toEqual([]);
    expect(result.fail).toEqual([]);
    expect(result.thrown).toEqual(['a', 'b', 'c']);
  });

  test('preserves item order in each category', () => {
    const numbers = [10, 1, 20, 2, 30, 3];
    const result = partition({
      predicate: (n: number) => n > 5,
      iterable: numbers,
    });

    expect(result.pass).toEqual([10, 20, 30]);
    expect(result.fail).toEqual([1, 2, 3]);
    expect(result.thrown).toEqual([]);
  });

  test('works with non-array iterables', () => {
    const set = new Set([1, 2, 3, 4, 5]);
    const result = partition({
      predicate: (n: number) => n % 2 === 0,
      iterable: set,
    });

    expect(result.pass).toEqual([2, 4]);
    expect(result.fail).toEqual([1, 3, 5]);
    expect(result.thrown).toEqual([]);
  });

  test('works with generator functions', () => {
    function* numbers(): Generator<number> {
      yield 1;
      yield 2;
      yield 3;
      yield 4;
      yield 5;
    }

    const result = partition({
      predicate: (n: number) => n % 2 === 0,
      iterable: numbers(),
    });

    expect(result.pass).toEqual([2, 4]);
    expect(result.fail).toEqual([1, 3, 5]);
    expect(result.thrown).toEqual([]);
  });

  test('works with strings as iterables', () => {
    const result = partition({
      predicate: (c: string) => c >= 'c',
      iterable: 'abcde',
    });

    expect(result.pass).toEqual(['c', 'd', 'e']);
    expect(result.fail).toEqual(['a', 'b']);
    expect(result.thrown).toEqual([]);
  });
});
