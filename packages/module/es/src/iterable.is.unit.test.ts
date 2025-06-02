import {
  arrayIsEmpty,
  arrayIsNonEmpty,
  type ArrayNonFixedLengthOrNever,
  isArray,
  type IsArrayFixedLength,
  isAsyncGenerator,
  isAsyncIterable,
  isEmptyArray,
  isGenerator,
  isIterable,
  isMap,
  isMaybeAsyncIterable,
  isNonEmptyArray,
  isObject,
  isSet,
  type IsTupleArray,
  isWeakMap,
  isWeakSet,
  logtapeConfiguration,
  logtapeConfigure,
} from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  expectTypeOf,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration());

describe('ArrayFixedLength', () => {
  test('IsArrayFixedLength', () => {
    expectTypeOf<IsArrayFixedLength<[number, string]>>().toEqualTypeOf<true>();
    expectTypeOf<IsArrayFixedLength<[number]>>().toEqualTypeOf<true>();
    expectTypeOf<IsArrayFixedLength<[number[]]>>().toEqualTypeOf<true>();

    expectTypeOf<IsArrayFixedLength<[...number[]]>>().toEqualTypeOf<false>();
    expectTypeOf<IsArrayFixedLength<[string, ...number[]]>>().toEqualTypeOf<false>();
    expectTypeOf<IsArrayFixedLength<any[]>>().toEqualTypeOf<false>();
  });

  test('ArrayNonFixedLengthOrNever', () => {
    expectTypeOf<ArrayNonFixedLengthOrNever<[number, string]>>().toBeNever();
    expectTypeOf<ArrayNonFixedLengthOrNever<[number]>>().toBeNever();
    expectTypeOf<ArrayNonFixedLengthOrNever<[number[]]>>().toBeNever();

    expectTypeOf<ArrayNonFixedLengthOrNever<[...number[]]>>().toEqualTypeOf<
      [...number[]]
    >();
    expectTypeOf<ArrayNonFixedLengthOrNever<[string, ...number[]]>>().toEqualTypeOf<
      [string, ...number[]]
    >();
    expectTypeOf<ArrayNonFixedLengthOrNever<any[]>>().toEqualTypeOf<any[]>();
  });

  /*  test('ArrayNonFixedLength', () => {
    expectTypeOf<[]>().not.toExtend<ArrayNonFixedLength>();
    expectTypeOf<[number, string]>().not.toExtend<ArrayNonFixedLength>();
    expectTypeOf<[number]>().not.toExtend<ArrayNonFixedLength>();
    expectTypeOf<[number[]]>().not.toExtend<ArrayNonFixedLength>();

    expectTypeOf<[...number[]]>().toExtend<ArrayNonFixedLength>();
    expectTypeOf<[string, ...number[]]>().toExtend<ArrayNonFixedLength>();
    expectTypeOf<any[]>().toExtend<ArrayNonFixedLength>();
  });*/
});

describe('TupleArray', () => {
  test('IsTupleArray', () => {
    expectTypeOf<IsTupleArray<[]>>().toEqualTypeOf<true>();
    expectTypeOf<IsTupleArray<[number, string]>>().toEqualTypeOf<true>();
    expectTypeOf<IsTupleArray<[string]>>().toEqualTypeOf<true>();
    expectTypeOf<IsTupleArray<[number, ...string[]]>>().toEqualTypeOf<true>();
    expectTypeOf<IsTupleArray<[number[]]>>().toEqualTypeOf<true>();

    // This technically looks like a tuple, but it doesn't fulfill why we want a tuple sometimes.
    // There's no guarantee of anything inside the structure.
    // Moreover, it's equal to number[].
    // Therefore, the expected value is false.
    expectTypeOf<IsTupleArray<[...number[]]>>().toEqualTypeOf<false>();

    expectTypeOf<IsTupleArray<string[]>>().toEqualTypeOf<false>();
    expectTypeOf<IsTupleArray<any[]>>().toEqualTypeOf<false>();
  });
});

describe(isArray, () => {
  test('identifies arrays correctly', () => {
    expect(isArray([])).toBe(true);
    expect(isArray([1, 2, 3])).toBe(true);
    expect(isArray(Array.from({ length: 5 }))).toBe(true);
  });

  test('rejects non-arrays', () => {
    expect(isArray(null)).toBe(false);
    expect(isArray(undefined)).toBe(false);
    expect(isArray({})).toBe(false);
    expect(isArray('array')).toBe(false);
    expect(isArray(new Set([1, 2, 3]))).toBe(false);
    expect(isArray(new Map())).toBe(false);
  });
});

