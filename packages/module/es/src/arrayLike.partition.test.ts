import {
  logtapeConfiguration,
  logtapeConfigure,
} from '@monochromatic-dev/module-es/ts';
import {
  describe,
  expect,
  test,
} from 'vitest';
import {
  partitionArrAsync,
  partitionArrayLike,
  partitionArrayLikeAsync,
} from './arrayLike.partition.ts';

await logtapeConfigure(await logtapeConfiguration());

describe('partitionArrayLike', () => {
  test('splits array based on predicate', () => {
    const input = [1, 2, 3, 4, 5];
    const [evens, odds] = partitionArrayLike((n) => n % 2 === 0, input);

    expect(evens).toEqual([2, 4]);
    expect(odds).toEqual([1, 3, 5]);
  });

  test('works with empty arrays', () => {
    const [yes, no] = partitionArrayLike(() => true, []);

    expect(yes).toEqual([]);
    expect(no).toEqual([]);
  });

  test('works when all items pass predicate', () => {
    const input = [2, 4, 6, 8];
    const [evens, odds] = partitionArrayLike((n) => n % 2 === 0, input);

    expect(evens).toEqual([2, 4, 6, 8]);
    expect(odds).toEqual([]);
  });

  test('works when no items pass predicate', () => {
    const input = [1, 3, 5, 7];
    const [evens, odds] = partitionArrayLike((n) => n % 2 === 0, input);

    expect(evens).toEqual([]);
    expect(odds).toEqual([1, 3, 5, 7]);
  });

  test('works with objects', () => {
    const input = [
      { id: 1, active: true },
      { id: 2, active: false },
      { id: 3, active: true },
    ];
    const [active, inactive] = partitionArrayLike((obj) => obj.active, input);

    expect(active).toEqual([{ id: 1, active: true }, { id: 3, active: true }]);
    expect(inactive).toEqual([{ id: 2, active: false }]);
  });

  test('works with strings', () => {
    const input = ['apple', 'banana', 'cherry', 'date'];
    const [longWords, shortWords] = partitionArrayLike((word) => word.length > 5, input);

    expect(longWords).toEqual(['banana', 'cherry']);
    expect(shortWords).toEqual(['apple', 'date']);
  });

  test('works with other iterables', () => {
    const set = new Set([1, 2, 3, 4, 5]);
    const [evens, odds] = partitionArrayLike((n) => n % 2 === 0, set);

    expect(evens).toEqual([2, 4]);
    expect(odds).toEqual([1, 3, 5]);
  });
});

describe('partitionArrayLikeAsync', () => {
  test('splits array based on async predicate', async () => {
    const input = [1, 2, 3, 4, 5];
    const [evens, odds] = await partitionArrayLikeAsync(
      async (n) => n % 2 === 0,
      input,
    );

    expect(evens).toEqual([2, 4]);
    expect(odds).toEqual([1, 3, 5]);
  });

  test('works with empty arrays', async () => {
    const [yes, no] = await partitionArrayLikeAsync(async () => true, []);

    expect(yes).toEqual([]);
    expect(no).toEqual([]);
  });

  test('processes items in parallel', async () => {
    const input = [100, 200, 300];
    const startTime = Date.now();

    // Each predicate call takes 100ms, but total should be ~100ms, not 300ms
    const [yes, no] = await partitionArrayLikeAsync(async (n) => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return n > 150;
    }, input);

    const duration = Date.now() - startTime;

    expect(yes).toEqual([200, 300]);
    expect(no).toEqual([100]);
    expect(duration).toBeLessThan(200); // Allow some margin
  });

  test('works with async iterables', async () => {
    async function* generator() {
      yield 1;
      yield 2;
      yield 3;
    }

    const [evens, odds] = await partitionArrayLikeAsync(
      async (n) => n % 2 === 0,
      generator(),
    );

    expect(evens).toEqual([2]);
    expect(odds).toEqual([1, 3]);
  });

  test('handles errors in predicate', async () => {
    const input = [1, 2, 3];

    expect(
      partitionArrayLikeAsync(async (n) => {
        if (n === 2) { throw new Error('Test error'); }
        return n > 2;
      }, input),
    )
      .rejects
      .toThrow('Test error');
  });
});
