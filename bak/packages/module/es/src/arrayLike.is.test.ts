import {
  isArray,
  isAsyncIterable,
  isIterable,
  isMaybeAsyncIterable,
} from './arrayLike.is.ts';

import { configure } from '@logtape/logtape';
import {
  logtapeConfiguration,
  suite,
  test,
} from '@monochromatic-dev/module-es/ts';
import {
  assertFalse,
  assertTrue,
} from './error.assert.equal.ts';

await configure(logtapeConfiguration());

suite('isArray', [
  test('Array', () => {
    assertTrue(isArray([]));
  }),

  test('string - false', () => {
    assertTrue(isIterable(''));
  }),

  test('Iterable - false', () => {
    assertFalse(isIterable((function*() {
      // Intentionally left empty for testing.
    })()));
  }),

  test('AsyncIterable - false', () => {
    assertFalse(isIterable((async function*() {
      // Intentionally left empty for testing.
    })()));
  }),
], { skip: 'is an alias of the builtin Array.isArray, no point testing this.' });

suite('isIterable', [
  test('Array', () => {
    assertTrue(isIterable([]));
  }),

  test('string', () => {
    assertTrue(isIterable(''));
  }),

  test('Iterable', () => {
    assertTrue(isIterable((function*() {
      // Intentionally left empty for testing.
    })()));
  }),

  test('AsyncIterable - false', () => {
    assertFalse(isIterable((async function*() {
      // Intentionally left empty for testing.
    })()));
  }),
]);

suite('isAsyncIterable', [
  test('Array - false', () => {
    assertFalse(isAsyncIterable([]));
  }),

  test('string - false', () => {
    assertFalse(isAsyncIterable(''));
  }),

  test('Iterable - false', () => {
    assertFalse(isAsyncIterable((function*() {
      // Intentionally left empty for testing.
    })()));
  }),

  test('AsyncIterable', () => {
    assertTrue(isAsyncIterable((async function*() {
      // Intentionally left empty for testing.
    })()));
  }),
]);

suite('isMaybeAsyncIterable', [
  test('Array', () => {
    assertTrue(isMaybeAsyncIterable([]));
  }),

  test('string', () => {
    assertTrue(isMaybeAsyncIterable(''));
  }),

  test('Iterable', () => {
    assertTrue(isMaybeAsyncIterable((function*() {
      // Intentionally left empty for testing.
    })()));
  }),

  test('AsyncIterable', () => {
    assertTrue(isMaybeAsyncIterable((async function*() {
      // Intentionally left empty for testing.
    })()));
  }),
]);
