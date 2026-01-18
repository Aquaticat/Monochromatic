import { types, } from '@monochromatic-dev/module-es';
import {
  describe,
  test,
} from 'vitest';

const $ = types.function.generator.from.iterable.pick.sync.named.$;

describe($, () => {
  test('picks items in the inclusion set', ({ expect, },) => {
    const numbers = [1, 2, 3, 4, 5,];
    const toPick = new Set([2, 4,],);
    const result = [...$({ iterable: numbers, toPick, },),];

    expect(result,).toEqual([2, 4,],);
  });

  test('returns empty when inclusion set is empty', ({ expect, },) => {
    const numbers = [1, 2, 3,];
    const result = [...$({ iterable: numbers, toPick: new Set(), },),];

    expect(result,).toEqual([],);
  });

  test('returns all items when all are in inclusion set', ({ expect, },) => {
    const numbers = [1, 2, 3,];
    const toPick = new Set([1, 2, 3,],);
    const result = [...$({ iterable: numbers, toPick, },),];

    expect(result,).toEqual([1, 2, 3,],);
  });

  test('handles string items', ({ expect, },) => {
    const words = ['apple', 'banana', 'cherry',];
    const toPick = new Set(['banana', 'cherry',],);
    const result = [...$({ iterable: words, toPick, },),];

    expect(result,).toEqual(['banana', 'cherry',],);
  });

  test('throws when toPick contains items not in the iterable', ({ expect, },) => {
    const numbers = [1, 2, 3,];
    const toPick = new Set([2, 4, 5,],);

    expect(() => [...$({ iterable: numbers, toPick, },),],).toThrow('Key not found in iterable: 4',);
  });

  test('does not throw when strict is false and toPick contains missing items', ({ expect, },) => {
    const numbers = [1, 2, 3,];
    const toPick = new Set([2, 4, 5,],);
    const result = [...$({ iterable: numbers, toPick, strict: false, },),];

    expect(result,).toEqual([2,],);
  });

  test('strict: false returns only existing items from toPick', ({ expect, },) => {
    const words = ['apple', 'banana', 'cherry',];
    const toPick = new Set(['banana', 'mango', 'grape',],);
    const result = [...$({ iterable: words, toPick, strict: false, },),];

    expect(result,).toEqual(['banana',],);
  });

  test('strict: false with all missing keys returns empty array', ({ expect, },) => {
    const numbers = [1, 2, 3,];
    const toPick = new Set([99, 100,],);
    const result = [...$({ iterable: numbers, toPick, strict: false, },),];

    expect(result,).toEqual([],);
  });

  test('preserves order of items from iterable', ({ expect, },) => {
    const numbers = [5, 3, 1, 4, 2,];
    const toPick = new Set([1, 2,],);
    const result = [...$({ iterable: numbers, toPick, },),];

    expect(result,).toEqual([1, 2,],);
  });

  test('works with generator iterables', ({ expect, },) => {
    function* generateNumbers(): Generator<number> {
      yield 1;
      yield 2;
      yield 3;
    }
    const toPick = new Set([2, 3,],);
    const result = [...$({ iterable: generateNumbers(), toPick, },),];

    expect(result,).toEqual([2, 3,],);
  });
},);
