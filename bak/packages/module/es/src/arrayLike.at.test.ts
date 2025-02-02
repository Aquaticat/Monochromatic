import {
  atArrayLike,
  atArrayLikeAsync,
} from './arrayLike.at.ts';

import { configure } from '@logtape/logtape';
import {
  type Equal,
  type Expect,
  logtapeConfiguration,
  type NotEqual,
  suite,
  test,
} from '@monochromatic-dev/module-es/ts';
import {
  type Assert1,
  assert1,
  type AssertUndefined,
  assertUndefined,
} from './error.ts';

await configure(logtapeConfiguration());

suite('atArrayLikeAsync', [
  suite('Array', [
    test('empty', async () => {
      const at0OfEmptyArray = await atArrayLikeAsync(0, []);
      type _ = AssertUndefined<typeof at0OfEmptyArray>;
      assertUndefined(at0OfEmptyArray);
    }),

    test('out', async () => {
      const at1Of0 = await atArrayLikeAsync(1, [0]);
      type _ = AssertUndefined<typeof at1Of0>;
      assertUndefined(at1Of0);
    }),

    test('one', async () => {
      const at0Of1 = await atArrayLikeAsync(0, [1]);
      type _ = Assert1<typeof at0Of1>;
      assert1(at0Of1);
    }),

    test('neg', async () => {
      const atNeg1Of1 = await atArrayLikeAsync(-1, [1]);
      type _ = Assert1<typeof atNeg1Of1>;
      assert1(atNeg1Of1);
    }),

    test('neg-out', async () => {
      // MAYBE: Shouldn't accept -2 in the first place!
      const atNeg2Of1 = await atArrayLikeAsync(-2, [1]);
      // @ts-expect-error TypeScript limitations?
      type _ = AssertUndefined<typeof atNeg2Of1>;
      assertUndefined(atNeg2Of1);
    }),
  ]),

  suite('Iterable', [
    test('empty', async () => {
      assertUndefined(await atArrayLikeAsync(0, (function*() {
        /* Intentionally left empty for testing. */
      })()));
    }),

    test('out', async () => {
      assertUndefined(await atArrayLikeAsync(1, (function*() {
        yield 0;
      })()));
    }),

    test('one', async () => {
      assert1(await atArrayLikeAsync(0, (function*() {
        yield 1;
      })()));
    }),

    test('neg', async () => {
      assert1(await atArrayLikeAsync(-1, (function*() {
        yield 1;
      })()));
    }),

    test('neg-out', async () => {
      assertUndefined(await atArrayLikeAsync(-2, (function*() {
        yield 1;
      })()));
    }),
  ]),

  suite('AsyncIterable', [
    test('empty', async () => {
      assertUndefined(await atArrayLikeAsync(0, (async function*() {
        /* Intentionally left empty for testing. */
      })()));
    }),

    test('out', async () => {
      assertUndefined(await atArrayLikeAsync(1, (async function*() {
        yield 0;
      })()));
    }),

    test('one', async () => {
      assert1(await atArrayLikeAsync(0, (async function*() {
        yield 1;
      })()));
    }),

    test('neg', async () => {
      assert1(await atArrayLikeAsync(-1, (async function*() {
        yield 1;
      })()));
    }),

    test('neg-out', async () => {
      assertUndefined(await atArrayLikeAsync(-2, (async function*() {
        yield 1;
      })()));
    }),
  ]),
]);

suite('atArrayLike', [
  suite('Array', [
    test('empty', () => {
      assertUndefined(atArrayLike(0, []));
    }),

    test('out', () => {
      assertUndefined(atArrayLike(1, [0]));
    }),

    test('one', () => {
      assert1(atArrayLike(0, [1]));
    }),

    test('neg', () => {
      assert1(atArrayLike(-1, [1]));
    }),

    test('neg-out', () => {
      assertUndefined(atArrayLike(-2, [1]));
    }),
  ]),

  suite('Iterable', [
    test('empty', () => {
      assertUndefined(atArrayLike(0, (function*() {
        /* Intentionally left empty for testing. */
      })()));
    }),

    test('out', () => {
      assertUndefined(atArrayLike(1, (function*() {
        yield 0;
      })()));
    }),

    test('one', () => {
      assert1(atArrayLike(0, (function*() {
        yield 1;
      })()));
    }),

    test('neg', () => {
      assert1(atArrayLike(-1, (function*() {
        yield 1;
      })()));
    }),

    test('neg-out', () => {
      assertUndefined(atArrayLike(-2, (function*() {
        yield 1;
      })()));
    }),
  ]),
]);