describe(isIterable, () => {
  test('identifies iterables correctly', () => {
    expect(isIterable([])).toBe(true);
    expect(isIterable('string')).toBe(true);
    expect(isIterable(new Set())).toBe(true);
    expect(isIterable(new Map())).toBe(true);
    expect(isIterable(function*() {
      yield 1;
    }()))
      .toBe(true);
  });

  test('rejects non-iterables', () => {
    expect(isIterable(null)).toBe(false);
    expect(isIterable(undefined)).toBe(false);
    expect(isIterable({})).toBe(false);
    expect(isIterable(123)).toBe(false);
    expect(isIterable(Symbol('nope'))).toBe(false);
    expect(isIterable(async function*() {
      yield 1;
    }()))
      .toBe(false);
  });
});

describe(isAsyncIterable, () => {
  test('identifies async iterables correctly', () => {
    expect(isAsyncIterable(async function*() {
      yield 1;
    }()))
      .toBe(true);

    const customAsyncIterable = {
      [Symbol.asyncIterator]: () => ({ next: async () => ({ value: 1, done: false }) }),
    };
    expect(isAsyncIterable(customAsyncIterable)).toBe(true);
  });

  test('rejects non-async iterables', () => {
    expect(isAsyncIterable([])).toBe(false);
    expect(isAsyncIterable('string')).toBe(false);
    expect(isAsyncIterable(new Set())).toBe(false);
    expect(isAsyncIterable(new Map())).toBe(false);
    expect(isAsyncIterable(null)).toBe(false);
    expect(isAsyncIterable(undefined)).toBe(false);
    expect(isAsyncIterable({})).toBe(false);
    expect(isAsyncIterable(function*() {
      yield 1;
    }()))
      .toBe(false);
  });
});

describe(isMaybeAsyncIterable, () => {
  test('identifies both sync and async iterables', () => {
    expect(isMaybeAsyncIterable([])).toBe(true);
    expect(isMaybeAsyncIterable('string')).toBe(true);
    expect(isMaybeAsyncIterable(new Set())).toBe(true);
    expect(isMaybeAsyncIterable(new Map())).toBe(true);
    expect(isMaybeAsyncIterable(function*() {
      yield 1;
    }()))
      .toBe(true);
    expect(isMaybeAsyncIterable(async function*() {
      yield 1;
    }()))
      .toBe(true);

    const customAsyncIterable = {
      [Symbol.asyncIterator]: () => ({ next: async () => ({ value: 1, done: false }) }),
    };
    expect(isMaybeAsyncIterable(customAsyncIterable)).toBe(true);
  });

  test('rejects non-iterables', () => {
    expect(isMaybeAsyncIterable(null)).toBe(false);
    expect(isMaybeAsyncIterable(undefined)).toBe(false);
    expect(isMaybeAsyncIterable({})).toBe(false);
    expect(isMaybeAsyncIterable(123)).toBe(false);
    expect(isMaybeAsyncIterable(Symbol('nope'))).toBe(false);
  });
});

describe(isMap, () => {
  test('identifies maps correctly', () => {
    expect(isMap(new Map())).toBe(true);
    expect(isMap(new Map([['key', 'value']]))).toBe(true);
  });

  test('rejects non-maps', () => {
    expect(isMap({})).toBe(false);
    expect(isMap([])).toBe(false);
    expect(isMap(new Set())).toBe(false);
    expect(isMap(null)).toBe(false);
    expect(isMap(undefined)).toBe(false);
    expect(isMap(new WeakMap())).toBe(false);
  });
});

describe('isWeakMap', () => {
  test('identifies weak maps correctly', () => {
    expect(isWeakMap(new WeakMap())).toBe(true);
    const obj = {};
    const weakMap = new WeakMap([[obj, 'value']]);
    expect(isWeakMap(weakMap)).toBe(true);
  });

  test('rejects non-weak maps', () => {
    expect(isWeakMap({})).toBe(false);
    expect(isWeakMap([])).toBe(false);
    expect(isWeakMap(new Map())).toBe(false);
    expect(isWeakMap(new Set())).toBe(false);
    expect(isWeakMap(null)).toBe(false);
    expect(isWeakMap(undefined)).toBe(false);
  });
});

describe(isSet, () => {
  test('identifies sets correctly', () => {
    expect(isSet(new Set())).toBe(true);
    expect(isSet(new Set([1, 2, 3]))).toBe(true);
  });

  test('rejects non-sets', () => {
    expect(isSet({})).toBe(false);
    expect(isSet([])).toBe(false);
    expect(isSet(new Map())).toBe(false);
    expect(isSet(null)).toBe(false);
    expect(isSet(undefined)).toBe(false);
    expect(isSet(new WeakSet())).toBe(false);
  });
});

