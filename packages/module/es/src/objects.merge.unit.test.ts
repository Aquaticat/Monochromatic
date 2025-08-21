import {
  logtapeConfiguration,
  logtapeConfigure,
  objectsMerge,
} from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration(),);

describe('objectsMerge', () => {
  test('returns consensus value for same property values', () => {
    const result = objectsMerge({ objs: [{ a: 1, }, { a: 1, },], },);
    expect(result,).toEqual({ a: 1, },);
  });

  test('merges different properties from multiple objects', () => {
    const result = objectsMerge({ objs: [{ a: 1, }, { b: 2, },], },);
    expect(result,).toEqual({ a: 1, b: 2, },);
  });

  test('merges multiple different properties', () => {
    const result = objectsMerge({
      objs: [
        { a: 1, c: 3, },
        { b: 2, d: 4, },
        { e: 5, },
      ],
    },);
    expect(result,).toEqual({ a: 1, b: 2, c: 3, d: 4, e: 5, },);
  });

  test('throws error for conflicting number values without rules', () => {
    expect(() => {
      objectsMerge({ objs: [{ a: 1, }, { a: 2, },], },);
    },)
      .toThrow('No resolution rule provided for number conflicts on property "a"',);
  });

  test('throws error for mixing different types', () => {
    expect(() => {
      objectsMerge({ objs: [{ a: 1, }, { a: 'string', },], },);
    },)
      .toThrow('Cannot merge property "a": mixed types found: number, string',);
  });

  test('throws error for functions with incompatible parameters', () => {
    expect(() => {
      objectsMerge({ objs: [{ a: () => 1, }, { a: (c: string,) => c, },], },);
    },)
      .toThrow('fn params incompatible',);
  });

  test('allows functions with compatible parameters using default rule', () => {
    const fn1 = (x: number,) => x * 2;
    const fn2 = (y: number,) => y + 1;
    const result = objectsMerge({ objs: [{ a: fn1, }, { a: fn2, },], },);

    expect(typeof result.a,).toBe('function',);
    const combinedFn = result.a as (x: number,) => number[];
    const fnResult = combinedFn(5,);
    expect(fnResult,).toEqual([10, 6,],); // [5*2, 5+1]
  });

  test('custom function resolution rule returns function count', () => {
    const result = objectsMerge({
      objs: [{ a: (c: string,) => c, }, { a: () => true, },],
      rules: {
        function: ({ values, },) => values.length,
      },
    },);

    expect(result.a,).toBe(2,);
  });

  test('preserves single function without wrapping', () => {
    const fn = () => 42;
    const result = objectsMerge({ objs: [{ a: fn, },], },);

    expect(result.a,).toBe(fn,);
    expect((result.a as () => number)(),).toBe(42,);
  });

  test('custom number rule resolves conflicts', () => {
    const result = objectsMerge({
      objs: [{ a: 1, }, { a: 2, },],
      rules: {
        number: ({ values, },) => Math.max(...values,),
      },
    },);

    expect(result.a,).toBe(2,);
  });

  test('custom string rule resolves conflicts', () => {
    const result = objectsMerge({
      objs: [{ name: 'John', }, { name: 'Jane', },],
      rules: {
        string: ({ values, },) => values.join(' & ',),
      },
    },);

    expect(result.name,).toBe('John & Jane',);
  });

  test('custom boolean rule resolves conflicts', () => {
    const result = objectsMerge({
      objs: [{ flag: true, }, { flag: false, },],
      rules: {
        boolean: ({ values, },) => values.some(v => v), // OR operation
      },
    },);

    expect(result.flag,).toBe(true,);
  });

  test('throws error for empty objects array', () => {
    expect(() => {
      objectsMerge({ objs: [], },);
    },)
      .toThrow('objs array cannot be empty',);
  });

  test('returns copy of single object', () => {
    const obj = { a: 1, b: 2, };
    const result = objectsMerge({ objs: [obj,], },);

    expect(result,).toEqual(obj,);
    expect(result,).not.toBe(obj,); // Different reference
  });

  test('handles complex nested objects with consensus', () => {
    const obj1 = { nested: { x: 1, y: 2, }, };
    const obj2 = { nested: { x: 1, y: 2, }, };
    const result = objectsMerge({ objs: [obj1, obj2,], },);

    expect(result,).toEqual({ nested: { x: 1, y: 2, }, },);
  });

  test('throws error for different nested objects without rules', () => {
    const obj1 = { nested: { x: 1, }, };
    const obj2 = { nested: { x: 2, }, };

    expect(() => {
      objectsMerge({ objs: [obj1, obj2,], },);
    },)
      .toThrow('No resolution rule provided for object conflicts on property "nested"',);
  });

  test('recursively merges objects by default', () => {
    const result = objectsMerge({
      objs: [
        { config: { theme: 'dark', }, },
        { config: { size: 'large', }, },
      ],
    },);

    expect(result,).toEqual({ config: { theme: 'dark', size: 'large', }, },);
  });

  test('deeply nested object merging works recursively', () => {
    const result = objectsMerge({
      objs: [
        { user: { profile: { name: 'John', }, settings: { theme: 'dark', }, }, },
        { user: { profile: { age: 25, }, settings: { lang: 'en', }, }, },
      ],
    },);

    expect(result,).toEqual({
      user: {
        profile: { name: 'John', age: 25, },
        settings: { theme: 'dark', lang: 'en', },
      },
    },);
  });

  test('object merging throws error on conflicting primitive values in nested objects', () => {
    expect(() => {
      objectsMerge({
        objs: [
          { user: { name: 'John', }, },
          { user: { name: 'Jane', }, },
        ],
      },);
    },)
      .toThrow('No resolution rule provided for string conflicts on property "name"',);
  });

  test('handles undefined values correctly', () => {
    const result = objectsMerge({
      objs: [
        { a: undefined, },
        { a: undefined, b: 'value', },
      ],
    },);

    expect(result,).toEqual({ a: undefined, b: 'value', },);
  });

  test('throws error for conflicting undefined and null', () => {
    expect(() => {
      objectsMerge({ objs: [{ a: null, }, { a: undefined, },], },);
    },)
      .toThrow('Cannot merge property "a": mixed types found: object, undefined',);
  });

  test('handles multiple objects with mixed scenarios', () => {
    const fn1 = () => 'hello';
    const fn2 = () => 'world';

    const result = objectsMerge({
      objs: [
        { a: 1, greet: fn1, },
        { a: 1, b: 2, },
        { c: 3, greet: fn2, },
        { d: 4, },
      ],
    },);

    expect(result.a,).toBe(1,);
    expect(result.b,).toBe(2,);
    expect(result.c,).toBe(3,);
    expect(result.d,).toBe(4,);

    const combinedGreet = result.greet as () => string[];
    expect(combinedGreet(),).toEqual(['hello', 'world',],);
  });

  test('custom object rule handles nested merging', () => {
    const result = objectsMerge({
      objs: [
        { config: { theme: 'dark', }, },
        { config: { size: 'large', }, },
      ],
      rules: {
        object: ({ key, values, },) => {
          // Simple object merge for this test
          return Object.assign({}, ...values as object[],);
        },
      },
    },);

    expect(result,).toEqual({ config: { theme: 'dark', size: 'large', }, },);
  });

  test('bigint values work with custom rules', () => {
    const result = objectsMerge({
      objs: [{ count: 100n, }, { count: 200n, },],
      rules: {
        bigint: ({ values, },) => values.reduce((a, b,) => a + b, 0n,),
      },
    },);

    expect(result.count,).toBe(300n,);
  });

  test('symbol values work with custom rules', () => {
    const sym1 = Symbol('test1',);
    const sym2 = Symbol('test2',);

    const result = objectsMerge({
      objs: [{ id: sym1, }, { id: sym2, },],
      rules: {
        symbol: ({ values, },) => values[0], // Use first symbol
      },
    },);

    expect(result.id,).toBe(sym1,);
  });

  test('handles parameter-less functions correctly', () => {
    const fn1 = () => 1;
    const fn2 = () => 2;
    const result = objectsMerge({ objs: [{ a: fn1, }, { a: fn2, },], },);

    expect(typeof result.a,).toBe('function',);
    const combinedFn = result.a as () => number[];
    expect(combinedFn(),).toEqual([1, 2,],);
  });

  test('single parameter functions are compatible', () => {
    const fn1 = (x: any,) => x + 1;
    const fn2 = (y: any,) => y * 2;
    const result = objectsMerge({ objs: [{ transform: fn1, }, { transform: fn2, },], },);

    const combinedFn = result.transform as (x: number,) => number[];
    const fnResult = combinedFn(5,);
    expect(fnResult,).toEqual([6, 10,],); // [5+1, 5*2]
  });
});
