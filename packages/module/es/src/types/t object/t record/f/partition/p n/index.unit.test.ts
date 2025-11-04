import {
  describe,
  expect,
  test,
} from 'vitest';
import { $ as partition } from './index.ts';

describe('partition (async named)', () => {
  test('partitions with sync predicate and sync iterable', async () => {
    const numbers = [1, 2, 3, 4, 5];
    const result = await partition({
      predicate: (n: number) => n % 2 === 0,
      iterable: numbers,
    });

    expect(result.pass).toEqual([2, 4]);
    expect(result.fail).toEqual([1, 3, 5]);
    expect(result.thrown).toEqual([]);
  });

  test('partitions with async predicate and sync iterable', async () => {
    const numbers = [1, 2, 3, 4, 5];
    const result = await partition({
      predicate: async (n: number) => n % 2 === 0,
      iterable: numbers,
    });

    expect(result.pass).toEqual([2, 4]);
    expect(result.fail).toEqual([1, 3, 5]);
    expect(result.thrown).toEqual([]);
  });

  test('partitions with sync predicate and async iterable', async () => {
    async function* asyncNumbers(): AsyncGenerator<number> {
      yield 1;
      yield 2;
      yield 3;
      yield 4;
      yield 5;
    }

    const result = await partition({
      predicate: (n: number) => n % 2 === 0,
      iterable: asyncNumbers(),
    });

    expect(result.pass).toEqual([2, 4]);
    expect(result.fail).toEqual([1, 3, 5]);
    expect(result.thrown).toEqual([]);
  });

  test('partitions with async predicate and async iterable', async () => {
    async function* asyncNumbers(): AsyncGenerator<number> {
      yield 1;
      yield 2;
      yield 3;
      yield 4;
      yield 5;
    }

    const result = await partition({
      predicate: async (n: number) => n % 2 === 0,
      iterable: asyncNumbers(),
    });

    expect(result.pass).toEqual([2, 4]);
    expect(result.fail).toEqual([1, 3, 5]);
    expect(result.thrown).toEqual([]);
  });

  test('catches errors and places items in thrown array', async () => {
    const items = ['1', 'invalid', '3', 'bad', '5'];
    const result = await partition({
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

  test('handles empty iterable', async () => {
    const result = await partition({
      predicate: (n: number) => n > 0,
      iterable: [],
    });

    expect(result.pass).toEqual([]);
    expect(result.fail).toEqual([]);
    expect(result.thrown).toEqual([]);
  });

  test('handles all items passing', async () => {
    const numbers = [2, 4, 6, 8];
    const result = await partition({
      predicate: (n: number) => n % 2 === 0,
      iterable: numbers,
    });

    expect(result.pass).toEqual([2, 4, 6, 8]);
    expect(result.fail).toEqual([]);
    expect(result.thrown).toEqual([]);
  });

  test('handles all items failing', async () => {
    const numbers = [1, 3, 5, 7];
    const result = await partition({
      predicate: (n: number) => n % 2 === 0,
      iterable: numbers,
    });

    expect(result.pass).toEqual([]);
    expect(result.fail).toEqual([1, 3, 5, 7]);
    expect(result.thrown).toEqual([]);
  });

  test('handles all items throwing', async () => {
    const items = ['a', 'b', 'c'];
    const result = await partition({
      predicate: () => {
        throw new Error('Always throws');
      },
      iterable: items,
    });

    expect(result.pass).toEqual([]);
    expect(result.fail).toEqual([]);
    expect(result.thrown).toEqual(['a', 'b', 'c']);
  });

  test('preserves item order in each category', async () => {
    const numbers = [10, 1, 20, 2, 30, 3];
    const result = await partition({
      predicate: (n: number) => n > 5,
      iterable: numbers,
    });

    expect(result.pass).toEqual([10, 20, 30]);
    expect(result.fail).toEqual([1, 2, 3]);
    expect(result.thrown).toEqual([]);
  });

  test('handles async predicate with delays', async () => {
    const numbers = [1, 2, 3];
    const result = await partition({
      predicate: async (n: number) => {
        await new Promise((resolve) => {
          setTimeout(resolve, 1);
        });
        return n > 1;
      },
      iterable: numbers,
    });

    expect(result.pass).toEqual([2, 3]);
    expect(result.fail).toEqual([1]);
    expect(result.thrown).toEqual([]);
  });
});
