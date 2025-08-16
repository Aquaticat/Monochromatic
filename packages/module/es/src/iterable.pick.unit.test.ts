import {
  // iterablePick,
  // iterablePickAsync,

  // Logging library used.
  logtapeConfiguration,
  logtapeConfigure,
} from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration(),);

// Import the functions we're testing
import {
  iterablePick,
  iterablePickAsync,
} from './iterable.pick.ts';

// Helper function to create async iterables
async function* asyncIterable<T,>(items: T[],): AsyncIterable<T> {
  for (const item of items)
    yield item;
}

// Generic schema helpers for testing
const numberArraySchema = {
  parse: (value: unknown,): number[] => {
    if (!Array.isArray(value,))
      throw new Error('Expected array',);
    if (!value.every((item,): item is number => typeof item === 'number'))
      throw new Error('Expected array of numbers',);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- Testing schema returns validated array
    return value;
  },
};

const numberSchema = {
  parse: (value: unknown,): number => {
    if (typeof value !== 'number')
      throw new Error('Expected number',);
    return value;
  },
};

const stringSchema = {
  parse: (value: unknown,): string => {
    if (typeof value !== 'string')
      throw new Error('Expected string',);
    return value;
  },
};

const stringRegexSchema = {
  parse: (value: unknown,): string => {
    if (typeof value !== 'string')
      throw new Error('Expected string',);
    if (!/^start/.test(value,))
      throw new Error('String must start with "start"',);
    return value;
  },
};

