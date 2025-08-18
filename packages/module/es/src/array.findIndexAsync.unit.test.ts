import {
  arrayFindIndexAsync,
  logtapeConfiguration,
  logtapeConfigure,
} from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration());

describe(arrayFindIndexAsync, () => {
  test('finds index of first element that satisfies async predicate', async () => {
    const numbers = [1, 2, 3, 4, 5];
    const isEvenAsync = async (n: number) => n % 2 === 0;
    const index = await arrayFindIndexAsync({ array: numbers, predicate: isEvenAsync });
    expect(index).toBe(1);
  });

  test('returns -1 when no element satisfies the predicate', async () => {
    const numbers = [1, 3, 5, 7, 9];
    const isEvenAsync = async (n: number) => n % 2 === 0;
    const index = await arrayFindIndexAsync({ array: numbers, predicate: isEvenAsync });
    expect(index).toBe(-1);
  });

  test('returns -1 for empty array', async () => {
    const empty: number[] = [];
    const isEvenAsync = async (n: number) => n % 2 === 0;
    const index = await arrayFindIndexAsync({ array: empty, predicate: isEvenAsync });
    expect(index).toBe(-1);
  });

  test('returns 0 when first element satisfies the predicate', async () => {
    const numbers = [2, 1, 3, 4, 5];
    const isEvenAsync = async (n: number) => n % 2 === 0;
    const index = await arrayFindIndexAsync({ array: numbers, predicate: isEvenAsync });
    expect(index).toBe(0);
  });

  test('returns last index when only last element satisfies the predicate', async () => {
    const numbers = [1, 3, 5, 7, 2];
    const isEvenAsync = async (n: number) => n % 2 === 0;
    const index = await arrayFindIndexAsync({ array: numbers, predicate: isEvenAsync });
    expect(index).toBe(4);
  });

  test('works with string arrays', async () => {
    const strings = ['hello', 'world', 'test', 'example'];
    const isLongAsync = async (s: string) => s.length > 4;
    const index = await arrayFindIndexAsync({ array: strings, predicate: isLongAsync });
    expect(index).toBe(0);
  });

  test('works with object arrays', async () => {
    const users = [
      { id: 1, name: 'Alice', active: false },
      { id: 2, name: 'Bob', active: true },
      { id: 3, name: 'Charlie', active: false },
    ];
    const isActiveAsync = async (user: { active: boolean }) => user.active;
    const index = await arrayFindIndexAsync({ array: users, predicate: isActiveAsync });
    expect(index).toBe(1);
  });

  test('handles async predicate that rejects', async () => {
    const numbers = [1, 2, 3, 4, 5];
    const failingPredicate = async (_n: number) => {
      throw new Error('Test error');
    };
    await expect(arrayFindIndexAsync({ array: numbers, predicate: failingPredicate })).rejects.toThrow('Test error');
  });

  test('stops execution after finding first match', async () => {
    const numbers = [1, 2, 3, 4, 5];
    let callCount = 0;
    const countingPredicate = async (n: number) => {
      callCount++;
      return n > 2;
    };
    const index = await arrayFindIndexAsync({ array: numbers, predicate: countingPredicate });
    expect(index).toBe(3);
    expect(callCount).toBe(4); // Called for indices 0, 1, 2, 3
  });
});
