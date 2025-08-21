import {
  arrayFindIndex,
  logtapeConfiguration,
  logtapeConfigure,
} from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration());

describe(arrayFindIndex, () => {
  test('finds index of first element that satisfies predicate', () => {
    const numbers = [1, 2, 3, 4, 5];
    const isEven = (n: number) => n % 2 === 0;
    const index = arrayFindIndex(numbers, isEven);
    expect(index).toBe(1);
  });

  test('returns -1 when no element satisfies the predicate', () => {
    const numbers = [1, 3, 5, 7, 9];
    const isEven = (n: number) => n % 2 === 0;
    const index = arrayFindIndex(numbers, isEven);
    expect(index).toBe(-1);
  });

  test('returns -1 for empty array', () => {
    const empty: number[] = [];
    const isEven = (n: number) => n % 2 === 0;
    const index = arrayFindIndex(empty, isEven);
    expect(index).toBe(-1);
  });

  test('returns 0 when first element satisfies the predicate', () => {
    const numbers = [2, 1, 3, 4, 5];
    const isEven = (n: number) => n % 2 === 0;
    const index = arrayFindIndex(numbers, isEven);
    expect(index).toBe(0);
  });

  test('returns last index when only last element satisfies the predicate', () => {
    const numbers = [1, 3, 5, 7, 2];
    const isEven = (n: number) => n % 2 === 0;
    const index = arrayFindIndex(numbers, isEven);
    expect(index).toBe(4);
  });

  test('works with string arrays', () => {
    const strings = ['hello', 'world', 'test', 'example'];
    const isLong = (s: string) => s.length > 4;
    const index = arrayFindIndex(strings, isLong);
    expect(index).toBe(0);
  });

  test('works with object arrays', () => {
    const users = [
      { id: 1, name: 'Alice', active: false },
      { id: 2, name: 'Bob', active: true },
      { id: 3, name: 'Charlie', active: false },
    ];
    const isActive = (user: { active: boolean }) => user.active;
    const index = arrayFindIndex(users, isActive);
    expect(index).toBe(1);
  });

  test('stops execution after finding first match', () => {
    const numbers = [1, 2, 3, 4, 5];
    let callCount = 0;
    const countingPredicate = (n: number) => {
      callCount++;
      return n > 2;
    };
    const index = arrayFindIndex(numbers, countingPredicate);
    expect(index).toBe(3);
    expect(callCount).toBe(4); // Called for indices 0, 1, 2, 3
  });
});