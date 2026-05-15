/**
 * Tests for `symbolOrThrow`.
 *
 * @module
 */

import {
  describe,
  expect,
  expectTypeOf,
  it,
} from '@monochromatic-dev/module-test';

import { symbolOrThrow, } from './symbol-or-throw.ts';

await describe({
  name: symbolOrThrow.name,
  children: [
    it({
      name: 'returns symbols unchanged',
      fn: async () => {
        const s = Symbol('test',);
        expect(symbolOrThrow(s,),).toBe(s,);
        const registered = Symbol.for('shared',);
        expect(symbolOrThrow(registered,),).toBe(registered,);
      },
    },),

    it({
      name: 'throws on non-symbol values',
      fn: async () => {
        expect(() => symbolOrThrow('sym',)).toThrow(/symbol/,);
        expect(() => symbolOrThrow(0,)).toThrow(/symbol/,);
        expect(() => symbolOrThrow(null,)).toThrow(/symbol/,);
        expect(() => symbolOrThrow(undefined,)).toThrow(/symbol/,);
        expect(() => symbolOrThrow({},)).toThrow(/symbol/,);
      },
    },),

    it({
      name: 'narrows unknown to symbol',
      fn: async () => {
        const input: unknown = Symbol('x',);
        const output = symbolOrThrow(input,);
        expectTypeOf(output,).toEqualTypeOf<symbol>();
      },
    },),
  ],
},);