describe(isWeakSet, () => {
  test('identifies weak sets correctly', () => {
    expect(isWeakSet(new WeakSet())).toBe(true);
    const obj = {};
    const weakSet = new WeakSet([obj]);
    expect(isWeakSet(weakSet)).toBe(true);
  });

  test('rejects non-weak sets', () => {
    expect(isWeakSet({})).toBe(false);
    expect(isWeakSet([])).toBe(false);
    expect(isWeakSet(new Map())).toBe(false);
    expect(isWeakSet(new Set())).toBe(false);
    expect(isWeakSet(null)).toBe(false);
    expect(isWeakSet(undefined)).toBe(false);
  });
});

describe(isObject, () => {
  test('identifies objects correctly', () => {
    expect(isObject({})).toBe(true);
    expect(isObject({ a: 1, b: 2 })).toBe(true);
    expect(isObject(Object.create(null))).toBe(true);
  });

  test('rejects non-objects', () => {
    expect(isObject([])).toBe(false);
    expect(isObject(null)).toBe(false);
    expect(isObject(undefined)).toBe(false);
    expect(isObject('string')).toBe(false);
    expect(isObject(123)).toBe(false);
    expect(isObject(new Map())).toBe(false);
    expect(isObject(new Set())).toBe(false);
  });
});

describe(isAsyncGenerator, () => {
  test('identifies async generators correctly', () => {
    const asyncGen = async function*() {
      yield 1;
    }();
    expect(isAsyncGenerator(asyncGen)).toBe(true);
  });

  test('rejects non-async generators', () => {
    const gen = function*() {
      yield 1;
    }();
    expect(isAsyncGenerator(gen)).toBe(false);
    expect(isAsyncGenerator({})).toBe(false);
    expect(isAsyncGenerator([])).toBe(false);
    expect(isAsyncGenerator(null)).toBe(false);
    expect(isAsyncGenerator(undefined)).toBe(false);
  });
});

describe(isGenerator, () => {
  test('identifies generators correctly', () => {
    const gen = function*() {
      yield 1;
    }();
    expect(isGenerator(gen)).toBe(true);
  });

  test('rejects non-generators', () => {
    const asyncGen = async function*() {
      yield 1;
    }();
    expect(isGenerator(asyncGen)).toBe(false);
    expect(isGenerator({})).toBe(false);
    expect(isGenerator([])).toBe(false);
    expect(isGenerator(null)).toBe(false);
    expect(isGenerator(undefined)).toBe(false);
  });
});

describe(isEmptyArray, () => {
  test('identifies empty arrays correctly', () => {
    expect(isEmptyArray([])).toBe(true);
  });

  test('rejects non-empty arrays and other values', () => {
    expect(isEmptyArray([1])).toBe(false);
    expect(isEmptyArray([null])).toBe(false);
    expect(isEmptyArray([undefined])).toBe(false);
    expect(isEmptyArray(Array.from({ length: 1 }).fill(0))).toBe(false);
    expect(isEmptyArray({})).toBe(false);
    expect(isEmptyArray(null)).toBe(false);
    expect(isEmptyArray(undefined)).toBe(false);
    expect(isEmptyArray('string')).toBe(false);
  });
});

describe(arrayIsEmpty, () => {
  test('identifies empty arrays correctly', () => {
    expect(arrayIsEmpty([])).toBe(true);
  });

  test('rejects non-empty arrays', () => {
    expect(arrayIsEmpty([1])).toBe(false);
    expect(arrayIsEmpty([null])).toBe(false);
    expect(arrayIsEmpty([undefined])).toBe(false);
    expect(arrayIsEmpty(Array.from({ length: 1 }).fill(0))).toBe(false);
  });
});

describe(isNonEmptyArray, () => {
  test('identifies non-empty arrays correctly', () => {
    expect(isNonEmptyArray([1])).toBe(true);
    expect(isNonEmptyArray([null])).toBe(true);
    expect(isNonEmptyArray([undefined])).toBe(true);
    expect(isNonEmptyArray([1, 2, 3])).toBe(true);
    expect(isNonEmptyArray(Array.from({ length: 1 }).fill(0))).toBe(true);
  });

  test('rejects empty arrays and other values', () => {
    expect(isNonEmptyArray([])).toBe(false);
    expect(isNonEmptyArray({})).toBe(false);
    expect(isNonEmptyArray(null)).toBe(false);
    expect(isNonEmptyArray(undefined)).toBe(false);
    expect(isNonEmptyArray('string')).toBe(false);
  });
});

describe(arrayIsNonEmpty, () => {
  test('identifies non-empty arrays correctly', () => {
    expect(arrayIsNonEmpty([1])).toBe(true);
    expect(arrayIsNonEmpty([null])).toBe(true);
    expect(arrayIsNonEmpty([undefined])).toBe(true);
    expect(arrayIsNonEmpty([1, 2, 3])).toBe(true);
    expect(arrayIsNonEmpty(Array.from({ length: 1 }).fill(0))).toBe(true);
  });

  test('rejects empty arrays', () => {
    expect(arrayIsNonEmpty([])).toBe(false);
  });
});
