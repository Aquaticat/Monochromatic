import { partitionArrayLikeAsync } from './arrayLike.partition.ts';

import { configure } from '@logtape/logtape';
import {
  logtapeConfiguration,
  suite,
  test,
} from '@monochromatic-dev/module-es/ts';

import { assert } from './error.ts';

await configure(logtapeConfiguration());
/*
suite('partitionArrAsync (deprecated)', [
  suite('arr', [
    test('empty', async () => {
      expect(
        await partitionArrAsync(() => true, []),
      )
        .toStrictEqual(
          [[], []],
        );
    }),

    test('true', async () => {
      expect(
        await partitionArrAsync(() => true, [1]),
      )
        .toStrictEqual(
          [[1], []],
        );
    }),

    test('false', async () => {
      expect(
        await partitionArrAsync(() => false, [1]),
      )
        .toStrictEqual(
          [[], [1]],
        );
    }),

    test('mixed', async () => {
      expect(
        await partitionArrAsync(Boolean, [0, 1]),
      )
        .toStrictEqual(
          [[1], [0]],
        );
    }),
  ]),

  suite('generator', [
    test('empty', async () => {
      expect(
        await partitionArrAsync(() => true, (function*() {
          // intentionally left empty for testing
        })()),
      )
        .toStrictEqual(
          [[], []],
        );
    }),

    test('true', async () => {
      expect(
        await partitionArrAsync(
          () => true,
          (function*() {
            yield 1;
          })(),
        ),
      )
        .toStrictEqual(
          [[1], []],
        );
    }),

    test('false', async () => {
      expect(
        await partitionArrAsync(
          () => false,
          (function*() {
            yield 1;
          })(),
        ),
      )
        .toStrictEqual(
          [[], [1]],
        );
    }),

    test('mixed', async () => {
      expect(
        await partitionArrAsync(
          Boolean,
          (function*() {
            yield 0;
            yield 1;
          })(),
        ),
      )
        .toStrictEqual(
          [[1], [0]],
        );
    }),
  ]),

  suite('AsyncGenerator', [
    test('empty', async () => {
      expect(
        await partitionArrAsync(async () => true, (async function*() {
          // intentionally left empty for testing
        })()),
      )
        .toStrictEqual(
          [[], []],
        );
    }),

    test('true', async () => {
      expect(
        await partitionArrAsync(
          async () => true,
          (async function*() {
            yield 1;
          })(),
        ),
      )
        .toStrictEqual(
          [[1], []],
        );
    }),

    test('false', async () => {
      expect(
        await partitionArrAsync(
          async () => false,
          (async function*() {
            yield 1;
          })(),
        ),
      )
        .toStrictEqual(
          [[], [1]],
        );
    }),

    test('mixed', async () => {
      expect(
        await partitionArrAsync(
          async (i) => Boolean(i),
          (async function*() {
            yield 0;
            yield 1;
          })(),
        ),
      )
        .toStrictEqual(
          [[1], [0]],
        );
    }),
  ]),
]);
 */

suite('partitionArrayLikeAsync', [
  suite('arr', [
    test('empty', async () => {
      assert(
        [[], []],
        await partitionArrayLikeAsync(() => true, []),
      );
    }),

    test('true', async () => {
      assert(
        [[1], []],
        await partitionArrayLikeAsync(() => true, [1]),
      );
    }),

    test('false', async () => {
      assert(
        [[], [1]],
        await partitionArrayLikeAsync(() => false, [1]),
      );
    }),

    test('mixed', async () => {
      assert(
        [[1], [0]],
        await partitionArrayLikeAsync(Boolean, [0, 1]),
      );
    }),
  ]),

  suite('generator', [
    test('empty', async () => {
      assert(
        [[], []],
        await partitionArrayLikeAsync(() => true, (function*() {
          // intentionally left empty for testing
        })()),
      );
    }),

    test('true', async () => {
      assert(
        [[1], []],
        await partitionArrayLikeAsync(
          () => true,
          (function*() {
            yield 1;
          })(),
        ),
      );
    }),

    test('false', async () => {
      assert(
        [[], [1]],
        await partitionArrayLikeAsync(
          () => false,
          (function*() {
            yield 1;
          })(),
        ),
      );
    }),

    test('mixed', async () => {
      assert(
        [[1], [0]],
        await partitionArrayLikeAsync(
          Boolean,
          (function*() {
            yield 0;
            yield 1;
          })(),
        ),
      );
    }),
  ]),

  suite('AsyncGenerator', [
    test('empty', async () => {
      assert(
        [[], []],
        await partitionArrayLikeAsync(async () => true, (async function*() {
          // intentionally left empty for testing
        })()),
      );
    }),

    test('true', async () => {
      assert(
        [[1], []],
        await partitionArrayLikeAsync(
          async () => true,
          (async function*() {
            yield 1;
          })(),
        ),
      );
    }),

    test('false', async () => {
      assert(
        [[], [1]],
        await partitionArrayLikeAsync(
          async () => false,
          (async function*() {
            yield 1;
          })(),
        ),
      );
    }),

    test('mixed', async () => {
      assert(
        [[1], [0]],
        await partitionArrayLikeAsync(
          async (i) => Boolean(i),
          (async function*() {
            yield 0;
            yield 1;
          })(),
        ),
      );
    }),
  ]),
]);
