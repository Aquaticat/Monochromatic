import {
  equal,
  equalAsync,
  isPrimitive,
  logtapeConfiguration,
  logtapeConfigure,
} from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration());

describe(isPrimitive, () => {
  test('identifies primitive values', () => {
    expect(isPrimitive(undefined)).toBe(true);
    expect(isPrimitive(null)).toBe(true);
    expect(isPrimitive(true)).toBe(true);
    expect(isPrimitive(false)).toBe(true);
    expect(isPrimitive('string')).toBe(true);
    expect(isPrimitive('')).toBe(true);
    expect(isPrimitive(123)).toBe(true);
    expect(isPrimitive(-0)).toBe(true);
    expect(isPrimitive(Number.NaN)).toBe(true);
    expect(isPrimitive(123n)).toBe(true);
    expect(isPrimitive(Symbol('sym'))).toBe(true);
  });

  test('identifies BigInt object wrapper as primitive', () => {
    expect(isPrimitive(Object(123n))).toBe(true);
  });

  test('identifies non-primitive values', () => {
    expect(isPrimitive({})).toBe(false);
    expect(isPrimitive([])).toBe(false);
    expect(isPrimitive(new Date())).toBe(false);
    expect(isPrimitive(new Map())).toBe(false);
    expect(isPrimitive(new Set())).toBe(false);
    expect(isPrimitive(() => {
      // noop
    }))
      .toBe(false);
    expect(isPrimitive(new Error('noop'))).toBe(false);
  });
});

