import {
  types,
} from '@monochromatic-dev/module-es';
import {
  describe,
  test,
} from 'vitest';

const $ = types.function.generator.from.iterable.partition.named.$;

describe($, () => {
  test('yields items with pass decision for items that pass the predicate', async ({ expect }) => {
    const numbers = [1, 2, 3, 4, 5];
    const results = [];

    for await (const result of $({
      predicate: (n: number) => n % 2 === 0,
      iterable: numbers,
    })) {
      results.push(result);
    }

    expect(results).toEqual([
      { decision: 'fail', item: 1 },
      { decision: 'pass', item: 2 },
      { decision: 'fail', item: 3 },
      { decision: 'pass', item: 4 },
      { decision: 'fail', item: 5 },
    ]);
  });

  test('yields items with thrown decision when predicate throws', async ({ expect }) => {
    const items = ['1', 'invalid', '3'];
    const results = [];

    for await (const result of $({
      predicate: (s: string) => {
        const num = Number.parseInt(s, 10);
        if (Number.isNaN(num)) {
          throw new Error('Invalid number');
        }
        return num > 1;
      },
      iterable: items,
    })) {
      results.push(result);
    }

    expect(results).toEqual([
      { decision: 'fail', item: '1' },
      { decision: 'thrown', item: 'invalid' },
      { decision: 'pass', item: '3' },
    ]);
  });

  test('handles empty iterables', async ({ expect }) => {
    const results = [];

    for await (const result of $({
      predicate: (n: number) => n > 0,
      iterable: [],
    })) {
      results.push(result);
    }

    expect(results).toEqual([]);
  });

  test('works with async predicates', async ({ expect }) => {
    const numbers = [1, 2, 3];
    const results = [];

    for await (const result of $({
      predicate: async (n: number) => {
        // Simulate async operation
        await Promise.resolve();
        return n % 2 === 0;
      },
      iterable: numbers,
    })) {
      results.push(result);
    }

    expect(results).toEqual([
      { decision: 'fail', item: 1 },
      { decision: 'pass', item: 2 },
      { decision: 'fail', item: 3 },
    ]);
  });

  test('works with async iterables', async ({ expect }) => {
    async function* asyncNumbers() {
      yield 1;
      yield 2;
      yield 3;
    }

    const results = [];

    for await (const result of $({
      predicate: (n: number) => n % 2 === 0,
      iterable: asyncNumbers(),
    })) {
      results.push(result);
    }

    expect(results).toEqual([
      { decision: 'fail', item: 1 },
      { decision: 'pass', item: 2 },
      { decision: 'fail', item: 3 },
    ]);
  });

  test('handles all items passing', async ({ expect }) => {
    const numbers = [2, 4, 6];
    const results = [];

    for await (const result of $({
      predicate: (n: number) => n % 2 === 0,
      iterable: numbers,
    })) {
      results.push(result);
    }

    expect(results).toEqual([
      { decision: 'pass', item: 2 },
      { decision: 'pass', item: 4 },
      { decision: 'pass', item: 6 },
    ]);
  });

  test('handles all items failing', async ({ expect }) => {
    const numbers = [1, 3, 5];
    const results = [];

    for await (const result of $({
      predicate: (n: number) => n % 2 === 0,
      iterable: numbers,
    })) {
      results.push(result);
    }

    expect(results).toEqual([
      { decision: 'fail', item: 1 },
      { decision: 'fail', item: 3 },
      { decision: 'fail', item: 5 },
    ]);
  });

  test('handles all items throwing', async ({ expect }) => {
    const items = ['a', 'b', 'c'];
    const results = [];

    for await (const result of $({
      predicate: (s: string) => {
        const num = Number.parseInt(s, 10);
        if (Number.isNaN(num)) {
          throw new Error('Invalid');
        }
        return num > 0;
      },
      iterable: items,
    })) {
      results.push(result);
    }

    expect(results).toEqual([
      { decision: 'thrown', item: 'a' },
      { decision: 'thrown', item: 'b' },
      { decision: 'thrown', item: 'c' },
    ]);
  });

  test('preserves item type information', async ({ expect }) => {
    type Item = { id: number; name: string };
    const items: Item[] = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ];

    const results = [];

    for await (const result of $({
      predicate: (item: Item) => item.id % 2 === 0,
      iterable: items,
    })) {
      results.push(result);
    }

    expect(results).toEqual([
      { decision: 'fail', item: { id: 1, name: 'Alice' } },
      { decision: 'pass', item: { id: 2, name: 'Bob' } },
    ]);
  });
});
