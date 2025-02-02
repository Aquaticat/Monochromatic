import { configure } from '@logtape/logtape';
import {
  type Expect,
  logtapeConfiguration,
  suite,
  test,
} from '@monochromatic-dev/module-util/ts';

import {
  concatArrayLikes,
  concatArrayLikesAsync,
} from './arrayLike.concat.ts';
import {
  assert,
  assertEmptyArray,
} from './error.ts';

await configure(logtapeConfiguration());

suite('concatAsync', [
  suite('Array', [
    test('two', async () => {
      assert([0, 1], await concatArrayLikesAsync([0], [1]));
    }),

    test('none', async () => {
      assertEmptyArray(await concatArrayLikesAsync());
    }),

    test('holey', async () => {
      assert([0, 2], await concatArrayLikesAsync([0], [], [2]));
    }),
  ]),

  suite('Iterable', [
    test('two', async () => {
      assert([0, 1], await concatArrayLikesAsync(
        (function*() {
          yield 0;
        })(),
        (function*() {
          yield 1;
        })(),
      ));
    }),

    test('empty', async () => {
      assertEmptyArray(await concatArrayLikesAsync(
        (function*() {
          // Intentionally left empty for testing.
        })(),
      ));
    }),

    test('holey', async () => {
      assert([0, 2], await concatArrayLikesAsync(
        (function*() {
          yield 0;
        })(),
        (function*() {
          // Intentionally left empty for testing.
        })(),
        (function*() {
          yield 2;
        })(),
      ));
    }),
  ]),

  suite('AsyncIterable', [
    test('two', async () => {
      assert([0, 1], await concatArrayLikesAsync(
        (async function*() {
          yield 0;
        })(),
        (async function*() {
          yield 1;
        })(),
      ));
    }),

    test('empty', async () => {
      assertEmptyArray(await concatArrayLikesAsync(
        (async function*() {
          // Intentionally left empty for testing.
        })(),
      ));
    }),

    test('holey', async () => {
      assert([0, 2], await concatArrayLikesAsync(
        (async function*() {
          yield 0;
        })(),
        (async function*() {
          // Intentionally left empty for testing.
        })(),
        (async function*() {
          yield 2;
        })(),
      ));
    }),
  ]),

  suite('mixed', [
    test('empty', async () => {
      assert([], await concatArrayLikesAsync(
        [],
        (function*() {})(),
        (async function*() {})(),
      ));
    }),

    test('1 2 3', async () => {
      assert([1, 2, 3], await concatArrayLikesAsync(
        [1],
        (function*() {
          yield 2;
        })(),
        (async function*() {
          yield 3;
        })(),
      ));
    }),
  ]),
]);

suite('concat', [
  suite('Array', [
    test('two', () => {
      assert([0, 1], concatArrayLikes([0], [1]));
    }),

    test('none', () => {
      assertEmptyArray(concatArrayLikes());
    }),

    test('holey', () => {
      assert([0, 2], concatArrayLikes([0], [], [2]));
    }),
  ]),

  suite('Iterable', [
    test('two', () => {
      assert([0, 1], concatArrayLikes(
        (function*() {
          yield 0;
        })(),
        (function*() {
          yield 1;
        })(),
      ));
    }),

    test('empty', () => {
      assertEmptyArray(concatArrayLikes(
        (function*() {
          // Intentionally left empty for testing.
        })(),
      ));
    }),

    test('holey', () => {
      assert([0, 2], concatArrayLikes(
        (function*() {
          yield 0;
        })(),
        (function*() {
          // Intentionally left empty for testing.
        })(),
        (function*() {
          yield 2;
        })(),
      ));
    }),
  ]),

  suite('mixed', [
    test('empty', () => {
      assert([], concatArrayLikes(
        [],
        (function*() {})(),
        (function*() {})(),
      ));
    }),

    test('1 2 3', () => {
      assert([1, 2, 3], concatArrayLikes(
        [1],
        (function*() {
          yield 2;
        })(),
        (function*() {
          yield 3;
        })(),
      ));
    }),
  ]),
]);
