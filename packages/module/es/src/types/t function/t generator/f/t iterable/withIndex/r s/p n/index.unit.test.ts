import { types, } from '@monochromatic-dev/module-es';
import {
  describe,
  test,
} from 'vitest';

const $ = types.function.generator.from.iterable.withIndex.sync.named.$;

describe($, () => {
  test('yields elements with their indices for arrays', ({ expect, },) => {
    const result = [...$({ myIterable: ['a', 'b', 'c',], },),];

    expect(result,).toEqual([
      { element: 'a', index: 0, },
      { element: 'b', index: 1, },
      { element: 'c', index: 2, },
    ],);
  });

  test('yields elements with their indices for strings', ({expect}) => {
    const result = [...$({ myIterable: 'hello', },),];

    expect(result,).toEqual([
      { element: 'h', index: 0, },
      { element: 'e', index: 1, },
      { element: 'l', index: 2, },
      { element: 'l', index: 3, },
      { element: 'o', index: 4, },
    ],);
  });

  test('yields elements with their indices for numbers', ({expect}) => {
    const result = [...$({ myIterable: [10, 20, 30,], },),];

    expect(result,).toEqual([
      { element: 10, index: 0, },
      { element: 20, index: 1, },
      { element: 30, index: 2, },
    ],);
  });

  test('yields nothing for empty iterable', ({expect}) => {
    const result = [...$({ myIterable: [], },),];

    expect(result,).toEqual([],);
  });

  test('works with Set', ({expect}) => {
    const result = [...$({ myIterable: new Set(['x', 'y', 'z',],), },),];

    expect(result,).toEqual([
      { element: 'x', index: 0, },
      { element: 'y', index: 1, },
      { element: 'z', index: 2, },
    ],);
  });

  test('works with Map', ({expect}) => {
    const map = new Map([['key1', 'value1',], ['key2', 'value2',],],);
    const result = [...$({ myIterable: map, },),];

    expect(result,).toEqual([
      { element: ['key1', 'value1',], index: 0, },
      { element: ['key2', 'value2',], index: 1, },
    ],);
  });

  test('lazy evaluation - generator only iterates when consumed', ({expect}) => {
    let callCount = 0;
    function* lazyIterable() {
      callCount++;
      yield 'first';
      callCount++;
      yield 'second';
    }

    const gen = $({ myIterable: lazyIterable(), },);

    // Generator hasn't been consumed yet
    expect(callCount,).toBe(0,);

    // Consume first element
    const first = gen.next();
    expect(first.value,).toEqual({ element: 'first', index: 0, },);
    expect(callCount,).toBe(1,);

    // Consume second element
    const second = gen.next();
    expect(second.value,).toEqual({ element: 'second', index: 1, },);
    expect(callCount,).toBe(2,);

    // Generator is done
    const done = gen.next();
    expect(done.done,).toBe(true,);
  });
},);
