import { types, } from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  test,
} from 'bun:test';

const {$} = types.function.generator.from.iterable.partition.sync.named;

describe($, () => {
  test('yields items with pass decision for items that pass the predicate', () => {
    const numbers = [1, 2, 3, 4, 5,];
    const results = [];

    for (const result of $({
      predicate: (n: number,) => n % 2 === 0,
      iterable: numbers,
    },)) {
      results.push(result,);
    }

    expect(results,).toEqual([
      { decision: 'fail', item: 1, },
      { decision: 'pass', item: 2, },
      { decision: 'fail', item: 3, },
      { decision: 'pass', item: 4, },
      { decision: 'fail', item: 5, },
    ],);
  });

  test('yields items with thrown decision tuple when predicate throws', () => {
    const items = ['1', 'invalid', '3',];
    const results = [];

    for (const result of $({
      predicate: (s: string,) => {
        const num = Number.parseInt(s, 10,);
        if (Number.isNaN(num,))
          throw new Error('Invalid number',);
        return num > 1;
      },
      iterable: items,
    },)) {
      results.push(result,);
    }

    expect(results,).toHaveLength(3,);
    expect(results[0],).toEqual({ decision: 'fail', item: '1', },);
    const thrownResult = results[1];
    if (thrownResult === undefined) throw new Error('expected result at index 1');
    expect(thrownResult.item,).toBe('invalid',);
    expect(Array.isArray(thrownResult.decision,),).toBe(true,);
    const decisionTuple = thrownResult.decision as unknown[];
    expect(decisionTuple[0],).toBe('thrown',);
    expect(decisionTuple[1],).toBeInstanceOf(Error,);
    expect((decisionTuple[1] as Error).message,).toBe(
      'Invalid number',
    );
    expect(results[2],).toEqual({ decision: 'pass', item: '3', },);
  });

  test('handles empty iterables', () => {
    const results = [];

    for (const result of $({
      predicate: (n: number,) => n > 0,
      iterable: [],
    },)) {
      results.push(result,);
    }

    expect(results,).toEqual([],);
  });

  test('handles all items passing', () => {
    const numbers = [2, 4, 6,];
    const results = [];

    for (const result of $({
      predicate: (n: number,) => n % 2 === 0,
      iterable: numbers,
    },)) {
      results.push(result,);
    }

    expect(results,).toEqual([
      { decision: 'pass', item: 2, },
      { decision: 'pass', item: 4, },
      { decision: 'pass', item: 6, },
    ],);
  });

  test('handles all items failing', () => {
    const numbers = [1, 3, 5,];
    const results = [];

    for (const result of $({
      predicate: (n: number,) => n % 2 === 0,
      iterable: numbers,
    },)) {
      results.push(result,);
    }

    expect(results,).toEqual([
      { decision: 'fail', item: 1, },
      { decision: 'fail', item: 3, },
      { decision: 'fail', item: 5, },
    ],);
  });

  test('handles all items throwing', () => {
    const items = ['a', 'b', 'c',];
    const results = [];

    for (const result of $({
      predicate: (s: string,) => {
        const num = Number.parseInt(s, 10,);
        if (Number.isNaN(num,))
          throw new Error('Invalid',);
        return num > 0;
      },
      iterable: items,
    },)) {
      results.push(result,);
    }

    expect(results,).toHaveLength(3,);

    for (const [resultIndex, item,] of items.entries()) {
      const result = results[resultIndex];
      if (result === undefined) throw new Error(`expected result at index ${String(resultIndex)}`);
      expect(result.item,).toBe(item,);
      expect(Array.isArray(result.decision,),).toBe(true,);
      const decision = result.decision as unknown[];
      expect(decision[0],).toBe('thrown',);
      expect(decision[1],).toBeInstanceOf(Error,);
      expect((decision[1] as Error).message,).toBe('Invalid',);
    }
  });

  test('preserves item type information', () => {
    type Item = { id: number; name: string; };
    const items: Item[] = [
      { id: 1, name: 'Alice', },
      { id: 2, name: 'Bob', },
    ];

    const results = [];

    for (const result of $({
      predicate: (item: Item,) => item.id % 2 === 0,
      iterable: items,
    },)) {
      results.push(result,);
    }

    expect(results,).toEqual([
      { decision: 'fail', item: { id: 1, name: 'Alice', }, },
      { decision: 'pass', item: { id: 2, name: 'Bob', }, },
    ],);
  });

  test('works with generator iterables', () => {
    function* numbers() {
      yield 1;
      yield 2;
      yield 3;
    }

    const results = [];

    for (const result of $({
      predicate: (n: number,) => n % 2 === 0,
      iterable: numbers(),
    },)) {
      results.push(result,);
    }

    expect(results,).toEqual([
      { decision: 'fail', item: 1, },
      { decision: 'pass', item: 2, },
      { decision: 'fail', item: 3, },
    ],);
  });

  test('works with Set iterables', () => {
    const numberSet = new Set([1, 2, 3, 4,],);
    const results = [];

    for (const result of $({
      predicate: (n: number,) => n % 2 === 0,
      iterable: numberSet,
    },)) {
      results.push(result,);
    }

    expect(results,).toEqual([
      { decision: 'fail', item: 1, },
      { decision: 'pass', item: 2, },
      { decision: 'fail', item: 3, },
      { decision: 'pass', item: 4, },
    ],);
  });

  test('captures different error types in thrown decision tuple', () => {
    const items = [1, 2, 3,];
    const results = [];
    const customError = new TypeError('Custom error',);

    for (const result of $({
      predicate: (n: number,) => {
        if (n === 2)
          throw customError;
        return n > 2;
      },
      iterable: items,
    },)) {
      results.push(result,);
    }

    expect(results,).toHaveLength(3,);
    expect(results[0],).toEqual({ decision: 'fail', item: 1, },);
    const errorResult = results[1];
    if (errorResult === undefined) throw new Error('expected result at index 1');
    expect(errorResult.item,).toBe(2,);
    expect(Array.isArray(errorResult.decision,),).toBe(true,);
    const errorDecision = errorResult.decision as unknown[];
    expect(errorDecision[0],).toBe('thrown',);
    expect(errorDecision[1],).toBe(customError,);
    expect(results[2],).toEqual({ decision: 'pass', item: 3, },);
  });

  test('captures non-Error thrown values in decision tuple', () => {
    const items = [1, 2, 3,];
    const results = [];
    const thrownValue = 'string error';

    for (const result of $({
      predicate: (n: number,) => {
        if (n === 2) {
          // oxlint-disable-next-line typescript/only-throw-error -- Testing non-Error throws
          throw thrownValue;
        }
        return n > 2;
      },
      iterable: items,
    },)) {
      results.push(result,);
    }

    expect(results,).toHaveLength(3,);
    expect(results[0],).toEqual({ decision: 'fail', item: 1, },);
    const strErrorResult = results[1];
    if (strErrorResult === undefined) throw new Error('expected result at index 1');
    expect(strErrorResult.item,).toBe(2,);
    expect(Array.isArray(strErrorResult.decision,),).toBe(true,);
    const strDecision = strErrorResult.decision as unknown[];
    expect(strDecision[0],).toBe('thrown',);
    expect(strDecision[1],).toBe(thrownValue,);
    expect(results[2],).toEqual({ decision: 'pass', item: 3, },);
  });
},);
