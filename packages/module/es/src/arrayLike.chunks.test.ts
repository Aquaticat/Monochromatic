import {
  logtapeConfiguration,
  logtapeConfigure,
} from '@monochromatic-dev/module-es/ts';
import {
  describe,
  expect,
  test,
} from 'bun:test';
import {
  chunksArray,
  chunksArrayLike,
  chunksArrayLikeAsync,
} from './arrayLike.chunks.ts';

await logtapeConfigure(await logtapeConfiguration());

describe('chunksArray', () => {
  test('chunks an array into equal parts', () => {
    const array = [1, 2, 3, 4, 5, 6] as const;
    const chunker = chunksArray(array, 2);

    expect([...chunker]).toEqual([[1, 2], [3, 4], [5, 6]]);
  });

  test('handles uneven chunks correctly', () => {
    const array = [1, 2, 3, 4, 5] as const;
    const chunker = chunksArray(array, 2);

    expect([...chunker]).toEqual([[1, 2], [3, 4], [5]]);
  });

  test('works with chunk size of 1', () => {
    const array = [1, 2, 3] as const;
    const chunker = chunksArray(array, 1);

    expect([...chunker]).toEqual([[1], [2], [3]]);
  });

  test('works when chunk size equals array length', () => {
    const array = [1, 2, 3] as const;
    const chunker = chunksArray(array, 3);

    expect([...chunker]).toEqual([[1, 2, 3]]);
  });

  test('throws when array is empty', () => {
    expect(() => {
      // @ts-expect-error: Testing runtime error with empty array
      const _chunks = [...chunksArray([], 1)];
    })
      .toThrow(RangeError);
  });

  test('throws when chunk size is larger than array', () => {
    expect(() => {
      // @ts-expect-error: Testing runtime error with oversized chunk
      const _chunks = [...chunksArray([1, 2, 3], 4)];
    })
      .toThrow(RangeError);
  });
});

describe('chunksArrayLike', () => {
  test('works with array-like objects', () => {
    const arrayLike = {
      0: 'a',
      1: 'b',
      2: 'c',
      3: 'd',
      length: 4,
      [Symbol.iterator]: function*() {
        for (let i = 0; i < this.length; i++) {
          yield this[i];
        }
      },
    };

    const chunker = chunksArrayLike(arrayLike, 2);
    expect([...chunker]).toEqual([['a', 'b'], ['c', 'd']]);
  });

  test('works with Set objects', () => {
    const set = new Set([1, 2, 3, 4]);
    const chunker = chunksArrayLike(set, 2);

    expect([...chunker]).toEqual([[1, 2], [3, 4]]);
  });

  test('works with Map.keys()', () => {
    const map = new Map([['a', 1], ['b', 2], ['c', 3], ['d', 4]]);
    const chunker = chunksArrayLike(map.keys(), 2);

    expect([...chunker]).toEqual([['a', 'b'], ['c', 'd']]);
  });

  test('throws when iterable is empty', () => {
    expect(() => {
      const _chunks = [...chunksArrayLike(new Set(), 1)];
    })
      .toThrow(RangeError);
  });

  test('throws when chunk size is larger than iterable length', () => {
    const arrayLike = {
      0: 'a',
      1: 'b',
      length: 2,
      [Symbol.iterator]: function*() {
        for (let i = 0; i < this.length; i++) {
          yield this[i];
        }
      },
    };

    expect(() => {
      const _chunks = [...chunksArrayLike(arrayLike, 3)];
    })
      .toThrow(RangeError);
  });
});

describe('chunksArrayLikeAsync', () => {
  test('works with async iterables', async () => {
    const asyncIterable = {
      async *[Symbol.asyncIterator]() {
        yield 1;
        yield 2;
        yield 3;
        yield 4;
      },
      length: 4,
    };

    const chunker = chunksArrayLikeAsync(asyncIterable, 2);
    const result: any[] = [];

    for await (const chunk of chunker) {
      result.push(chunk);
    }

    expect(result).toEqual([[1, 2], [3, 4]]);
  });

  test('works with regular iterables', async () => {
    const iterable = {
      *[Symbol.iterator]() {
        yield 1;
        yield 2;
        yield 3;
        yield 4;
        yield 5;
      },
      length: 5,
    };

    const chunker = chunksArrayLikeAsync(iterable, 2);
    const result: any[] = [];

    for await (const chunk of chunker) {
      result.push(chunk);
    }

    expect(result).toEqual([[1, 2], [3, 4], [5]]);
  });

  test('throws when async iterable is empty', async () => {
    const emptyAsync = {
      async *[Symbol.asyncIterator]() {
        // No values to yield
      },
      length: 0,
    };

    expect(async () => {
      const chunker = chunksArrayLikeAsync(emptyAsync, 1);
      await chunker.next();
    })
      .toThrow(RangeError);
  });

  test('throws when chunk size is larger than async iterable length', async () => {
    const asyncIterable = {
      async *[Symbol.asyncIterator]() {
        yield 1;
        yield 2;
      },
      length: 2,
    };

    expect(async () => {
      const chunker = chunksArrayLikeAsync(asyncIterable, 3);
      await chunker.next();
    })
      .toThrow(RangeError);
  });

  test('works with different types of values', async () => {
    const asyncIterable = {
      async *[Symbol.asyncIterator]() {
        yield 'a';
        yield 2;
        yield true;
        yield { key: 'value' };
      },
      length: 4,
    };

    const chunker = chunksArrayLikeAsync(asyncIterable, 2);
    const result: any[] = [];

    for await (const chunk of chunker) {
      result.push(chunk);
    }

    expect(result).toEqual([['a', 2], [true, { key: 'value' }]]);
  });
});
