import { configure } from '@logtape/logtape';
import {
  logtapeConfiguration,
  suite,
  test,
} from '@monochromatic-dev/module-util/ts';
import {
  assertFalse,
  assertTrue,
} from './error.assert.equal.ts';
import { somePromises } from './promise.some.ts';
import type { NotPromise } from './promise.ts';

await configure(logtapeConfiguration());

// TODO: Add time limits.

suite('array', [
  suite('sync callback', [
    test('first', async () => {
      assertTrue(
        await somePromises((input: NotPromise): boolean => typeof input === 'number', [
          (async () => 1)(),
          (async () => '')(),
        ]),
      );
    }),

    test('second', async () => {
      assertTrue(
        await somePromises((input: NotPromise): boolean => typeof input === 'number', [
          (async () => '')(),
          (async () => 2)(),
        ]),
      );
    }),

    test('none - false', async () => {
      assertFalse(
        await somePromises((input: NotPromise): boolean => typeof input === 'number', [
          (async () => '')(),
          (async () => ({}))(),
        ]),
      );
    }),
  ]),
]);
