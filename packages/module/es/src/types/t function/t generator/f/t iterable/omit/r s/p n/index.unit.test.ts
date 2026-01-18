import { types, } from '@monochromatic-dev/module-es';
import {
  describe,
  test,
} from 'vitest';

const $ = types.function.generator.from.iterable.omit.sync.named.$;

describe($, () => {
  test('omits items in the exclusion set', ({ expect, },) => {
    const numbers = [1, 2, 3, 4, 5,];
    const toOmit = new Set([2, 4,],);
    const result = [...$({ iterable: numbers, toOmit, },),];

    expect(result,).toEqual([1, 3, 5,],);
  });

  test('returns all items when exclusion set is empty', ({ expect, },) => {
    const numbers = [1, 2, 3,];
    const result = [...$({ iterable: numbers, toOmit: new Set(), },),];

    expect(result,).toEqual([1, 2, 3,],);
  });

  test('returns empty when all items are in exclusion set', ({ expect, },) => {
    const numbers = [1, 2, 3,];
    const toOmit = new Set([1, 2, 3,],);
    const result = [...$({ iterable: numbers, toOmit, },),];

    expect(result,).toEqual([],);
  });

  test('handles string items', ({ expect, },) => {
    const words = ['apple', 'banana', 'cherry',];
    const toOmit = new Set(['banana',],);
    const result = [...$({ iterable: words, toOmit, },),];

    expect(result,).toEqual(['apple', 'cherry',],);
  });

  test('throws when toOmit contains items not in the iterable', ({ expect, },) => {
    const numbers = [1, 2, 3,];
    const toOmit = new Set([4, 5,],);

    expect(() => [...$({ iterable: numbers, toOmit, },),],).toThrow('Key not found in iterable: 4',);
  });

  test('does not throw when strict is false and toOmit contains missing items', ({ expect, },) => {
    const numbers = [1, 2, 3,];
    const toOmit = new Set([2, 4, 5,],);
    const result = [...$({ iterable: numbers, toOmit, strict: false, },),];

    expect(result,).toEqual([1, 3,],);
  });

  test('strict: false omits existing items and ignores missing', ({ expect, },) => {
    const words = ['apple', 'banana', 'cherry',];
    const toOmit = new Set(['banana', 'mango', 'grape',],);
    const result = [...$({ iterable: words, toOmit, strict: false, },),];

    expect(result,).toEqual(['apple', 'cherry',],);
  });

  test('strict: false with all missing keys returns all items', ({ expect, },) => {
    const numbers = [1, 2, 3,];
    const toOmit = new Set([99, 100,],);
    const result = [...$({ iterable: numbers, toOmit, strict: false, },),];

    expect(result,).toEqual([1, 2, 3,],);
  });

  test('preserves order of items', ({ expect, },) => {
    const numbers = [5, 3, 1, 4, 2,];
    const toOmit = new Set([3, 4,],);
    const result = [...$({ iterable: numbers, toOmit, },),];

    expect(result,).toEqual([5, 1, 2,],);
  });

  test('works with generator iterables', ({ expect, },) => {
    function* generateNumbers(): Generator<number> {
      yield 1;
      yield 2;
      yield 3;
    }
    const toOmit = new Set([2,],);
    const result = [...$({ iterable: generateNumbers(), toOmit, },),];

    expect(result,).toEqual([1, 3,],);
  });
},);
