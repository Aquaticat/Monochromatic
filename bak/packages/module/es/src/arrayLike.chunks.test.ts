import { configure } from '@logtape/logtape';
import {
  assert,
  assertAsync,
  assertThrowRangeError,
  assertThrowRangeErrorAsync,
  logtapeConfiguration,
  suite,
  test,
} from '@monochromatic-dev/module-es/ts';
import {
  chunksArray,
  chunksArrayLike,
  chunksArrayLikeAsync,
} from './arrayLike.chunks.ts';
import {
  arrayFrom,
  arrayFromAsync,
} from './arrayLike.from.ts';

await configure(logtapeConfiguration());

suite('chunksArray', [
  test('empty', () => {
    assertThrowRangeError(
      () => {
        // exhaust the generator
        arrayFrom(chunksArray(
          // Test: should error on the type level.
          // @ts-expect-error Argument of type '[]' is not assignable to parameter of type 'readonly [any, ...any[]]'.  Source has 0 element(s) but target requires 1.ts(2345)
          [],
          1,
        ));
      },
    );
  }),

  test('1', () => {
    assert(function*() {
      yield [1];
    }(), chunksArray([1], 1));
  }),

  test('2 1', () => {
    assert(function*() {
      yield [1];
      yield [2];
    }(), chunksArray([1, 2], 1));
  }),

  test('2 2', () => {
    assert(function*() {
      yield [1, 2];
    }(), chunksArray([1, 2], 2));
  }),

  test('out', () => {
    assertThrowRangeError(() => {
      arrayFrom(chunksArray(
        [1],
        // Test: should error on the type level.
        // @ts-expect-error Argument of type '2' is not assignable to parameter of type '1'.ts(2345)
        2,
      ));
    });
  }),
]);

suite('chunksArrayLike', [
  suite('array', [
    test('empty', () => {
      assertThrowRangeError(
        () => {
          arrayFrom(chunksArrayLike(
            // Due to TypeScript limitations,
            // this should error on the type level but the erroring behavior cannot be implemented.
            [],
            1,
          ));
        },
      );
    }),

    test('1', () => {
      assert(function*() {
        yield [1];
      }(), chunksArrayLike([1], 1));
    }),

    test('2 1', () => {
      assert(function*() {
        yield [1];
        yield [2];
      }(), chunksArrayLike([1, 2], 1));
    }),

    test('2 2', () => {
      assert(function*() {
        yield [1, 2];
      }(), chunksArrayLike([1, 2], 2));
    }),

    test('out', () => {
      assertThrowRangeError(() => {
        arrayFrom(chunksArrayLike(
          [1],
          // Due to TypeScript limitations,
          // this should error on the type level but the erroring behavior cannot be implemented.
          2,
        ));
      });
    }),
  ]),

  suite('iterable', [
    test('empty', () => {
      assertThrowRangeError(
        () => {
          arrayFrom(chunksArrayLike(
            (function*() {
              // Delibrately left empty for testing.
            })(),
            1,
          ));
        },
      );
    }),

    test('1', () => {
      assert(
        function*() {
          yield [1];
        }(),
        chunksArrayLike((function*() {
          yield 1;
        })(), 1),
      );
    }),

    test('2 1', () => {
      assert(
        function*() {
          yield [1];
          yield [2];
        }(),
        chunksArrayLike((function*() {
          yield 1;
          yield 2;
        })(), 1),
      );
    }),

    test('2 2', () => {
      assert(
        function*() {
          yield [1, 2];
        }(),
        chunksArrayLike((function*() {
          yield 1;
          yield 2;
        })(), 2),
      );
    }),

    test('out', () => {
      assertThrowRangeError(() => {
        arrayFrom(chunksArrayLike(
          (function*() {
            yield 1;
          })(),
          2,
        ));
      });
    }),
  ]),
]);

suite('chunksArrayLikeAsync', [
  suite('array', [
    test('empty', async () => {
      await assertThrowRangeErrorAsync(
        async () => {
          await arrayFromAsync(chunksArrayLikeAsync(
            // Due to TypeScript limitations,
            // this should error on the type level but the erroring behavior cannot be implemented.
            [],
            1,
          ));
        },
      );
    }),

    test('1', async () => {
      await assertAsync(async function*() {
        yield [1];
      }(), chunksArrayLikeAsync([1], 1));
    }),

    test('2 1', async () => {
      await assertAsync(async function*() {
        yield [1];
        yield [2];
      }(), chunksArrayLikeAsync([1, 2], 1));
    }),

    test('2 2', async () => {
      await assertAsync(async function*() {
        yield [1, 2];
      }(), chunksArrayLikeAsync([1, 2], 2));
    }),

    test('out', async () => {
      await assertThrowRangeErrorAsync(async () => {
        await arrayFromAsync(chunksArrayLikeAsync(
          [1],
          // Due to TypeScript limitations,
          // this should error on the type level but the erroring behavior cannot be implemented.
          2,
        ));
      });
    }),
  ]),

  suite('iterable', [
    test('empty', async () => {
      await assertThrowRangeErrorAsync(
        async () => {
          await arrayFromAsync(chunksArrayLikeAsync(
            (function*() {
              // Delibrately left empty for testing.
            })(),
            1,
          ));
        },
      );
    }),

    test('1', async () => {
      await assertAsync(async function*() {
        yield [1];
      }(), chunksArrayLikeAsync((async function*() {
        yield 1;
      })(), 1));
    }),

    test('2 1', async () => {
      await assertAsync(async function*() {
        yield [1];
        yield [2];
      }(), chunksArrayLikeAsync((async function*() {
        yield 1;
        yield 2;
      })(), 1));
    }),

    test('2 2', async () => {
      await assertAsync(async function*() {
        yield [1, 2];
      }(), chunksArrayLikeAsync((async function*() {
        yield 1;
        yield 2;
      })(), 2));
    }),

    test('out', async () => {
      await assertThrowRangeErrorAsync(async () => {
        await arrayFromAsync(chunksArrayLikeAsync(
          (async function*() {
            yield 1;
          })(),
          2,
        ));
      });
    }),
  ]),

  suite('AsyncIterable', [
    test('empty', async () => {
      await assertThrowRangeErrorAsync(
        async () => {
          await arrayFromAsync(chunksArrayLikeAsync(
            (async function*() {
              // Delibrately left empty for testing.
            })(),
            1,
          ));
        },
      );
    }),

    test('1', async () => {
      await assertAsync(
        async function*() {
          yield [1];
        }(),
        chunksArrayLikeAsync((async function*() {
          yield 1;
        })(), 1),
      );
    }),

    test('2 1', async () => {
      await assertAsync(
        async function*() {
          yield [1];
          yield [2];
        }(),
        chunksArrayLikeAsync((async function*() {
          yield 1;
          yield 2;
        })(), 1),
      );
    }),

    test('2 2', async () => {
      await assertAsync(
        async function*() {
          yield [1, 2];
        }(),
        chunksArrayLikeAsync((async function*() {
          yield 1;
          yield 2;
        })(), 2),
      );
    }),

    test('out', async () => {
      await assertThrowRangeErrorAsync(
        async () => {
          await arrayFromAsync(chunksArrayLikeAsync(
            (async function*() {
              yield 1;
            })(),
            2,
          ));
        },
      );
    }),
  ]),
]);