const stringArrayRegexSchema = {
  parse: (value: unknown,): string[] => {
    if (!Array.isArray(value,))
      throw new Error('Expected array',);
    for (const item of value) {
      if (typeof item !== 'string')
        throw new Error('Expected array of strings',);
      if (!/^start/.test(item,))
        throw new Error('All strings must start with "start"',);
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- Testing schema returns validated array
    return value;
  },
};

const booleanSchema = {
  parse: (value: unknown,): boolean => {
    if (typeof value !== 'boolean')
      throw new Error('Expected boolean',);
    return value;
  },
};

// Coercion schema that converts numbers to booleans (like z.coerce.boolean())
const coerceBooleanSchema = {
  parse: (value: unknown,): boolean => {
    // Convert truthy/falsy values to boolean like Zod coercion
    return Boolean(value,);
  },
};

describe('iterablePick', () => {
  test('returns picked shape for exact match', () => {
    const originalArray = [1, 2, 3,];
    const pickedArray = [1, 2, 3,];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Testing mixed validation function
    const result = iterablePick({ iterable: originalArray, picked: pickedArray, },);

    expect(result,).toBe(pickedArray,); // Should return the picked array reference
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- Testing mixed validation function
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- Testing mixed validation function spread
    expect([...result,],).toEqual([1, 2, 3,],);
  });

  test('works with different iterable types - Set', () => {
    const originalSet = new Set([1, 2, 3,],);
    const pickedSet = new Set([1, 2, 3,],);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Testing mixed validation function
    const result = iterablePick({ iterable: originalSet, picked: pickedSet, },);

    expect(result,).toBe(pickedSet,); // Should return the picked Set
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- Testing mixed validation function
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- Testing mixed validation function spread
    expect([...result,],).toEqual([1, 2, 3,],);
  });

  test('works with different iterable types - Map', () => {
    const originalMap = new Map([['a', 1,], ['b', 2,],],);
    const pickedMap = new Map([['a', 1,], ['b', 2,],],);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Testing mixed validation function
    const result = iterablePick({ iterable: originalMap, picked: pickedMap, },);

    expect(result,).toBe(pickedMap,); // Should return the picked Map
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- Testing mixed validation function
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- Testing mixed validation function spread
    expect([...result,],).toEqual([['a', 1,], ['b', 2,],],);
  });

  test('works with string iterables', () => {
    const originalString = 'abc';
    const pickedString = 'abc';
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Testing mixed validation function
    const result = iterablePick({ iterable: originalString, picked: pickedString, },);

    expect(result,).toBe(pickedString,); // Should return the picked string
    // eslint-disable-next-line unicorn/prefer-spread, @typescript-eslint/no-unsafe-argument -- Testing string iteration behavior
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- Testing mixed validation function spread
    expect([...result,],).toEqual(['a', 'b', 'c',],);
  });

  test('works with generator functions', () => {
    function* originalGenerator() {
      yield 1;
      yield 2;
      yield 3;
    }

    function* pickedGenerator() {
      yield 1;
      yield 2;
      yield 3;
    }

    const picked = pickedGenerator();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Testing mixed validation function
    const result = iterablePick({ iterable: originalGenerator(), picked, },);

    expect(result,).toBe(picked,); // Should return the picked generator
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- Testing mixed validation function
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- Testing mixed validation function spread
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- Testing mixed validation function spread
    expect([...result,],).toEqual([1, 2, 3,],);
  });

  test('throws error when iterables do not match', () => {
    expect(() => {
      iterablePick({ iterable: [1, 2, 3,], picked: [1, 2, 4,], },);
    },)
      .toThrow('Iterable does not match the expected shape',);
  });

  test('works with function returning picked shape', () => {
    const originalArray = [1, 2, 3,];
    const getPickedArray = () => [1, 2, 3,];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Testing mixed validation function
    const result = iterablePick({ iterable: originalArray, picked: getPickedArray, },);

    // Should return the result of the function call
    expect(result,).toEqual([1, 2, 3,],);
  });

  test('throws error when function-returned shape does not match', () => {
    expect(() => {
      iterablePick({ iterable: [1, 2, 3,], picked: () => [1, 2, 4,], },);
    },)
      .toThrow('Iterable does not match the expected shape',);
  });
});

describe('iterablePickAsync', () => {
  test('returns picked shape for exact match with async iterable', async () => {
    const originalIterable = asyncIterable([1, 2, 3,],);
    const pickedArray = [1, 2, 3,];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Testing mixed validation function
    const result = await iterablePickAsync({ iterable: originalIterable,
      picked: pickedArray, },);

    expect(result,).toBe(pickedArray,); // Should return the picked array reference
    expect(result,).toEqual([1, 2, 3,],);
  });

  test('works with async function returning picked shape', async () => {
    const originalIterable = asyncIterable([1, 2, 3,],);
    const getPickedArray = async () => {
      // Simulate async operation
      await new Promise(resolve => setTimeout(resolve, 1,));
      return [1, 2, 3,];
    };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Testing mixed validation function
    const result = await iterablePickAsync({ iterable: originalIterable,
      picked: getPickedArray, },);

    expect(result,).toEqual([1, 2, 3,],);
  });

  test('throws error when async iterables do not match', async () => {
    await expect(async () => {
      await iterablePickAsync({ iterable: asyncIterable([1, 2, 3,],),
        picked: [1, 2, 4,], },);
    },)
      .rejects
      .toThrow('Async iterable does not match the expected shape',);
  });

  test('throws error when async function-returned shape does not match', async () => {
    await expect(async () => {
      await iterablePickAsync({
        iterable: asyncIterable([],),
        picked: async () => [1, 2, 3,],
      },);
    },)
      .rejects
      .toThrow('Async iterable does not match the expected shape',);
  });
});

describe('iterablePick with generic schemas', () => {
  test('validates empty array with array schema', () => {
    const data: unknown[] = [];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Testing schema validation
    const result = iterablePick({ iterable: data, picked: numberArraySchema, },);
    expect(result,).toEqual([],);
  });

  test('validates generator with array schema', () => {
    function* emptyGenerator(): Generator<never> {
      // Empty generator
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Testing schema validation
    const result = iterablePick({ iterable: emptyGenerator(),
      picked: numberArraySchema, },);
    expect(result,).toEqual([],);
  });

  test('validates single element array with [numberSchema]', () => {
    const data = [1, 2,];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Testing schema validation
    const result = iterablePick({ iterable: data, picked: [numberSchema,] as any, },);
    expect(result,).toEqual([1,],); // Should return first element validated
  });

  test('validates coercion with [coerceBooleanSchema] - matches z.coerce.boolean() behavior', () => {
    const data = [1,];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Testing schema validation
    const result = iterablePick({ iterable: data,
      picked: [coerceBooleanSchema,] as any, },);
    expect(result,).toEqual([true,],); // Number 1 gets coerced to boolean true
  });

  test('validates multiple coercions', () => {
    const data = [1, 0, 'hello', '', null,];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Testing schema validation
    const result = iterablePick({
      iterable: data,
      picked: [coerceBooleanSchema, coerceBooleanSchema, coerceBooleanSchema,] as any,
    },);
    expect(result,).toEqual([true, false, true,],); // 1->true, 0->false, 'hello'->true
  });

  test('validates regex pattern with stringArrayRegexSchema', () => {
    const data = ['startA', 'startB',];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Testing schema validation
    const result = iterablePick({
      iterable: data,
      picked: stringArrayRegexSchema,
    },);
    expect(result,).toEqual(['startA', 'startB',],);
  });

  test('throws when schema validation fails', () => {
    expect(() => {
      iterablePick({ iterable: ['invalid',], picked: numberArraySchema, },);
    },)
      .toThrow();
  });

  test('validates mixed array with multiple schemas', () => {
    const data = [1, 'hello', true,];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Testing schema validation
    const result = iterablePick({
      iterable: data,
      picked: [numberSchema, stringSchema, booleanSchema,] as any,
    },);
    expect(result,).toEqual([1, 'hello', true,],);
  });

  test('validates subset of elements with mixed schema array', () => {
    const data = [1, 'hello', true, 'extra', 99,];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Testing schema validation
    const result = iterablePick({
      iterable: data,
      picked: [numberSchema, stringSchema,] as any,
    },);
    expect(result,).toEqual([1, 'hello',],); // Only first 2 elements
  });

  test('throws when mixed schema validation fails', () => {
    expect(() => {
      iterablePick({
        iterable: ['not-number', 'hello',],
        picked: [numberSchema, stringSchema,] as any,
      },);
    },)
      .toThrow();
  });
});

describe('iterablePickAsync with generic schemas', () => {
  test('validates async iterable with array schema', async () => {
    const data = asyncIterable([1, 2, 3,],);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Testing schema validation
    const result = await iterablePickAsync({ iterable: data,
      picked: numberArraySchema, },);
    expect(result,).toEqual([1, 2, 3,],);
  });

  test('validates async iterable with mixed schemas', async () => {
    const data = asyncIterable([1, 'hello', true,],);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Testing schema validation
    const result = await iterablePickAsync({
      iterable: data,
      picked: [numberSchema, stringSchema, booleanSchema,] as any,
    },);
    expect(result,).toEqual([1, 'hello', true,],);
  });

  test('throws when async schema validation fails', async () => {
    await expect(async () => {
      await iterablePickAsync({
        iterable: asyncIterable(['invalid',],),
        picked: numberArraySchema,
      },);
    },)
      .rejects
      .toThrow();
  });
});

describe('integration examples', () => {
  test('example 1: empty array with array schema', () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Testing schema validation
    const result = iterablePick({ iterable: [], picked: numberArraySchema, },);
    expect(result,).toEqual([],);
  });

  test('example 2: single element extraction', () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Testing schema validation
    const result = iterablePick({ iterable: [1, 2,], picked: [numberSchema,] as any, },);
    expect(result,).toEqual([1,],);
  });

  test('example 3: regex validation of string array', () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Testing schema validation
    const result = iterablePick({
      iterable: ['startA', 'startB',],
      picked: stringArrayRegexSchema,
    },);
    expect(result,).toEqual(['startA', 'startB',],);
  });

  test('example 4: coercion like z.coerce.boolean()', () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Testing schema validation
    const result = iterablePick({
      iterable: [1,],
      picked: [coerceBooleanSchema,] as any,
    },);
    expect(result,).toEqual([true,],); // [1] becomes [true] through coercion
  });
});