describe(equal, () => {
  test('compares primitive values', () => {
    expect(equal(5, 5)).toBe(true);
    expect(equal('test', 'test')).toBe(true);
    expect(equal(true, true)).toBe(true);
    expect(equal(null, null)).toBe(true);
    expect(equal(undefined, undefined)).toBe(true);
    expect(equal(123n, 123n)).toBe(true);

    expect(equal(5, 6)).toBe(false);
    expect(equal('test', 'other')).toBe(false);
    expect(equal(true, false)).toBe(false);
    expect(equal(null, undefined)).toBe(false);
    expect(equal(123n, 124n)).toBe(false);
  });

  test('handles NaN comparisons', () => {
    expect(equal(Number.NaN, Number.NaN)).toBe(true);
    expect(equal(Number.NaN, 5)).toBe(false);
  });

  test('handles Symbol comparisons', () => {
    const sym1 = Symbol('test');
    const sym2 = Symbol('test');
    expect(equal(sym1, sym1)).toBe(true);
    expect(equal(sym1, sym2)).toBe(false);
  });

  test('handles different types correctly', () => {
    expect(equal(5, '5')).toBe(false);
    expect(equal(0, false)).toBe(false);
    expect(equal([], {})).toBe(false);
    expect(equal(new Date(), {})).toBe(false);
  });

  test('compares arrays', () => {
    expect(equal([], [])).toBe(true);
    expect(equal([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(equal(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(equal([[1], 2], [[1], 2])).toBe(true);

    expect(equal([1, 2, 3], [1, 2])).toBe(false);
    expect(equal([1, 2, 3], [3, 2, 1])).toBe(false);
  });

  test('compares objects', () => {
    expect(equal({}, {})).toBe(true);
    expect(equal({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
    expect(equal({ a: { b: 2 } }, { a: { b: 2 } })).toBe(true);

    expect(equal({ a: 1, b: 2 }, { a: 1, b: 3 })).toBe(false);
    expect(equal({ a: 1, b: 2 }, { a: 1 })).toBe(false);
  });

  test('compares dates', () => {
    const date1 = new Date('2023-01-01');
    const date2 = new Date('2023-01-01');
    const date3 = new Date('2023-02-01');

    expect(equal(date1, date2)).toBe(true);
    expect(equal(date1, date3)).toBe(false);
  });

  test('compares sets', () => {
    const set1 = new Set([1, 2, 3]);
    const set2 = new Set([1, 2, 3]);
    const set3 = new Set([3, 2, 1]);
    const set4 = new Set([1, 2]);

    expect(equal(set1, set2)).toBe(true);
    expect(equal(set1, set3)).toBe(true); // Same elements in different order
    expect(equal(set1, set4)).toBe(false);
  });

  test('compares maps', () => {
    const map1 = new Map([['a', 1], ['b', 2]]);
    const map2 = new Map([['a', 1], ['b', 2]]);
    const map3 = new Map([['b', 2], ['a', 1]]);
    const map4 = new Map([['a', 1], ['b', 3]]);

    expect(equal(map1, map2)).toBe(true);
    expect(equal(map1, map3)).toBe(true); // Same entries in different order
    expect(equal(map1, map4)).toBe(false);
  });

  test('compares errors', () => {
    const error1 = new Error('test');
    const error2 = new Error('test');
    const error3 = new Error('different');
    const error4 = new TypeError('test');

    expect(equal(error1, error2)).toBe(true);
    expect(equal(error1, error3)).toBe(false);
    expect(equal(error1, error4)).toBe(false);
  });

  test('compares regexps', () => {
    expect(equal(/test/g, /test/g)).toBe(true);
    expect(equal(/test/g, /test/i)).toBe(false);
    expect(equal(/test/g, /other/g)).toBe(false);
  });

  test('handles nested complex structures', () => {
    const obj1 = {
      arr: [1, 2, { key: 'value' }],
      map: new Map([['key', { inner: 'value' }]]),
      date: new Date('2023-01-01'),
    };

    const obj2 = {
      arr: [1, 2, { key: 'value' }],
      map: new Map([['key', { inner: 'value' }]]),
      date: new Date('2023-01-01'),
    };

    const obj3 = {
      arr: [1, 2, { key: 'different' }],
      map: new Map([['key', { inner: 'value' }]]),
      date: new Date('2023-01-01'),
    };

    expect(equal(obj1, obj2)).toBe(true);
    expect(equal(obj1, obj3)).toBe(false);
  });

  test('throws for WeakMap and WeakSet', () => {
    expect(() => equal(new WeakMap(), new WeakMap())).toThrow(TypeError);
    expect(() => equal(new WeakSet(), new WeakSet())).toThrow(TypeError);
  });

  test('throws for Promise values', () => {
    expect(() => equal(Promise.resolve(1), Promise.resolve(1))).toThrow(TypeError);
  });

  test('throws for AsyncGenerator values', () => {
    async function* generator() {
      yield 1;
    }
    expect(() => equal(generator(), generator())).toThrow(TypeError);
  });

  test('compares functions', () => {
    const fn1 = function test() { return 1; };
    const fn2 = function test() { return 1; };
    const fn3 = function test() { return 2; };
    const fn4 = () => 1;
    
    expect(equal(fn1, fn1)).toBe(true);
    expect(equal(fn1, fn2)).toBe(true);
    expect(equal(fn1, fn3)).toBe(false);
    expect(equal(fn1, fn4)).toBe(false);
    expect(equal(fn1, 'not a function')).toBe(false);
  });

  test('compares generators', () => {
    function* gen1() {
      yield 1;
      yield 2;
    }
    function* gen2() {
      yield 1;
      yield 2;
    }
    function* gen3() {
      yield 1;
      yield 3;
    }
    
    expect(equal(gen1(), gen2())).toBe(true);
    expect(equal(gen1(), gen3())).toBe(false);
    expect(equal(gen1(), 'not a generator')).toBe(false);
  });

  test('compares Boolean wrapper objects', () => {
    expect(equal(new Boolean(true), new Boolean(true))).toBe(true);
    expect(equal(new Boolean(true), new Boolean(false))).toBe(false);
    expect(equal(new Boolean(true), true)).toBe(false);
  });

  test('compares errors with causes', () => {
    const cause1 = new Error('root cause');
    const cause2 = new Error('root cause');
    const cause3 = new Error('different cause');
    
    const error1 = new Error('test', { cause: cause1 });
    const error2 = new Error('test', { cause: cause2 });
    const error3 = new Error('test', { cause: cause3 });
    const error4 = new Error('test');
    
    expect(equal(error1, error2)).toBe(true);
    expect(equal(error1, error3)).toBe(false);
    expect(equal(error1, error4)).toBe(false);
  });

  test('handles empty sets and maps', () => {
    expect(equal(new Set(), new Set())).toBe(true);
    expect(equal(new Map(), new Map())).toBe(true);
  });

  test('handles arrays compared to non-arrays', () => {
    expect(equal([], 'not an array')).toBe(false);
    expect(equal([1, 2], { 0: 1, 1: 2 })).toBe(false);
  });

  test('handles dates compared to non-dates', () => {
    expect(equal(new Date(), 'not a date')).toBe(false);
    expect(equal(new Date(), {})).toBe(false);
  });

  test('handles sets compared to non-sets', () => {
    expect(equal(new Set([1, 2]), [1, 2])).toBe(false);
    expect(equal(new Set([1, 2]), 'not a set')).toBe(false);
  });

  test('handles maps compared to non-maps', () => {
    expect(equal(new Map([['a', 1]]), { a: 1 })).toBe(false);
    expect(equal(new Map([['a', 1]]), 'not a map')).toBe(false);
  });

  test('handles errors compared to non-errors', () => {
    expect(equal(new Error('test'), 'not an error')).toBe(false);
    expect(equal(new Error('test'), { message: 'test' })).toBe(false);
  });

  test('handles regexps compared to non-regexps', () => {
    expect(equal(/test/, '/test/')).toBe(false);
    expect(equal(/test/, {})).toBe(false);
  });

  test('handles generators compared to non-generators', () => {
    function* gen() {
      yield 1;
    }
    expect(equal(gen(), [1])).toBe(false);
    expect(equal(gen(), 'not a generator')).toBe(false);
  });

  test('handles objects compared to non-objects at the end', () => {
    expect(equal({ a: 1 }, 'not an object')).toBe(false);
  });

  test('compares empty arrays', () => {
    expect(equal([], [])).toBe(true);
  });

  test('handles comparisons with primitive as second arg against async types', () => {
    const promise = Promise.resolve(1);
    const asyncGen = (async function*() { yield 1; })();
    const asyncIter = { [Symbol.asyncIterator]: async function*() { yield 1; } };
    
    // When comparing primitive with async types, should return false
    expect(equal(1, promise)).toBe(false);
    expect(equal('string', asyncGen)).toBe(false);
    expect(equal(true, asyncIter)).toBe(false);
  });

  test('handles edge case with Boolean wrapper compared to non-Boolean wrapper', () => {
    const boolWrapper = new Boolean(true);
    const notBoolWrapper = { valueOf: () => true };
    
    expect(equal(boolWrapper, notBoolWrapper)).toBe(false);
  });

  test('edge case with error names mismatch', () => {
    const error1 = new Error('test');
    const error2 = new TypeError('test');
    
    expect(equal(error1, error2)).toBe(false);
  });

  test('edge case for object toString not matching Object', () => {
    // This covers the "warn b is not primitive..." path at line 284
    const weirdObj = Object.create(null);
    // Give it properties so isObject returns true but it's not really a standard object
    Object.defineProperty(weirdObj, 'toString', {
      value: () => '[object WeirdObject]'
    });
    
    expect(equal(weirdObj, 'not an object')).toBe(false);
  });

  test('compares empty objects', () => {
    expect(equal({}, {})).toBe(true);
    expect(Object.keys({}).length).toBe(0);
  });

  test('handles comparisons that trigger logging', () => {
    // Testing line 99 - non-primitive debug logging path
    const complexObj = { a: { b: { c: 1 } } };
    const otherObj = { a: { b: { c: 2 } } };
    
    // This triggers the debug logging at line 99 since they're not equal and not primitive
    expect(equal(complexObj, otherObj)).toBe(false);
  });
});

describe('equalAsync', () => {
  test('handles primitive values', async () => {
    expect(await equalAsync(5, 5)).toBe(true);
    expect(await equalAsync('test', 'test')).toBe(true);
    expect(await equalAsync(5, 10)).toBe(false);
  });

  test('compares resolved promises', async () => {
    const promise1 = Promise.resolve(42);
    const promise2 = Promise.resolve(42);
    const promise3 = Promise.resolve('different');

    expect(await equalAsync(promise1, promise2)).toBe(true);
    expect(await equalAsync(promise1, promise3)).toBe(false);
  });

  test('compares rejected promises', async () => {
    const error = new Error('test error');
    const promise1 = Promise.reject(error);
    const promise2 = Promise.reject(new Error('test error'));
    const promise3 = Promise.reject(new Error('different error'));

    // Handle the rejections to prevent unhandled promise rejection errors
    promise1.catch(() => {
      // noop
    });
    promise2.catch(() => {
      // noop
    });
    promise3.catch(() => {
      // noop
    });

    expect(await equalAsync(promise1, promise2)).toBe(true);
    expect(await equalAsync(promise1, promise3)).toBe(false);
  });

  test('compares async generators', async () => {
    async function* generator1() {
      yield 1;
      yield 2;
      yield 3;
    }

    async function* generator2() {
      yield 1;
      yield 2;
      yield 3;
    }

    async function* generator3() {
      yield 1;
      yield 2;
    }

    expect(await equalAsync(generator1(), generator2())).toBe(true);
    expect(await equalAsync(generator1(), generator3())).toBe(false);
  });

  test('compares async iterables', async () => {
    const asyncIterable1 = {
      [Symbol.asyncIterator]: async function*() {
        yield 'a';
        yield 'b';
      },
    };

    const asyncIterable2 = {
      [Symbol.asyncIterator]: async function*() {
        yield 'a';
        yield 'b';
      },
    };

    const asyncIterable3 = {
      [Symbol.asyncIterator]: async function*() {
        yield 'a';
        yield 'c';
      },
    };

    expect(await equalAsync(asyncIterable1, asyncIterable2)).toBe(true);
    expect(await equalAsync(asyncIterable1, asyncIterable3)).toBe(false);
  });
});
