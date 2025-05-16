import {
  arrayOf,
  genOf,
  logtapeConfiguration,
  logtapeConfigure,
} from '@monochromatic-dev/module-es/.js';
import {
  describe,
  expect,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration());

describe('arrayOf', () => {
  test('returns an array with the provided elements', () => {
    expect(arrayOf(1, 2, 3)).toEqual([1, 2, 3]);
    expect(arrayOf('a', 'b', 'c')).toEqual(['a', 'b', 'c']);
  });

  test('works with mixed types', () => {
    expect(arrayOf(1, 'a', true, null)).toEqual([1, 'a', true, null]);
  });

  test('works with no arguments', () => {
    expect(arrayOf()).toEqual([]);
  });

  test('preserves object references', () => {
    const obj = { a: 1 };
    const arr = [1, 2];
    const result = arrayOf(obj, arr);
    expect(result[0]).toBe(obj);
    expect(result[1]).toBe(arr);
  });
});

describe('genOf', () => {
  test('yields each provided element', () => {
    const generator = genOf(1, 2, 3);

    expect(generator.next().value).toBe(1);
    expect(generator.next().value).toBe(2);
    expect(generator.next().value).toBe(3);
    expect(generator.next().done).toBe(true);
  });

  test('works with mixed types', () => {
    const generator = genOf(1, 'a', true);

    expect(generator.next().value).toBe(1);
    expect(generator.next().value).toBe('a');
    expect(generator.next().value).toBe(true);
    expect(generator.next().done).toBe(true);
  });

  test('works with no arguments', () => {
    const generator = genOf();
    expect(generator.next().done).toBe(true);
  });

  test('preserves object references', () => {
    const obj = { a: 1 };
    const arr = [1, 2];
    const generator = genOf(obj, arr);

    expect(generator.next().value).toBe(obj);
    expect(generator.next().value).toBe(arr);
    expect(generator.next().done).toBe(true);
  });

  test('can be iterated with for-of', () => {
    const values = [5, 'test', { x: 1 }];
    const result: any[] = [];

    for (const item of genOf(...values)) {
      result.push(item);
    }

    expect(result).toEqual(values);
  });
});
