import {
  describe,
  expect,
  test,
} from 'vitest';

import { echo } from '@monochromatic-dev/module-es';

describe('echo', () => {
  test('yields the same value infinitely', () => {
    const ones = echo(1);
    expect(ones.next().value).toBe(1);
    expect(ones.next().value).toBe(1);
    expect(ones.next().value).toBe(1);
    expect(ones.next().done).toBe(false);
  });

  test('works with different types', () => {
    const greetings = echo('hello');
    expect(greetings.next().value).toBe('hello');
    expect(greetings.next().value).toBe('hello');

    const booleans = echo(true);
    expect(booleans.next().value).toBe(true);
    expect(booleans.next().value).toBe(true);

    const nulls = echo(null);
    expect(nulls.next().value).toBe(null);
  });

  test('works with objects and arrays', () => {
    const obj = { key: 'value' };
    const objects = echo(obj);
    expect(objects.next().value).toBe(obj);
    expect(objects.next().value).toBe(obj);

    const arr = [1, 2, 3];
    const arrays = echo(arr);
    expect(arrays.next().value).toBe(arr);
    expect(arrays.next().value).toBe(arr);
  });

  test('can be used with Array.from to create finite arrays', () => {
    const ones = echo(1);
    const firstFive = [];
    for (let i = 0; i < 5; i++) {
      firstFive.push(ones.next().value);
    }
    expect(firstFive).toEqual([1, 1, 1, 1, 1]);
  });

  test('creates independent generators', () => {
    const ones = echo(1);
    const twos = echo(2);

    expect(ones.next().value).toBe(1);
    expect(twos.next().value).toBe(2);
    expect(ones.next().value).toBe(1);
    expect(twos.next().value).toBe(2);
  });

  test('generator never ends', () => {
    const endless = echo(42);
    for (let i = 0; i < 100; i++) {
      const result = endless.next();
      expect(result.value).toBe(42);
      expect(result.done).toBe(false);
    }
  });

  test('can be used in for-of loop with break', () => {
    const values: number[] = [];
    let count = 0;

    for (const value of echo(7)) {
      values.push(value);
      count++;
      if (count >= 3) break;
    }

    expect(values).toEqual([7, 7, 7]);
  });
});
