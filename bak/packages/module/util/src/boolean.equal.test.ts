// DONE: Switch expect to my own assertion min-sub lib for less noise in generated files.
//       Except this file, testing equal, therefore assert itself.
// MAYBE: Do we really need to exclude this file itself?
//        All the compares are either true or false or throw TypeError anyway.
import { expect } from '@std/expect';
import { equal } from './boolean.equal.ts';

import { configure } from '@logtape/logtape';
import {
  logtapeConfiguration,
  suite,
  test,
} from '@monochromatic-dev/module-util/ts';

await configure(logtapeConfiguration());

suite('equal', [
  suite('primitive', [
    test('number', () => {
      expect(equal(0, 0)).toStrictEqual(true);
    }),
    test('string', () => {
      expect(equal('1', '1')).toStrictEqual(true);
    }),
    test('undefined', () => {
      expect(equal(undefined, undefined)).toStrictEqual(true);
    }),
    test('NaN', () => {
      expect(equal(Number.NaN, Number.NaN)).toStrictEqual(true);
    }),
    test('bigint', () => {
      expect(equal(1n, 1n)).toStrictEqual(true);
    }),
    test('BigInt', () => {
      expect(equal(BigInt(1), BigInt(1))).toStrictEqual(true);
    }),
  ]),

  suite('object', [
    suite('Object', [
      test('empty', () => {
        expect(equal({}, {})).toStrictEqual(true);
      }),
      test('one', () => {
        expect(equal({ a: 0 }, { a: 0 })).toStrictEqual(true);
      }),
      test('unordered', () => {
        expect(equal({ a: 0, b: 1 }, { b: 1, a: 0 })).toStrictEqual(true);
      }),
      test('hasArray', () => {
        expect(equal({ a: [0, { c: [] }], b: 1 }, { a: [0, { c: [] }], b: 1 }))
          .toStrictEqual(true);
      }),
    ]),

    suite('Array', [
      test('empty', () => {
        expect(equal([], [])).toStrictEqual(true);
      }),
      test('one', () => {
        expect(equal([0], [0])).toStrictEqual(true);
      }),
      test('2d', () => {
        expect(equal([[], [0]], [[], [0]])).toStrictEqual(true);
      }),
      test('hasObject', () => {
        expect(equal([{ c: [] }, [0]], [{ c: [] }, [0]])).toStrictEqual(true);
      }),
      test('wrong order - false', () => {
        expect(equal([[], [0]], [[0], []])).toStrictEqual(false);
      }),
    ]),

    suite('Unhandled', [
      test('WeakMap', () => {
        expect(() => equal(new WeakMap(), new WeakMap())).toThrow(TypeError);
      }),
    ]),
  ]),
]);
