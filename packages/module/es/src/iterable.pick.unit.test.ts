import {
  // Import functions to test
  iterablePick,
  iterablePickAsync,
  // Logging library used
  logtapeConfiguration,
  logtapeConfigure,
} from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration(),);

// Helper function to create async iterables
async function* asyncIterable<T,>(items: T[],): AsyncIterable<T> {
  for (const item of items)
    yield item;
}

// Test schema helpers
const numberArraySchema = {
  parse: (value: unknown,): number[] => {
    if (!Array.isArray(value,))
      throw new Error('Expected array',);
    if (!value.every((item,): item is number => typeof item === 'number'))
      throw new Error('Expected array of numbers',);
    return value;
  },
};

const stringArraySchema = {
  parse: (value: unknown,): string[] => {
    if (!Array.isArray(value,))
      throw new Error('Expected array',);
    if (!value.every((item,): item is string => typeof item === 'string'))
      throw new Error('Expected array of strings',);
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

const booleanSchema = {
  parse: (value: unknown,): boolean => {
    if (typeof value !== 'boolean')
      throw new Error('Expected boolean',);
    return value;
  },
};

// Coercion schema that converts values to boolean
const coerceBooleanSchema = {
  parse: (value: unknown,): boolean => {
    return Boolean(value,);
  },
};

// Async schemas for testing
const asyncNumberSchema = {
  parseAsync: async (value: unknown,): Promise<number> => {
    if (typeof value !== 'number')
      throw new Error('Expected number',);
    return value;
  },
};

const asyncStringSchema = {
  parseAsync: async (value: unknown,): Promise<string> => {
    if (typeof value !== 'string')
      throw new Error('Expected string',);
    return value;
  },
};

describe(iterablePick, () => {
  describe('schema validation - validates entire iterable as single unit', () => {
    test('validates number array with numberArraySchema', () => {
      const result = iterablePick({
        iterable: [1, 2, 3,],
        picked: numberArraySchema,
      },);
      expect(result,).toEqual([1, 2, 3,],);
    });

    test('validates empty array with numberArraySchema', () => {
      const result = iterablePick({
        iterable: [],
        picked: numberArraySchema,
      },);
      expect(result,).toEqual([],);
    });

    test('validates string array with stringArraySchema', () => {
      const result = iterablePick({
        iterable: ['a', 'b', 'c',],
        picked: stringArraySchema,
      },);
      expect(result,).toEqual(['a', 'b', 'c',],);
    });

    test('throws when schema validation fails', () => {
      expect(() => {
        iterablePick({
          iterable: ['not', 'numbers',],
          picked: numberArraySchema,
        },);
      },)
        .toThrow('Expected array of numbers',);
    });

    test('works with different iterable types - Set', () => {
      const result = iterablePick({
        iterable: new Set([1, 2, 3,],),
        picked: numberArraySchema,
      },);
      expect(result,).toEqual([1, 2, 3,],);
    });

    test('works with generator functions', () => {
      function* numberGenerator() {
        yield 1;
        yield 2;
        yield 3;
      }

      const result = iterablePick({
        iterable: numberGenerator(),
        picked: numberArraySchema,
      },);
      expect(result,).toEqual([1, 2, 3,],);
    });
  });

  describe('element-by-element validation with exact values', () => {
    test('validates matching elements exactly', () => {
      const result = iterablePick({
        iterable: [1, 2, 3,],
        picked: [1, 2, 3,],
      },);
      expect(result,).toEqual([1, 2, 3,],);
    });

    test('validates subset of elements', () => {
      const result = iterablePick({
        iterable: [1, 2, 3, 4, 5,],
        picked: [1, 2,],
      },);
      expect(result,).toEqual([1, 2,],);
    });

    test('works with mixed types', () => {
      const result = iterablePick({
        iterable: [1, 'hello', true,],
        picked: [1, 'hello', true,],
      },);
      expect(result,).toEqual([1, 'hello', true,],);
    });

    test('throws when elements do not match', () => {
      expect(() => {
        iterablePick({
          iterable: [1, 2, 3,],
          picked: [1, 2, 4,],
        },);
      },)
        .toThrow('Element at index 2 does not match expected value',);
    });

    test('throws RangeError when picked is longer than iterable', () => {
      expect(() => {
        iterablePick({
          iterable: [1, 2,],
          picked: [1, 2, 3,],
        },);
      },)
        .toThrow('pickedArray longer than iterableArray',);
    });
  });

  describe('element-by-element validation with schemas', () => {
    test('validates each element with corresponding schema', () => {
      const result = iterablePick({
        iterable: [1, 'hello', true,],
        picked: [numberSchema, stringSchema, booleanSchema,],
      },);
      expect(result,).toEqual([1, 'hello', true,],);
    });

    test('validates subset with schemas', () => {
      const result = iterablePick({
        iterable: [1, 'hello', true, 99, 'extra',],
        picked: [numberSchema, stringSchema,],
      },);
      expect(result,).toEqual([1, 'hello',],);
    });

    test('applies coercion schema', () => {
      const result = iterablePick({
        iterable: [1, 0, 'hello', '', null,],
        picked: [coerceBooleanSchema, coerceBooleanSchema, coerceBooleanSchema,],
      },);
      expect(result,).toEqual([true, false, true,],);
    });

    test('throws when schema validation fails', () => {
      expect(() => {
        iterablePick({
          iterable: ['not-number', 'hello',],
          picked: [numberSchema, stringSchema,],
        },);
      },)
        .toThrow('Expected number',);
    });

    test('mixed schemas and exact values', () => {
      const result = iterablePick({
        iterable: [1, 'hello', 42,],
        picked: [numberSchema, 'hello', numberSchema,],
      },);
      expect(result,).toEqual([1, 'hello', 42,],);
    });

    test('throws when mixed validation fails on exact value', () => {
      expect(() => {
        iterablePick({
          iterable: [1, 'wrong', 42,],
          picked: [numberSchema, 'hello', numberSchema,],
        },);
      },)
        .toThrow('Element at index 1 does not match expected value',);
    });
  });

  describe('error cases', () => {
    test('throws TypeError when picked is neither schema nor iterable', () => {
      expect(() => {
        iterablePick({
          iterable: [1, 2, 3,],
          // oxlint-disable-next-line @typescript-eslint/no-unsafe-argument -- Testing invalid picked parameter
          picked: 42 as unknown as Iterable<unknown>,
        },);
      },)
        .toThrow('picked',);
    });

    test('throws TypeError when picked is null', () => {
      expect(() => {
        iterablePick({
          iterable: [1, 2, 3,],
          // oxlint-disable-next-line @typescript-eslint/no-unsafe-argument -- Testing null picked parameter
          picked: null as unknown as Iterable<unknown>,
        },);
      },)
        .toThrow('picked',);
    });
  });
},);

describe(iterablePickAsync, () => {
  describe('schema validation - validates entire iterable as single unit', () => {
    test('validates async iterable with schema', async () => {
      const result = await iterablePickAsync({
        iterable: asyncIterable([1, 2, 3,],),
        picked: numberArraySchema,
      },);
      expect(result,).toEqual([1, 2, 3,],);
    });

    test('validates regular iterable with schema', async () => {
      const result = await iterablePickAsync({
        iterable: [1, 2, 3,],
        picked: numberArraySchema,
      },);
      expect(result,).toEqual([1, 2, 3,],);
    });

    test('validates with async schema', async () => {
      const asyncSchema = {
        parseAsync: async (value: unknown,) => {
          if (!Array.isArray(value,))
            throw new Error('Expected array',);
          if (!value.every((item,): item is number => typeof item === 'number'))
            throw new Error('Expected array of numbers',);
          return value;
        },
      };

      const result = await iterablePickAsync({
        iterable: asyncIterable([1, 2, 3,],),
        picked: asyncSchema,
      },);
      expect(result,).toEqual([1, 2, 3,],);
    });

    test('throws when async schema validation fails', async () => {
      await expect(async () => {
        await iterablePickAsync({
          iterable: asyncIterable(['not', 'numbers',],),
          picked: numberArraySchema,
        },);
      },)
        .rejects
        .toThrow('Expected array of numbers',);
    });
  });

  describe('element-by-element validation with exact values', () => {
    test('validates matching elements exactly with async iterable', async () => {
      const result = await iterablePickAsync({
        iterable: asyncIterable([1, 2, 3,],),
        picked: [1, 2, 3,],
      },);
      expect(result,).toEqual([1, 2, 3,],);
    });

    test('validates subset of async elements', async () => {
      const result = await iterablePickAsync({
        iterable: asyncIterable([1, 2, 3, 4, 5,],),
        picked: [1, 2,],
      },);
      expect(result,).toEqual([1, 2,],);
    });

    test('validates with async picked iterable', async () => {
      const result = await iterablePickAsync({
        iterable: [1, 2, 3,],
        picked: asyncIterable([1, 2, 3,],),
      },);
      expect(result,).toEqual([1, 2, 3,],);
    });

    test('throws when async elements do not match', async () => {
      await expect(async () => {
        await iterablePickAsync({
          iterable: asyncIterable([1, 2, 3,],),
          picked: [1, 2, 4,],
        },);
      },)
        .rejects
        .toThrow('Element at index 2 does not match expected value',);
    });

    test('throws RangeError when async picked is longer than iterable', async () => {
      await expect(async () => {
        await iterablePickAsync({
          iterable: asyncIterable([1, 2,],),
          picked: [1, 2, 3,],
        },);
      },)
        .rejects
        .toThrow('pickedArray longer than iterableArray',);
    });
  });

  describe('element-by-element validation with schemas', () => {
    test('validates each async element with corresponding schema', async () => {
      const result = await iterablePickAsync({
        iterable: asyncIterable([1, 'hello', true,],),
        picked: [numberSchema, stringSchema, booleanSchema,],
      },);
      expect(result,).toEqual([1, 'hello', true,],);
    });

    test('validates with async schemas', async () => {
      const result = await iterablePickAsync({
        iterable: asyncIterable([1, 'hello',],),
        picked: [asyncNumberSchema, asyncStringSchema,],
      },);
      expect(result,).toEqual([1, 'hello',],);
    });

    test('applies coercion schema async', async () => {
      const result = await iterablePickAsync({
        iterable: asyncIterable([1, 0, 'hello',],),
        picked: [coerceBooleanSchema, coerceBooleanSchema, coerceBooleanSchema,],
      },);
      expect(result,).toEqual([true, false, true,],);
    });

    test('throws when async schema validation fails', async () => {
      await expect(async () => {
        await iterablePickAsync({
          iterable: asyncIterable(['not-number', 'hello',],),
          picked: [numberSchema, stringSchema,],
        },);
      },)
        .rejects
        .toThrow('Expected number',);
    });

    test('mixed schemas and exact values async', async () => {
      const result = await iterablePickAsync({
        iterable: asyncIterable([1, 'hello', 42,],),
        picked: [numberSchema, 'hello', numberSchema,],
      },);
      expect(result,).toEqual([1, 'hello', 42,],);
    });
  });

  describe('error cases', () => {
    test('throws TypeError when picked is neither schema nor async iterable', async () => {
      await expect(async () => {
        await iterablePickAsync({
          iterable: asyncIterable([1, 2, 3,],),
          // oxlint-disable-next-line @typescript-eslint/no-unsafe-argument -- Testing invalid picked parameter
          picked: 42 as unknown as Iterable<unknown>,
        },);
      },)
        .rejects
        .toThrow('picked',);
    });

    test('throws TypeError when picked is null', async () => {
      await expect(async () => {
        await iterablePickAsync({
          iterable: asyncIterable([1, 2, 3,],),
          // oxlint-disable-next-line @typescript-eslint/no-unsafe-argument -- Testing null picked parameter
          picked: null as unknown as Iterable<unknown>,
        },);
      },)
        .rejects
        .toThrow('picked',);
    });
  });
},);
