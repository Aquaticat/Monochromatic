import {
  entriesArrayLike,
  entriesArrayLikeAsync,
} from './arrayLike.entries.ts';

import { configure } from '@logtape/logtape';
import {
  logtapeConfiguration,
  suite,
  test,
} from '@monochromatic-dev/module-util/ts';
import {
  assert,
  assertEmptyArray,
} from './error.ts';

await configure(logtapeConfiguration());

suite('entriesArrayLikeAsync', [
  suite('Array', [
    test('empty', async () => {
      const entries: [number, unknown][] = [];
      for await (const entry of entriesArrayLikeAsync([])) {
        entries.push(entry);
      }
      assertEmptyArray(entries);
    }),

    test('one', async () => {
      const entries: [number, number][] = [];
      for await (const entry of entriesArrayLikeAsync([1])) {
        entries.push(entry);
      }
      assert([[0, 1]], entries);
    }),

    test('holey', async () => {
      const entries: [number, number | undefined][] = [];

      // biome-ignore lint/suspicious/noSparseArray: intentionally created holey Array for testing.
      for await (const entry of entriesArrayLikeAsync([1, , 2])) {
        entries.push(entry);
      }
      assert([[0, 1], [1, undefined], [2, 2]], entries);
    }),
  ]),

  suite('Iterable', [
    test('empty', async () => {
      const entries: [number, unknown][] = [];
      for await (
        const entry of entriesArrayLikeAsync(
          (function*() {
            /* Intentionally left empty for testing. */
          })(),
        )
      ) {
        entries.push(entry);
      }
      assertEmptyArray(entries);
    }),

    test('one', async () => {
      const entries: [number, number][] = [];
      for await (
        const entry of entriesArrayLikeAsync((function*() {
          yield 1;
        })())
      ) {
        entries.push(entry);
      }
      assert([[0, 1]], entries);
    }),

    test('two', async () => {
      const entries: [number, number | undefined][] = [];

      for await (
        const entry of entriesArrayLikeAsync((function*() {
          yield 1;
          yield 2;
        })())
      ) {
        entries.push(entry);
      }
      assert([[0, 1], [1, 2]], entries);
    }),
  ]),

  suite('AsyncIterable', [
    test('empty', async () => {
      const entries: [number, unknown][] = [];
      for await (
        const entry of entriesArrayLikeAsync(
          (async function*() {
            /* Intentionally left empty for testing. */
          })(),
        )
      ) {
        entries.push(entry);
      }
      assertEmptyArray(entries);
    }),

    test('one', async () => {
      const entries: [number, number][] = [];
      for await (
        const entry of entriesArrayLikeAsync((async function*() {
          yield 1;
        })())
      ) {
        entries.push(entry);
      }
      assert([[0, 1]], entries);
    }),

    test('two', async () => {
      const entries: [number, number | undefined][] = [];

      for await (
        const entry of entriesArrayLikeAsync((async function*() {
          yield 1;
          yield 2;
        })())
      ) {
        entries.push(entry);
      }
      assert([[0, 1], [1, 2]], entries);
    }),
  ]),
]);

suite('entriesArrayLike', [
  suite('Array', [
    test('empty', async () => {
      const entries: [number, unknown][] = [];
      for await (const entry of entriesArrayLike([])) {
        entries.push(entry);
      }
      assertEmptyArray(entries);
    }),

    test('one', async () => {
      const entries: [number, number][] = [];
      for await (const entry of entriesArrayLike([1])) {
        entries.push(entry);
      }
      assert([[0, 1]], entries);
    }),

    test('holey', async () => {
      const entries: [number, number | undefined][] = [];

      // biome-ignore lint/suspicious/noSparseArray: intentionally created holey Array for testing.
      for await (const entry of entriesArrayLike([1, , 2])) {
        entries.push(entry);
      }
      assert([[0, 1], [1, undefined], [2, 2]], entries);
    }),
  ]),

  suite('Iterable', [
    test('empty', async () => {
      const entries: [number, unknown][] = [];
      for await (
        const entry of entriesArrayLike(
          (function*() {
            /* Intentionally left empty for testing. */
          })(),
        )
      ) {
        entries.push(entry);
      }
      assertEmptyArray(entries);
    }),

    test('one', async () => {
      const entries: [number, number][] = [];
      for await (
        const entry of entriesArrayLike((function*() {
          yield 1;
        })())
      ) {
        entries.push(entry);
      }
      assert([[0, 1]], entries);
    }),

    test('two', async () => {
      const entries: [number, number | undefined][] = [];

      for await (
        const entry of entriesArrayLike((function*() {
          yield 1;
          yield 2;
        })())
      ) {
        entries.push(entry);
      }
      assert([[0, 1], [1, 2]], entries);
    }),
  ]),
]);
