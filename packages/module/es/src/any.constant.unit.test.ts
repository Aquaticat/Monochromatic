import {
  describe,
  expect,
  test,
} from 'vitest';

import { constant, } from '@monochromatic-dev/module-es';

describe(constant, () => {
  test('returns a function that always returns the same value', () => {
    const alwaysFive = constant(5,);
    expect(alwaysFive(),).toBe(5,);
    expect(alwaysFive(),).toBe(5,);
    expect(alwaysFive(),).toBe(5,);
  });

  test('ignores any arguments passed to the returned function', () => {
    const alwaysHello = constant('hello',);
    // @ts-expect-error - Testing that arguments are ignored
    expect(alwaysHello(1, 2, 3, 'ignored',),).toBe('hello',);
  });

  test('works with different types', () => {
    const alwaysTrue = constant(true,);
    expect(alwaysTrue(),).toBe(true,);

    const alwaysNull = constant(null,);
    expect(alwaysNull(),).toBeNull();

    const alwaysUndefined = constant(undefined,);
    const undefinedResult = alwaysUndefined();
    expect(undefinedResult,).toBeUndefined();

    const alwaysObject = constant({ key: 'value', },);
    const obj = { key: 'value', };
    const alwaysSpecificObject = constant(obj,);
    expect(alwaysSpecificObject(),).toBe(obj,);
  });

  test('works with arrays', () => {
    const arr = [1, 2, 3,];
    const alwaysArray = constant(arr,);
    expect(alwaysArray(),).toBe(arr,);
    expect(alwaysArray(),).toEqual([1, 2, 3,],);
  });

  test('can be used in functional programming scenarios', () => {
    const numbers = [1, 2, 3,];
    const result = numbers.map(constant(0,),);
    expect(result,).toEqual([0, 0, 0,],);
  });

  test('creates closure over the value', () => {
    let value = 'initial';
    const constantFn = constant(value,);
    value = 'changed';
    expect(constantFn(),).toBe('initial',);
  });
},);
