import {
  types,
} from '@monochromatic-dev/module-es';
import {
  describe,
  expectTypeOf,
  test,
} from 'vitest';

const $ = types.function.generator.from.iterable.withIndex.named.$;

describe($, () => {
  test('yields elements with their indices for arrays', async ({ expect }) => {
    const result = await Array.fromAsync($({ myIterable: ['a', 'b', 'c'] }));

    expect(result).toEqual([
      { element: 'a', index: 0 },
      { element: 'b', index: 1 },
      { element: 'c', index: 2 },
    ]);
  });

  test('handles empty iterables', async ({ expect }) => {
    const emptyArray = await Array.fromAsync($({ myIterable: [] }));
    expect(emptyArray).toEqual([]);

    const emptyString = await Array.fromAsync($({ myIterable: '' }));
    expect(emptyString).toEqual([]);

    const emptySet = await Array.fromAsync($({ myIterable: new Set() }));
    expect(emptySet).toEqual([]);
  });

  test('yields characters with indices for strings', async ({ expect }) => {
    const result = await Array.fromAsync($({ myIterable: 'hello' }));

    expect(result).toEqual([
      { element: 'h', index: 0 },
      { element: 'e', index: 1 },
      { element: 'l', index: 2 },
      { element: 'l', index: 3 },
      { element: 'o', index: 4 },
    ]);
  });

  test('yields Set values with indices', async ({ expect }) => {
    const mySet = new Set([10, 20, 30]);
    const result = await Array.fromAsync($({ myIterable: mySet }));

    expect(result).toEqual([
      { element: 10, index: 0 },
      { element: 20, index: 1 },
      { element: 30, index: 2 },
    ]);
  });

  test('yields Map entries with indices', async ({ expect }) => {
    const myMap = new Map([
      ['key1', 'value1'],
      ['key2', 'value2'],
      ['key3', 'value3'],
    ]);
    const result = await Array.fromAsync($({ myIterable: myMap }));

    expect(result).toEqual([
      { element: ['key1', 'value1'], index: 0 },
      { element: ['key2', 'value2'], index: 1 },
      { element: ['key3', 'value3'], index: 2 },
    ]);
  });

  test('handles async generators', async ({ expect }) => {
    async function* asyncGen(): AsyncGenerator<string> {
      yield 'first';
      yield 'second';
      yield 'third';
    }

    const result = await Array.fromAsync($({ myIterable: asyncGen() }));

    expect(result).toEqual([
      { element: 'first', index: 0 },
      { element: 'second', index: 1 },
      { element: 'third', index: 2 },
    ]);
  });

  test('handles single element iterable', async ({ expect }) => {
    const result = await Array.fromAsync($({ myIterable: ['only'] }));

    expect(result).toEqual([
      { element: 'only', index: 0 },
    ]);
  });

  test('correctly increments indices for large arrays', async ({ expect }) => {
    const LARGE_ARRAY_SIZE = 100;
    const largeArray = Array.from({ length: LARGE_ARRAY_SIZE }, (_, arrayIndex) => arrayIndex);
    const result = await Array.fromAsync($({ myIterable: largeArray }));

    expect(result).toHaveLength(LARGE_ARRAY_SIZE);
    expect(result[0]).toEqual({ element: 0, index: 0 });
    expect(result[LARGE_ARRAY_SIZE - 1]).toEqual({ element: 99, index: 99 });

    result.forEach((item, arrayIndex) => {
      expect(item.index).toBe(arrayIndex);
      expect(item.element).toBe(arrayIndex);
    });
  });

  test('handles generator functions as input', async ({ expect }) => {
    function* numberGen(): Generator<number> {
      yield 1;
      yield 2;
      yield 3;
    }

    const result = await Array.fromAsync($({ myIterable: numberGen() }));

    expect(result).toEqual([
      { element: 1, index: 0 },
      { element: 2, index: 1 },
      { element: 3, index: 2 },
    ]);
  });

  test('type checking for index and element', async () => {
    const gen = $({ myIterable: [1, 2, 3] });
    const firstItem = await gen.next();

    if (firstItem.done) {
      throw new Error('Generator unexpectedly done');
    }

    type IndexType = typeof firstItem.value.index;
    type ElementType = typeof firstItem.value.element;

    expectTypeOf<IndexType>().toMatchTypeOf<number>();
    expectTypeOf<ElementType>().toEqualTypeOf<1 | 2 | 3>();
  });
});
