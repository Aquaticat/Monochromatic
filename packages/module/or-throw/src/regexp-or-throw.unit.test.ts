/**
 * Tests for `regExpOrThrow`.
 *
 * @module
 */

import {
  describe,
  expect,
  expectTypeOf,
  it,
} from '@monochromatic-dev/module-test';

import { regExpOrThrow, } from './regexp-or-throw.ts';

await describe({
  name: regExpOrThrow.name,
  children: [
    it({
      name: 'returns RegExp instances unchanged',
      fn: async () => {
        const re = /abc/;
        expect(regExpOrThrow(re,),).toBe(re,);
        const ctor = new RegExp('xyz',);
        expect(regExpOrThrow(ctor,),).toBe(ctor,);
      },
    },),

    it({
      name: 'throws on non-RegExp values',
      fn: async () => {
        expect(() => regExpOrThrow('abc',),).toThrow(/RegExp/,);
        expect(() =>
          regExpOrThrow({
            test() {
              return true;
            },
          },),).toThrow(/RegExp/,);
        expect(() => regExpOrThrow(null,),).toThrow(/RegExp/,);
        expect(() => regExpOrThrow(undefined,),).toThrow(/RegExp/,);
      },
    },),

    it({
      name: 'narrows unknown to RegExp',
      fn: async () => {
        const input: unknown = /abc/;
        const output = regExpOrThrow(input,);
        expectTypeOf(output,).toEqualTypeOf<RegExp>();
      },
    },),
  ],
},);
