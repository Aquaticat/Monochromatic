/**
 * Tests for `stringOrThrow`.
 *
 * @module
 */

import {
  describe,
  expect,
  expectTypeOf,
  it,
} from '@monochromatic-dev/module-test';

import { stringOrThrow, } from './string-or-throw.ts';

await describe({
  name: stringOrThrow.name,
  children: [
    it({
      name: 'returns primitive strings unchanged',
      fn: async () => {
        expect(stringOrThrow('hello',),).toBe('hello',);
        expect(stringOrThrow('',),).toBe('',);
      },
    },),

    it({
      name: 'throws on non-string values',
      fn: async () => {
        expect(() => stringOrThrow(42,),).toThrow(/string/,);
        expect(() => stringOrThrow(true,),).toThrow(/string/,);
        expect(() => stringOrThrow(1n,),).toThrow(/string/,);
        expect(() => stringOrThrow(Symbol('s',),),).toThrow(/string/,);
        expect(() => stringOrThrow(null,),).toThrow(/string/,);
        expect(() => stringOrThrow(undefined,),).toThrow(/string/,);
        expect(() => stringOrThrow({},),).toThrow(/string/,);
        expect(() => stringOrThrow([],),).toThrow(/string/,);
      },
    },),

    it({
      name: 'narrows unknown to string',
      fn: async () => {
        const input: unknown = 'hello';
        const output = stringOrThrow(input,);
        expectTypeOf(output,).toEqualTypeOf<string>();
      },
    },),

    it({
      name: 'narrows union to string branch',
      fn: async () => {
        const input: string | number = 'hello';
        const output = stringOrThrow(input,);
        expectTypeOf(output,).toEqualTypeOf<string>();
      },
    },),
  ],
},);
